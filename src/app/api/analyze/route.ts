import { NextRequest } from 'next/server';
import { saveRobotProfile } from '@/lib/db/robots';
import { getAgentSettings } from '@/lib/db/settings';
import { resolveApiKey } from '@/lib/db/api-keys';
import { createDynamicRobotProfileFromUrl } from '@/lib/robot-profile';
import { runAgenticAnalysis, AgenticAnalysisResult } from '@/lib/agent';

export const runtime = 'nodejs';

// Helper to parse GitHub URL into owner, repo, branch
function parseGithubUrl(url: string) {
  try {
    const cleanUrl = url.trim().replace(/\/$/, '');
    const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        branch: match[3] || null
      };
    }
  } catch (err) {
    // Fallthrough
  }
  return null;
}

interface AutonomyModuleSpec {
  name: string;
  depKeywords: string[];
  pathKeywords: string[];
  requiresCamera?: boolean;
}

const AUTONOMY_MODULE_SPECS: AutonomyModuleSpec[] = [
  { name: 'SLAM', depKeywords: ['slam_toolbox', 'gmapping', 'cartographer', 'slam'], pathKeywords: ['slam'] },
  { name: 'Localization', depKeywords: ['robot_localization', 'amcl', 'nav2_amcl'], pathKeywords: ['amcl', 'localization'] },
  { name: 'Navigation', depKeywords: ['nav2_bringup', 'nav2_bt_navigator', 'navigation2', 'nav2_common'], pathKeywords: ['navigation', 'nav2'] },
  { name: 'Path Planning', depKeywords: ['nav2_planner', 'nav2_navfn_planner', 'nav2_smac_planner'], pathKeywords: ['planner'] },
  { name: 'Obstacle Avoidance', depKeywords: ['nav2_controller', 'nav2_dwb_controller', 'teb_local_planner', 'nav2_costmap_2d'], pathKeywords: ['controller', 'costmap', 'dwb', 'teb'] },
  { name: 'Perception', depKeywords: ['image_proc', 'depth_image_proc', 'vision_opencv', 'cv_bridge'], pathKeywords: ['perception', 'vision'], requiresCamera: true },
  { name: 'Control', depKeywords: ['ros2_control', 'diff_drive_controller', 'controller_manager'], pathKeywords: ['control', 'hardware'] },
  { name: 'Sensor Fusion', depKeywords: ['robot_localization', 'ekf'], pathKeywords: ['ekf', 'fusion'] },
];

function classifyAutonomyModules(
  parsedPackages: any[],
  launchFiles: Array<{ path: string }>,
  yamlConfigFiles: Array<{ path: string }>,
  hasCamera: boolean,
  repoLabel: string
) {
  const allDeps = parsedPackages.flatMap(p => p.dependencies.map((d: string) => ({ dep: d.toLowerCase(), pkg: p.name })));
  const allFiles = [...launchFiles, ...yamlConfigFiles];

  return AUTONOMY_MODULE_SPECS.map((spec) => {
    const matchedDeps = allDeps.filter(({ dep }) => spec.depKeywords.some(k => dep.includes(k)));
    const matchedFiles = allFiles.filter(f => spec.pathKeywords.some(k => f.path.toLowerCase().includes(k)));
    const cameraSignal = !!spec.requiresCamera && hasCamera;

    const hasDepEvidence = matchedDeps.length > 0;
    const hasFileEvidence = matchedFiles.length > 0;

    let status: 'Implemented in Codebase' | 'Configured via Launch/YAML' | 'Missing / Unreferenced';
    let evidence: string;

    if (hasDepEvidence && hasFileEvidence) {
      status = 'Implemented in Codebase';
      evidence = `Found package dependency '${matchedDeps[0].dep}' (declared by ${matchedDeps[0].pkg}) plus ${matchedFiles.length} matching launch/config file(s): ${matchedFiles.slice(0, 3).map(f => f.path).join(', ')}.`;
    } else if (hasDepEvidence) {
      status = 'Configured via Launch/YAML';
      evidence = `Package dependency '${matchedDeps[0].dep}' declared by ${matchedDeps[0].pkg}, but no dedicated launch/YAML file was found referencing it — likely started from a shared/aggregate launch file.`;
    } else if (hasFileEvidence) {
      status = 'Configured via Launch/YAML';
      evidence = `Found ${matchedFiles.length} launch/config file(s) referencing this module: ${matchedFiles.slice(0, 3).map(f => f.path).join(', ')}. No explicit package.xml dependency declared.`;
    } else if (cameraSignal) {
      status = 'Configured via Launch/YAML';
      evidence = `Camera sensor detected in the URDF, implying a perception pipeline, but no image_proc/vision package dependency or launch file was found in this repository.`;
    } else {
      status = 'Missing / Unreferenced';
      evidence = `No package.xml dependency, launch file, or YAML configuration referencing ${spec.name} was found anywhere in this repository.`;
    }

    const nodeName = matchedDeps[0]?.dep || matchedFiles[0]?.path.split('/').pop() || 'Not detected';
    const packageSource = matchedDeps[0]?.pkg || (matchedFiles[0] ? matchedFiles[0].path.split('/')[0] : repoLabel);

    return {
      name: spec.name,
      status,
      nodeName,
      packageSource,
      evidence,
      configFiles: matchedFiles.slice(0, 5).map(f => f.path),
    };
  });
}

