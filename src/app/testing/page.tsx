'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FlaskConical, CheckCircle2, XCircle, AlertCircle, Loader2, FolderOpen, Server, Clock } from 'lucide-react';
import { fetchProjects, UserProject } from '@/lib/user-projects';
import { TestRunRecord } from '@/lib/db/test-runs';
import { TestRunDetailModal } from '@/components/testing/test-run-detail-modal';

// This app's palette (src/app/globals.css) remaps emerald-950/800 and
// amber-950/800 to pure black and emerald-400/amber-400 to translucent
// black — a dark bg + dark text combo here renders as invisible black-on-
// black. Rose is the one color intentionally left untouched (reserved for
// real errors), so it's safe at any stop; emerald/amber must use the
// light/text/border pattern already established elsewhere in the app (see
// the "AI Agent"/"Heuristic Fallback" badges in projects/[id]/page.tsx).
function StatusBadge({ status }: { status: TestRunRecord['status'] }) {
  if (status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-light border border-emerald-border text-emerald-text text-[10px] font-bold rounded uppercase">
        <CheckCircle2 className="h-3 w-3" /> Passed
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded uppercase">
        <AlertCircle className="h-3 w-3" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-rose-950 border border-rose-800 text-rose-400 text-[10px] font-bold rounded uppercase">
      <XCircle className="h-3 w-3" /> Failed
    </span>
  );
}

export default function TestingPage() {
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [runs, setRuns] = useState<TestRunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingRun, setViewingRun] = useState<TestRunRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProjects()
      .then((projs) => { if (!cancelled) setProjects(projs); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const params = selectedProjectId !== 'all' ? `?projectId=${encodeURIComponent(selectedProjectId)}` : '';
    fetch(`/api/testing/runs${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.error) throw new Error(data.error);
        setRuns(Array.isArray(data) ? data : []);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects]
  );

  return (
    <div className="space-y-6 font-sans pb-4">

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-4xl sm:text-5xl font-display font-normal text-sand-50 tracking-tight flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-emerald-primary" />
            Test Runs
          </h1>
          <p className="text-sand-500 text-sm sm:text-base">
            Tests run locally via Claude Code and MCP show up here — this is a log, not a launcher.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-sand-500 shrink-0" />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="minimal-card p-12 text-center">
          <Loader2 className="h-6 w-6 mx-auto text-sand-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 p-4 text-rose-700 text-xs">{error}</div>
      ) : runs.length === 0 ? (
        <div className="minimal-card p-12 text-center space-y-2">
          <FlaskConical className="h-8 w-8 mx-auto text-sand-700" />
          <p className="text-sm font-bold text-sand-300">No test runs yet</p>
          <p className="text-xs text-sand-500 max-w-md mx-auto">
            Run <code className="font-mono text-sand-400">upfreq.testing.run_test_case</code> via Claude Code or Cursor (connected over MCP — see Settings) against your Isaac Sim server. Results appear here automatically.
          </p>
        </div>
      ) : (
        <div className="minimal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-sand-925 border-b border-sand-700 text-sand-400 font-semibold uppercase tracking-wide">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Test</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Environment</th>
                  <th className="py-2.5 px-3">Server</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                  <th className="py-2.5 px-3 text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-800">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => setViewingRun(run)}
                    className="cursor-pointer hover:bg-sand-900/60 transition-colors"
                  >
                    <td className="py-2.5 px-3"><StatusBadge status={run.status} /></td>
                    <td className="py-2.5 px-3 text-sand-100 font-semibold max-w-56 truncate" title={run.testCaseName}>
                      {run.testCaseName}
                    </td>
                    <td className="py-2.5 px-3 text-sand-400">
                      {run.projectId ? (projectNameById.get(run.projectId) || '—') : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-sand-400">{run.environment}</td>
                    <td className="py-2.5 px-3 text-sand-400 max-w-40 truncate font-mono">
                      {run.serverUrl ? (
                        <span className="inline-flex items-center gap-1.5" title={run.serverUrl}>
                          <Server className="h-3 w-3 shrink-0" />
                          {run.serverUrl.replace(/^https?:\/\//, '')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-sand-400">{(run.durationMs / 1000).toFixed(1)}s</td>
                    <td className="py-2.5 px-3 text-right text-sand-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewingRun && <TestRunDetailModal run={viewingRun} onClose={() => setViewingRun(null)} />}

    </div>
  );
}
