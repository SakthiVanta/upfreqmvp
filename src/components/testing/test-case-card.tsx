'use client';

import React from 'react';
import { Play, CheckCircle2, XCircle, Clock, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { TestCase } from '@/lib/testing/types';

interface TestCaseCardProps {
  testCase: TestCase;
  isRunning: boolean;
  onRun: () => void;
  onViewReport?: () => void;
}

export function TestCaseCard({ testCase, isRunning, onRun, onViewReport }: TestCaseCardProps) {
  const lastRun = testCase.lastRun;

  return (
    <div className="p-4 bg-sand-950 border border-sand-800 rounded space-y-3 font-sans">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-sand-50 truncate">{testCase.name}</h4>
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 bg-sand-900 border border-sand-700 text-sand-400 font-bold rounded">
              {testCase.category.replace('_', ' ')}
            </span>
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 bg-sand-900 border border-sand-800 text-emerald-400 font-bold rounded">
              {testCase.environment}
            </span>
          </div>
          <p className="text-[11px] text-sand-400 leading-relaxed">{testCase.description}</p>
        </div>

        {/* Status indicator */}
        <div className="shrink-0 flex items-center gap-2">
          {isRunning ? (
            <span className="px-2 py-1 bg-sand-800 border border-sand-700 text-emerald-400 text-[10px] font-bold rounded flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Running
            </span>
          ) : lastRun?.status === 'passed' ? (
            <span className="px-2 py-1 bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-[10px] font-bold rounded flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Passed
            </span>
          ) : lastRun?.status === 'failed' ? (
            <span className="px-2 py-1 bg-rose-950/60 border border-rose-800/80 text-rose-400 text-[10px] font-bold rounded flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Failed
            </span>
          ) : (
            <span className="px-2 py-1 bg-sand-900 border border-sand-800 text-sand-500 text-[10px] font-bold rounded flex items-center gap-1">
              <Clock className="h-3 w-3" /> Idle
            </span>
          )}
        </div>
      </div>

      {/* Assertions checklist */}
      <div className="p-2.5 bg-sand-900/50 border border-sand-800 rounded space-y-1.5">
        <span className="text-[10px] font-bold text-sand-500 uppercase tracking-wider block">
          Pass / Fail Assertions ({testCase.assertions.length})
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
          {testCase.assertions.map((a) => {
            const res = lastRun?.assertionResults.find((r) => r.assertionId === a.id);
            return (
              <div key={a.id} className="flex items-center gap-1.5 text-sand-300">
                {res ? (
                  res.passed ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-primary shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-rose-400 shrink-0" />
                  )
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-sand-600 shrink-0" />
                )}
                <span className="truncate">
                  {a.label}: <strong className="text-sand-100 font-mono">{a.operator} {a.targetValue} {a.unit}</strong>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-sand-850">
        <span className="text-[10px] font-mono text-sand-500">
          Duration: {testCase.durationSec}s {lastRun && `| Ran: ${(lastRun.durationMs / 1000).toFixed(1)}s`}
        </span>

        <div className="flex items-center gap-2">
          {lastRun && onViewReport && (
            <button
              onClick={onViewReport}
              className="px-2.5 py-1 text-[11px] font-bold text-sand-300 hover:text-sand-100 flex items-center gap-1 cursor-pointer"
            >
              <FileText className="h-3 w-3" />
              Report
            </button>
          )}

          <button
            onClick={onRun}
            disabled={isRunning}
            className="btn-emerald-primary py-1 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
            {isRunning ? 'Testing...' : 'Run Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
