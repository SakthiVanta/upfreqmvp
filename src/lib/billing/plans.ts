export type PlanId = 'free' | 'pro';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Price in rupees (not paise) for one 30-day period. 0 for free. */
  priceInr: number;
  /** MCP tool calls (tools/call over the MCP gateway) allowed per calendar month. null = unlimited. */
  mcpCallLimitPerMonth: number | null;
  /** Webapp action dispatches (POST /api/actions) allowed per calendar month. null = unlimited. */
  webappActionLimitPerMonth: number | null;
}

// PLACEHOLDER PRICE — ₹999/month is a reasonable starting point for an
// India-first developer-tool SaaS, but this is not a confirmed business
// decision. Change PRO.priceInr before actually launching billing.
//
// Free-tier limits are deliberately generous right now (not the eventual
// real numbers, e.g. 100/month for MCP) — Razorpay isn't configured yet, so
// a tight cap would hard-block every user with no way to pay their way out
// (clicking "Upgrade" would 500). Once billing is live, lower these to
// their real values.
export const PLANS: Record<PlanId, PlanDefinition> = {
  free: { id: 'free', name: 'Free', priceInr: 0, mcpCallLimitPerMonth: 10000, webappActionLimitPerMonth: 10000 },
  pro: { id: 'pro', name: 'Pro', priceInr: 999, mcpCallLimitPerMonth: null, webappActionLimitPerMonth: null },
};

export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] || PLANS.free;
}
