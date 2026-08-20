// Shared implementation for any provider that speaks OpenAI's chat
// completions wire format — OpenAI itself and OpenRouter (which proxies to
// dozens of models behind the same request/response shape). A future
// OpenAI-compatible provider (Groq, Mistral, ...) is a ~10-line config
// wrapper around this file, the same way providers/openai.ts and
// providers/openrouter.ts already are — see either for the pattern.

import { AgentRunContext, AgenticAnalysisResult } from '../types';
import {
  TOOL_DEFS, SUBMIT_TOOL_NAME, READ_FILE_TOOL_NAME, SYSTEM_INSTRUCTION,
  buildUserPrompt, executeReadFile, parseSubmitArgs,
  MAX_TOOL_ITERATIONS, RATE_LIMIT_RETRY_DELAYS_MS, sleep,
} from '../tools';

interface OAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: OAIToolCall[];
  tool_call_id?: string;
}

const OAI_TOOLS = TOOL_DEFS.map(t => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  /** Used only in error/log messages, e.g. "OpenAI" or "OpenRouter". */
  providerLabel: string;
  extraHeaders?: Record<string, string>;
}

async function callChatCompletions(
  cfg: OpenAICompatibleConfig,
  model: string,
  messages: OAIMessage[],
  forceSubmit: boolean,
  onEvent: (log: string) => void
): Promise<OAIMessage> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
        ...cfg.extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: OAI_TOOLS,
        tool_choice: forceSubmit ? { type: 'function', function: { name: SUBMIT_TOOL_NAME } } : 'auto',
        temperature: 0.15,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const message = data.choices?.[0]?.message;
      if (!message) throw new Error(`${cfg.providerLabel} API returned no message: ${JSON.stringify(data).slice(0, 300)}`);
      return message as OAIMessage;
    }

    const body = await res.text().catch(() => '');
    if (res.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      const delayMs = RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      onEvent(`Rate limited by the ${cfg.providerLabel} API — waiting ${delayMs / 1000}s before retrying (attempt ${attempt + 1}/${RATE_LIMIT_RETRY_DELAYS_MS.length})...`);
      await sleep(delayMs);
      continue;
    }
    throw new Error(`${cfg.providerLabel} API error ${res.status}: ${body.slice(0, 300)}`);
  }
}

export async function runOpenAICompatibleAgent(cfg: OpenAICompatibleConfig, ctx: AgentRunContext): Promise<AgenticAnalysisResult> {
  const { model, owner, repo, branch, relevantPaths, onEvent } = ctx;

  const messages: OAIMessage[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    { role: 'user', content: buildUserPrompt(owner, repo, branch, relevantPaths) },
  ];

  let toolCallCount = 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const forceSubmit = iteration === MAX_TOOL_ITERATIONS - 1;
    const message = await callChatCompletions(cfg, model, messages, forceSubmit, onEvent);
    messages.push(message);

    const toolCalls = message.tool_calls || [];
    if (toolCalls.length === 0) {
      messages.push({ role: 'user', content: 'Please continue by calling read_file or submit_analysis.' });
      continue;
    }

    for (const call of toolCalls) {
      toolCallCount++;
      let args: any = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        // Malformed args fall through as {} — resolveFilePath/parseSubmitArgs
        // handle missing fields the same way a genuinely empty call would.
      }

      if (call.function.name === SUBMIT_TOOL_NAME) {
        return parseSubmitArgs(args, toolCallCount, onEvent);
      }

      if (call.function.name === READ_FILE_TOOL_NAME) {
        const { result, error } = await executeReadFile(args.path, relevantPaths, owner, repo, branch, onEvent);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(error ? { error } : result) });
        continue;
      }

      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: `Unknown tool: ${call.function.name}` }) });
    }
  }

  throw new Error(`Agent did not submit an analysis within ${MAX_TOOL_ITERATIONS} tool-call iterations`);
}
