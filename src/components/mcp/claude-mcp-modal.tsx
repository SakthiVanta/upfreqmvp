'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Check, ExternalLink, Cpu, Bot, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { useToast } from '@/components/ui/toast';

export function ClaudeMcpModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [copiedCursor, setCopiedCursor] = useState(false);
  const [mcpHealth, setMcpHealth] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [toolCount, setToolCount] = useState<number>(0);

  const [origin, setOrigin] = useState('http://localhost:3000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }

    // GET /api/mcp is deliberately unauthenticated server metadata — the
    // real tools/list call needs a WorkOS bearer token this browser session
    // can't provide, so this only confirms the gateway process is up, not a
    // full OAuth round-trip the way a real MCP client would do it.
    fetch('/api/mcp', { method: 'GET' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (typeof data.toolCount === 'number') {
          setToolCount(data.toolCount);
          setMcpHealth('healthy');
        } else {
          setMcpHealth('error');
        }
      })
      .catch(() => setMcpHealth('error'));
  }, []);

  const claudeCommand = `claude mcp add --transport http upfreq ${origin}/api/mcp`;

  const cursorJson = JSON.stringify(
    {
      mcpServers: {
        upfreq: {
          url: `${origin}/api/mcp`,
        },
      },
    },
    null,
    2
  );

  const handleCopyClaude = () => {
    navigator.clipboard.writeText(claudeCommand);
    setCopiedClaude(true);
    toast.success('Copied Claude Code MCP command to clipboard!');
    setTimeout(() => setCopiedClaude(false), 2500);
  };

  const handleCopyCursor = () => {
    navigator.clipboard.writeText(cursorJson);
    setCopiedCursor(true);
    toast.success('Copied Cursor MCP configuration JSON to clipboard!');
    setTimeout(() => setCopiedCursor(false), 2500);
  };

  return (
    <ModalShell onClose={onClose} title="Connect Claude Code & Cursor (MCP Gateway)" icon={Terminal} wide>
      <div className="space-y-5 text-xs font-sans">
        {/* Health status banner */}
        <div className="p-4 bg-sand-950 border border-sand-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            {mcpHealth === 'checking' ? (
              <Loader2 className="h-4 w-4 text-sand-400 animate-spin" />
            ) : mcpHealth === 'healthy' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-primary" />
            ) : (
              <div className="h-3 w-3 bg-amber-500 rounded-full" />
            )}
            <div>
              <span className="font-bold text-sand-50">UpFreq MCP Server Gateway: Active</span>
              <p className="text-[11px] text-sand-500">
                {toolCount > 0
                  ? `${toolCount} Agent-Native tools exposed (Robots, Projects, Isaac Sim Testing, URDF compiler)`
                  : 'Ready for client connections'}
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 border border-sand-700 bg-sand-900 font-mono text-[10px] text-emerald-primary font-bold">
            JSON-RPC 2.0 / SSE
          </span>
        </div>

        {/* Value Proposition */}
        <div className="space-y-1.5 text-sand-300 leading-relaxed">
          <p>
            <strong>No in-browser code editor needed:</strong> You write, compile, and debug your ROS 2 nodes directly in your local terminal with <strong>Claude Code CLI</strong> or in <strong>Cursor</strong>.
          </p>
          <p className="text-sand-400 text-[11px]">
            By connecting UpFreq through the Model Context Protocol (MCP), Claude Code can inspect robot kinematics, compile OpenUSD models, and launch NVIDIA Isaac Sim simulation tests directly from your CLI.
          </p>
        </div>

        {/* Tab / Option 1: Claude Code CLI */}
        <div className="p-4 bg-sand-950 border border-sand-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sand-50 text-sm">Option A: Claude Code CLI</span>
              <span className="px-1.5 py-0.5 bg-emerald-primary text-sand-950 font-bold text-[10px]">Recommended</span>
            </div>
            <button
              onClick={handleCopyClaude}
              className="py-1 px-2.5 bg-sand-800 hover:bg-sand-700 text-sand-200 border border-sand-700 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
            >
              {copiedClaude ? <Check className="h-3.5 w-3.5 text-emerald-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedClaude ? 'Copied' : 'Copy Command'}
            </button>
          </div>

          <p className="text-[11px] text-sand-400">Run this single command in your local project terminal:</p>

          <div className="p-3 bg-black border border-sand-800 font-mono text-[11px] text-sand-100 flex items-center justify-between select-all">
            <span>{claudeCommand}</span>
          </div>
        </div>

        {/* Tab / Option 2: Cursor / VS Code */}
        <div className="p-4 bg-sand-950 border border-sand-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sand-50 text-sm">Option B: Cursor / VS Code (`.cursor/mcp.json`)</span>
            <button
              onClick={handleCopyCursor}
              className="py-1 px-2.5 bg-sand-800 hover:bg-sand-700 text-sand-200 border border-sand-700 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
            >
              {copiedCursor ? <Check className="h-3.5 w-3.5 text-emerald-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedCursor ? 'Copied' : 'Copy JSON'}
            </button>
          </div>

          <div className="p-3 bg-black border border-sand-800 font-mono text-[11px] text-sand-100 overflow-x-auto whitespace-pre-wrap select-all">
            {cursorJson}
          </div>
        </div>

        {/* Capabilities list */}
        <div className="p-3.5 bg-sand-900/50 border border-sand-800 text-[11px] text-sand-400 space-y-1.5">
          <span className="font-bold text-sand-300 uppercase tracking-wider text-[10px] block">
            What Claude Code Can Do With UpFreq:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-primary shrink-0" />
              <span>Read and edit robot URDF / Xacro specifications</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-primary shrink-0" />
              <span>Launch Isaac Sim physics simulation tests</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-primary shrink-0" />
              <span>Verify inertia tensors & coordinate frame compliance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-primary shrink-0" />
              <span>Fetch live telemetry and simulation logs</span>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
