// Real agentic repository analysis via the Gemini API's function-calling
// (tool-use) loop. The model decides which files to read — including
// chasing Xacro `${property}` indirection into referenced YAML config
// files, which no fixed regex pass can reliably follow — and finally
// reports a structured robot profile via the `submit_analysis` tool.

// Lite tier: materially cheaper per token than gemini-2.5-flash while still
// supporting function-calling tool-use, at some cost to reasoning depth on
// gnarlier multi-hop Xacro/YAML chains. Swap back to 'gemini-2.5-flash' (or
// a future non-lite model) if accuracy on complex repos becomes a problem.
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
// Real repos with heavily YAML-templated chassis/sensor properties (e.g.
// Andino's base/wheel/motor/lidar_base/battery_base/sensors/hardware.yaml —
// 7+ separate config files behind one URDF) can legitimately need a dozen-
// plus reads before the agent has enough to submit. Err generous; the loop
// still terminates and forces a submission on the last iteration either way.
// Multi-robot repos (e.g. turtlebot3_simulations with 4 variants) need a
// URDF/SDF/config read or two per variant on top of the base chassis/sensor
// exploration, so this needs more headroom than a single-robot repo.
const MAX_TOOL_ITERATIONS = 40;
const MAX_FILE_CHARS = 12000;

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

