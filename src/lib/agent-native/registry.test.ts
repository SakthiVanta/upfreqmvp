import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registry } from './registry';
import { handleMcpRequest } from './mcp-gateway';

const TEST_USER_ID = 'usr_test_registry';

// run_test_case's SSRF guard (assertPublicHttpUrl, added in the production-
// readiness pass) does a real DNS lookup on the server URL before calling
// fetch. The sandboxed test environment has no network access to resolve
// 'my-tunnel.example.com', so without this mock the guard throws before
// fetchMock is ever invoked. Resolve it to a public IP so the guard passes
// and the test still exercises the real fetch call sequence below.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '203.0.113.10', family: 4 }]),
}));

// upfreq.project.create_project/list_projects require a real userId and no
// longer silently fabricate data on DB failure (that was a cross-tenant bug
// — see src/lib/agent-native/actions/project.ts). Mocking the DB layer here
// keeps these tests hermetic (no live Postgres needed) while still verifying
// userId actually flows from ActionExecutionContext through to the DB call.
vi.mock('@/lib/db/projects', () => ({
  createProject: vi.fn(async (userId: string, input: { name: string; description?: string }) => ({
    id: 'proj_test', userId, name: input.name, description: input.description || '', repos: [], isAudited: false,
  })),
  listProjects: vi.fn(async (userId: string) => ([
    { id: 'proj_test', userId, name: 'Autonomous Warehouse AMR', description: '', repos: [], isAudited: false },
  ])),
}));

vi.mock('@/lib/db/test-runs', () => ({
  saveTestRun: vi.fn(async (userId: string, input: any) => ({ id: 'run_test', userId, ...input })),
  listTestRuns: vi.fn(async (userId: string) => ([
    { id: 'run_test', userId, projectId: 'proj_test', testCaseId: 'test_kinematics_reachability', testCaseName: 'Kinematics', category: 'kinematics', status: 'passed', metrics: {}, assertions: [], logs: [], durationMs: 100, createdAt: new Date().toISOString() },
  ])),
}));

