import { AgentProvider } from '../types';
import {
  TOOL_DEFS, SUBMIT_TOOL_NAME, READ_FILE_TOOL_NAME, SYSTEM_INSTRUCTION,
  buildUserPrompt, executeReadFile, parseSubmitArgs,
  MAX_TOOL_ITERATIONS, RATE_LIMIT_RETRY_DELAYS_MS, sleep,
} from '../tools';

const ANTHROPIC_VERSION = '2023-06-01';

const ANTHROPIC_TOOLS = TOOL_DEFS.map(t => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters,
}));

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: string };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

async function callMessages(
  apiKey: string,
  model: string,
  messages: AnthropicMessage[],
  forceSubmit: boolean,
  onEvent: (log: string) => void
): Promise<ContentBlock[]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        temperature: 0.15,
        system: SYSTEM_INSTRUCTION,
        messages,
        tools: ANTHROPIC_TOOLS,
        tool_choice: forceSubmit ? { type: 'tool', name: SUBMIT_TOOL_NAME } : { type: 'auto' },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.content as ContentBlock[] | undefined;
      if (!content) throw new Error(`Anthropic API returned no content: ${JSON.stringify(data).slice(0, 300)}`);
      return content;
    }

    const body = await res.text().catch(() => '');
    if (res.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      const delayMs = RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      onEvent(`Rate limited by the Anthropic API — waiting ${delayMs / 1000}s before retrying (attempt ${attempt + 1}/${RATE_LIMIT_RETRY_DELAYS_MS.length})...`);
      await sleep(delayMs);
      continue;
    }
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
  }
}

export const runAnthropicAgent: AgentProvider = async (ctx) => {
  const { apiKey, model, owner, repo, branch, relevantPaths, onEvent } = ctx;

  const messages: AnthropicMessage[] = [
    { role: 'user', content: buildUserPrompt(owner, repo, branch, relevantPaths) },
  ];

  let toolCallCount = 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const forceSubmit = iteration === MAX_TOOL_ITERATIONS - 1;
    const content = await callMessages(apiKey, model, messages, forceSubmit, onEvent);
    messages.push({ role: 'assistant', content });

    const toolUses = content.filter(
      (b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use'
    );
    if (toolUses.length === 0) {
      messages.push({ role: 'user', content: 'Please continue by calling read_file or submit_analysis.' });
      continue;
    }

    const resultBlocks: ContentBlock[] = [];
    for (const call of toolUses) {
      toolCallCount++;

      if (call.name === SUBMIT_TOOL_NAME) {
        return parseSubmitArgs(call.input, toolCallCount, onEvent);
      }

      if (call.name === READ_FILE_TOOL_NAME) {
        const { result, error } = await executeReadFile(call.input.path, relevantPaths, owner, repo, branch, onEvent);
        resultBlocks.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(error ? { error } : result) });
        continue;
      }

      resultBlocks.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify({ error: `Unknown tool: ${call.name}` }) });
    }

    messages.push({ role: 'user', content: resultBlocks });
  }

  throw new Error(`Agent did not submit an analysis within ${MAX_TOOL_ITERATIONS} tool-call iterations`);
};