export interface AgenticRobotModel {
  modelName: string;
  modelVariable: string;
  formFactor: string;
  rolePurpose: string;
  actuatorsSensors: string[];
  simulationAssets: AgenticSimAsset[];
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

const SUBMIT_TOOL_NAME = 'submit_analysis';
const READ_FILE_TOOL_NAME = 'read_file';

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: READ_FILE_TOOL_NAME,
        description: 'Fetch the raw text content of one file from this repository by its exact path (as given in the file list, or resolved from a package:// URI). Use this to read URDF/Xacro files, YAML config files that back Xacro `${property}` references, package.xml manifests, or launch files.',
        parameters: {
          type: 'OBJECT',
          properties: {
            path: { type: 'STRING', description: 'Exact repo-relative file path to read.' },
          },
          required: ['path'],
        },
      },
      {
        name: SUBMIT_TOOL_NAME,
        description: 'Submit the final structured robot analysis. Call this exactly once, after you have read enough files to be confident, or after you have determined a value genuinely cannot be resolved (in which case provide your best engineering estimate and list the field name in chassis.estimatedFields, or set sensor.estimated=true).',
        parameters: {
          type: 'OBJECT',
          properties: {
            robotName: { type: 'STRING' },
            rosVersion: { type: 'STRING', description: "e.g. 'ROS 2 Humble'" },
            chassis: {
              type: 'OBJECT',
              properties: {
                length: { type: 'NUMBER', description: 'meters, along X' },
                width: { type: 'NUMBER', description: 'meters, along Y' },
                height: { type: 'NUMBER', description: 'meters, along Z' },
                wheelbase: { type: 'NUMBER', description: 'meters, distance between left/right drive wheels' },
                wheelRadius: { type: 'NUMBER', description: 'meters' },
                totalMassKg: { type: 'NUMBER' },
                estimatedFields: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                  description: 'Names of the chassis fields above that you could NOT confidently resolve from the actual repo content and are therefore your engineering estimate, not a real extracted value.',
                },
              },
              required: ['length', 'width', 'height', 'wheelbase', 'wheelRadius', 'totalMassKg', 'estimatedFields'],
            },
            sensors: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING', description: 'Human-readable sensor name/model, e.g. "SLAMTEC RPLidar A1M8"' },
                  type: { type: 'STRING', description: 'e.g. "2D Laser Scanner (LiDAR)", "RGB Camera", "6-Axis IMU"' },
                  linkName: { type: 'STRING' },
                  parentLink: { type: 'STRING' },
                  positionX: { type: 'NUMBER' },
                  positionY: { type: 'NUMBER' },
                  positionZ: { type: 'NUMBER' },
                  orientationR: { type: 'NUMBER' },
                  orientationP: { type: 'NUMBER' },
                  orientationY: { type: 'NUMBER' },
                  frameId: { type: 'STRING' },
                  sourceFile: { type: 'STRING' },
                  estimated: { type: 'BOOLEAN', description: 'true if this exact position/orientation could not be confidently resolved (e.g. blocked by unresolvable Xacro indirection) and is a placeholder, not a real value' },
                },
                required: ['name', 'type', 'linkName', 'parentLink', 'positionX', 'positionY', 'positionZ', 'orientationR', 'orientationP', 'orientationY', 'frameId', 'estimated'],
              },
            },
            gazeboPlugins: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  targetLink: { type: 'STRING' },
                  sensorType: { type: 'STRING' },
                  pluginSystem: { type: 'STRING' },
                  rosTopic: { type: 'STRING' },
                  rosMessageType: { type: 'STRING' },
                },
                required: ['name', 'targetLink', 'sensorType', 'pluginSystem', 'rosTopic', 'rosMessageType'],
              },
            },
            topics: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  topic: { type: 'STRING' },
                  type: { type: 'STRING', description: 'ROS message type, e.g. sensor_msgs/msg/LaserScan' },
                  direction: { type: 'STRING', enum: ['Publisher', 'Subscriber'] },
                  nodeOwner: { type: 'STRING' },
                  description: { type: 'STRING' },
                },
                required: ['topic', 'type', 'direction', 'nodeOwner', 'description'],
              },
            },
            robotModels: {
              type: 'ARRAY',
              description: 'Every distinct robot model/variant this repository actually defines (e.g. different chassis sizes or sensor loadouts selectable via an env var, launch arg, or separate URDF/SDF files per model). If the repo defines only one robot, still submit it as a single entry here. This field is mandatory and every value in it must be grounded in files you actually opened — never invent a file path, a sensor, or a role/purpose you did not verify. If you cannot verify simulationAssets for a variant, submit an empty array for it rather than guessing a path.',
              items: {
                type: 'OBJECT',
                properties: {
                  modelName: { type: 'STRING', description: 'Human-readable name, e.g. "TurtleBot3 Burger"' },
                  modelVariable: { type: 'STRING', description: 'The real identifier/token used to select this variant in the code — an env var value, launch argument, or filename suffix, e.g. "burger"' },
                  formFactor: { type: 'STRING', description: 'One-line real chassis/sensor summary for this specific variant' },
                  rolePurpose: { type: 'STRING', description: "What this specific variant is for / how it differs from the other variants, from real evidence (README, package description, comments) — not invented" },
                  actuatorsSensors: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'Real actuators and sensors this specific variant has, read from its actual URDF/SDF — not a generic guess shared across all variants.',
                  },
                  simulationAssets: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        label: { type: 'STRING', description: 'e.g. "URDF", "SDF", "Gazebo Bridge Config"' },
                        path: { type: 'STRING', description: 'Real repo-relative file path for this variant' },
                      },
                      required: ['label', 'path'],
                    },
                    description: 'Real file paths in this repo specific to this variant — every path must be one you actually resolved or read, never guessed from a naming convention.',
                  },
                },
                required: ['modelName', 'modelVariable', 'formFactor', 'rolePurpose', 'actuatorsSensors', 'simulationAssets'],
              },
            },
            reasoningSummary: { type: 'STRING', description: 'Two or three sentences on what you found and any notable uncertainty.' },
          },
          required: ['robotName', 'rosVersion', 'chassis', 'sensors', 'gazeboPlugins', 'topics', 'robotModels', 'reasoningSummary'],
        },
      },
    ],
  },
];

