'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface BillingStatus {
  planId: string;
  planName: string;
  planExpiresAt: string | null;
  mcpCallsThisMonth: number;
  mcpCallLimit: number | null;
  webappCallsThisMonth: number;
  webappCallLimit: number | null;
  proPlan: { id: string; name: string; priceInr: number };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function BillingSettingsTab() {
  const toast = useToast();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  const refreshStatus = useCallback(() => {
    fetch('/api/billing/status')
      .then((res) => res.json())
      .then((data) => { if (!data.error) setStatus(data); })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Could not load the Razorpay checkout script.');

      const orderRes = await fetch('/api/billing/create-order', { method: 'POST' });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || 'Could not create order.');

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'UpFreq',
        description: `${order.planName} plan — monthly`,
        order_id: order.orderId,
        handler: async (response: any) => {
          const verifyRes = await fetch('/api/billing/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verify = await verifyRes.json();
          if (verifyRes.ok && verify.success) {
            toast.success('Upgraded to Pro!');
            refreshStatus();
          } else {
            toast.error(verify.error || 'Payment verification failed.');
          }
        },
        theme: { color: '#000000' },
      });

      rzp.on('payment.failed', (resp: any) => {
        toast.error(resp?.error?.description || 'Payment failed.');
      });

      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Could not start checkout.');
    } finally {
      setUpgrading(false);
    }
  };

  if (!status) {
    return (
      <div className="minimal-card p-5 sm:p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-sand-500 animate-spin" />
      </div>
    );
  }

  const isFree = status.planId === 'free';
  const mcpUsagePercent = status.mcpCallLimit ? Math.min(100, (status.mcpCallsThisMonth / status.mcpCallLimit) * 100) : 0;
  const webappUsagePercent = status.webappCallLimit ? Math.min(100, (status.webappCallsThisMonth / status.webappCallLimit) * 100) : 0;

  return (
    <div className="minimal-card p-5 sm:p-6 space-y-4 text-xs font-sans">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-emerald-primary" />
        <h3 className="text-sm font-bold text-sand-50 uppercase tracking-wider">Billing &amp; Usage</h3>
      </div>

      <div className="flex items-center justify-between p-3.5 bg-sand-950 border border-sand-800 rounded-lg">
        <div>
          <span className="font-bold text-sand-50 text-sm">{status.planName} Plan</span>
          {!isFree && status.planExpiresAt && (
            <p className="text-[11px] text-sand-500">Renews {new Date(status.planExpiresAt).toLocaleDateString()}</p>
          )}
        </div>
        {!isFree && (
          <span className="px-2 py-0.5 bg-emerald-light border border-emerald-border text-emerald-text text-[10px] font-bold rounded flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Active
          </span>
        )}
      </div>

      {isFree && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-sand-400">
              <span>MCP calls this month</span>
              <span className="font-mono">{status.mcpCallsThisMonth} / {status.mcpCallLimit}</span>
            </div>
            <div className="h-1.5 bg-sand-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${mcpUsagePercent >= 100 ? 'bg-rose-600' : 'bg-emerald-primary'}`}
                style={{ width: `${mcpUsagePercent}%` }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-sand-400">
              <span>Webapp actions this month</span>
              <span className="font-mono">{status.webappCallsThisMonth} / {status.webappCallLimit}</span>
            </div>
            <div className="h-1.5 bg-sand-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${webappUsagePercent >= 100 ? 'bg-rose-600' : 'bg-emerald-primary'}`}
                style={{ width: `${webappUsagePercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {isFree && (
        <button
          onClick={handleUpgrade}
          disabled={upgrading}
          className="w-full py-2.5 px-4 bg-sand-50 hover:bg-sand-200 text-sand-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 rounded-lg"
        >
          {upgrading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Upgrade to {status.proPlan.name} — ₹{status.proPlan.priceInr}/month
        </button>
      )}

      <p className="text-[10px] text-sand-500">
        Free plan includes {status.mcpCallLimit} MCP tool calls and {status.webappCallLimit} webapp actions per month. Pro is unlimited on both.
      </p>
    </div>
  );
}
