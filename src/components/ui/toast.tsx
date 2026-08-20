'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4500;

// App-wide replacement for window.alert(): toast.success('Saved') /
// toast.error('Failed to save.'). Renders as a stacked, auto-dismissing
// notification instead of a blocking native dialog.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, variant: Toast['variant']) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  const api: ToastApi = {
    success: useCallback((message: string) => push(message, 'success'), [push]),
    error: useCallback((message: string) => push(message, 'error'), [push]),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`minimal-card flex items-start gap-2.5 p-3.5 text-xs animate-in fade-in slide-in-from-bottom-2 ${
              t.variant === 'error' ? 'border-rose-700/60' : 'border-emerald-primary/40'
            }`}
          >
            {t.variant === 'error' ? (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-primary shrink-0 mt-0.5" />
            )}
            <span className="flex-1 text-sand-100 leading-relaxed">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-sand-500 hover:text-sand-50 cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