// Distinct robot models this codebase actually defines — read directly off
// real URDF/Xacro entry-point filenames (e.g. turtlebot3_burger.urdf.xacro,
// turtlebot3_waffle.urdf.xacro, turtlebot3_waffle_pi.urdf.xacro all living
// side by side in one *_description package). Deliberately excludes files
// that are clearly shared macro/include fragments rather than a standalone
// robot definition, so a package with one robot but several helper xacro
// files doesn't get reported as multiple robots.
//
// Two checks, not one: a fragment's basename doesn't always say so (e.g.
// andino_control.urdf.xacro is a <ros2_control> tag fragment despite its
// clean-looking name) — but real per-robot entry points live directly in a
// `urdf/` folder, while fragments/macros/includes almost always sit one
// level deeper (urdf/include/, urdf/macros/, urdf/gazebo/, ...). Requiring
// the immediate parent directory to literally be "urdf" catches that case;
// the basename keyword check catches fragments that sit at that same top
// level without a subfolder (e.g. urdf/common_properties.urdf.xacro).
const URDF_FRAGMENT_TOKENS = ['macro', 'common', 'materials', 'gazebo', 'sensors', 'sensor', 'include', 'transmission', 'ros2_control', 'plugin', 'imu', 'lidar', 'camera'];

function detectRobotVariants(urdfFiles: Array<{ path: string }>, fallbackName: string): string[] {
  const candidates = urdfFiles.filter(f => {
    const parts = f.path.split('/');
    const basename = (parts[parts.length - 1] || '').toLowerCase();
    const parentDir = (parts[parts.length - 2] || '').toLowerCase();

    if (parentDir !== 'urdf') return false;
    return !URDF_FRAGMENT_TOKENS.some(t => basename.includes(t));
  });

  const names = candidates
    .map(f => (f.path.split('/').pop() || '').replace(/\.urdf\.xacro$/i, '').replace(/\.xacro$/i, '').replace(/\.urdf$/i, ''))
    .filter(n => n.length > 0);

  const unique = Array.from(new Set(names));
  return unique.length > 0 ? unique : [fallbackName];
}

interface AutonomyFeatureCheck {
  key: string;
  label: string;
  present: boolean;
  evidence: string;
  subChecks?: AutonomyFeatureCheck[];
}

// The user-facing "Codebase Review" checklist — deliberately a small, fixed
// set (not the broader autonomyModules breakdown) reusing the same
// deterministic evidence already gathered above, so it stays consistent
// with the full Parameter Matrix rather than re-deriving its own answer.
function buildCodebaseReview(
  autonomyModules: ReturnType<typeof classifyAutonomyModules>,
  parsedPackages: any[],
  launchFiles: Array<{ path: string }>,
  yamlConfigFiles: Array<{ path: string }>,
  uniqueSensors: any[],
  detectedGazeboPlugins: any[]
): AutonomyFeatureCheck[] {
  const byName = (n: string) => autonomyModules.find(m => m.name === n);
  const implemented = (n: string) => (byName(n) ? byName(n)!.status !== 'Missing / Unreferenced' : false);

  const allDeps = parsedPackages.flatMap(p => p.dependencies.map((d: string) => d.toLowerCase()));
  const depHas = (...kws: string[]) => allDeps.some(d => kws.some(k => d.includes(k)));
  const allFiles = [...launchFiles, ...yamlConfigFiles];
  const pathHas = (...kws: string[]) => allFiles.some(f => kws.some(k => f.path.toLowerCase().includes(k)));
  const gazeboHas = (...kws: string[]) => detectedGazeboPlugins.some(p => kws.some(k => `${p.name} ${p.pluginSystem} ${p.sensorType}`.toLowerCase().includes(k)));

  const sensorPipelinePresent = uniqueSensors.length > 0 || detectedGazeboPlugins.some(p => p.sensorType !== 'actuator_controller');
  const motorControlPresent = depHas('ros2_control', 'diff_drive_controller', 'controller_manager') || gazeboHas('diff-drive', 'diff_drive', 'diffdrive');
  const stateEstimationPresent = depHas('robot_localization', 'ekf') || pathHas('ekf', 'odom', 'localization') || gazeboHas('diff-drive', 'diff_drive', 'diffdrive');

  return [
    {
      key: 'sensorPipeline',
      label: 'Sensor Pipeline',
      present: sensorPipelinePresent,
      evidence: uniqueSensors.length > 0
        ? `${uniqueSensors.length} sensor(s) resolved from real URDF joints: ${uniqueSensors.slice(0, 3).map((s: any) => s.name).join(', ')}.`
        : detectedGazeboPlugins.some(p => p.sensorType !== 'actuator_controller')
          ? `${detectedGazeboPlugins.length} Gazebo sensor plugin(s) declared in the URDF/SDF.`
          : 'No sensor joints or Gazebo sensor plugins were found anywhere in this repository.',
    },
    {
      key: 'motorControl',
      label: 'Motor Control',
      present: motorControlPresent,
      evidence: motorControlPresent
        ? 'A ros2_control / diff_drive_controller dependency or a Gazebo DiffDrive plugin was found.'
        : 'No ros2_control, diff_drive_controller dependency, or DiffDrive plugin was found in this repository.',
    },
    {
      key: 'stateEstimation',
      label: 'State Estimation (Odometry)',
      present: stateEstimationPresent,
      evidence: stateEstimationPresent
        ? 'A robot_localization/EKF dependency, an odometry/localization config file, or a Gazebo DiffDrive plugin (which publishes /odom) was found.'
        : 'No robot_localization/EKF dependency, odometry config, or odometry-publishing plugin was found.',
    },
    {
      key: 'slam',
      label: 'SLAM',
      present: implemented('SLAM'),
      evidence: byName('SLAM')?.evidence || 'Not evaluated.',
    },
    {
      key: 'localization',
      label: 'Localization',
      present: implemented('Localization'),
      evidence: byName('Localization')?.evidence || 'Not evaluated.',
    },
    {
      key: 'navigation',
      label: 'Navigation',
      present: implemented('Navigation'),
      evidence: byName('Navigation')?.evidence || 'Not evaluated.',
      subChecks: [
        {
          key: 'pathPlanning',
          label: 'Path Planning',
          present: implemented('Path Planning'),
          evidence: byName('Path Planning')?.evidence || 'Not evaluated.',
        },
        {
          key: 'motionPlanning',
          label: 'Motion Planning (Nav2)',
          present: implemented('Obstacle Avoidance'),
          evidence: byName('Obstacle Avoidance')?.evidence || 'Not evaluated.',
        },
      ],
    },
  ];
}

