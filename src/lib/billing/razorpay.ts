import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';

// Requires RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (dashboard API keys) and
// RAZORPAY_WEBHOOK_SECRET (set separately when configuring the webhook URL
// in the Razorpay dashboard — not the same value as KEY_SECRET). None of
// these are in .env yet; every function here throws a clear "not
// configured" error rather than silently no-op'ing, since silently
// skipping payment verification would be a real security hole.
function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured — billing is not set up on this server yet.');
  }
  return { keyId, keySecret };
}

let client: Razorpay | null = null;
function getClient(): Razorpay {
  if (client) return client;
  const { keyId, keySecret } = getCredentials();
  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

export interface CreatedOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

// amountInr is taken ONLY from PLANS (src/lib/billing/plans.ts) by the
// caller — never from client input. A client-supplied amount here would let
// anyone create a ₹1 order and claim a ₹999 plan once the payment "succeeds".
export async function createOrder(amountInr: number, receipt: string): Promise<CreatedOrder> {
  const { keyId } = getCredentials();
  const amountPaise = Math.round(amountInr * 100);

  const order = await getClient().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    // Tags every order as UpFreq's in the Razorpay Dashboard — relevant if
    // this account is shared with another app, so orders/payments from the
    // two don't blur together when reconciling revenue or looking at the
    // transaction list. Purely cosmetic/organizational; not a security
    // boundary (that's handled by confirmPaymentAndUpgrade looking up the
    // order in UpFreq's own `payments` table before acting on any webhook).
    notes: { app: 'upfreq' },
  });

  return { orderId: order.id, amountPaise, currency: order.currency, keyId };
}

// Constant-time comparison (timingSafeEqual, not ===) — a plain string
// comparison short-circuits on the first mismatched byte, which leaks
// timing information an attacker can use to guess a valid signature one
// byte at a time. This is the standard hardening for any HMAC verification,
// not just a nice-to-have here.
function safeHexCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = getCredentials();
  const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeHexCompare(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured — cannot verify webhook authenticity.');
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeHexCompare(expected, signature);
}
