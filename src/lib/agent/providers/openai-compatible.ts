// Shared implementation for any provider that speaks OpenAI's chat
// completions wire format — OpenAI itself and OpenRouter (which proxies to
// dozens of models behind the same request/response shape). A future
// OpenAI-compatible provider (Groq, Mistral, ...) is a ~10-line config
// wrapper around this file, the same way providers/openai.ts and
// providers/openrouter.ts already are — see either for the pattern.

import { AgentRunContext, AgenticAnalysisResult, AgentTokenUsage, emptyTokenUsage, addTokenUsage } from '../types';
import {
  TOOL_DEFS, SUBMIT_TOOL_NAME, READ_FILE_TOOL_NAME, SYSTEM_INSTRUCTION,
  buildUserPrompt, executeReadFile, parseSubmitArgs,
  MAX_TOOL_ITERATIONS, RATE_LIMIT_RETRY_DELAYS_MS, sleep,
  KEEP_RECENT_FILE_READS, compactedFilePlaceholder,
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
  /** Chat Completions field name for limiting output length. OpenAI's own
   * current reasoning-capable models (GPT-5.x) expect max_completion_tokens
   * — plain max_tokens is deprecated there. OpenRouter normalizes
   * max_tokens across every backend model it proxies regardless of what the
   * underlying provider actually calls it internally, so that's the right
   * default for it (and for any future OpenAI-compatible provider that
   * doesn't override this). */
  maxTokensParam?: 'max_tokens' | 'max_completion_tokens';
}

// Replaces the JSON body of read_file tool results older than the most
// recent KEEP_RECENT_FILE_READS with a compact placeholder, in place —
// same rationale as the Gemini/Anthropic providers' equivalent: without
// this, every call re-sends every file ever read in full.
function compactOldFileReads(messages: OAIMessage[]): void {
  let fullReadsSeen = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'tool' || typeof msg.content !== 'string') continue;
    let parsed: any;
    try {
      parsed = JSON.parse(msg.content);
    } catch {
      continue;
    }
    if (typeof parsed?.content !== 'string' || parsed.compacted) continue;

    fullReadsSeen++;
    if (fullReadsSeen > KEEP_RECENT_FILE_READS) {
      msg.content = JSON.stringify({
        path: parsed.path,
        content: compactedFilePlaceholder(parsed.path, parsed.content.length),
        compacted: true,
      });
    }
  }
}

async function callChatCompletions(
  cfg: OpenAICompatibleConfig,
  model: string,
  messages: OAIMessage[],
  forceSubmit: boolean,
  onEvent: (log: string) => void
): Promise<{ message: OAIMessage; usage: Partial<AgentTokenUsage> }> {
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
        [cfg.maxTokensParam || 'max_tokens']: 8192,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const message = data.choices?.[0]?.message;
      if (!message) throw new Error(`${cfg.providerLabel} API returned no message: ${JSON.stringify(data).slice(0, 300)}`);
      const u = data.usage || {};
      return {
        message: message as OAIMessage,
        usage: {
          inputTokens: u.prompt_tokens || 0,
          cachedInputTokens: u.prompt_tokens_details?.cached_tokens || 0,
          outputTokens: u.completion_tokens || 0,
          totalTokens: u.total_tokens || 0,
        },
      };
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
  let usage = emptyTokenUsage();

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const forceSubmit = iteration === MAX_TOOL_ITERATIONS - 1;
    compactOldFileReads(messages);
    const { message, usage: callUsage } = await callChatCompletions(cfg, model, messages, forceSubmit, onEvent);
    usage = addTokenUsage(usage, callUsage);
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
        // Malformed args fall through as {} — executeReadFile/parseSubmitArgs
        // handle missing fields the same way a genuinely empty call would.
      }

      if (call.function.name === SUBMIT_TOOL_NAME) {
        return parseSubmitArgs(args, toolCallCount, usage, onEvent);
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
