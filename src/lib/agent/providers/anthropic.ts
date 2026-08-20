import { AgentProvider, AgentTokenUsage, emptyTokenUsage, addTokenUsage } from '../types';
import {
  TOOL_DEFS, SUBMIT_TOOL_NAME, READ_FILE_TOOL_NAME, SYSTEM_INSTRUCTION,
  buildUserPrompt, executeReadFile, parseSubmitArgs,
  MAX_TOOL_ITERATIONS, RATE_LIMIT_RETRY_DELAYS_MS, sleep,
  KEEP_RECENT_FILE_READS, compactedFilePlaceholder,
} from '../tools';

const ANTHROPIC_VERSION = '2023-06-01';

interface CacheControl {
  type: 'ephemeral';
}

// Every tool definition is identical on every call of a given run, so
// marking only the LAST one caches the whole array (Anthropic's cache
// covers everything up to and including a cache_control breakpoint).
const ANTHROPIC_TOOLS = TOOL_DEFS.map((t, i, arr) => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters,
  ...(i === arr.length - 1 ? { cache_control: { type: 'ephemeral' } as CacheControl } : {}),
}));

type ContentBlock =
  | { type: 'text'; text: string; cache_control?: CacheControl }
  | { type: 'tool_use'; id: string; name: string; input: any; cache_control?: CacheControl }
  | { type: 'tool_result'; tool_use_id: string; content: string; cache_control?: CacheControl };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

function asBlocks(content: string | ContentBlock[]): ContentBlock[] {
  return typeof content === 'string' ? [{ type: 'text', text: content }] : content;
}

// Replaces the content of read_file tool_result blocks older than the most
// recent KEEP_RECENT_FILE_READS with a compact placeholder, in place —
// same rationale as the Gemini/OpenAI-compatible providers: without this,
// every call re-sends every file ever read in full (the dominant cost
// driver in a multi-iteration tool loop). This runs BEFORE the rolling
// cache breakpoint is placed, so compacted (shorter) history is what
// actually gets cached going forward.
function compactOldFileReads(messages: AnthropicMessage[]): void {
  let fullReadsSeen = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const blocks = asBlocks(messages[i].content);
    for (const block of blocks) {
      if (block.type !== 'tool_result') continue;
      let parsed: any;
      try {
        parsed = JSON.parse(block.content);
      } catch {
        continue;
      }
      if (typeof parsed?.content !== 'string' || parsed.compacted) continue;

      fullReadsSeen++;
      if (fullReadsSeen > KEEP_RECENT_FILE_READS) {
        block.content = JSON.stringify({
          path: parsed.path,
          content: compactedFilePlaceholder(parsed.path, parsed.content.length),
          compacted: true,
        });
      }
    }
  }
}

// Anthropic's explicit prompt caching needs a "rolling" breakpoint: mark the
// last content block of everything-except-the-newest-message so the whole
// prefix up to it is served from cache on the next call, then move that
// mark forward each turn. Without this, tool-loop conversations pay full
// price for the entire growing history on every single iteration — this is
// the exact scenario Anthropic's own docs call out as the standard use case
// for caching, and we were previously not using it at all.
function refreshRollingCacheBreakpoint(messages: AnthropicMessage[], previousIndex: number): number {
  if (previousIndex >= 0 && previousIndex < messages.length) {
    const blocks = asBlocks(messages[previousIndex].content);
    delete blocks[blocks.length - 1].cache_control;
  }

  const targetIndex = messages.length - 2;
  if (targetIndex < 0) return -1;

  messages[targetIndex].content = asBlocks(messages[targetIndex].content);
  const blocks = messages[targetIndex].content as ContentBlock[];
  blocks[blocks.length - 1].cache_control = { type: 'ephemeral' };
  return targetIndex;
}

async function callMessages(
  apiKey: string,
  model: string,
  messages: AnthropicMessage[],
  forceSubmit: boolean,
  effort: string | undefined,
  onEvent: (log: string) => void
): Promise<{ content: ContentBlock[]; usage: Partial<AgentTokenUsage> }> {
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
        system: [{ type: 'text', text: SYSTEM_INSTRUCTION, cache_control: { type: 'ephemeral' } }],
        messages,
        tools: ANTHROPIC_TOOLS,
        tool_choice: forceSubmit ? { type: 'tool', name: SUBMIT_TOOL_NAME } : { type: 'auto' },
        ...(effort ? { output_config: { effort } } : {}),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.content as ContentBlock[] | undefined;
      if (!content) throw new Error(`Anthropic API returned no content: ${JSON.stringify(data).slice(0, 300)}`);
      const u = data.usage || {};
      const freshInput = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      const cachedInput = u.cache_read_input_tokens || 0;
      const outputTokens = u.output_tokens || 0;
      return {
        content,
        usage: {
          inputTokens: freshInput,
          cachedInputTokens: cachedInput,
          outputTokens,
          totalTokens: freshInput + cachedInput + outputTokens,
        },
      };
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
  const { apiKey, model, owner, repo, branch, relevantPaths, onEvent, effort } = ctx;

  const messages: AnthropicMessage[] = [
    { role: 'user', content: buildUserPrompt(owner, repo, branch, relevantPaths) },
  ];

  let toolCallCount = 0;
  let usage = emptyTokenUsage();
  let cacheBreakpointIndex = -1;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const forceSubmit = iteration === MAX_TOOL_ITERATIONS - 1;
    compactOldFileReads(messages);
    cacheBreakpointIndex = refreshRollingCacheBreakpoint(messages, cacheBreakpointIndex);

    const { content, usage: callUsage } = await callMessages(apiKey, model, messages, forceSubmit, effort, onEvent);
    usage = addTokenUsage(usage, callUsage);
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
        return parseSubmitArgs(call.input, toolCallCount, usage, onEvent);
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
