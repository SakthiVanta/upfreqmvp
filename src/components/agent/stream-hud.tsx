'use client';

import React from 'react';
import { Terminal, Cpu, Sparkles } from 'lucide-react';

interface StreamHudProps {
  repoName?: string;
  repoUrl?: string;
  isActive?: boolean;
  isStreaming?: boolean;
  isComplete?: boolean;
  logs?: string[];
  currentThought?: string;
  stageTitle?: string;
}

export function StreamHud({
  repoName = "No Repository Loaded",
  repoUrl,
  isActive = false,
  isStreaming = false,
  isComplete = false,
  logs = [],
  currentThought,
  stageTitle = "Idle — Submit GitHub Repository URL to start audit"
}: StreamHudProps) {
  const activeState = isActive || isStreaming;
  const displayName = repoUrl ? repoUrl.split('/').pop() || repoUrl : repoName;

  // If not active, not complete, and no logs, render a clean idle banner
  if (!activeState && !isComplete && logs.length === 0) {
    return (
      <div id="agent-stream" className="minimal-card overflow-hidden text-xs">
        <div className="flex items-center justify-between border-b border-sand-800 bg-sand-925/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sand-800 text-sand-400 border border-sand-700">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sand-100">
                  Agentic Reasoning Stream
                </span>
                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-sand-800 text-sand-400 border border-sand-700">
                  IDLE
                </span>
              </div>
              <p className="text-[11px] text-sand-500 mt-0.5">
                Target Codebase: <span className="font-semibold text-sand-300">Waiting for user input</span>
              </p>
            </div>
          </div>
          <span className="text-[11px] text-sand-600 hidden sm:inline">
            Submit a repo URL above to trigger real-time SSE stream.
          </span>
        </div>
      </div>
    );
  }

  // Progress reflects real stream activity: log count against a realistic
  // step budget, rather than a hardcoded placeholder percentage.
  const estimatedSteps = 14;
  const progressPercent = isComplete ? 100 : activeState ? Math.min(96, Math.round((logs.length / estimatedSteps) * 100)) : 100;

  return (
    <div id="agent-stream" className="minimal-card overflow-hidden font-sans">

      {/* HUD Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-800 bg-sand-925/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-light text-emerald-primary border border-emerald-border">
            <Cpu className={`h-4 w-4 ${activeState ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sand-100">
                Agentic Reasoning Stream
              </span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                activeState
                  ? 'bg-emerald-light text-emerald-text border border-emerald-border'
                  : 'bg-emerald-light text-emerald-text border border-emerald-border'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${activeState ? 'animate-ping' : ''}`} />
                {activeState ? 'ANALYZING STREAM' : 'AUDIT COMPLETED'}
              </span>
            </div>
            <p className="text-[11px] text-sand-500 mt-0.5">
              Target Codebase: <span className="font-semibold text-sand-200">{displayName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-sand-950 px-3 py-1 rounded-md border border-sand-700 text-xs">
          <span className="text-sand-500">Audit Status:</span>
          <span className="text-emerald-primary font-bold">{progressPercent}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-sand-800 h-1">
        <div
          className="bg-emerald-primary h-1 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Stage Banner */}
      <div className="bg-sand-950 text-sand-100 px-4 py-2 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-emerald-400 font-bold shrink-0">CURRENT STAGE:</span>
          <span className="truncate">{activeState ? (logs[logs.length - 1] || 'Connecting to GitHub API...') : stageTitle}</span>
        </div>
        <span className="text-sand-500 text-[11px] shrink-0 ml-2">
          {isComplete ? 'Analysis Synced' : 'Stream Active'}
        </span>
      </div>

      {/* Active Thought Inspector if provided */}
      {currentThought && (
        <div className="p-4 bg-sand-925/60 border-b border-sand-800">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-emerald-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-xs font-bold text-sand-100 uppercase tracking-wide block">
                Agent Thought Reasoning
              </span>
              <p className="mt-1 text-xs text-sand-200 font-mono bg-sand-950 p-3 rounded-lg border border-sand-800 leading-relaxed">
                &quot;{currentThought}&quot;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Log Stream */}
      {logs.length > 0 && (
        <div className="p-4 bg-sand-950 font-mono text-xs max-h-56 overflow-y-auto space-y-1 text-sand-300">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2">
              <span className="text-sand-600 text-[10px] shrink-0">LOG #{idx + 1}</span>
              <span className={log.includes('✓') || log.includes('CONFIRMED') || log.includes('VERIFIED') ? 'text-emerald-400 font-bold' : ''}>
                {log}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
