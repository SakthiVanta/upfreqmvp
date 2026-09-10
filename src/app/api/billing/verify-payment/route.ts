import { NextRequest } from 'next/server';
import { getSessionUserId, UnauthorizedError } from '@/lib/auth/session';
import { verifyPaymentSignature } from '@/lib/billing/razorpay';
import { confirmPaymentAndUpgrade } from '@/lib/billing/confirm-payment';

export const runtime = 'nodejs';

// Client-side confirmation path, for immediate UI feedback right after
// Razorpay Checkout closes — NOT the sole source of truth for whether a
// user gets upgraded. The webhook (../webhook/route.ts) is the durable
// backstop: if the user closes the tab before this fires, or this request
// fails, the webhook still upgrades the plan once Razorpay confirms capture
// server-side. Both paths call the same confirmPaymentAndUpgrade(), so they
// can't diverge in behavior.
export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json({ error: 'Missing payment verification fields.' }, { status: 400 });
    }

    const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) {
      return Response.json({ error: 'Payment signature verification failed.' }, { status: 400 });
    }

    // User-ownership check happens inside confirmPaymentAndUpgrade — refuses
    // if razorpay_order_id belongs to a different user than this session,
    // so a signature valid for someone else's order can't be replayed here.
    const result = await confirmPaymentAndUpgrade(razorpay_order_id, razorpay_payment_id, userId);
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, planId: result.planId });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: err.message || 'Payment verification failed.' }, { status: 500 });
  }
}
