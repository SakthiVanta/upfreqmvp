import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { getPlan } from './plans';

export interface UsageCheck {
  allowed: boolean;
  planId: string;
  callsThisMonth: number;
  limit: number | null;
}

type Channel = 'mcp' | 'webapp';

// Column pairs are fixed, internal literals (never derived from request
// input) — safe to splice into SQL via sql.raw(), since this is a closed
// two-value enum the caller selects, not attacker-controlled data.
const COLUMNS: Record<Channel, { count: string; resetAt: string }> = {
  mcp: { count: 'mcp_calls_this_month', resetAt: 'mcp_calls_reset_at' },
  webapp: { count: 'webapp_calls_this_month', resetAt: 'webapp_calls_reset_at' },
};

// Increment-then-check, in a single atomic UPDATE ... RETURNING — not a
// read-then-write (SELECT count, compare, UPDATE), which would race under
// concurrent calls: two requests could both read count=99, both decide
// "allowed", and both write 100, silently letting 101 through. A single
// UPDATE is serialized per-row by Postgres regardless of concurrency, so
// this is safe without an application-level lock. The monthly reset (new
// calendar month -> count resets to 1 instead of +1) is folded into the
// same statement for the same reason — no separate "check if reset needed"
// read that could itself race against the increment. Verified for
// correctness and concurrency safety (10 parallel calls -> exactly +10,
// no lost updates) against live Postgres during development.
async function checkAndIncrementUsage(userId: string, channel: Channel, limitField: 'mcpCallLimitPerMonth' | 'webappActionLimitPerMonth'): Promise<UsageCheck> {
  const db = getDb();
  if (!db) {
    // No database configured (local dev without DATABASE_URL) — fail open
    // rather than block every call in an environment that can't even track
    // usage.
    return { allowed: true, planId: 'free', callsThisMonth: 0, limit: null };
  }

  const { count, resetAt } = COLUMNS[channel];
  const result = await db.execute<{ plan: string; plan_expires_at: string | null; count: number }>(sql`
    UPDATE users
    SET
      ${sql.raw(count)} = CASE
        WHEN date_trunc('month', ${sql.raw(resetAt)} AT TIME ZONE 'UTC') <> date_trunc('month', now() AT TIME ZONE 'UTC')
        THEN 1
        ELSE ${sql.raw(count)} + 1
      END,
      ${sql.raw(resetAt)} = CASE
        WHEN date_trunc('month', ${sql.raw(resetAt)} AT TIME ZONE 'UTC') <> date_trunc('month', now() AT TIME ZONE 'UTC')
        THEN now()
        ELSE ${sql.raw(resetAt)}
      END
    WHERE id = ${userId}
    RETURNING plan, plan_expires_at, ${sql.raw(count)} AS count
  `);
  const row = result.rows[0];

  if (!row) {
    // User row doesn't exist yet — fail open rather than block on an
    // unexpected state.
    return { allowed: true, planId: 'free', callsThisMonth: 0, limit: null };
  }

  const planExpired = row.plan_expires_at ? new Date(row.plan_expires_at) < new Date() : false;
  const effectivePlanId = planExpired ? 'free' : row.plan;
  const plan = getPlan(effectivePlanId);
  const limit = plan[limitField];

  const allowed = limit === null || row.count <= limit;

  return { allowed, planId: effectivePlanId, callsThisMonth: row.count, limit };
}

export function checkAndIncrementMcpUsage(userId: string): Promise<UsageCheck> {
  return checkAndIncrementUsage(userId, 'mcp', 'mcpCallLimitPerMonth');
}

export function checkAndIncrementWebappUsage(userId: string): Promise<UsageCheck> {
  return checkAndIncrementUsage(userId, 'webapp', 'webappActionLimitPerMonth');
}
