import { z } from 'zod';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AgentNativeAction } from '../types';
import { STANDARD_TEST_PRESETS } from '@/lib/testing/test-presets';
import { TestAssertion } from '@/lib/testing/types';
import { saveTestRun, listTestRuns, getTestRun } from '@/lib/db/test-runs';

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-UpFreq-Key'] = apiKey;
  return headers;
}

// This action fetches a user-supplied serverUrl from UpFreq's own backend
// (not the browser) — without this guard, a caller could point it at cloud
// metadata endpoints, internal admin services, or anything else reachable
// from our network, and get the response echoed back through the tool
// result. Only http(s) to a resolved public IP is allowed; every address a
// hostname resolves to is checked, not just the first, since a caller could
// otherwise return a mix of public/private records.
function isPrivateOrReservedIp(ip: string, family: number): boolean {
  if (family === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 0) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (fc00::/7)
  if (lower.startsWith('::ffff:')) return isPrivateOrReservedIp(lower.replace('::ffff:', ''), 4);
  return false;
}

async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported protocol "${url.protocol}" — serverUrl must be http:// or https://.`);
  }

  const hostname = url.hostname;
  if (hostname === 'localhost') {
    throw new Error('serverUrl cannot be localhost — this action runs on UpFreq\'s backend, not your machine.');
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await dnsLookup(hostname, { all: true }).catch(() => {
        throw new Error(`Could not resolve host "${hostname}".`);
      });

  for (const { address, family } of addresses) {
    if (isPrivateOrReservedIp(address, family)) {
      throw new Error(`serverUrl resolves to a private/internal address (${address}) — not reachable, and not allowed for security reasons.`);
    }
  }

  return url;
}

async function checkServerHealth(serverUrl: string, apiKey?: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${serverUrl}/health`, { method: 'GET', headers: buildHeaders(apiKey), signal: controller.signal });
    if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Connection to the Isaac Sim server timed out.');
    throw new Error(err.message || 'Could not connect to the Isaac Sim server.');
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runSimTest(
  serverUrl: string,
  body: { robot_name: string; category: string; command_type: string; command_params: Record<string, unknown>; duration_sec: number; environment: string },
  apiKey?: string
): Promise<{ metrics?: Record<string, number>; logs?: string[] }> {
  const res = await fetch(`${serverUrl}/api/v1/run-test`, { method: 'POST', headers: buildHeaders(apiKey), body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || data?.error || `Isaac Sim test run failed (HTTP ${res.status})`);
  return data || {};
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
    const preset = STANDARD_TEST_PRESETS.find(p => p.id === input.testCaseId) || STANDARD_TEST_PRESETS[0];
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
  description: 'Lists standard simulation test presets available for ROS 2 validation in Isaac Sim.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    category: z.enum(['all', 'kinematics', 'navigation', 'safety', 'sensors', 'controllers']).default('all'),
  }),
  async execute(input) {
    if (input.category === 'all') {
      return { presets: STANDARD_TEST_PRESETS };
    }
    return { presets: STANDARD_TEST_PRESETS.filter(p => p.category === input.category) };
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

export const createTestCaseAction: AgentNativeAction = {
  id: 'upfreq.testing.create_test_case',
  namespace: 'upfreq.testing',
  name: 'create_test_case',
  description: 'Creates a custom robotics simulation test specification with pass/fail assertion criteria.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    name: z.string().describe('Test case name, e.g. "Strict 0.5m Pallet Clearance Test"'),
    description: z.string().describe('Test objective'),
    category: z.enum(['kinematics', 'navigation', 'safety', 'sensors', 'controllers']).default('safety'),
    environment: z.enum(['grid', 'warehouse', 'hospital', 'outdoor_uneven', 'narrow_corridor']).default('warehouse'),
    assertionType: z.enum(['min_clearance', 'max_time_to_goal', 'zero_collisions', 'max_velocity']).default('min_clearance'),
    thresholdValue: z.number().default(0.5),
  }),
  async execute(input) {
    const testCaseId = `custom_test_${Date.now()}`;
    const testCase = {
      id: testCaseId,
      name: input.name,
      description: input.description,
      category: input.category,
      environment: input.environment,
      assertion: {
        type: input.assertionType,
        threshold: input.thresholdValue,
      },
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      testCase,
      message: `Test case "${input.name}" created and registered in UpFreq test runner.`,
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