const SYSTEM_INSTRUCTION = `You are a robotics codebase auditor. You are given the file tree of a ROS/ROS2 GitHub repository (filtered to URDF/Xacro, YAML, launch, and package.xml files) and a read_file tool to fetch any file's real content.

Your job: determine the robot's real physical chassis dimensions, every physical sensor's real link name and joint origin (position + orientation), any Gazebo/Ignition simulation plugins, and the ROS topics they publish/subscribe.

Critical rule: many robot description packages define geometry via Xacro macros with \${property} placeholders (e.g. <box size="\${chassis_length} \${chassis_width} \${chassis_height}"/>) whose real values live in a separate YAML file loaded via xacro.load_yaml(...) or a sibling *.yaml config. When you see this pattern, find and read that YAML file to resolve the real numbers — do not guess. Also watch for xacro:include chains — the file that defines a <joint> or <link> is often not the top-level URDF file.

Be careful matching joint/link names: a joint whose name merely contains a keyword (e.g. "lidar_base_joint" connecting a mounting plate) is NOT the same as the actual sensor's own joint (e.g. "rplidar_laser_joint") — trace to the real sensor-bearing link, not an intermediate mounting link.

Accuracy matters far more than speed here — a wrong number that looks confident is worse than admitting you couldn't find it. Before giving up on a field, make sure you've actually opened every YAML file a relevant xacro:property/xacro.load_yaml call references, not just the top-level URDF. If you truly cannot resolve a value after that real effort (no literal number anywhere in the reachable files), fill in a reasonable engineering estimate for a small-to-medium mobile ground robot and explicitly list that field as estimated — the caller discards estimated numbers entirely and shows "not determined" instead, so an honest estimated=true costs nothing, but a wrong confident value is a real bug users will see.

Prioritize files in this order: (1) the main URDF/xacro entry point — usually named after the robot or repo, or referenced from a launch file, not a fragment under an "include/" folder — (2) files it directly includes via xacro:include, (3) YAML files those includes load via xacro.load_yaml or a matching filename convention, (4) package.xml for dependency context. Don't stop at the first file that mentions a sensor keyword — verify you're looking at the actual sensor-bearing joint, not an intermediate mounting link, by checking the parent/child link names make sense. When you have enough information, call submit_analysis exactly once.

Multiple robot models: some repos define more than one robot variant — multiple URDF/SDF files sitting side by side directly in a urdf/ folder (not nested under include/), often selected at runtime via an environment variable, launch argument, or filename suffix (e.g. turtlebot3_burger.urdf, turtlebot3_waffle.urdf, turtlebot3_waffle_pi.urdf all in the same package). When you see this pattern, open each variant's own URDF/SDF and any config file specific to it, and report every one of them in robotModels with its own real actuators/sensors and its own real file paths — do not describe one variant and copy its details onto the others. This field is mandatory: submit one entry even for a single-robot repo. Never pad it with a made-up file path or a sensor you didn't actually see in that variant's own file — an honest empty simulationAssets array is fine, a guessed path is not.`;

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, any> };
  functionResponse?: { name: string; response: Record<string, any> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

const RATE_LIMIT_RETRY_DELAYS_MS = [15_000, 30_000, 45_000];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// The agent loop can fire up to MAX_TOOL_ITERATIONS sequential calls for a
// single audit — comfortably enough to blow through a free-tier per-minute
// quota on any real repo (even Andino, a small one, needs a dozen-plus
// read_file calls). A 429 here is almost always transient (the same key
// recovers within a minute), so retry with backoff before giving up and
// falling back to the regex parser — a temporary rate limit shouldn't
// silently downgrade every audit to the less accurate path.
async function callGemini(
  apiKey: string,
  contents: GeminiContent[],
  forceSubmit: boolean,
  onEvent?: (log: string) => void
) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          tools: TOOLS,
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
      onEvent?.(`Rate limited by the Gemini API — waiting ${delayMs / 1000}s before retrying (attempt ${attempt + 1}/${RATE_LIMIT_RETRY_DELAYS_MS.length})...`);
      await sleep(delayMs);
      continue;
    }

    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }
}

type ResolveResult = { path: string } | { ambiguous: string[] } | null;

