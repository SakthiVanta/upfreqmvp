'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions (delete, reset, remove) get the rose treatment. */
  danger?: boolean;
}

type ConfirmState = ConfirmOptions & { resolve: (value: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

// App-wide replacement for window.confirm(): const ok = await confirm({...});
// One modal instance lives here so every page shares the same styling and
// promise-based API instead of each call site hand-rolling its own dialog.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setState((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[100] bg-sand-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => close(false)}
          role="presentation"
        >
          <div
            className="minimal-card w-full max-w-sm animate-in fade-in slide-in-from-top-4"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            <div className="p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2.5">
                {state.danger ? (
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                ) : (
                  <HelpCircle className="h-5 w-5 text-emerald-primary shrink-0" />
                )}
                <h3 id="confirm-dialog-title" className="text-sm font-bold text-sand-50">
                  {state.title || (state.danger ? 'Confirm Deletion' : 'Please Confirm')}
                </h3>
              </div>
              <p id="confirm-dialog-message" className="text-xs text-sand-400 leading-relaxed">
                {state.message}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-sand-800 p-4 sm:p-5">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => close(false)}
                className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-300 text-xs font-semibold cursor-pointer"
              >
                {state.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`px-4 py-2 text-xs font-bold cursor-pointer ${
                  state.danger
                    ? 'bg-rose-700 hover:bg-rose-600 text-white'
                    : 'btn-emerald-primary'
                }`}
              >
                {state.confirmLabel || (state.danger ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