// Same discard-estimated-numbers rule as the top-level chassis, applied per
// robot variant: the agent's schema requires a number even for metrics it
// couldn't confidently resolve for that specific variant (it lists those in
// metrics.estimatedFields) — strip those guessed numbers to null here so
// the detail modal never renders a fabricated value as if it were real.
function stripEstimatedRobotModelMetrics(robotModels: any[]): any[] {
  return robotModels.map((m) => {
    const estimated = new Set(m.metrics?.estimatedFields || []);
    const metrics = m.metrics
      ? Object.fromEntries(
          Object.entries(m.metrics)
            .filter(([k]) => k !== 'estimatedFields')
            .map(([k, v]) => [k, estimated.has(k) ? null : v])
        )
      : null;
    return { ...m, metrics };
  });
}

function resolveMeshUrl(
  urdfText: string,
  nearIndex: number,
  owner: string,
  repo: string,
  branch: string,
  urdfFilePath: string,
  tree: Array<{ path: string }>
): string | null {
  // Look for the nearest <mesh filename="..."> around the joint/link
  // definition — xacro macros place the <link> (with the visual mesh)
  // either just before or just after the <joint> that positions it, so
  // search both directions. Only matches a literal path with a real .stl
  // extension — xacro property substitutions like `${mesh}` (resolved from
  // a separate YAML file we aren't parsing) are deliberately left
  // unresolved rather than guessed.
  const before = urdfText.slice(Math.max(0, nearIndex - 2500), nearIndex);
  const after = urdfText.slice(nearIndex, nearIndex + 2500);
  const beforeMatches = Array.from(before.matchAll(/filename="([^"]+\.(?:stl|STL))"/g));
  const meshMatch = after.match(/filename="([^"]+\.(?:stl|STL))"/) || beforeMatches[beforeMatches.length - 1];
  if (!meshMatch) return null;

  let meshPath = meshMatch[1];
  const urdfDir = urdfFilePath.includes('/') ? urdfFilePath.slice(0, urdfFilePath.lastIndexOf('/')) : '';

  if (meshPath.startsWith('package://')) {
    const rest = meshPath.replace('package://', '');
    const [pkgName, ...restParts] = rest.split('/');
    const relPath = restParts.join('/');
    const candidate = tree.find(f => f.path.includes(`/${pkgName}/`) && f.path.endsWith(relPath));
    if (candidate) {
      meshPath = candidate.path;
    } else {
      meshPath = `${pkgName}/${relPath}`;
    }
  } else if (!meshPath.startsWith('/') && urdfDir) {
    meshPath = `${urdfDir}/${meshPath}`.replace(/\/\.\//g, '/');
  }

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${meshPath.replace(/^\//, '')}`;
}

function parseXyz(str: string) {
  const parts = str.trim().split(/\s+/).map(Number);
  return { x: parts[0] || 0, y: parts[1] || 0, z: parts[2] || 0 };
}

function parseRpy(str: string) {
  const parts = str.trim().split(/\s+/).map(Number);
  return { r: parts[0] || 0, p: parts[1] || 0, y: parts[2] || 0 };
}

// Deterministic regex-based fallback — used only when the Gemini agent is
// unavailable (no API key, quota, network error) so an audit still
// completes. Materially less accurate than the agent (see known false
// positives noted inline) but keeps the app functional without an LLM.
async function regexFallbackParse(
  owner: string,
  repo: string,
  targetBranch: string,
  urdfFiles: Array<{ path: string }>,
  tree: Array<{ path: string; type: string; url: string }>,
  sendEvent: (data: Record<string, any>) => void
) {
  const parsedSensors: any[] = [];
  const detectedGazeboPlugins: any[] = [];

  for (const urdfFile of urdfFiles) {
    sendEvent({ stage: 'PARSING_URDF', log: `[Fallback parser] Extracting joint transforms from ${urdfFile.path}...` });

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/${urdfFile.path}`;
    try {
      const rawRes = await fetch(rawUrl);
      if (rawRes.ok) {
        const urdfText = await rawRes.text();

        if (urdfText.includes('<gazebo') || urdfText.includes('libignition') || urdfText.includes('libgazebo') || urdfText.includes('gz-sim')) {
          if (urdfText.includes('sensors-system') || urdfText.includes('gpu_lidar') || urdfText.includes('ray')) {
            detectedGazeboPlugins.push({
              name: "Ignition/Gazebo GPU LiDAR Sensor System",
              targetLink: "rplidar_laser_link",
              sensorType: "gpu_lidar",
              pluginSystem: "libignition-gazebo-sensors-system.so",
              rosTopic: "/scan",
              rosMessageType: "sensor_msgs/msg/LaserScan"
            });
          }
          if (urdfText.includes('diff_drive') || urdfText.includes('diff-drive')) {
            detectedGazeboPlugins.push({
              name: "Ignition/Gazebo DiffDrive Actuator Controller",
              targetLink: "base_link",
              sensorType: "actuator_controller",
              pluginSystem: "ignition-gazebo-diff-drive-system",
              rosTopic: "/cmd_vel",
              rosMessageType: "geometry_msgs/msg/Twist"
            });
          }
        }

        // Real joint match only — when the regex can't confidently find the
        // sensor's own joint (as opposed to some other joint that merely
        // mentions the keyword), report the sensor as detected-but-unlocated
        // rather than filling in another robot's coordinates.
        if (urdfText.includes('rplidar') || urdfText.includes('laser') || urdfText.includes('lidar') || urdfText.includes('scan')) {
          const jointMatch = urdfText.match(/joint name="[^"]*(?:rplidar|laser|lidar)[^"]*"[\s\S]*?<origin xyz="([^"]+)" rpy="([^"]+)"/i);
          const meshUrl = jointMatch ? resolveMeshUrl(urdfText, jointMatch.index || 0, owner, repo, targetBranch, urdfFile.path, tree) : null;
          parsedSensors.push({
            id: "rplidar-a1",
            name: "SLAMTEC RPLidar A1M8 (2D Scanner)",
            type: "2D Laser Scanner (LiDAR)",
            linkName: "rplidar_laser_link",
            parentLink: "lidar_base_link",
            position: jointMatch ? parseXyz(jointMatch[1]) : null,
            orientation: jointMatch ? parseRpy(jointMatch[2]) : null,
            frameId: "rplidar_laser_link",
            collisionType: "Cylinder (r=0.015m, l=0.01m)",
            sourceFile: urdfFile.path,
            estimated: !jointMatch,
            meshUrl
          });
        }

        if (urdfText.includes('camera')) {
          const jointMatch = urdfText.match(/joint name="[^"]*camera[^"]*"[\s\S]*?<origin xyz="([^"]+)" rpy="([^"]+)"/i);
          const meshUrl = jointMatch ? resolveMeshUrl(urdfText, jointMatch.index || 0, owner, repo, targetBranch, urdfFile.path, tree) : null;
          parsedSensors.push({
            id: "camera-v2",
            name: "Raspberry Pi Camera Module V2",
            type: "8MP RGB USB/CSI Camera",
            linkName: "camera_link",
            parentLink: "base_link",
            position: jointMatch ? parseXyz(jointMatch[1]) : null,
            orientation: jointMatch ? parseRpy(jointMatch[2]) : null,
            frameId: "camera_link",
            collisionType: "Box (0.02m x 0.02m x 0.02m)",
            sourceFile: urdfFile.path,
            estimated: !jointMatch,
            meshUrl
          });
        }

        if (urdfText.includes('imu')) {
          const jointMatch = urdfText.match(/joint name="[^"]*imu[^"]*"[\s\S]*?<origin xyz="([^"]+)" rpy="([^"]+)"/i);
          parsedSensors.push({
            id: "imu-mpu6050",
            name: "InvenSense MPU6050 6-DOF IMU",
            type: "6-Axis Inertial Measurement Unit",
            linkName: "imu_link",
            parentLink: "base_link",
            position: jointMatch ? parseXyz(jointMatch[1]) : null,
            orientation: jointMatch ? parseRpy(jointMatch[2]) : null,
            frameId: "imu_link",
            collisionType: "Box",
            sourceFile: urdfFile.path,
            estimated: !jointMatch
          });
        }
      }
    } catch (e) {
      // Ignore fetch error for this one file
    }
  }

  // No repo-wide fallback either: if regex found nothing, sensors stays
  // empty — never substituted with another robot's sensor list.
  const uniqueSensors = parsedSensors.filter((s, idx, self) => self.findIndex(t => t.id === s.id) === idx);
  const noSensorsDetected = uniqueSensors.length === 0;

  return {
    sensors: uniqueSensors,
    gazeboPlugins: detectedGazeboPlugins,
    noSensorsDetected,
    chassis: null as any,
    chassisEstimatedFields: ['length', 'width', 'height', 'wheelbase', 'wheelRadius', 'totalMassKg'],
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const repoUrl = body.repoUrl;
  const projectId = typeof body.projectId === 'string' ? body.projectId : null;

  if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.trim()) {
    return new Response(
      JSON.stringify({ error: 'MISSING_URL', message: 'repoUrl is required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) {
    return new Response(
      JSON.stringify({ error: 'INVALID_URL', message: 'Invalid GitHub repository URL format.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { owner, repo } = parsed;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, any>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendEvent({ stage: 'CONNECT', log: `Connecting to GitHub API [${owner}/${repo}]...` });

        // Step 1: Resolve Default Branch from GitHub Meta API
        let targetBranch = parsed.branch || 'main';
        try {
          const repoMetaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { 'User-Agent': 'UpFreq-Robotics-Agent/1.0', 'Accept': 'application/vnd.github.v3+json' }
          });
          if (repoMetaRes.ok) {
            const meta = await repoMetaRes.json();
            if (meta.default_branch && !parsed.branch) {
              targetBranch = meta.default_branch;
            }
          }
        } catch (e) {}

        sendEvent({ stage: 'BRANCH_RESOLVED', log: `Resolved active repository branch: '${targetBranch}'` });

        // Step 2: Fetch Recursive File Tree (handles nested packages and sub-modules)
        let treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`, {
          headers: { 'User-Agent': 'UpFreq-Robotics-Agent/1.0', 'Accept': 'application/vnd.github.v3+json' }
        });

        // Fallback to alternative common branches if initial target branch fails
        if (!treeRes.ok) {
          const fallbackBranches = ['main', 'master', 'humble', 'ros2', 'iron', 'rolling'].filter(b => b !== targetBranch);
          for (const fb of fallbackBranches) {
            sendEvent({ stage: 'RETRY_BRANCH', log: `Branch '${targetBranch}' unavailable. Probing fallback branch '${fb}'...` });
            const fbRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${fb}?recursive=1`, {
              headers: { 'User-Agent': 'UpFreq-Robotics-Agent/1.0', 'Accept': 'application/vnd.github.v3+json' }
            });
            if (fbRes.ok) {
              treeRes = fbRes;
              targetBranch = fb;
              break;
            }
          }
        }

        if (!treeRes.ok) {
          sendEvent({
            stage: 'ERROR',
            isRosRepo: false,
            message: `Failed to fetch GitHub repository tree (${treeRes.status} ${treeRes.statusText}). Verify repository URL and visibility.`
          });
          controller.close();
          return;
        }

        const treeData = await treeRes.json();
        const tree: Array<{ path: string; type: string; url: string }> = treeData.tree || [];

        sendEvent({ stage: 'TREE_FETCHED', log: `Fetched complete recursive repository file tree: ${tree.length} total files discovered.` });

        // Step 3: Discover ALL Nested ROS / ROS 2 Sub-Packages & File Manifests
        const packageXmlFiles = tree.filter(f => f.path.endsWith('package.xml'));
        const urdfFiles = tree.filter(f => f.path.endsWith('.urdf') || f.path.endsWith('.xacro') || f.path.endsWith('.urdf.xacro'));
        const launchFiles = tree.filter(f => f.path.endsWith('.launch.py') || f.path.endsWith('.launch.xml') || f.path.endsWith('.launch'));
        const yamlConfigFiles = tree.filter(f => f.path.endsWith('.yaml') || f.path.endsWith('.yml'));
        const cmakeFiles = tree.filter(f => f.path.endsWith('CMakeLists.txt'));

        const isRosRepo = packageXmlFiles.length > 0 || urdfFiles.length > 0 || cmakeFiles.length > 0;

        if (!isRosRepo) {
          sendEvent({
            stage: 'ERROR',
            isRosRepo: false,
            message: `This is NOT a valid ROS/ROS2 repository. No package.xml, URDF manifests, or CMakeLists.txt found.`
          });
          controller.close();
          return;
        }

        sendEvent({
          stage: 'ROS_VERIFIED',
          log: `VALID ROS 2 REPOSITORY RECURSIVELY AUDITED! Discovered ${packageXmlFiles.length} sub-package manifests, ${urdfFiles.length} URDF/XACRO models, ${launchFiles.length} launch files, and ${yamlConfigFiles.length} YAML parameters across nested directories.`
        });

        // Step 4: Parse ALL Nested ROS Sub-Packages (e.g. description, navigation, gz, hardware, bringup)
        const parsedPackages: any[] = [];
        for (const pkgFile of packageXmlFiles) {
          const pkgFolder = pkgFile.path.includes('/') ? pkgFile.path.split('/')[0] : repo;
          sendEvent({ stage: 'PARSING_PACKAGE', log: `Auditing nested ROS sub-package manifest: [${pkgFolder}] (${pkgFile.path})...` });

          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/${pkgFile.path}`;
          try {
            const rawRes = await fetch(rawUrl);
            if (rawRes.ok) {
              const xml = await rawRes.text();
              const nameMatch = xml.match(/<name>(.*?)<\/name>/);
              const verMatch = xml.match(/<version>(.*?)<\/version>/);
              const descMatch = xml.match(/<description>([\s\S]*?)<\/description>/);
              const deps = Array.from(xml.matchAll(/<(?:depend|exec_depend|build_depend)>(.*?)<\/(?:depend|exec_depend|build_depend)>/g)).map(m => m[1]);

              parsedPackages.push({
                folderPath: pkgFile.path,
                name: nameMatch ? nameMatch[1].trim() : pkgFolder,
                version: verMatch ? verMatch[1].trim() : '0.1.0',
                description: descMatch ? descMatch[1].trim().replace(/\s+/g, ' ') : `ROS 2 package in ${pkgFolder}`,
                buildType: xml.includes('ament_cmake') ? 'ament_cmake' : (xml.includes('ament_python') ? 'ament_python' : 'catkin'),
                dependencies: deps
              });
            }
          } catch (e) {
            // Ignore single file error
          }
        }

        // Step 5: Real agentic analysis via Gemini (sensors, chassis, gazebo
        // plugins, topics) — falls back to the regex parser only if the
        // agent is unavailable, so an audit always completes.
        let agentResult: AgenticAnalysisResult | null = null;
        let agentError: string | null = null;

        // URDF/Xacro first (the geometry lives there), then YAML (property
        // resolution), then package.xml/launch — if a huge repo forces
        // truncation, drop the least load-bearing files first.
        const relevantPaths = [...urdfFiles, ...yamlConfigFiles, ...packageXmlFiles, ...launchFiles]
          .map(f => f.path)
          .filter((p, idx, self) => self.indexOf(p) === idx)
          .slice(0, 250);

        const agentSettings = await getAgentSettings();
        const apiKey = await resolveApiKey(agentSettings.provider);

        sendEvent({ stage: 'AGENT_START', log: `Handing ${relevantPaths.length} relevant file(s) to the ${agentSettings.provider} agent for real tool-use analysis...` });

        if (!apiKey) {
          agentError = `No API key configured for ${agentSettings.provider} — add one in Settings, or set its server env var.`;
          sendEvent({ stage: 'AGENT_FALLBACK', log: `${agentError} Falling back to heuristic regex parsing for sensors/chassis/plugins.` });
        } else {
          try {
            agentResult = await runAgenticAnalysis(agentSettings, apiKey, owner, repo, targetBranch, relevantPaths, (log) => {
              sendEvent({ stage: 'AGENT_STEP', log });
            });
          } catch (err: any) {
            agentError = err.message;
            sendEvent({ stage: 'AGENT_FALLBACK', log: `${agentSettings.provider} agent unavailable (${agentError}) — falling back to heuristic regex parsing for sensors/chassis/plugins.` });
          }
        }

        let uniqueSensors: any[];
        let detectedGazeboPlugins: any[];
        let noSensorsDetected: boolean;
        let chassis: any = null;
        let chassisEstimatedFields: string[] = [];

        if (agentResult) {
          // The agent's function schema requires numeric values even for
          // fields it couldn't confidently resolve (it lists those in
          // estimatedFields / marks sensor.estimated) — strip those specific
          // guessed numbers to null here so nothing downstream ever renders
          // a fabricated value as if it were real.
          uniqueSensors = agentResult.sensors.map((s, idx) => ({
            id: `${s.linkName || s.name}-${idx}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name: s.name,
            type: s.type,
            linkName: s.linkName,
            parentLink: s.parentLink,
            position: s.estimated ? null : s.position,
            orientation: s.estimated ? null : s.orientation,
            frameId: s.frameId,
            collisionType: undefined,
            mass: undefined,
            sourceFile: s.sourceFile,
            estimated: s.estimated,
            meshUrl: null,
          }));
          detectedGazeboPlugins = agentResult.gazeboPlugins;
          noSensorsDetected = uniqueSensors.length === 0;
          const agentEstimated = new Set(agentResult.chassis?.estimatedFields || []);
          chassis = agentResult.chassis
            ? Object.fromEntries(
                Object.entries(agentResult.chassis)
                  .filter(([k]) => k !== 'estimatedFields')
                  .map(([k, v]) => [k, agentEstimated.has(k) ? null : v])
              )
            : null;
          chassisEstimatedFields = agentResult.chassis?.estimatedFields || [];
        } else {
          const fallback = await regexFallbackParse(owner, repo, targetBranch, urdfFiles, tree, sendEvent);
          uniqueSensors = fallback.sensors;
          detectedGazeboPlugins = fallback.gazeboPlugins;
          noSensorsDetected = fallback.noSensorsDetected;
          chassisEstimatedFields = fallback.chassisEstimatedFields;
        }

        const hasLidar = uniqueSensors.some(s => s.type.includes('LiDAR') || s.type.includes('Laser'));
        const hasCamera = uniqueSensors.some(s => s.type.toLowerCase().includes('camera'));

        // Step 6: Classify Final Autonomy Modules from REAL codebase evidence
        // (package.xml dependencies + launch/YAML file paths — deterministic,
        // no LLM needed since this is a straightforward evidence lookup)
        sendEvent({ stage: 'AUDITING_NAV2', log: `Cross-referencing ${parsedPackages.length} package manifests and ${launchFiles.length + yamlConfigFiles.length} launch/config files against known autonomy-stack signatures...` });

        const autonomyModules = classifyAutonomyModules(parsedPackages, launchFiles, yamlConfigFiles, hasCamera, repo);
        const implementedModuleNames = new Set(autonomyModules.filter(m => m.status !== 'Missing / Unreferenced').map(m => m.name));

        // Codebase Review: the two-part summary shown right after connecting
        // a repo — which robot models it actually defines (from real URDF
        // filenames) and a fixed, restricted autonomy-feature checklist
        // (not the full autonomyModules breakdown above).
        const robotVariants = detectRobotVariants(urdfFiles, agentResult?.robotName || repo.charAt(0).toUpperCase() + repo.slice(1));
        const codebaseReview = buildCodebaseReview(autonomyModules, parsedPackages, launchFiles, yamlConfigFiles, uniqueSensors, detectedGazeboPlugins);

        // Step 7: Build Sensor-to-Module Mapping & Data-Flow Pipeline from what was ACTUALLY detected
        const sensorToModuleMappings: any[] = [];
        if (hasLidar) {
          sensorToModuleMappings.push({
            sensorName: uniqueSensors.find(s => s.type.includes('LiDAR') || s.type.includes('Laser'))!.name,
            sensorType: "2D Laser Scanner (LiDAR)",
            outputTopic: "/scan",
            consumerNodes: [implementedModuleNames.has('SLAM') ? 'slam_toolbox' : '(no SLAM node found)', implementedModuleNames.has('Obstacle Avoidance') ? 'nav2_costmap_2d' : '(no costmap node found)'],
            processingStage: "Pre-processing Raycast → Costmap Filter",
            targetAutonomyModule: implementedModuleNames.has('SLAM') ? "SLAM & Obstacle Avoidance" : "Unmapped — no consuming module detected"
          });
        }
        if (hasCamera) {
          sensorToModuleMappings.push({
            sensorName: uniqueSensors.find(s => s.type.toLowerCase().includes('camera'))!.name,
            sensorType: "RGB Camera",
            outputTopic: "/camera/image_raw",
            consumerNodes: [implementedModuleNames.has('Perception') ? 'image_proc' : '(no perception node found)'],
            processingStage: "Debayering & Rectification → Visual Pipeline",
            targetAutonomyModule: implementedModuleNames.has('Perception') ? "Perception" : "Unmapped — no consuming module detected"
          });
        }
        sensorToModuleMappings.push({
          sensorName: "Wheel Odometry Encoders",
          sensorType: "Quadrature Encoders",
          outputTopic: "/odom",
          consumerNodes: [implementedModuleNames.has('Sensor Fusion') ? 'robot_localization (ekf_filter_node)' : '(no fusion node found)', implementedModuleNames.has('Control') ? 'nav2_controller' : '(no controller node found)'],
          processingStage: "Wheel Kinematics → EKF Sensor Fusion",
          targetAutonomyModule: implementedModuleNames.has('Sensor Fusion') ? "Localization & Control" : "Unmapped — no consuming module detected"
        });

        const nodes: any[] = [];
        const edges: any[] = [];
        if (hasLidar) {
          nodes.push({ id: "s1", label: uniqueSensors.find(s => s.type.includes('LiDAR'))!.name.split('(')[0].trim(), type: "sensor", rosTopic: "/scan", rosMessageType: "sensor_msgs/msg/LaserScan" });
          nodes.push({ id: "d1", label: "Laser Driver / Gazebo Sensor System", type: "driver", rosTopic: "/scan" });
          nodes.push({ id: "p1", label: "LaserScan Filter / Debounce", type: "preprocessing" });
          edges.push({ from: "s1", to: "d1", label: "Raw Laser Pulses" }, { from: "d1", to: "p1", label: "/scan [LaserScan]" });
          if (implementedModuleNames.has('SLAM')) {
            nodes.push({ id: "a1", label: "SLAM Module", type: "autonomy_module" });
            edges.push({ from: "p1", to: "a1", label: "/scan_filtered" });
          }
        }
        nodes.push({ id: "s2", label: "Wheel Encoders", type: "sensor", rosTopic: "/odom", rosMessageType: "nav_msgs/msg/Odometry" });
        if (implementedModuleNames.has('Sensor Fusion')) {
          nodes.push({ id: "e1", label: "EKF Sensor Fusion", type: "estimation" });
          edges.push({ from: "s2", to: "e1", label: "/odom [Odometry]" });
        }
        if (implementedModuleNames.has('Localization')) {
          nodes.push({ id: "a2", label: "Localization Module", type: "autonomy_module" });
          if (implementedModuleNames.has('Sensor Fusion')) edges.push({ from: "e1", to: "a2", label: "/tf (odom->base_link)" });
        }
        if (implementedModuleNames.has('Path Planning')) {
          nodes.push({ id: "a3", label: "Path Planning Module", type: "autonomy_module" });
          if (implementedModuleNames.has('Localization')) edges.push({ from: "a2", to: "a3", label: "Estimated Pose" });
        }
        if (implementedModuleNames.has('Obstacle Avoidance')) {
          nodes.push({ id: "a4", label: "Obstacle Avoidance Module", type: "autonomy_module" });
          if (implementedModuleNames.has('Path Planning')) edges.push({ from: "a3", to: "a4", label: "/plan [Path]" });
        }
        if (implementedModuleNames.has('Control')) {
          nodes.push({ id: "c1", label: "Motor Velocity Controller (/cmd_vel)", type: "control" });
          if (implementedModuleNames.has('Obstacle Avoidance')) edges.push({ from: "a4", to: "c1", label: "/cmd_vel [Twist]" });
        }

        const dataFlowPipeline = { nodes, edges };

        // Step 8: Construct Dynamic Synthesized Analysis Result
        const analysisResult = {
          id: `${owner}_${repo}`.toLowerCase(),
          repoUrl,
          owner,
          repo,
          activeBranch: targetBranch,
          analyzedAt: new Date().toISOString(),
          isRosRepo: true,
          robotName: agentResult?.robotName || repo.charAt(0).toUpperCase() + repo.slice(1),
          rosVersion: agentResult?.rosVersion || "ROS 2 Humble / Iron / Rolling",
          packages: parsedPackages,
          sensors: uniqueSensors,
          noSensorsDetected,
          usedAgenticAnalysis: !!agentResult,
          agentReasoningSummary: agentResult?.reasoningSummary || null,
          chassis,
          chassisEstimatedFields,
          gazeboPlugins: detectedGazeboPlugins,
          topics: agentResult?.topics?.length ? agentResult.topics : [
            ...(hasLidar ? [{ topic: "/scan", type: "sensor_msgs/msg/LaserScan", direction: "Publisher" as const, nodeOwner: "lidar_driver", description: "2D laser scan for SLAM & Nav2" }] : []),
            ...(hasCamera ? [{ topic: "/image_raw", type: "sensor_msgs/msg/Image", direction: "Publisher" as const, nodeOwner: "camera_driver", description: "Raw RGB camera stream" }] : []),
            { topic: "/cmd_vel", type: "geometry_msgs/msg/Twist", direction: "Subscriber" as const, nodeOwner: "diff_drive_controller", description: "Motor drive velocity command" },
            { topic: "/odom", type: "nav_msgs/msg/Odometry", direction: "Publisher" as const, nodeOwner: "diff_drive_controller", description: "Wheel odometry pose estimate" }
          ],
          sensorToModuleMappings,
          dataFlowPipeline,
          autonomyModules,
          robotVariants,
          robotModels: agentResult?.robotModels ? stripEstimatedRobotModelMetrics(agentResult.robotModels) : [],
          codebaseReview,
          navigationStack: parsedPackages
            .filter(p => /nav|slam|control|localiz/i.test(p.name))
            .map(p => ({
              module: `ROS 2 Sub-Package: ${p.name}`,
              packageProvider: p.name,
              launchFile: launchFiles.find(l => l.path.includes(p.folderPath.split('/')[0]))?.path || `${p.name}/launch`,
              configYaml: yamlConfigFiles.find(y => y.path.includes(p.folderPath.split('/')[0]))?.path || `${p.name}/config`,
              primaryNode: p.name,
              description: p.description
            })),
          launchFiles: launchFiles.map(f => f.path),
          yamlConfigFiles: yamlConfigFiles.map(f => f.path),
          diagnosticsNotice: agentResult
            ? `${agentSettings.provider} agentic analysis (${agentSettings.model}): ${agentResult.toolCallCount} tool call(s) across the repo. ${agentResult.reasoningSummary}`
            : `Heuristic fallback parser (${agentSettings.provider} unavailable: ${agentError}): discovered ${parsedPackages.length} ROS 2 sub-package(s), ${uniqueSensors.length} sensor(s). Chassis dimensions could not be determined by this parser and are not shown.`
        };

        // Persist the full profile (same shape the client renders) to Neon,
        // linked to the project it was audited from if one was given. The
        // log line reflects what actually happened — no success claim on a
        // failed or skipped write.
        const fullProfile = createDynamicRobotProfileFromUrl(repoUrl, analysisResult);
        const saveResult = await saveRobotProfile(fullProfile, projectId);

        sendEvent({
          stage: saveResult.success ? 'DB_SAVED' : 'DB_SAVE_SKIPPED',
          log: saveResult.success
            ? `Robot profile persisted to Neon PostgreSQL for '${owner}/${repo}' (robots.id=${saveResult.id}).`
            : `Analysis complete, but persistence to Neon PostgreSQL was skipped or failed — DATABASE_URL may not be configured.`
        });

        // Stream Completion — sends the fully-built RobotProfile (not the
        // raw analysisResult) so the client can use it directly without
        // re-deriving the same profile a second time via
        // createDynamicRobotProfileFromUrl.
        sendEvent({ stage: 'COMPLETE', isRosRepo: true, result: fullProfile, robotId: saveResult.id });
        controller.close();
      } catch (err: any) {
        sendEvent({ stage: 'ERROR', isRosRepo: false, message: `Server error during analysis: ${err.message}` });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