// A repo with several sub-packages can easily have two files with the same
// basename (e.g. two different `base.yaml`, one per robot variant). Silently
// picking the first match would let the agent read the wrong package's
// config and confidently report a value that belongs to a different robot
// entirely — worse than not resolving it at all. Ambiguous matches are
// surfaced back to the agent as a list to choose from, never guessed.
function resolveFilePath(requestedPath: string, availablePaths: string[]): ResolveResult {
  if (availablePaths.includes(requestedPath)) return { path: requestedPath };

  // Resolve package://pkg_name/rel/path.ext by finding a matching real path
  const pkgMatch = requestedPath.match(/^package:\/\/([^/]+)\/(.+)$/);
  if (pkgMatch) {
    const [, pkgName, relPath] = pkgMatch;
    const candidates = availablePaths.filter(p => p.includes(`/${pkgName}/`) && p.endsWith(relPath));
    if (candidates.length === 1) return { path: candidates[0] };
    if (candidates.length > 1) return { ambiguous: candidates };
  }

  // Fall back to matching by basename if the model got the directory wrong
  const basename = requestedPath.split('/').pop();
  if (basename) {
    const candidates = availablePaths.filter(p => p.endsWith(`/${basename}`) || p === basename);
    if (candidates.length === 1) return { path: candidates[0] };
    if (candidates.length > 1) return { ambiguous: candidates };
  }

  return null;
}

export async function runAgenticAnalysis(
  owner: string,
  repo: string,
  branch: string,
  relevantPaths: string[],
  onEvent: (log: string) => void
): Promise<AgenticAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const fileListText = relevantPaths.map(p => `- ${p}`).join('\n');
  const contents: GeminiContent[] = [
    {
      role: 'user',
      parts: [{
        text: `Repository: ${owner}/${repo} (branch: ${branch})\n\nRelevant files (URDF/Xacro, YAML, launch, package.xml):\n${fileListText}\n\nBegin your analysis. Use read_file to explore, then call submit_analysis with your findings.`,
      }],
    },
  ];

  let toolCallCount = 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const forceSubmit = iteration === MAX_TOOL_ITERATIONS - 1;
    const modelTurn = await callGemini(apiKey, contents, forceSubmit, onEvent);
    contents.push(modelTurn);

    const functionCalls = modelTurn.parts.filter(p => p.functionCall).map(p => p.functionCall!);
    if (functionCalls.length === 0) {
      // Model returned plain text instead of a tool call — nudge it once.
      contents.push({ role: 'user', parts: [{ text: 'Please continue by calling read_file or submit_analysis.' }] });
      continue;
    }

    const responseParts: GeminiPart[] = [];
    for (const call of functionCalls) {
      toolCallCount++;

      if (call.name === SUBMIT_TOOL_NAME) {
        const args = call.args as any;
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
          })),
          reasoningSummary: args.reasoningSummary || '',
          toolCallCount,
        };
      }

      if (call.name === READ_FILE_TOOL_NAME) {
        const requestedPath = call.args.path as string;
        const resolved = resolveFilePath(requestedPath, relevantPaths);

        if (!resolved) {
          onEvent(`Agent requested '${requestedPath}' — not found in this repository.`);
          responseParts.push({
            functionResponse: { name: call.name, response: { error: `File not found: ${requestedPath}. Check the file list for the exact path.` } },
          });
          continue;
        }

        if ('ambiguous' in resolved) {
          onEvent(`Agent requested '${requestedPath}' — ambiguous, ${resolved.ambiguous.length} files share that name.`);
          responseParts.push({
            functionResponse: { name: call.name, response: { error: `Ambiguous path — multiple files match '${requestedPath}': ${resolved.ambiguous.join(', ')}. Specify the exact one for the correct package.` } },
          });
          continue;
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
          responseParts.push({
            functionResponse: { name: call.name, response: { path: resolvedPath, content: text, truncated } },
          });
        } catch (err: any) {
          responseParts.push({
            functionResponse: { name: call.name, response: { error: `Failed to fetch ${resolvedPath}: ${err.message}` } },
          });
        }
        continue;
      }

      responseParts.push({
        functionResponse: { name: call.name, response: { error: `Unknown tool: ${call.name}` } },
      });
    }

    contents.push({ role: 'user', parts: responseParts });
  }

  throw new Error(`Agent did not submit an analysis within ${MAX_TOOL_ITERATIONS} tool-call iterations`);
}
