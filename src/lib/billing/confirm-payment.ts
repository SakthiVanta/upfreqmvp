import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as schema from '@/lib/schema';

export interface ConfirmPaymentResult {
  success: boolean;
  error?: string;
  planId?: string;
}

// Single source of truth for "a payment was confirmed, upgrade the user" —
// called from both the client-side verify-payment callback (immediate UI
// feedback) and the webhook (the durable backstop if the client callback
// never fires, e.g. the tab closed before it ran). Idempotent: calling this
// twice for the same order (client callback + webhook both firing) is safe
// — the second call sees status already 'paid' and does nothing further.
export async function confirmPaymentAndUpgrade(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  expectedUserId?: string
): Promise<ConfirmPaymentResult> {
  const db = getDb();
  if (!db) return { success: false, error: 'No database configured.' };

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.razorpayOrderId, razorpayOrderId));

  if (!payment) {
    return { success: false, error: `No payment record for order ${razorpayOrderId}.` };
  }

  // When called from the client-callback path, the caller passes the
  // session's userId — refuse if it doesn't match the order's owner, so one
  // user can't upgrade themselves by replaying another user's order id.
  // The webhook path omits this (Razorpay itself is the authenticated
  // caller there, verified via HMAC signature before this is ever reached).
  if (expectedUserId && payment.userId !== expectedUserId) {
    return { success: false, error: 'Order does not belong to this user.' };
  }

  if (payment.status === 'paid') {
    return { success: true, planId: payment.planId }; // already processed — idempotent no-op
  }

  await db.update(schema.payments)
    .set({ status: 'paid', razorpayPaymentId, paidAt: new Date() })
    .where(eq(schema.payments.id, payment.id));

  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  await db.update(schema.users)
    .set({ plan: payment.planId, planExpiresAt: expiresAt })
    .where(eq(schema.users.id, payment.userId));

  return { success: true, planId: payment.planId };
}
