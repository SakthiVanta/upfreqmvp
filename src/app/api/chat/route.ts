import { NextRequest } from 'next/server';
import { registry } from '@/lib/agent-native/registry';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, context } = body;

    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Missing message.' }, { status: 400 });
    }

    const actionDescriptors = registry.listDescriptors();
    const lower = message.toLowerCase();
    let proposedAction: any = null;
    let reply = '';

    // 1. Claude Code & MCP questions
    if (lower.includes('claude') || lower.includes('mcp') || lower.includes('edit code') || lower.includes('terminal') || lower.includes('cursor')) {
      reply = `You don't need a clunky in-browser text editor in UpFreq! You can edit, compile, and git-commit your robotics code directly in your local terminal with **Claude Code CLI** or in **Cursor**, connected to UpFreq via our **Model Context Protocol (MCP)** gateway.\n\nTo connect Claude Code, run:\n\`\`\`bash\nclaude mcp add upfreq http://localhost:3000/api/mcp\n\`\`\`\nOnce connected, Claude Code in your CLI can inspect UpFreq robot models, verify URDFs, trigger Isaac Sim tests, and read simulation telemetry!`;
    }
    // 2. Robot design & inertia validation
    else if (lower.includes('validate') || lower.includes('inertia') || lower.includes('physics')) {
      proposedAction = {
        actionId: 'upfreq.robot.calculate_inertias',
        name: 'Calculate Analytical Inertias',
        namespace: 'upfreq.robot',
        input: { geometryType: 'box', massKg: 15.0, dimensions: { x: 0.5, y: 0.4, z: 0.2 } },
        rationale: 'Verify positive-definiteness and triangle inequality for chassis.',
      };
      reply = `I can verify the link mass, positive-definiteness, and triangle inequalities ($I_{xx} + I_{yy} \\ge I_{zz}$) using analytical mechanics.`;
    }
    // 3. Robot creation or link addition
    else if (lower.includes('create robot') || lower.includes('robot design') || lower.includes('add link') || lower.includes('lidar') || lower.includes('chassis')) {
      proposedAction = {
        actionId: 'upfreq.robot.create_description',
        name: 'Synthesize Robot Description',
        namespace: 'upfreq.robot',
        input: {
          robotName: context?.robotName || 'autonomous_amr',
          driveType: 'differential',
          chassisDimensions: { length: 0.6, width: 0.45, height: 0.25, massKg: 18.0 },
          sensors: ['lidar_2d', 'imu'],
        },
        rationale: 'Generate clean REP-103/105 compliant parametric URDF with exact box/cylinder inertias.',
      };
      reply = `I have formulated a specification to synthesize a REP-103/105 compliant robot description with verified inertias.`;
    }
    // 4. OpenUSD compilation
    else if (lower.includes('usd') || lower.includes('openusd') || lower.includes('compile')) {
      proposedAction = {
        actionId: 'upfreq.robot.compile_simulation',
        name: 'Preflight Compile to OpenUSD',
        namespace: 'upfreq.robot',
        input: {
          robotName: context?.robotName || 'warehouse_robot',
          urdfContent: '<robot name="warehouse_robot"><link name="base_link"/></robot>',
          enableVhacd: true,
        },
        rationale: 'Preflight compile URDF to OpenUSD (.usda) with ros2_control simulation bridge.',
      };
      reply = `I can compile the robot URDF into canonical OpenUSD with physical articulation APIs and simulation hardware bridge.`;
    }
    // 5. Isaac Sim Simulation Testing
    else if (lower.includes('sim') || lower.includes('test') || lower.includes('isaac') || lower.includes('deploy') || lower.includes('run')) {
      proposedAction = {
        actionId: 'upfreq.simulation.start_scenario',
        name: 'Launch Scenario in Isaac Sim',
        namespace: 'upfreq.simulation',
        input: {
          robotName: context?.robotName || 'warehouse_amr',
          scenarioName: 'warehouse_navigation',
          profileKey: 'interactive_inspect',
          trials: 1,
        },
        rationale: 'Deploy robot stage to NVIDIA Isaac Sim and connect WebRTC live stream.',
      };
      reply = `I can launch the simulation scenario in NVIDIA Isaac Sim (PhysX 5) and connect the live WebRTC stream.`;
    }
    // 6. Time & ROS 2 /clock compliance
    else if (lower.includes('clock') || lower.includes('ros') || lower.includes('tf') || lower.includes('time')) {
      proposedAction = {
        actionId: 'upfreq.ros.validate_time_config',
        name: 'Audit /clock & use_sim_time Authority',
        namespace: 'upfreq.ros',
        input: {
          nodes: ['/controller_manager', '/diff_drive_controller', '/nav2_planner', '/robot_state_publisher'],
        },
        rationale: 'Verify all ROS 2 nodes obey master simulation /clock to prevent Nav2 aborts.',
      };
      reply = `I can audit all active ROS 2 nodes to verify strict \`use_sim_time=true\` compliance.`;
    }
    // General fallback
    else {
      reply = `I can help you build and verify your autonomous robot either agentically or manually:\n\n1. **Projects**: Attach GitHub repos, select branches & commits.\n2. **Robots**: Add links & joints, calculate analytical inertias, compile OpenUSD.\n3. **Claude Code / MCP**: Connect Claude Code in your terminal to edit code directly while UpFreq runs simulation.\n4. **Isaac Sim**: Deploy stages, inspect WebRTC stream, and run automated ROS 2 test suites.`;
    }

    // The suggested policy must reflect the action's actual registered
    // defaultPolicy, not a hardcoded guess — otherwise the chat UI could
    // tell the user an action is 'ALLOWED' (auto-executes) when the
    // registry would really route it to the REVIEW proposal queue.
    if (proposedAction) {
      const action = registry.get(proposedAction.actionId);
      proposedAction.policy = action?.defaultPolicy ?? 'REVIEW';
    }

    return Response.json({
      reply,
      proposedAction,
      availableActionsCount: actionDescriptors.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Chat processing failed.' }, { status: 500 });
  }
}
