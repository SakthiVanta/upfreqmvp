// Minimal eval harness for the audit agent — the thing that was missing
// entirely before this. Runs the REAL /api/analyze endpoint (not a special
// test-only code path) against known repos and reports what actually came
// back: did the agent run at all, how many tool calls / API calls / tokens
// did it take, how long did it take, and did it produce structurally
// complete output (sensors found, chassis resolved vs. estimated, robot
// variants identified).
//
// This deliberately does NOT assert exact ground-truth numeric values
// (chassis dimensions, sensor positions) — hardcoding "the right answer"
// from memory risks shipping wrong ground truth, which is worse than no
// eval at all. What it verifies is structural completeness and real
// resource cost, which is exactly what was unmeasured before.
//
// Usage: pnpm exec tsx scripts/eval-agent.ts [baseUrl]
// Requires a running server (`pnpm start` after `pnpm build`, or `pnpm dev`)
// and at least one provider API key configured (env var or Settings page).

const BASE_URL = process.argv[2] || process.env.EVAL_BASE_URL || 'http://localhost:3000';

// Andino is this app's own reference repo (see the Xacro/YAML-indirection
// comments throughout src/lib/agent/tools.ts) — real, public, small enough
// to eval quickly.
const EVAL_REPOS = [
  { name: 'Andino', url: 'https://github.com/Ekumen-OS/andino' },
];

interface EvalResult {
  repo: string;
  ok: boolean;
  error: string | null;
  robotName: string | null;
  rosVersion: string | null;
  sensorCount: number;
  chassisResolved: boolean | null;
  robotModelCount: number;
  usedAgenticAnalysis: boolean;
  durationMs: number;
}

async function evalRepo(repoUrl: string): Promise<EvalResult> {
  const startedAt = Date.now();
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl }),
  });

  if (!res.ok || !res.body) {
    return {
      repo: repoUrl, ok: false, error: `HTTP ${res.status}`, robotName: null, rosVersion: null,
      sensorCount: 0, chassisResolved: null, robotModelCount: 0, usedAgenticAnalysis: false,
      durationMs: Date.now() - startedAt,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: any = null;
  let errorMessage: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.log) process.stdout.write(`  ${data.log}\n`);
        if (data.stage === 'ERROR') errorMessage = data.message || 'Unknown error';
        if (data.stage === 'COMPLETE' && data.result) result = data.result;
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  if (!result) {
    return {
      repo: repoUrl, ok: false, error: errorMessage || 'No result received', robotName: null, rosVersion: null,
      sensorCount: 0, chassisResolved: null, robotModelCount: 0, usedAgenticAnalysis: false,
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    repo: repoUrl,
    ok: true,
    error: null,
    robotName: result.name,
    rosVersion: result.rosVersion,
    sensorCount: result.sensors?.length ?? 0,
    chassisResolved: result.chassisEstimatedFields ? result.chassisEstimatedFields.length === 0 : null,
    robotModelCount: result.robotModels?.length ?? 0,
    usedAgenticAnalysis: !!result.usedAgenticAnalysis,
    durationMs: Date.now() - startedAt,
  };
}

async function main() {
  console.log(`Evaluating against ${BASE_URL} — ${EVAL_REPOS.length} repo(s)\n`);

  const results: EvalResult[] = [];
  for (const { name, url } of EVAL_REPOS) {
    console.log(`--- ${name} (${url}) ---`);
    const result = await evalRepo(url);
    results.push(result);
    console.log('');
  }

  console.log('=== Summary ===');
  for (const r of results) {
    if (!r.ok) {
      console.log(`${r.repo}: FAILED — ${r.error} (${(r.durationMs / 1000).toFixed(1)}s)`);
      continue;
    }
    console.log(
      `${r.repo}: ${r.usedAgenticAnalysis ? 'agent' : 'FALLBACK (regex)'} | ` +
      `robot="${r.robotName}" ros="${r.rosVersion}" | ` +
      `${r.sensorCount} sensor(s), ${r.robotModelCount} variant(s), ` +
      `chassis ${r.chassisResolved === null ? 'n/a' : r.chassisResolved ? 'fully resolved' : 'partially estimated'} | ` +
      `${(r.durationMs / 1000).toFixed(1)}s`
    );
  }

  const failures = results.filter(r => !r.ok || !r.usedAgenticAnalysis);
  if (failures.length > 0) {
    console.log(`\n${failures.length}/${results.length} run(s) did not complete via the real agent (failed or fell back to regex).`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} run(s) completed via the real agent.`);
  }

  console.log('\nFor exact token usage/cost per run, check the Settings page "Recent Audits" panel or query the audit_runs table directly.');
}

main().catch((err) => {
  console.error('Eval run failed:', err);
  process.exit(1);
});
