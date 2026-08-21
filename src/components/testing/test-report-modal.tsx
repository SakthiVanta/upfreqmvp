'use client';

import React from 'react';
import { FileText, CheckCircle2, XCircle, Clock, Terminal } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { TestCase } from '@/lib/testing/types';

interface TestReportModalProps {
  testCase: TestCase;
  onClose: () => void;
}

export function TestReportModal({ testCase, onClose }: TestReportModalProps) {
  const lastRun = testCase.lastRun;
  if (!lastRun) return null;

  const isPassed = lastRun.status === 'passed';

  return (
    <ModalShell onClose={onClose} title={`Test Report: ${testCase.name}`} icon={FileText} wide>
      <div className="space-y-4 text-xs font-sans text-sand-200">
        {/* Header Summary */}
        <div className="flex items-center justify-between p-3 bg-sand-950 border border-sand-800 rounded">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-sand-50">{testCase.name}</span>
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-sand-900 border border-sand-700 text-sand-300 font-bold rounded">
                {testCase.category.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[11px] text-sand-400">
              Executed at {new Date(lastRun.executedAt).toLocaleString()} ({lastRun.durationMs}ms)
            </p>
          </div>

          <div className="shrink-0">
            {isPassed ? (
              <span className="px-3 py-1.5 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-bold rounded flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> ALL ASSERTIONS PASSED
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-rose-950 border border-rose-800 text-rose-400 text-xs font-bold rounded flex items-center gap-1.5">
                <XCircle className="h-4 w-4" /> ASSERTION FAILED
              </span>
            )}
          </div>
        </div>

        {/* Assertions Evaluation Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-sand-300 uppercase tracking-wider">
            Assertion Evaluation Results
          </h4>
          <div className="border border-sand-800 rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-sand-900 border-b border-sand-800 text-sand-400 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="p-2.5">Assertion Criterion</th>
                  <th className="p-2.5">Target Requirement</th>
                  <th className="p-2.5">Actual Measured</th>
                  <th className="p-2.5 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-800 bg-sand-950">
                {testCase.assertions.map((a) => {
                  const res = lastRun.assertionResults.find((r) => r.assertionId === a.id);
                  return (
                    <tr key={a.id} className="text-sand-300">
                      <td className="p-2.5 font-medium text-sand-100">{a.label}</td>
                      <td className="p-2.5 font-mono text-sand-400">
                        {a.operator} {a.targetValue} {a.unit}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-sand-50">
                        {res ? `${res.actualValue} ${a.unit}` : '—'}
                      </td>
                      <td className="p-2.5 text-right font-bold">
                        {res?.passed ? (
                          <span className="text-emerald-primary inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Passed
                          </span>
                        ) : (
                          <span className="text-rose-400 inline-flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Execution Logs */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-sand-300 uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-emerald-primary" /> Execution Stepper Logs
          </h4>
          <div className="p-3 bg-sand-950 border border-sand-800 rounded font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto text-sand-300">
            {lastRun.logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* Close */}
        <div className="flex justify-end pt-2 border-t border-sand-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-emerald-primary py-2 px-5 text-xs font-bold cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