// upfreq.robot.save_robot/list_robots — same real-DB-backed, mocked-for-tests
// pattern, verified for real against live Postgres via
// scripts/_verify_mcp_loop.ts during implementation (project → save_robot →
// list_robots → workspace register/get_path/list all round-tripped
// correctly against the actual dev database).
vi.mock('@/lib/db/mcp-robots', () => ({
  saveMcpRobot: vi.fn(async (userId: string, input: any) => ({
    id: 'mrb_test', userId, projectId: input.projectId || null, name: input.name,
    description: input.description || '', driveType: input.driveType || null,
    chassis: input.chassis || {}, sensors: input.sensors || [], urdfXacroXml: input.urdfXacroXml || null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })),
  listMcpRobots: vi.fn(async (userId: string, projectId?: string) => ([
    { id: 'mrb_test', userId, projectId: projectId || null, name: 'verify_bot', description: '', driveType: 'differential', chassis: { massKg: 12 }, sensors: ['lidar_2d'], urdfXacroXml: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ])),
}));

vi.mock('@/lib/db/workspace-registrations', () => {
  const store = new Map<string, { id: string; projectId: string; machineId: string; localPath: string; lastSeenAt: string; createdAt: string }>();
  return {
    getWorkspacePath: vi.fn(async (userId: string, projectId: string, machineId: string) => store.get(`${projectId}:${machineId}`) || null),
    registerWorkspacePath: vi.fn(async (userId: string, projectId: string, machineId: string, localPath: string) => {
      const record = { id: 'wsr_test', projectId, machineId, localPath, lastSeenAt: new Date().toISOString(), createdAt: new Date().toISOString() };
      store.set(`${projectId}:${machineId}`, record);
      return record;
    }),
    listWorkspaces: vi.fn(async () => Array.from(store.values())),
  };
});

describe('Agent-Native Action Registry & MCP Gateway', () => {
  it('registers all canonical namespaces and descriptors', () => {
    const descriptors = registry.listDescriptors();
    expect(descriptors.length).toBeGreaterThanOrEqual(20);

    const namespaces = new Set(descriptors.map(d => d.namespace));
    expect(namespaces.has('upfreq.robot')).toBe(true);
    expect(namespaces.has('upfreq.code')).toBe(true);
    expect(namespaces.has('upfreq.simulation')).toBe(true);
    expect(namespaces.has('upfreq.ros')).toBe(true);
    expect(namespaces.has('upfreq.testing')).toBe(true);
    expect(namespaces.has('upfreq.workspace')).toBe(true);
  });

  it('enforces Policy Engine: ALLOWED actions execute immediately', async () => {
    const result = await registry.execute(
      'upfreq.robot.calculate_inertias',
      {
        geometryType: 'box',
        massKg: 10,
        dimensions: { x: 0.5, y: 0.5, z: 0.5 },
      },
      { source: 'api' }
    );

    expect(result.success).toBe(true);
    expect(result.policyStatus).toBe('executed');
    expect(result.data.positiveDefinite).toBe(true);
  });

  it('executes project creation and listing via MCP action', async () => {
    const createResult = await registry.execute(
      'upfreq.project.create_project',
      {
        name: 'Autonomous Warehouse AMR',
        description: 'ROS 2 Nav2 and Cartographer SLAM fleet project',
      },
      { source: 'api', userId: TEST_USER_ID }
    );

    expect(createResult.success).toBe(true);
    expect(createResult.data.project.name).toBe('Autonomous Warehouse AMR');

    const listResult = await registry.execute(
      'upfreq.project.list_projects',
      {},
      { source: 'api', userId: TEST_USER_ID }
    );

    expect(listResult.success).toBe(true);
    expect(listResult.data.count).toBeGreaterThanOrEqual(1);
  });

  it('queries simulation environments and stages them in Isaac Sim', async () => {
    const listEnvs = await registry.execute(
      'upfreq.environment.list_environments',
      {},
      { source: 'api' }
    );

    expect(listEnvs.success).toBe(true);
    expect(listEnvs.data.count).toBeGreaterThanOrEqual(3);

    const selectEnv = await registry.execute(
      'upfreq.environment.select_environment',
      {
        environmentKey: 'warehouse',
        robotName: 'heavy_payload_transporter',
      },
      { source: 'api' }
    );

    expect(selectEnv.success).toBe(true);
    expect(selectEnv.data.environmentKey).toBe('warehouse');
  });

  describe('run_test_case against a real (mocked) Isaac Sim server', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('fetch', fetchMock);
      fetchMock.mockReset();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('health-checks, runs the test, evaluates assertions, and persists the run', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ isaac_sim: { fps: 60 } }) }) // /health
        .mockResolvedValueOnce({ ok: true, json: async () => ({ metrics: { minObstacleClearanceM: 0.42 }, logs: ['[Isaac Sim] done'] }) }); // /api/v1/run-test

      const result = await registry.execute(
        'upfreq.testing.run_test_case',
        {
          testCaseId: 'test_kinematics_reachability',
          robotName: 'heavy_payload_transporter',
          environment: 'narrow_corridor',
          serverUrl: 'https://my-tunnel.example.com',
        },
        { source: 'mcp', userId: TEST_USER_ID }
      );

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe('https://my-tunnel.example.com/health');
      expect(fetchMock.mock.calls[1][0]).toBe('https://my-tunnel.example.com/api/v1/run-test');
      expect(result.data.status).toBe('failed'); // singularity_index (0, default) < 0.85 target
      expect(result.data.metrics.minObstacleClearanceM).toBe(0.42);
    });

    it('records a status: error run when the Isaac Sim server is unreachable', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fetch failed'));

      const result = await registry.execute(
        'upfreq.testing.run_test_case',
        {
          testCaseId: 'test_kinematics_reachability',
          robotName: 'heavy_payload_transporter',
          environment: 'grid',
          serverUrl: 'https://unreachable.example.com',
        },
        { source: 'mcp', userId: TEST_USER_ID }
      );

      expect(result.success).toBe(true); // the action itself doesn't throw — it reports the failure
      expect(result.data.status).toBe('error');
    });
  });

  it('saves a robot via MCP and lists it back', async () => {
    const saveResult = await registry.execute(
      'upfreq.robot.save_robot',
      {
        projectId: 'proj_test',
        name: 'verify_bot',
        driveType: 'differential',
        chassisDimensions: { length: 0.5, width: 0.4, height: 0.2, massKg: 12 },
        sensors: ['lidar_2d'],
        urdfXacroXml: '<robot name="verify_bot"/>',
      },
      { source: 'mcp', userId: TEST_USER_ID }
    );

    expect(saveResult.success).toBe(true);
    expect(saveResult.data.robot.name).toBe('verify_bot');
    // chassisDimensions were provided in full, so the inertia tensor should
    // have been computed and stored alongside the raw dimensions.
    expect(saveResult.data.robot.chassis.inertia.ixx).toBeGreaterThan(0);

    const listResult = await registry.execute(
      'upfreq.robot.list_robots',
      { projectId: 'proj_test' },
      { source: 'mcp', userId: TEST_USER_ID }
    );

    expect(listResult.success).toBe(true);
    expect(listResult.data.count).toBe(1);
    expect(listResult.data.robots[0].name).toBe('verify_bot');
  });

  it('registers and looks up a per-machine workspace path via MCP', async () => {
    const notFoundYet = await registry.execute(
      'upfreq.workspace.get_path',
      { projectId: 'proj_test', machineId: 'machine_a' },
      { source: 'mcp', userId: TEST_USER_ID }
    );
    expect(notFoundYet.data.found).toBe(false);

    const registerResult = await registry.execute(
      'upfreq.workspace.register',
      { projectId: 'proj_test', machineId: 'machine_a', localPath: '/Users/alex/code/verify-bot' },
      { source: 'mcp', userId: TEST_USER_ID }
    );
    expect(registerResult.success).toBe(true);

    const foundNow = await registry.execute(
      'upfreq.workspace.get_path',
      { projectId: 'proj_test', machineId: 'machine_a' },
      { source: 'mcp', userId: TEST_USER_ID }
    );
    expect(foundNow.data.found).toBe(true);
    expect(foundNow.data.localPath).toBe('/Users/alex/code/verify-bot');

    const listResult = await registry.execute(
      'upfreq.workspace.list',
      {},
      { source: 'mcp', userId: TEST_USER_ID }
    );
    expect(listResult.data.count).toBe(1);
  });

  it('lists past test runs via MCP', async () => {
    const result = await registry.execute(
      'upfreq.testing.list_runs',
      { projectId: 'proj_test' },
      { source: 'mcp', userId: TEST_USER_ID }
    );

    expect(result.success).toBe(true);
    expect(result.data.count).toBeGreaterThanOrEqual(1);
  });

  it('serves standard MCP tools/list and tools/call over JSON-RPC', async () => {
    const initRes = await handleMcpRequest({ method: 'initialize', id: 1 }, TEST_USER_ID);
    expect(initRes.result.serverInfo.name).toBe('upfreq-robotics-mcp');

    const toolsRes = await handleMcpRequest({ method: 'tools/list', id: 2 }, TEST_USER_ID);
    expect(toolsRes.result.tools.length).toBeGreaterThanOrEqual(15);

    // Real per-action JSON Schema via Mastra's schema-conversion utilities
    // (src/lib/agent-native/mastra-mcp-server.ts) — not the old stub that
    // mapped every field to `{ type: 'string' }` regardless of its real type.
    const inertiaTool = toolsRes.result.tools.find((t: any) => t.name === 'upfreq.robot.calculate_inertias');
    expect(inertiaTool.inputSchema.type).toBe('object');
    expect(inertiaTool.inputSchema.properties.massKg.type).toBe('number');
    expect(inertiaTool.inputSchema.properties.geometryType.enum).toEqual(['box', 'cylinder', 'sphere']);

    const callRes = await handleMcpRequest({
      method: 'tools/call',
      id: 3,
      params: {
        name: 'upfreq.ros.inspect_tf_tree',
        arguments: { rootFrame: 'base_footprint' },
      },
    }, TEST_USER_ID);

    expect(callRes.result.content[0].text).toContain('base_footprint');
  });
});
