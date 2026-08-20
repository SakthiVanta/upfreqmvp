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

/** Claude's `output_config.effort` — confirmed against Anthropic's own docs
 * (no beta header needed, top-level-ish field, values low/medium/high/xhigh/max).
 * Gemini's and OpenAI's equivalent reasoning-effort controls are NOT wired
 * up: their exact current field paths for our request shapes (generateContent,
 * and Chat Completions specifically — OpenAI's own docs now steer new
 * integrations toward the Responses API for reasoning control) couldn't be
 * confirmed from official docs without risking a guess that silently breaks
 * every call to the default provider. Left as a known gap rather than shipped
 * wrong. */
export type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const ANTHROPIC_EFFORT_LEVELS: AnthropicEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

export interface AgentSettings {
  provider: ProviderId;
  model: string;
  /** Anthropic-only; ignored by other providers. Unset = API default (high). */
  effort?: AnthropicEffort;
}

/** A single "spec sheet" entry — a real Gazebo/Ignition <sensor> or <plugin>
 * config value (range, FOV, sample count, noise, update rate, wheel
 * geometry, ...), not the sensor's own identity/position fields above.
 * Matches SensorRecord.detailedParams in robot-profile.ts exactly, so this
 * passes straight through without remapping. */
export interface AgenticParam {
  label: string;
  value: string;
  unit?: string;
  category: string;
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
  /** Real config values from this sensor's own <gazebo reference="LINK">
   * <sensor> block — range, FOV, sample count, noise, update rate — when
   * one exists in the repo. Empty, not guessed, when no such block exists. */
  detailedParams?: AgenticParam[];
}

export interface AgenticChassis {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  wheelRadius: number;
  totalMassKg: number;
  maxSpeedLinearMs: number;
  maxSpeedAngularRads: number;
  estimatedFields: string[];
}

/** A simulation-side plugin — Gazebo/Ignition is the common case (and the
 * only one the regex fallback parser can detect), but this is deliberately
 * not Gazebo-specific: Andino alone has real companion repos for Webots,
 * O3DE, Isaac Sim, MuJoCo, and RMF, each with their own plugin/config
 * format. `pluginSystem`/`sensorType` are free text precisely so the agent
 * can report whichever simulator's plugin identifier it actually finds,
 * not just Gazebo's. */
export interface AgenticSimulationPlugin {
  name: string;
  targetLink: string;
  sensorType: string;
  pluginSystem: string;
  rosTopic: string;
  rosMessageType: string;
  updateRateHz?: number;
  gzTopic?: string;
  /** Real config values straight off the plugin's own config block —
   * wheel_separation, odom_publish_frequency, joint names, etc. — for
   * plugins that aren't themselves a physical sensor (DiffDrive,
   * OdometryPublisher, ...). */
  parameters?: AgenticParam[];
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

/** Summed across every API call in the loop, not just the final one — the
 * whole point is knowing the real cost of a multi-iteration audit, not just
 * the last request's numbers. `cachedInputTokens` is the portion of
 * inputTokens that was served from a provider-side cache (Anthropic
 * explicit, OpenAI/Gemini implicit) at a fraction of normal cost; it's a
 * subset of inputTokens, not additional to it. */
export interface AgentTokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  apiCallCount: number;
}

export function emptyTokenUsage(): AgentTokenUsage {
  return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0, apiCallCount: 0 };
}

export function addTokenUsage(a: AgentTokenUsage, b: Partial<AgentTokenUsage>): AgentTokenUsage {
  return {
    inputTokens: a.inputTokens + (b.inputTokens || 0),
    cachedInputTokens: a.cachedInputTokens + (b.cachedInputTokens || 0),
    outputTokens: a.outputTokens + (b.outputTokens || 0),
    totalTokens: a.totalTokens + (b.totalTokens || 0),
    apiCallCount: a.apiCallCount + 1,
  };
}

export interface AgenticAnalysisResult {
  robotName: string;
  rosVersion: string;
  chassis: AgenticChassis;
  sensors: AgenticSensor[];
  simulationPlugins: AgenticSimulationPlugin[];
  topics: AgenticTopic[];
  robotModels: AgenticRobotModel[];
  reasoningSummary: string;
  toolCallCount: number;
  usage: AgentTokenUsage;
}

export interface AgentRunContext {
  apiKey: string;
  model: string;
  owner: string;
  repo: string;
  branch: string;
  relevantPaths: string[];
  onEvent: (log: string) => void;
  /** Anthropic only — see AnthropicEffort. Ignored by other providers. */
  effort?: AnthropicEffort;
}

export type AgentProvider = (ctx: AgentRunContext) => Promise<AgenticAnalysisResult>;
