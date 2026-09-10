import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getPlan, PLANS } from '@/lib/billing/plans';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const userId = await getSessionUserId();
    const db = getDb();
    if (!db) return Response.json({ error: 'Billing is not available (no database configured).' }, { status: 503 });

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!user) return Response.json({ error: 'User not found.' }, { status: 404 });

    const planExpired = user.planExpiresAt ? new Date(user.planExpiresAt) < new Date() : false;
    const effectivePlanId = planExpired ? 'free' : user.plan;
    const plan = getPlan(effectivePlanId);

    return Response.json({
      planId: effectivePlanId,
      planName: plan.name,
      planExpiresAt: planExpired ? null : user.planExpiresAt,
      mcpCallsThisMonth: user.mcpCallsThisMonth,
      mcpCallLimit: plan.mcpCallLimitPerMonth,
      webappCallsThisMonth: user.webappCallsThisMonth,
      webappCallLimit: plan.webappActionLimitPerMonth,
      proPlan: { id: PLANS.pro.id, name: PLANS.pro.name, priceInr: PLANS.pro.priceInr },
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
