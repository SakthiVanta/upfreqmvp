// Everything about the audit agent that does NOT depend on which LLM
// provider is running it: the two tools it can call, the system prompt, the
// file-resolution/fetch logic behind read_file, and the parser that turns a
// submit_analysis call's raw args into an AgenticAnalysisResult. Every
// provider adapter under providers/ imports from here rather than
// redefining any of this — the only thing that differs per provider is the
// wire format for "call a model with these tools" (see each provider file).

import { AgenticAnalysisResult } from './types';

export const READ_FILE_TOOL_NAME = 'read_file';
export const SUBMIT_TOOL_NAME = 'submit_analysis';

// Real repos with heavily YAML-templated chassis/sensor properties (e.g.
// Andino's base/wheel/motor/lidar_base/battery_base/sensors/hardware.yaml —
// 7+ separate config files behind one URDF) can legitimately need a dozen-
// plus reads before the agent has enough to submit. Err generous; the loop
// still terminates and forces a submission on the last iteration either way.
export const MAX_TOOL_ITERATIONS = 40;
export const MAX_FILE_CHARS = 12000;

// Standard JSON Schema (lowercase `type`) — used as-is by OpenAI and
// Anthropic's tool-use APIs. Gemini's function-calling schema is
// structurally identical but wants uppercase type names (OBJECT/STRING/...),
// so the Gemini provider runs this through toGeminiSchema() below rather
// than maintaining a second copy of this schema by hand.
export interface JsonSchema {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: string[];
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: JsonSchema;
}

const READ_FILE_PARAMETERS: JsonSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Exact repo-relative file path to read.' },
  },
  required: ['path'],
};

