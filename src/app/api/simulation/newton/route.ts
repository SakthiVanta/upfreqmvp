import { NextRequest } from 'next/server';
import { executeNewtonRegressionBatch, runDifferentiableTuning } from '@/lib/simulation/newton-runtime';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';

export const runtime = 'nodejs';

// src/proxy.ts already gates this route behind a signed-in session (it's
// not in the middleware's unauthenticatedPaths allowlist) — this explicit
// check is defense-in-depth, matching every other route's pattern, so
// auth doesn't depend solely on the proxy matcher never changing.
export async function POST(req: NextRequest) {
  try {
    await getSessionUserId();
    const body = await req.json();
    const { mode, robotName, scenarioName, trialCount, solver, tuningTarget, maxIterations } = body;

    if (mode === 'differentiable_tuning') {
      if (!tuningTarget) {
        return Response.json({ error: 'Missing tuningTarget for differentiable tuning.' }, { status: 400 });
      }

      const tuningResult = await runDifferentiableTuning(
        tuningTarget,
        [],
        maxIterations || 20
      );

      return Response.json({
        mode: 'differentiable_tuning',
        engine: 'newton_physics',
        solver: 'warp_differentiable',
        result: tuningResult,
      });
    }

    // Default mode: fast_regression
    const batchResult = await executeNewtonRegressionBatch(
      robotName || 'warehouse_amr',
      scenarioName || 'warehouse_v2',
      {
        trialCount: trialCount || 20,
        solver: solver || 'mujoco',
      }
    );

    return Response.json({
      mode: 'fast_regression',
      engine: 'newton_physics',
      solver: solver || 'mujoco',
      result: batchResult,
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message || 'Newton physics simulation failed.' }, { status: 500 });
  }
}
