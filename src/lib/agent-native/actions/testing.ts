import { z } from 'zod';
import { AgentNativeAction } from '../types';
import { STANDARD_TEST_PRESETS } from '@/lib/testing/test-presets';
import { TestAssertion, TestCase } from '@/lib/testing/types';
import { saveTestRun, listTestRuns, getTestRun } from '@/lib/db/test-runs';
import { assertPublicHttpUrl, checkServerHealth, bridgePost } from './bridge-http';

async function runSimTest(
  serverUrl: string,
  body: { robot_name: string; category: string; command_type: string; command_params: Record<string, unknown>; duration_sec: number; environment: string },
  apiKey?: string
): Promise<{ metrics?: Record<string, number>; logs?: string[] }> {
  return bridgePost(serverUrl, '/api/v1/run-test', body, apiKey);
}

function evaluateAssertions(assertions: TestAssertion[], metrics: Record<string, number>) {
  let allPassed = true;
  const results = assertions.map((assertion) => {
    const actual = metrics[assertion.metric] ?? 0;
    let passed = false;
    switch (assertion.operator) {
      case '>=': passed = actual >= assertion.targetValue; break;
      case '<=': passed = actual <= assertion.targetValue; break;
      case '==': passed = actual === assertion.targetValue; break;
      case '>': passed = actual > assertion.targetValue; break;
      case '<': passed = actual < assertion.targetValue; break;
    }
    if (!passed) allPassed = false;
    return {
      id: assertion.id,
      label: assertion.label,
      metric: assertion.metric,
      operator: assertion.operator,
      targetValue: assertion.targetValue,
      actualValue: actual,
      passed,
      unit: assertion.unit,
    };
  });
  return { allPassed, results };
}

export const runTestCaseAction: AgentNativeAction = {
  id: 'upfreq.testing.run_test_case',
  namespace: 'upfreq.testing',
  name: 'run_test_case',
  description:
    'Executes an automated ROS 2 simulation test case against a real, running Isaac Sim server (health-checks it, runs the test, evaluates pass/fail assertions) and records the result in UpFreq. ' +
    'IMPORTANT: this runs from UpFreq’s own backend, not your machine — serverUrl must be a publicly reachable address (a tunnel, a LAN box with a public IP, or a hosted server); "localhost" only works if this action itself is executed by a local MCP process, not UpFreq’s remote MCP endpoint.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    testCaseId: z.string().default('nav2-obstacle-avoidance'),
    robotName: z.string().default('warehouse_amr'),
    environment: z.string().default('grid'),
    serverUrl: z.string().url().describe('Base URL of the Isaac Sim bridge server to run this test against, e.g. https://my-tunnel.example.com'),
    apiKey: z.string().optional().describe('Optional X-UpFreq-Key header for the bridge server, if it requires one'),
    projectId: z.string().optional(),
  }),
  async execute(input, context) {
    let preset: TestCase | undefined = STANDARD_TEST_PRESETS.find(p => p.id === input.testCaseId);
    if (!preset && context.userId) {
      const { getCustomTestCase } = await import('@/lib/db/custom-test-cases');
      preset = (await getCustomTestCase(context.userId, input.testCaseId)) || undefined;
    }
    if (!preset) {
      // Previously fell back to STANDARD_TEST_PRESETS[0] here — silently
      // running a different, unrelated test and reporting it as if it were
      // the one requested. For a safety-testing tool that's actively
      // dangerous, not just a UX rough edge — an unknown id must be a clear
      // error, never a silent substitution.
      return {
        testCaseId: input.testCaseId,
        status: 'error',
        error: `No test case found with id "${input.testCaseId}" — checked both standard presets (list_test_presets) and your custom test cases (create_test_case). Not running a substitute test.`,
      };
    }
    const serverUrl = input.serverUrl.replace(/\/+$/, '');
    const startedAt = Date.now();

    try {
      await assertPublicHttpUrl(serverUrl);
      await checkServerHealth(serverUrl, input.apiKey);

      const simResult = await runSimTest(serverUrl, {
        robot_name: input.robotName,
        category: preset.category,
        command_type: preset.commandType,
        command_params: preset.commandParams || {},
        duration_sec: preset.durationSec || 5,
        environment: input.environment,
      }, input.apiKey);

      const metrics = simResult.metrics || {};
      const { allPassed, results } = evaluateAssertions(preset.assertions, metrics);
      const durationMs = Date.now() - startedAt;
      const status = allPassed ? 'passed' : 'failed';

      if (context.userId) {
        await saveTestRun(context.userId, {
          projectId: input.projectId,
          environment: input.environment,
          serverUrl,
          testCaseId: preset.id,
          testCaseName: preset.name,
          category: preset.category,
          status,
          metricsJson: metrics,
          assertionsJson: results,
          logsJson: simResult.logs || [],
          durationMs,
        });
      }

      return {
        testCaseId: preset.id,
        testName: preset.name,
        category: preset.category,
        status,
        robotName: input.robotName,
        environment: input.environment,
        serverUrl,
        durationMs,
        metrics,
        assertions: results,
        logs: simResult.logs || [],
      };
    } catch (err: any) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err.message || 'Test execution failed.';

      if (context.userId) {
        await saveTestRun(context.userId, {
          projectId: input.projectId,
          environment: input.environment,
          serverUrl,
          testCaseId: preset.id,
          testCaseName: preset.name,
          category: preset.category,
          status: 'error',
          metricsJson: {},
          assertionsJson: [],
          logsJson: [`[ERROR] ${errorMessage}`],
          durationMs,
        });
      }

      return {
        testCaseId: preset.id,
        testName: preset.name,
        category: preset.category,
        status: 'error',
        robotName: input.robotName,
        environment: input.environment,
        serverUrl,
        durationMs,
        error: errorMessage,
      };
    }
  },
};