const SUBMIT_ANALYSIS_PARAMETERS: JsonSchema = {
  type: 'object',
  properties: {
    robotName: { type: 'string' },
    rosVersion: { type: 'string', description: "e.g. 'ROS 2 Humble'" },
    chassis: {
      type: 'object',
      properties: {
        length: { type: 'number', description: 'meters, along X' },
        width: { type: 'number', description: 'meters, along Y' },
        height: { type: 'number', description: 'meters, along Z' },
        wheelbase: { type: 'number', description: 'meters, distance between left/right drive wheels' },
        wheelRadius: { type: 'number', description: 'meters' },
        totalMassKg: { type: 'number' },
        estimatedFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of the chassis fields above that you could NOT confidently resolve from the actual repo content and are therefore your engineering estimate, not a real extracted value.',
        },
      },
      required: ['length', 'width', 'height', 'wheelbase', 'wheelRadius', 'totalMassKg', 'estimatedFields'],
    },
    sensors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Human-readable sensor name/model, e.g. "SLAMTEC RPLidar A1M8"' },
          type: { type: 'string', description: 'e.g. "2D Laser Scanner (LiDAR)", "RGB Camera", "6-Axis IMU"' },
          linkName: { type: 'string' },
          parentLink: { type: 'string' },
          positionX: { type: 'number' },
          positionY: { type: 'number' },
          positionZ: { type: 'number' },
          orientationR: { type: 'number' },
          orientationP: { type: 'number' },
          orientationY: { type: 'number' },
          frameId: { type: 'string' },
          sourceFile: { type: 'string' },
          estimated: { type: 'boolean', description: 'true if this exact position/orientation could not be confidently resolved (e.g. blocked by unresolvable Xacro indirection) and is a placeholder, not a real value' },
        },
        required: ['name', 'type', 'linkName', 'parentLink', 'positionX', 'positionY', 'positionZ', 'orientationR', 'orientationP', 'orientationY', 'frameId', 'estimated'],
      },
    },
    gazeboPlugins: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          targetLink: { type: 'string' },
          sensorType: { type: 'string' },
          pluginSystem: { type: 'string' },
          rosTopic: { type: 'string' },
          rosMessageType: { type: 'string' },
        },
        required: ['name', 'targetLink', 'sensorType', 'pluginSystem', 'rosTopic', 'rosMessageType'],
      },
    },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          type: { type: 'string', description: 'ROS message type, e.g. sensor_msgs/msg/LaserScan' },
          direction: { type: 'string', enum: ['Publisher', 'Subscriber'] },
          nodeOwner: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['topic', 'type', 'direction', 'nodeOwner', 'description'],
      },
    },
    robotModels: {
      type: 'array',
      description: 'Every distinct robot model/variant this repository actually defines (e.g. different chassis sizes or sensor loadouts selectable via an env var, launch arg, or separate URDF/SDF files per model). If the repo defines only one robot, still submit it as a single entry here. This field is mandatory and every value in it must be grounded in files you actually opened — never invent a file path, a sensor, or a role/purpose you did not verify. If you cannot verify simulationAssets for a variant, submit an empty array for it rather than guessing a path.',
      items: {
        type: 'object',
        properties: {
          modelName: { type: 'string', description: 'Human-readable name, e.g. "TurtleBot3 Burger"' },
          modelVariable: { type: 'string', description: 'The real identifier/token used to select this variant in the code — an env var value, launch argument, or filename suffix, e.g. "burger"' },
          formFactor: { type: 'string', description: 'One-line real chassis/sensor summary for this specific variant' },
          rolePurpose: { type: 'string', description: "What this specific variant is for / how it differs from the other variants, from real evidence (README, package description, comments) — not invented" },
          actuatorsSensors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Real actuators and sensors this specific variant has, read from its actual URDF/SDF — not a generic guess shared across all variants.',
          },
          simulationAssets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'e.g. "URDF", "SDF", "Gazebo Bridge Config"' },
                path: { type: 'string', description: 'Real repo-relative file path for this variant' },
              },
              required: ['label', 'path'],
            },
            description: 'Real file paths in this repo specific to this variant — every path must be one you actually resolved or read, never guessed from a naming convention.',
          },
          metrics: {
            type: 'object',
            description: "This specific variant's own physical dimensions and speed limits — read from its own URDF geometry (<box>/<cylinder> size, <mass value>, wheel joint origins) and its own controller/param YAML (max linear/angular velocity), not copied from another variant.",
            properties: {
              lengthM: { type: 'number', description: 'meters, along X, this variant only' },
              widthM: { type: 'number', description: 'meters, along Y, this variant only' },
              heightM: { type: 'number', description: 'meters, along Z, this variant only' },
              wheelbaseM: { type: 'number', description: 'meters, distance between left/right drive wheels, this variant only' },
              wheelRadiusM: { type: 'number', description: 'meters, this variant only' },
              massKg: { type: 'number', description: 'this variant only' },
              maxLinearSpeedMs: { type: 'number', description: 'm/s, this variant only' },
              maxAngularSpeedRads: { type: 'number', description: 'rad/s, this variant only' },
              estimatedFields: {
                type: 'array',
                items: { type: 'string' },
                description: "Names of the metrics fields above that you could NOT confidently resolve from this variant's own real repo content and are therefore your engineering estimate, not a real extracted value. The caller discards estimated numbers entirely and shows \"not determined\" instead — an honest estimated field costs nothing, a wrong confident value is a real bug users will see.",
              },
            },
            required: ['lengthM', 'widthM', 'heightM', 'wheelbaseM', 'wheelRadiusM', 'massKg', 'maxLinearSpeedMs', 'maxAngularSpeedRads', 'estimatedFields'],
          },
        },
        required: ['modelName', 'modelVariable', 'formFactor', 'rolePurpose', 'actuatorsSensors', 'simulationAssets', 'metrics'],
      },
    },
    reasoningSummary: { type: 'string', description: 'Two or three sentences on what you found and any notable uncertainty.' },
  },
  required: ['robotName', 'rosVersion', 'chassis', 'sensors', 'gazeboPlugins', 'topics', 'robotModels', 'reasoningSummary'],
};

export const TOOL_DEFS: ToolDef[] = [
  {
    name: READ_FILE_TOOL_NAME,
    description: 'Fetch the raw text content of one file from this repository by its exact path (as given in the file list, or resolved from a package:// URI). Use this to read URDF/Xacro files, YAML config files that back Xacro `${property}` references, package.xml manifests, or launch files.',
    parameters: READ_FILE_PARAMETERS,
  },
  {
    name: SUBMIT_TOOL_NAME,
    description: 'Submit the final structured robot analysis. Call this exactly once, after you have read enough files to be confident, or after you have determined a value genuinely cannot be resolved (in which case provide your best engineering estimate and list the field name in chassis.estimatedFields, or set sensor.estimated=true).',
    parameters: SUBMIT_ANALYSIS_PARAMETERS,
  },
];

// Gemini's function-calling schema is the same shape as standard JSON
// Schema except `type` is uppercase (OBJECT/STRING/NUMBER/ARRAY/BOOLEAN).
// Deriving it from TOOL_DEFS here — instead of hand-maintaining a second
// schema — is what keeps all four providers guaranteed to expose the exact
// same tool contract to the model.
export function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: schema.type.toUpperCase() };
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.required) out.required = schema.required;
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  if (schema.items) out.items = toGeminiSchema(schema.items);
  return out;
}

