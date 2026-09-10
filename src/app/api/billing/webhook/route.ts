import { NextRequest } from 'next/server';
import { verifyWebhookSignature } from '@/lib/billing/razorpay';
import { confirmPaymentAndUpgrade } from '@/lib/billing/confirm-payment';

export const runtime = 'nodejs';

// Razorpay calls this directly — no WorkOS session, authenticated instead
// by the X-Razorpay-Signature HMAC header (verified against
// RAZORPAY_WEBHOOK_SECRET, set when configuring the webhook URL in the
// Razorpay dashboard). This is the durable source of truth for payment
// confirmation: the client-side verify-payment callback is only a
// best-effort UX shortcut that can be missed (tab closed, network drop)
// before it ever reaches the server.
//
// req.text() (not req.json()) is deliberate — signature verification must
// run against the exact raw bytes Razorpay signed, not a re-serialized
// version of the parsed JSON, which can differ in whitespace/key order and
// make a genuine signature look invalid.
export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-razorpay-signature');
  if (!signature) {
    return Response.json({ error: 'Missing X-Razorpay-Signature header.' }, { status: 400 });
  }

  const rawBody = await req.text();

  let valid: boolean;
  try {
    valid = verifyWebhookSignature(rawBody, signature);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
  if (!valid) {
    return Response.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  const body = JSON.parse(rawBody);

  if (body.event === 'payment.captured') {
    const orderId = body.payload?.payment?.entity?.order_id;
    const paymentId = body.payload?.payment?.entity?.id;
    if (orderId && paymentId) {
      // No expectedUserId check here (unlike the client-callback path) —
      // the signature verification above already authenticates this
      // request as genuinely from Razorpay, so the order_id it reports is
      // trusted as-is.
      await confirmPaymentAndUpgrade(orderId, paymentId);
    }
  }

  // Always 200 once the signature is valid, even for event types we don't
  // act on — Razorpay retries (with backoff, then eventually gives up) on
  // any non-2xx response, which we don't want for events we intentionally ignore.
  return Response.json({ received: true });
}
