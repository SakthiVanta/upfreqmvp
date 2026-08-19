'use client';

import React from 'react';
import { Terminal, Cpu, Sparkles, Check, AlertTriangle, FileCode } from 'lucide-react';

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
      <div id="agent-stream" className="minimal-card overflow-hidden bg-white border-zinc-200 shadow-xs font-mono text-xs">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 border border-zinc-200">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 font-mono">
                  GEMINI AI AGENTIC REASONING STREAM
                </span>
                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
                  IDLE
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                Target Codebase: <span className="font-semibold text-zinc-700">Waiting for user input</span>
              </p>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500">
            Submit a repo URL above to trigger real-time SSE stream.
          </span>
        </div>
      </div>
    );
  }

  const progressPercent = isComplete ? 100 : activeState ? 65 : 100;

  return (
    <div id="agent-stream" className="minimal-card overflow-hidden bg-white border-zinc-200 shadow-xs font-sans">
      
      {/* HUD Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/80 px-4 py-3 font-mono">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Cpu className={`h-4 w-4 ${activeState ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                GEMINI AI AGENTIC REASONING STREAM
              </span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                activeState 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeState ? 'bg-indigo-600 animate-ping' : 'bg-emerald-500'}`} />
                {activeState ? 'ANALYZING STREAM' : 'AUDIT COMPLETED'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Target Codebase: <span className="font-semibold text-zinc-800">{displayName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-md border border-zinc-200 text-xs">
          <span className="text-zinc-500">Audit Status:</span>
          <span className="text-indigo-600 font-bold">{progressPercent}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-100 h-1">
        <div 
          className="bg-indigo-600 h-1 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Stage Banner */}
      <div className="bg-zinc-900 text-white px-4 py-2 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 font-bold">CURRENT STAGE:</span>
          <span>{activeState ? 'Parsing GitHub ROS 2 packages & URDF joint tree...' : stageTitle}</span>
        </div>
        <span className="text-zinc-400 text-[11px]">
          {isComplete ? 'Analysis Synced' : 'Stream Active'}
        </span>
      </div>

      {/* Active Thought Inspector if provided */}
      {currentThought && (
        <div className="p-4 bg-zinc-50 border-b border-zinc-200">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wide font-mono block">
                Agent Thought Reasoning
              </span>
              <p className="mt-1 text-xs text-zinc-800 font-mono bg-white p-3 rounded-lg border border-zinc-200 leading-relaxed">
                &quot;{currentThought}&quot;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Log Stream */}
      {logs.length > 0 && (
        <div className="p-4 bg-zinc-950 font-mono text-xs max-h-48 overflow-y-auto space-y-1 text-zinc-300">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-zinc-500 text-[10px] shrink-0">LOG #{idx + 1}</span>
              <span className={log.includes('✓') || log.includes('CONFIRMED') ? 'text-emerald-400 font-bold' : ''}>
                {log}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
