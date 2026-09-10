'use client';

import React from 'react';
import { FileText, CheckCircle2, XCircle, Clock, Terminal, Server } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { TestRunRecord } from '@/lib/db/test-runs';

export function TestRunDetailModal({ run, onClose }: { run: TestRunRecord; onClose: () => void }) {
  const isPassed = run.status === 'passed';
  const isError = run.status === 'error';

  return (
    <ModalShell onClose={onClose} title={`Test Run: ${run.testCaseName}`} icon={FileText} wide>
      <div className="space-y-4 text-xs font-sans text-sand-200">

        <div className="flex items-center justify-between gap-3 p-3 bg-sand-950 border border-sand-800 rounded">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-sand-50">{run.testCaseName}</span>
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-sand-900 border border-sand-700 text-sand-300 font-bold rounded">
                {run.category.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[11px] text-sand-400 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {new Date(run.createdAt).toLocaleString()} · {run.durationMs}ms · env: {run.environment}
            </p>
            {run.serverUrl && (
              <p className="text-[11px] text-sand-500 flex items-center gap-1.5 font-mono truncate">
                <Server className="h-3 w-3 shrink-0" />
                {run.serverUrl}
              </p>
            )}
          </div>

          <div className="shrink-0">
            {isPassed ? (
              <span className="px-3 py-1.5 bg-emerald-light border border-emerald-border text-emerald-text text-xs font-bold rounded flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> PASSED
              </span>
            ) : isError ? (
              <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded flex items-center gap-1.5">
                <XCircle className="h-4 w-4" /> ERROR
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-rose-950 border border-rose-800 text-rose-400 text-xs font-bold rounded flex items-center gap-1.5">
                <XCircle className="h-4 w-4" /> FAILED
              </span>
            )}
          </div>
        </div>

        {run.assertions.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-sand-500 uppercase tracking-wider">Assertions</span>
            <div className="space-y-1">
              {run.assertions.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between gap-3 p-2.5 border rounded ${
                    a.passed ? 'border-emerald-900 bg-emerald-950/30' : 'border-rose-900 bg-rose-950/30'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {a.passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    )}
                    <span className="truncate">{a.label}</span>
                  </span>
                  <span className="font-mono text-sand-400 shrink-0">
                    {a.actualValue} {a.unit || ''} {a.operator} {a.targetValue} {a.unit || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(run.metrics).length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-sand-500 uppercase tracking-wider">Metrics</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(run.metrics).map(([key, value]) => (
                <div key={key} className="p-2.5 bg-sand-950 border border-sand-800 rounded">
                  <div className="text-[10px] text-sand-500 truncate">{key}</div>
                  <div className="font-mono text-sand-100 font-bold">{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {run.logs.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-sand-500 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-3 w-3" /> Logs
            </span>
            <div className="bg-sand-950 border border-sand-800 rounded p-3 font-mono text-[11px] text-sand-400 space-y-0.5 max-h-64 overflow-y-auto">
              {run.logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
              ))}
            </div>
          </div>
        )}

      </div>
    </ModalShell>
  );
}
