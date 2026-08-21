// AI-assisted robot topology suggestion for the Robots module's manual
// builder. Unlike the repo-audit agent (lib/agent/index.ts + tools.ts),
// this is a single forced-tool-call per provider — there's no file reading
// or multi-turn loop. Two modes share the same provider-calling core below:
//
// - generateTopology: given N already-measured link components (real
//   bounding-box size/center), propose names + a joint tree for them.
//   Joint origins are computed deterministically by the caller from the
//   given centers, never by the model.
// - generateBlueprint: given only a text description and ZERO uploaded
//   links, propose a plausible link/joint skeleton from scratch — names,
//   structure, joint types/axes are legitimate semantic reasoning ("a
//   4-wheel rover needs 4 continuous wheel joints"), but there is no real
//   geometry to measure yet, so joint origins are never generated here —
//   they're left at (0,0,0), same as any manually-added joint, for the
//   user to correct once they attach real mesh files.
//
// Both modes follow this project's core principle: AI chooses names,
// structure, joint types, and axes (semantic interpretation); it never
// invents a physical measurement.

import { ProviderId, AgentSettings } from './types';
import { JsonSchema, toGeminiSchema, RATE_LIMIT_RETRY_DELAYS_MS, sleep } from './tools';
import { jointRequiresAxis, type JointType } from '../urdf/types';

export interface TopologyComponent {
  id: string;
  currentName: string;
  sizeM: { x: number; y: number; z: number };
  centerM: { x: number; y: number; z: number };
}

export interface TopologyJointSuggestion {
  name: string;
  parentId: string;
  childId: string;
  type: JointType;
  axis?: { x: number; y: number; z: number };
}

export interface TopologySuggestion {
  links: { id: string; name: string }[];
  joints: TopologyJointSuggestion[];
  reasoningSummary: string;
}

export interface BlueprintJointSuggestion {
  name: string;
  parentName: string;
  childName: string;
  type: JointType;
  axis?: { x: number; y: number; z: number };
}

export interface TopologyBlueprint {
  linkNames: string[];
  joints: BlueprintJointSuggestion[];
  reasoningSummary: string;
}

// ---------------------------------------------------------------------------
// Generic forced-tool-call core, shared by both modes.
// ---------------------------------------------------------------------------

interface ToolCallConfig {
  systemInstruction: string;
  toolName: string;
  toolDescription: string;
  schema: JsonSchema;
  userPrompt: string;
}

// 429 (rate limit) and 503 (temporary provider-side overload — Gemini
// returns this under real load, not just theoretically) are both worth a
// short backoff-and-retry; anything else is a real error.
const RETRYABLE_STATUS = new Set([429, 503]);