export const SYSTEM_INSTRUCTION = `You are a robotics codebase auditor. You are given the file tree of a ROS/ROS2 GitHub repository (filtered to URDF/Xacro, YAML, launch, and package.xml files) and a read_file tool to fetch any file's real content.

Your job: determine the robot's real physical chassis dimensions, every physical sensor's real link name and joint origin (position + orientation), any Gazebo/Ignition simulation plugins, and the ROS topics they publish/subscribe.

Critical rule: many robot description packages define geometry via Xacro macros with \${property} placeholders (e.g. <box size="\${chassis_length} \${chassis_width} \${chassis_height}"/>) whose real values live in a separate YAML file loaded via xacro.load_yaml(...) or a sibling *.yaml config. When you see this pattern, find and read that YAML file to resolve the real numbers — do not guess. Also watch for xacro:include chains — the file that defines a <joint> or <link> is often not the top-level URDF file.

Be careful matching joint/link names: a joint whose name merely contains a keyword (e.g. "lidar_base_joint" connecting a mounting plate) is NOT the same as the actual sensor's own joint (e.g. "rplidar_laser_joint") — trace to the real sensor-bearing link, not an intermediate mounting link.

Accuracy matters far more than speed here — a wrong number that looks confident is worse than admitting you couldn't find it. Before giving up on a field, make sure you've actually opened every YAML file a relevant xacro:property/xacro.load_yaml call references, not just the top-level URDF. If you truly cannot resolve a value after that real effort (no literal number anywhere in the reachable files), fill in a reasonable engineering estimate for a small-to-medium mobile ground robot and explicitly list that field as estimated — the caller discards estimated numbers entirely and shows "not determined" instead, so an honest estimated=true costs nothing, but a wrong confident value is a real bug users will see.

Prioritize files in this order: (1) the main URDF/xacro entry point — usually named after the robot or repo, or referenced from a launch file, not a fragment under an "include/" folder — (2) files it directly includes via xacro:include, (3) YAML files those includes load via xacro.load_yaml or a matching filename convention, (4) package.xml for dependency context. Don't stop at the first file that mentions a sensor keyword — verify you're looking at the actual sensor-bearing joint, not an intermediate mounting link, by checking the parent/child link names make sense. When you have enough information, call submit_analysis exactly once.

Multiple robot models: some repos define more than one robot variant — multiple URDF/SDF files sitting side by side directly in a urdf/ folder (not nested under include/), often selected at runtime via an environment variable, launch argument, or filename suffix (e.g. turtlebot3_burger.urdf, turtlebot3_waffle.urdf, turtlebot3_waffle_pi.urdf all in the same package). When you see this pattern, open each variant's own URDF/SDF and any config file specific to it, and report every one of them in robotModels with its own real actuators/sensors, its own real file paths, and its own real metrics — do not describe one variant and copy its details (or its numbers) onto the others; two variants sharing the same chassis size is a real finding, but only report it if you actually confirmed both files say so. This field is mandatory: submit one entry even for a single-robot repo. Never pad it with a made-up file path, a sensor, or a dimension you didn't actually see in that variant's own file — an honest empty simulationAssets array or an honest metrics.estimatedFields entry is fine, a guessed value is not. Read each variant's own geometry (<box>/<cylinder> size, <mass value>, wheel joint <origin>) for its metrics the same way you would for the single-robot chassis field — same accuracy bar, applied per variant.`;

export function buildUserPrompt(owner: string, repo: string, branch: string, relevantPaths: string[]): string {
  const fileListText = relevantPaths.map(p => `- ${p}`).join('\n');
  return `Repository: ${owner}/${repo} (branch: ${branch})\n\nRelevant files (URDF/Xacro, YAML, launch, package.xml):\n${fileListText}\n\nBegin your analysis. Use read_file to explore, then call submit_analysis with your findings.`;
}

export type ResolveResult = { path: string } | { ambiguous: string[] } | null;

