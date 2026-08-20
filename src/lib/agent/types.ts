// Shared contract for the audit agent, independent of which LLM provider
// actually runs it. Adding a 5th provider means adding one file under
// providers/ that implements AgentProvider — nothing else in this file, or
// anywhere that consumes AgenticAnalysisResult, needs to change.

export type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'openrouter';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Server env var holding this provider's API key. Never sent to the client. */
  envKey: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'gemini', label: 'Gemini', envKey: 'GEMINI_API_KEY' },
  { id: 'anthropic', label: 'Claude', envKey: 'ANTHROPIC_API_KEY' },
  { id: 'openai', label: 'ChatGPT', envKey: 'OPENAI_API_KEY' },
  { id: 'openrouter', label: 'OpenRouter', envKey: 'OPENROUTER_API_KEY' },
];

export const DEFAULT_PROVIDER: ProviderId = 'gemini';

export const DEFAULT_MODEL_BY_PROVIDER: Record<ProviderId, string> = {
  gemini: 'gemini-3.5-flash-lite',
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5.6-luna',
  openrouter: 'openrouter/auto',
};

// Curated presets for the Settings UI dropdown, verified against each
// provider's live catalog (openrouter.ai/api/v1/models) and official docs
// (ai.google.dev, platform.claude.com, developers.openai.com) — not
// guessed. This is the code-level fallback the Settings page falls back to
// if the DB is unreachable; src/lib/db/provider-models.ts seeds the same
// data into `provider_models` as the primary source. The stored value is
// always just a plain string, so a newer/unlisted model id still works if
// the user types one in manually — this list is a convenience, not a
// whitelist. Re-run the seed (or edit both places) when providers ship new
// models — nothing here is fetched live at runtime.
export const MODEL_PRESETS: Record<ProviderId, { id: string; label: string }[]> = {
  gemini: [
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite — fast, cheap' },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash — latest, best balance' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview) — most capable' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — older, stable' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fast, cheap' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — best balance' },
    { id: 'claude-opus-5', label: 'Claude Opus 5 — complex agentic work' },
    { id: 'claude-fable-5', label: 'Claude Fable 5 — most capable' },
  ],
  openai: [
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna — fast, cheap' },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra — balanced' },
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol — flagship, complex reasoning' },
  ],
  openrouter: [
    { id: 'openrouter/auto', label: 'Auto — OpenRouter picks a model' },
    { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { id: 'google/gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  ],
};

export interface AgentSettings {
  provider: ProviderId;
  model: string;
}

export interface AgenticSensor {
  name: string;
  type: string;
  linkName: string;
  parentLink: string;
  position: { x: number; y: number; z: number };
  orientation: { r: number; p: number; y: number };
  frameId: string;
  sourceFile?: string;
  estimated: boolean;
}

export interface AgenticChassis {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  wheelRadius: number;
  totalMassKg: number;
  estimatedFields: string[];
}

export interface AgenticGazeboPlugin {
  name: string;
  targetLink: string;
  sensorType: string;
  pluginSystem: string;
  rosTopic: string;
  rosMessageType: string;
}

export interface AgenticTopic {
  topic: string;
  type: string;
  direction: 'Publisher' | 'Subscriber';
  nodeOwner: string;
  description: string;
}

export interface AgenticSimAsset {
  label: string;
  path: string;
}

export interface AgenticRobotMetrics {
  lengthM: number;
  widthM: number;
  heightM: number;
  wheelbaseM: number;
  wheelRadiusM: number;
  massKg: number;
  maxLinearSpeedMs: number;
  maxAngularSpeedRads: number;
  estimatedFields: string[];
}

export interface AgenticRobotModel {
  modelName: string;
  modelVariable: string;
  formFactor: string;
  rolePurpose: string;
  actuatorsSensors: string[];
  simulationAssets: AgenticSimAsset[];
  metrics: AgenticRobotMetrics;
}

export interface AgenticAnalysisResult {
  robotName: string;
  rosVersion: string;
  chassis: AgenticChassis;
  sensors: AgenticSensor[];
  gazeboPlugins: AgenticGazeboPlugin[];
  topics: AgenticTopic[];
  robotModels: AgenticRobotModel[];
  reasoningSummary: string;
  toolCallCount: number;
}

export interface AgentRunContext {
  apiKey: string;
  model: string;
  owner: string;
  repo: string;
  branch: string;
  relevantPaths: string[];
  onEvent: (log: string) => void;
}

export type AgentProvider = (ctx: AgentRunContext) => Promise<AgenticAnalysisResult>;