async function callWithRetry<T>(providerLabel: string, attempt: (attemptIndex: number) => Promise<{ res: Response; parse: () => Promise<T> }>): Promise<T> {
  for (let i = 0; ; i++) {
    const { res, parse } = await attempt(i);
    if (res.ok) return parse();

    const body = await res.text().catch(() => '');
    if (RETRYABLE_STATUS.has(res.status) && i < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      await sleep(RATE_LIMIT_RETRY_DELAYS_MS[i]);
      continue;
    }
    throw new Error(`${providerLabel} API error ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function callAnthropicTool(apiKey: string, model: string, cfg: ToolCallConfig): Promise<any> {
  return callWithRetry('Anthropic', async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.15,
        system: cfg.systemInstruction,
        messages: [{ role: 'user', content: cfg.userPrompt }],
        tools: [{ name: cfg.toolName, description: cfg.toolDescription, input_schema: cfg.schema }],
        tool_choice: { type: 'tool', name: cfg.toolName },
      }),
    });
    return {
      res,
      parse: async () => {
        const data = await res.json();
        const block = (data.content || []).find((b: any) => b.type === 'tool_use' && b.name === cfg.toolName);
        if (!block) throw new Error('Anthropic did not return a tool call.');
        return block.input;
      },
    };
  });
}

async function callGeminiTool(apiKey: string, model: string, cfg: ToolCallConfig): Promise<any> {
  return callWithRetry('Gemini', async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: cfg.systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: cfg.userPrompt }] }],
        tools: [{ functionDeclarations: [{ name: cfg.toolName, description: cfg.toolDescription, parameters: toGeminiSchema(cfg.schema) }] }],
        toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [cfg.toolName] } },
        generationConfig: { temperature: 0.15, maxOutputTokens: 4096 },
      }),
    });
    return {
      res,
      parse: async () => {
        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const call = parts.map((p: any) => p.functionCall).find((c: any) => c?.name === cfg.toolName);
        if (!call) throw new Error('Gemini did not return a function call.');
        return call.args;
      },
    };
  });
}

async function callOpenAICompatibleTool(
  baseUrl: string,
  providerLabel: string,
  apiKey: string,
  model: string,
  cfg: ToolCallConfig,
  extraHeaders?: Record<string, string>
): Promise<any> {
  return callWithRetry(providerLabel, async () => {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: cfg.systemInstruction },
          { role: 'user', content: cfg.userPrompt },
        ],
        tools: [{ type: 'function', function: { name: cfg.toolName, description: cfg.toolDescription, parameters: cfg.schema } }],
        tool_choice: { type: 'function', function: { name: cfg.toolName } },
      }),
    });
    return {
      res,
      parse: async () => {
        const data = await res.json();
        const call = data.choices?.[0]?.message?.tool_calls?.[0];
        if (!call) throw new Error(`${providerLabel} did not return a tool call.`);
        try {
          return JSON.parse(call.function.arguments || '{}');
        } catch {
          throw new Error(`${providerLabel} returned malformed tool call arguments.`);
        }
      },
    };
  });
}

async function callProviderTool(settings: Pick<AgentSettings, 'provider' | 'model'>, apiKey: string, cfg: ToolCallConfig): Promise<any> {
  const dispatch: Record<ProviderId, () => Promise<any>> = {
    anthropic: () => callAnthropicTool(apiKey, settings.model, cfg),
    gemini: () => callGeminiTool(apiKey, settings.model, cfg),
    openai: () => callOpenAICompatibleTool('https://api.openai.com/v1', 'OpenAI', apiKey, settings.model, cfg),
    openrouter: () =>
      callOpenAICompatibleTool('https://openrouter.ai/api/v1', 'OpenRouter', apiKey, settings.model, cfg, {
        'HTTP-Referer': 'https://upfreq.app',
        'X-Title': 'UpFreq',
      }),
  };
  return dispatch[settings.provider]();
}

// ---------------------------------------------------------------------------
// Mode 1: propose names + a joint tree for already-measured components.
// ---------------------------------------------------------------------------

const TOPOLOGY_TOOL_NAME = 'submit_topology';

const TOPOLOGY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    links: {
      type: 'array',
      description: 'Exactly one entry per input component, in any order.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Must exactly match one of the input component ids.' },
          name: { type: 'string', description: 'A snake_case URDF link name, e.g. base_link, wheel_left, arm_shoulder.' },
        },
        required: ['id', 'name'],
      },
    },
    joints: {
      type: 'array',
      description: 'Forms a single connected tree: exactly one component has no incoming joint (the root), every other component is the child of exactly one joint.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parentId: { type: 'string', description: 'Component id of the parent link.' },
          childId: { type: 'string', description: 'Component id of the child link.' },
          type: { type: 'string', enum: ['revolute', 'continuous', 'prismatic', 'fixed', 'floating', 'planar'] },
          axis: {
            type: 'object',
            description: 'Required for revolute/continuous/prismatic/planar joints, omit entirely for fixed/floating.',
            properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            required: ['x', 'y', 'z'],
          },
        },
        required: ['name', 'parentId', 'childId', 'type'],
      },
    },
    reasoningSummary: { type: 'string', description: 'One or two sentences explaining the proposed structure.' },
  },
  required: ['links', 'joints', 'reasoningSummary'],
};

const TOPOLOGY_SYSTEM_INSTRUCTION = `You are a robotics engineer. You are given a list of rigid mechanical components extracted from a 3D model via connected-component mesh segmentation — each one is a physically separate part. Propose how these components form a robot: a semantic link name for each, and a single connected joint tree (URDF-style: exactly one root component with no parent, every other component the child of exactly one joint).

Reasoning heuristics:
- The largest / most central component is usually the base or chassis, and is usually the tree root.
- Small components positioned symmetrically near the bottom/sides, roughly disc- or cylinder-shaped, are often wheels or casters — typically "continuous" joints, usually leaves (children) of the base.
- Elongated components chained together (e.g. an arm) usually get "revolute" joints with a sensible rotation axis.
- Small components that don't move relative to their neighbor (sensor mounts, brackets, covers) usually get "fixed" joints.

Rules:
- Every input component id must appear exactly once in "links".
- parentId/childId must only reference given component ids, never invented ones.
- Do not compute joint origin positions — the caller derives those deterministically from the component centers you were given. Only decide structure, names, joint types, and axes.
- You must respond by calling ${TOPOLOGY_TOOL_NAME} with your answer — no other response format is acceptable.`;

function buildTopologyPrompt(components: TopologyComponent[], userContext?: string): string {
  const lines = components
    .map(
      (c) =>
        `- id="${c.id}" currentName="${c.currentName}" size(x,y,z)=(${c.sizeM.x.toFixed(3)}, ${c.sizeM.y.toFixed(3)}, ${c.sizeM.z.toFixed(3)}) meters, center(x,y,z)=(${c.centerM.x.toFixed(3)}, ${c.centerM.y.toFixed(3)}, ${c.centerM.z.toFixed(3)}) meters`
    )
    .join('\n');
  const contextBlock = userContext
    ? `\n\nThe user provided this additional context — it may reference a component by its currentName or original filename (e.g. "left_tire.stl"); prefer it over your own geometric guess wherever it's specific about a component's identity, role, or joint type:\n"""\n${userContext}\n"""`
    : '';
  return `Here are ${components.length} detected component(s):\n${lines}${contextBlock}\n\nPropose link names and a joint tree connecting all of them.`;
}

function validateSuggestion(raw: any, components: TopologyComponent[]): TopologySuggestion {
  const componentIds = new Set(components.map((c) => c.id));
  const links = Array.isArray(raw?.links) ? raw.links : [];
  const joints = Array.isArray(raw?.joints) ? raw.joints : [];

  const validLinks = links.filter((l: any) => typeof l?.id === 'string' && componentIds.has(l.id) && typeof l?.name === 'string' && l.name.trim());
  const linkIds = new Set(validLinks.map((l: any) => l.id));
  const validJoints = joints.filter(
    (j: any) =>
      typeof j?.name === 'string' &&
      typeof j?.parentId === 'string' &&
      typeof j?.childId === 'string' &&
      linkIds.has(j.parentId) &&
      linkIds.has(j.childId) &&
      j.parentId !== j.childId
  );

  if (validLinks.length === 0) {
    throw new Error('The AI response did not include any usable links.');
  }

  return {
    links: validLinks.map((l: any) => ({ id: l.id, name: l.name.trim() })),
    joints: validJoints.map((j: any) => normalizeJoint(j)),
    reasoningSummary: typeof raw?.reasoningSummary === 'string' ? raw.reasoningSummary : '',
  };
}

// The model sometimes omits axis even for a movable joint type — default to
// a sane starting value rather than leaving the suggestion immediately
// invalid; the user can still edit it like any other joint field.
function normalizeJoint(j: any): { name: string; type: JointType; axis?: { x: number; y: number; z: number } } & Record<string, any> {
  const type = (j.type as JointType) || 'fixed';
  const axis = j.axis && typeof j.axis.x === 'number' ? { x: j.axis.x, y: j.axis.y, z: j.axis.z } : undefined;
  return { ...j, type, axis: axis ?? (jointRequiresAxis(type) ? { x: 0, y: 0, z: 1 } : undefined) };
}

export async function generateTopology(
  settings: Pick<AgentSettings, 'provider' | 'model'>,
  apiKey: string,
  components: TopologyComponent[],
  userContext?: string
): Promise<TopologySuggestion> {
  const raw = await callProviderTool(settings, apiKey, {
    systemInstruction: TOPOLOGY_SYSTEM_INSTRUCTION,
    toolName: TOPOLOGY_TOOL_NAME,
    toolDescription: 'Submit the proposed robot topology.',
    schema: TOPOLOGY_SCHEMA,
    userPrompt: buildTopologyPrompt(components, userContext),
  });
  return validateSuggestion(raw, components);
}

// ---------------------------------------------------------------------------
// Mode 2: propose a link/joint skeleton from a text description alone (no
// uploaded links yet). Structure only — no coordinates, ever.
// ---------------------------------------------------------------------------

const BLUEPRINT_TOOL_NAME = 'submit_blueprint';

const BLUEPRINT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    linkNames: {
      type: 'array',
      description: 'snake_case URDF link names for every part this robot needs, e.g. ["base_link", "wheel_left", "wheel_right", "lidar_mount"]. Each must be unique.',
      items: { type: 'string' },
    },
    joints: {
      type: 'array',
      description: 'Forms a single connected tree over linkNames: exactly one link has no incoming joint (the root), every other link is the child of exactly one joint.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parentName: { type: 'string', description: 'Must exactly match one entry in linkNames.' },
          childName: { type: 'string', description: 'Must exactly match one entry in linkNames.' },
          type: { type: 'string', enum: ['revolute', 'continuous', 'prismatic', 'fixed', 'floating', 'planar'] },
          axis: {
            type: 'object',
            description: 'Required for revolute/continuous/prismatic/planar joints, omit entirely for fixed/floating.',
            properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            required: ['x', 'y', 'z'],
          },
        },
        required: ['name', 'parentName', 'childName', 'type'],
      },
    },
    reasoningSummary: { type: 'string', description: 'One or two sentences explaining the proposed structure.' },
  },
  required: ['linkNames', 'joints', 'reasoningSummary'],
};

const BLUEPRINT_SYSTEM_INSTRUCTION = `You are a robotics engineer. The user describes a robot in plain language, with no 3D model uploaded yet. Propose a plausible starting skeleton: the set of links (physical parts) this robot needs, and a single connected joint tree (URDF-style: exactly one root link with no parent, every other link the child of exactly one joint) connecting them.

This is a STARTING STRUCTURE the user will attach real mesh files to afterward — get the names, part count, and joint types/axes right using standard robotics conventions for the described robot type (e.g. a differential-drive rover needs a chassis plus two continuous-joint wheels; a robot arm needs a chain of revolute joints; a sensor gets a fixed mount).

Rules:
- Do not invent joint origins/positions — there is no real geometry yet, so any numeric position would be fabricated. The caller sets every joint's origin to (0,0,0) automatically; you only decide names, structure, joint types, and axes.
- Every parentName/childName must exactly match an entry in linkNames.
- You must respond by calling ${BLUEPRINT_TOOL_NAME} with your answer — no other response format is acceptable.`;

function buildBlueprintPrompt(description: string): string {
  return `The user's description of the robot they want to build:\n"""\n${description}\n"""\n\nPropose the link names and joint tree for this robot.`;
}

function validateBlueprint(raw: any): TopologyBlueprint {
  const linkNames: string[] = Array.isArray(raw?.linkNames)
    ? Array.from(new Set(raw.linkNames.filter((n: any) => typeof n === 'string' && n.trim()).map((n: string) => n.trim())))
    : [];
  if (linkNames.length === 0) {
    throw new Error('The AI response did not include any usable links.');
  }

  const nameSet = new Set(linkNames);
  const joints = Array.isArray(raw?.joints) ? raw.joints : [];
  const validJoints = joints.filter(
    (j: any) =>
      typeof j?.name === 'string' &&
      typeof j?.parentName === 'string' &&
      typeof j?.childName === 'string' &&
      nameSet.has(j.parentName) &&
      nameSet.has(j.childName) &&
      j.parentName !== j.childName
  );

  return {
    linkNames,
    joints: validJoints.map((j: any) => normalizeJoint(j)) as BlueprintJointSuggestion[],
    reasoningSummary: typeof raw?.reasoningSummary === 'string' ? raw.reasoningSummary : '',
  };
}

export async function generateBlueprint(
  settings: Pick<AgentSettings, 'provider' | 'model'>,
  apiKey: string,
  description: string
): Promise<TopologyBlueprint> {
  const raw = await callProviderTool(settings, apiKey, {
    systemInstruction: BLUEPRINT_SYSTEM_INSTRUCTION,
    toolName: BLUEPRINT_TOOL_NAME,
    toolDescription: 'Submit the proposed robot blueprint.',
    schema: BLUEPRINT_SCHEMA,
    userPrompt: buildBlueprintPrompt(description),
  });
  return validateBlueprint(raw);
}