export const listTestPresetsAction: AgentNativeAction = {
  id: 'upfreq.testing.list_test_presets',
  namespace: 'upfreq.testing',
  name: 'list_test_presets',
  description: 'Lists standard simulation test presets, plus your own saved custom test cases (from create_test_case) if authenticated.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    category: z.enum(['all', 'kinematics', 'velocity_braking', 'collision_avoidance', 'incline_stability', 'payload_capacity', 'custom']).default('all'),
  }),
  async execute(input, context) {
    let custom: TestCase[] = [];
    if (context.userId) {
      const { listCustomTestCases } = await import('@/lib/db/custom-test-cases');
      custom = await listCustomTestCases(context.userId);
    }

    const all = [...STANDARD_TEST_PRESETS, ...custom];
    const presets = input.category === 'all' ? all : all.filter(p => p.category === input.category);
    return { presets };
  },
};

export const getRunDiagnosticsAction: AgentNativeAction = {
  id: 'upfreq.testing.get_run_diagnostics',
  namespace: 'upfreq.testing',
  name: 'get_run_diagnostics',
  description: 'Returns the recorded metrics/assertions/logs for a specific test run by id. Requires the run to have been recorded via run_test_case first.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    runId: z.string().describe('The test run id returned by run_test_case or list_runs.'),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { found: false, error: 'No authenticated user context.' };
    }

    const run = await getTestRun(context.userId, input.runId);
    if (!run) {
      // Honest "not found" rather than a fabricated always-nominal payload —
      // this app is a robotics safety-testing tool, so a diagnostics
      // endpoint that always claims safetyClearanceMaintained: true would
      // be actively misleading, not just a stub.
      return { found: false, runId: input.runId, error: 'No recorded test run with this id.' };
    }

    return {
      found: true,
      runId: run.id,
      status: run.status,
      metrics: run.metrics,
      assertions: run.assertions,
      logs: run.logs,
      durationMs: run.durationMs,
      createdAt: run.createdAt,
    };
  },
};

