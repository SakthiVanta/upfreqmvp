import { NextRequest } from 'next/server';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';
import { createOrder } from '@/lib/billing/razorpay';
import { getPlan } from '@/lib/billing/plans';
import { getDb } from '@/lib/db/client';
import * as schema from '@/lib/schema';

export const runtime = 'nodejs';

// Creates a Razorpay order for the Pro plan. The amount is taken ONLY from
// PLANS.pro.priceInr on the server — the request body is not trusted for
// price, so a client can't tamper with what they're actually charged.
export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const plan = getPlan('pro');

    const db = getDb();
    if (!db) return Response.json({ error: 'Billing is not available (no database configured).' }, { status: 503 });

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const order = await createOrder(plan.priceInr, orderId);

    await db.insert(schema.payments).values({
      id: orderId,
      userId,
      razorpayOrderId: order.orderId,
      amountInr: plan.priceInr,
      planId: plan.id,
      status: 'created',
    });

    return Response.json({
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      keyId: order.keyId,
      planName: plan.name,
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message || 'Could not create order.' }, { status: 500 });
  }
}
