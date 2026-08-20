import { AgentProvider } from '../types';
import {
  TOOL_DEFS, SUBMIT_TOOL_NAME, READ_FILE_TOOL_NAME, SYSTEM_INSTRUCTION,
  buildUserPrompt, executeReadFile, parseSubmitArgs, toGeminiSchema,
  MAX_TOOL_ITERATIONS, RATE_LIMIT_RETRY_DELAYS_MS, sleep,
} from '../tools';

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, any> };
  functionResponse?: { name: string; response: Record<string, any> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

const GEMINI_TOOLS = [{
  functionDeclarations: TOOL_DEFS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: toGeminiSchema(t.parameters),
  })),
}];

// The agent loop can fire up to MAX_TOOL_ITERATIONS sequential calls for a
// single audit — comfortably enough to blow through a free-tier per-minute
// quota on any real repo. A 429 here is almost always transient, so retry
// with backoff before giving up.
async function callGemini(
  apiKey: string,
  model: string,
  contents: GeminiContent[],
  forceSubmit: boolean,
  onEvent: (log: string) => void
): Promise<GeminiContent> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          tools: GEMINI_TOOLS,
          toolConfig: forceSubmit
            ? { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [SUBMIT_TOOL_NAME] } }
            : { functionCallingConfig: { mode: 'AUTO' } },
          generationConfig: { temperature: 0.15, maxOutputTokens: 8192 },
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error(`Gemini API returned no candidates: ${JSON.stringify(data).slice(0, 300)}`);
      }
      return candidate.content as GeminiContent;
    }

    const body = await res.text().catch(() => '');

    if (res.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      const delayMs = RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      onEvent(`Rate limited by the Gemini API — waiting ${delayMs / 1000}s before retrying (attempt ${attempt + 1}/${RATE_LIMIT_RETRY_DELAYS_MS.length})...`);
      await sleep(delayMs);
      continue;
    }

    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }
}

export const runGeminiAgent: AgentProvider = async (ctx) => {
  const { apiKey, model, owner, repo, branch, relevantPaths, onEvent } = ctx;

  const contents: GeminiContent[] = [
    { role: 'user', parts: [{ text: buildUserPrompt(owner, repo, branch, relevantPaths) }] },
  ];

  let toolCallCount = 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const forceSubmit = iteration === MAX_TOOL_ITERATIONS - 1;
    const modelTurn = await callGemini(apiKey, model, contents, forceSubmit, onEvent);
    contents.push(modelTurn);

    const functionCalls = modelTurn.parts.filter(p => p.functionCall).map(p => p.functionCall!);
    if (functionCalls.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Please continue by calling read_file or submit_analysis.' }] });
      continue;
    }

    const responseParts: GeminiPart[] = [];
    for (const call of functionCalls) {
      toolCallCount++;

      if (call.name === SUBMIT_TOOL_NAME) {
        return parseSubmitArgs(call.args, toolCallCount, onEvent);
      }

      if (call.name === READ_FILE_TOOL_NAME) {
        const { result, error } = await executeReadFile(call.args.path as string, relevantPaths, owner, repo, branch, onEvent);
        responseParts.push({ functionResponse: { name: call.name, response: error ? { error } : (result as any) } });
        continue;
      }

      responseParts.push({ functionResponse: { name: call.name, response: { error: `Unknown tool: ${call.name}` } } });
    }

    contents.push({ role: 'user', parts: responseParts });
  }

  throw new Error(`Agent did not submit an analysis within ${MAX_TOOL_ITERATIONS} tool-call iterations`);
};