// assertionType -> metric name, kept consistent with the metric keys
// STANDARD_TEST_PRESETS already uses (src/lib/testing/test-presets.ts) so a
// custom test's assertion has a real chance of matching what a bridge
// server actually reports in run-test's response, instead of inventing a
// metric name nothing will ever populate.
const ASSERTION_METRIC_MAP: Record<string, { metric: string; operator: TestAssertion['operator']; unit: string; label: string }> = {
  min_clearance: { metric: 'min_clearance_m', operator: '>=', unit: 'm', label: 'Minimum Obstacle Clearance' },
  max_time_to_goal: { metric: 'time_to_goal_s', operator: '<=', unit: 's', label: 'Time to Goal' },
  zero_collisions: { metric: 'collision_count', operator: '==', unit: 'count', label: 'Collision Count' },
  max_velocity: { metric: 'top_speed_ms', operator: '<=', unit: 'm/s', label: 'Peak Velocity' },
};

export const createTestCaseAction: AgentNativeAction = {
  id: 'upfreq.testing.create_test_case',
  namespace: 'upfreq.testing',
  name: 'create_test_case',
  description:
    'Creates and saves a custom robotics simulation test specification with pass/fail assertion criteria. ' +
    'Once created, run it by passing this test case\'s id as testCaseId to run_test_case — same as a standard preset.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    name: z.string().describe('Test case name, e.g. "Strict 0.5m Pallet Clearance Test"'),
    description: z.string().describe('Test objective'),
    category: z.enum(['kinematics', 'velocity_braking', 'collision_avoidance', 'incline_stability', 'payload_capacity', 'custom']).default('custom'),
    environment: z.enum(['grid', 'warehouse', 'turtlebot_world', 'hospital', 'bookstore', 'incline', 'incline_slope', 'rough_terrain', 'laboratory', 'empty']).default('warehouse'),
    commandType: z.enum(['joint_sweep', 'velocity_step', 'emergency_stop', 'incline_drive', 'custom_script']).default('velocity_step'),
    durationSec: z.number().positive().default(5),
    assertionType: z.enum(['min_clearance', 'max_time_to_goal', 'zero_collisions', 'max_velocity']).default('min_clearance'),
    thresholdValue: z.number().default(0.5),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { success: false, message: 'No authenticated user for this action.' };
    }

    const assertionSpec = ASSERTION_METRIC_MAP[input.assertionType];
    const testCase: TestCase = {
      id: `custom_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: input.name,
      description: input.description,
      category: input.category,
      environment: input.environment,
      durationSec: input.durationSec,
      commandType: input.commandType,
      commandParams: {},
      assertions: [{
        id: 'a_custom',
        label: assertionSpec.label,
        metric: assertionSpec.metric,
        operator: assertionSpec.operator,
        targetValue: input.thresholdValue,
        unit: assertionSpec.unit,
      }],
    };

    const { saveCustomTestCase } = await import('@/lib/db/custom-test-cases');
    await saveCustomTestCase(context.userId, testCase);

    return {
      success: true,
      testCase,
      message: `Test case "${input.name}" (${testCase.id}) saved — run it with run_test_case using this id.`,
    };
  },
};

export const listRunsAction: AgentNativeAction = {
  id: 'upfreq.testing.list_runs',
  namespace: 'upfreq.testing',
  name: 'list_runs',
  description: 'Lists past test run results recorded by run_test_case, optionally scoped to one project — use this to check what has already been tested before running more tests.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string().optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { count: 0, runs: [] };
    }

    const runs = await listTestRuns(context.userId, { projectId: input.projectId, limit: input.limit });
    return { count: runs.length, runs };
  },
};

export const testingActions = [
  runTestCaseAction,
  listTestPresetsAction,
  createTestCaseAction,
  getRunDiagnosticsAction,
  listRunsAction,
];
