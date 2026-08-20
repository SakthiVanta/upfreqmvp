import { AgenticAnalysisResult, AgentProvider, AgentSettings, ProviderId, PROVIDERS } from './types';
import { runGeminiAgent } from './providers/gemini';
import { runAnthropicAgent } from './providers/anthropic';
import { runOpenAIAgent } from './providers/openai';
import { runOpenRouterAgent } from './providers/openrouter';

const PROVIDER_RUNNERS: Record<ProviderId, AgentProvider> = {
  gemini: runGeminiAgent,
  anthropic: runAnthropicAgent,
  openai: runOpenAIAgent,
  openrouter: runOpenRouterAgent,
};

// Credential resolution (user-saved DB key, falling back to a server env
// var) lives in src/lib/db/api-keys.ts, not here — this module only knows
// how to run a given provider once it's handed a real key, so it stays
// free of any DB dependency.
export async function runAgenticAnalysis(
  settings: AgentSettings,
  apiKey: string,
  owner: string,
  repo: string,
  branch: string,
  relevantPaths: string[],
  onEvent: (log: string) => void
): Promise<AgenticAnalysisResult> {
  const info = PROVIDERS.find(p => p.id === settings.provider);
  if (!info) throw new Error(`Unknown provider: ${settings.provider}`);

  const run = PROVIDER_RUNNERS[settings.provider];
  onEvent(`Handing analysis to ${info.label} (${settings.model})...`);
  return run({ apiKey, model: settings.model, owner, repo, branch, relevantPaths, onEvent });
}

export * from './types';