// A repo with several sub-packages can easily have two files with the same
// basename (e.g. two different `base.yaml`, one per robot variant). Silently
// picking the first match would let the agent read the wrong package's
// config and confidently report a value that belongs to a different robot
// entirely — worse than not resolving it at all. Ambiguous matches are
// surfaced back to the agent as a list to choose from, never guessed.
export function resolveFilePath(requestedPath: string, availablePaths: string[]): ResolveResult {
  if (availablePaths.includes(requestedPath)) return { path: requestedPath };

  const pkgMatch = requestedPath.match(/^package:\/\/([^/]+)\/(.+)$/);
  if (pkgMatch) {
    const [, pkgName, relPath] = pkgMatch;
    const candidates = availablePaths.filter(p => p.includes(`/${pkgName}/`) && p.endsWith(relPath));
    if (candidates.length === 1) return { path: candidates[0] };
    if (candidates.length > 1) return { ambiguous: candidates };
  }

  const basename = requestedPath.split('/').pop();
  if (basename) {
    const candidates = availablePaths.filter(p => p.endsWith(`/${basename}`) || p === basename);
    if (candidates.length === 1) return { path: candidates[0] };
    if (candidates.length > 1) return { ambiguous: candidates };
  }

  return null;
}

export interface ReadFileToolResult {
  path: string;
  content: string;
  truncated: boolean;
}

/** Resolves a requested path against the known file list and fetches it raw
 * from GitHub, truncating oversized files. Returns an `error` string instead
 * of throwing — every provider adapter feeds that straight back to the model
 * as the tool result, exactly like a real tool would report a failure. */
export async function executeReadFile(
  requestedPath: string,
  availablePaths: string[],
  owner: string,
  repo: string,
  branch: string,
  onEvent: (log: string) => void
): Promise<{ result?: ReadFileToolResult; error?: string }> {
  const resolved = resolveFilePath(requestedPath, availablePaths);

  if (!resolved) {
    onEvent(`Agent requested '${requestedPath}' — not found in this repository.`);
    return { error: `File not found: ${requestedPath}. Check the file list for the exact path.` };
  }

  if ('ambiguous' in resolved) {
    onEvent(`Agent requested '${requestedPath}' — ambiguous, ${resolved.ambiguous.length} files share that name.`);
    return { error: `Ambiguous path — multiple files match '${requestedPath}': ${resolved.ambiguous.join(', ')}. Specify the exact one for the correct package.` };
  }

  const resolvedPath = resolved.path;
  onEvent(`Agent reading ${resolvedPath}...`);
  try {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${resolvedPath}`;
    const fileRes = await fetch(rawUrl);
    if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
    let text = await fileRes.text();
    let truncated = false;
    if (text.length > MAX_FILE_CHARS) {
      text = text.slice(0, MAX_FILE_CHARS);
      truncated = true;
    }
    return { result: { path: resolvedPath, content: text, truncated } };
  } catch (err: any) {
    return { error: `Failed to fetch ${resolvedPath}: ${err.message}` };
  }
}

/** Turns the raw args object from a submit_analysis tool call into the
 * shared AgenticAnalysisResult shape — identical across every provider
 * since they're all handed the exact same tool schema. */
export function parseSubmitArgs(args: any, toolCallCount: number, onEvent: (log: string) => void): AgenticAnalysisResult {
  onEvent(`Agent submitted final analysis after ${toolCallCount} tool call(s): ${args.sensors?.length ?? 0} sensor(s), chassis ${args.chassis?.estimatedFields?.length ? 'partially estimated' : 'fully resolved'}.`);
  return {
    robotName: args.robotName,
    rosVersion: args.rosVersion,
    chassis: args.chassis,
    sensors: (args.sensors || []).map((s: any) => ({
      name: s.name,
      type: s.type,
      linkName: s.linkName,
      parentLink: s.parentLink,
      position: { x: s.positionX, y: s.positionY, z: s.positionZ },
      orientation: { r: s.orientationR, p: s.orientationP, y: s.orientationY },
      frameId: s.frameId,
      sourceFile: s.sourceFile,
      estimated: !!s.estimated,
    })),
    gazeboPlugins: args.gazeboPlugins || [],
    topics: args.topics || [],
    robotModels: (args.robotModels || []).map((m: any) => ({
      modelName: m.modelName,
      modelVariable: m.modelVariable,
      formFactor: m.formFactor,
      rolePurpose: m.rolePurpose,
      actuatorsSensors: m.actuatorsSensors || [],
      simulationAssets: m.simulationAssets || [],
      metrics: m.metrics,
    })),
    reasoningSummary: args.reasoningSummary || '',
    toolCallCount,
  };
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const RATE_LIMIT_RETRY_DELAYS_MS = [15_000, 30_000, 45_000];
