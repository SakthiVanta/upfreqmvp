'use client';

import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Sparkles,
  Bot,
  Layers,
  FolderOpen,
  FlaskConical,
  Radio,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export function McpSettingsTab() {
  const toast = useToast();
  const [origin, setOrigin] = useState('http://localhost:3000');
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [copiedCursor, setCopiedCursor] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: 'healthy' | 'error'; latencyMs: number; toolCount: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
    handleTestPing();
  }, []);

  const handleTestPing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      // GET /api/mcp is deliberately unauthenticated server metadata (see
      // that route's comment) — the actual tools/list call needs a WorkOS
      // bearer token our own browser session can't provide, so this only
      // confirms the gateway process itself is up, not a full OAuth
      // round-trip the way a real MCP client (Claude/Cursor) would do it.
      const res = await fetch('/api/mcp', { method: 'GET' });
      const latency = Math.round(performance.now() - start);
      const data = await res.json();
      if (res.ok && typeof data.toolCount === 'number') {
        setPingResult({
          status: 'healthy',
          latencyMs: latency,
          toolCount: data.toolCount,
        });
      } else {
        setPingResult({ status: 'error', latencyMs: latency, toolCount: 0 });
      }
    } catch {
      setPingResult({ status: 'error', latencyMs: 0, toolCount: 0 });
    } finally {
      setIsPinging(false);
    }
  };

  const claudeCommand = `claude mcp add --transport http upfreq ${origin}/api/mcp`;
  const cursorConfig = JSON.stringify(
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
    toast.success('Copied Claude Code CLI command!');
    setTimeout(() => setCopiedClaude(false), 2000);
  };

  const handleCopyCursor = () => {
    navigator.clipboard.writeText(cursorConfig);
    setCopiedCursor(true);
    toast.success('Copied Cursor configuration JSON!');
    setTimeout(() => setCopiedCursor(false), 2000);
  };

  return (
    <div className="space-y-6 text-xs font-sans">
      {/* Overview Banner */}
      <div className="minimal-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-emerald-primary" />
              <h3 className="text-sm font-bold text-sand-50 uppercase tracking-wider">
                UpFreq Model Context Protocol (MCP) Gateway
              </h3>
            </div>
            <p className="text-sand-400 text-[11px] leading-relaxed">
              Connect external AI agents (like <strong>Claude Code CLI</strong> or <strong>Cursor</strong>) directly to UpFreq.
              Claude can create projects, author robot models, compile OpenUSD, and execute Isaac Sim tests from your local terminal.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTestPing}
              disabled={isPinging}
              className="py-1.5 px-3 bg-sand-800 hover:bg-sand-700 text-sand-200 border border-sand-700 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isPinging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Test Connection
            </button>
          </div>
        </div>

        {/* Live Gateway Status Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-sand-800">
          <div className="p-3 bg-sand-950 border border-sand-800 space-y-1">
            <span className="text-sand-500 uppercase text-[10px] block font-bold">MCP Server Status</span>
            <div className="flex items-center gap-2">
              {pingResult?.status === 'healthy' ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-primary" />
                  <span className="font-bold text-sand-50">Active &amp; Online ({pingResult.latencyMs}ms)</span>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="font-bold text-sand-50">Checking Gateway...</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 bg-sand-950 border border-sand-800 space-y-1">
            <span className="text-sand-500 uppercase text-[10px] block font-bold">Protocol Specification</span>
            <span className="font-mono text-sand-100 font-bold">MCP JSON-RPC 2.0 / SSE</span>
          </div>

          <div className="p-3 bg-sand-950 border border-sand-800 space-y-1">
            <span className="text-sand-500 uppercase text-[10px] block font-bold">Exposed Robotics Tools</span>
            <span className="font-mono text-emerald-primary font-bold">
              {pingResult?.toolCount || 20} Agent-Native Actions
            </span>
          </div>
        </div>
      </div>

      {/* Option 1: Claude Code CLI Integration */}
      <div className="minimal-card p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-sand-50">1. Connect Claude Code CLI</span>
            <span className="px-1.5 py-0.5 bg-emerald-primary text-sand-950 font-bold text-[10px]">Recommended</span>
          </div>
          <button
            onClick={handleCopyClaude}
            className="py-1.5 px-3 bg-sand-800 hover:bg-sand-700 text-sand-200 border border-sand-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            {copiedClaude ? <Check className="h-3.5 w-3.5 text-emerald-primary" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedClaude ? 'Copied' : 'Copy Command'}
          </button>
        </div>

        <p className="text-sand-400 text-[11px]">
          Run this single command in your project terminal to register UpFreq as an MCP server with Claude Code:
        </p>

        <div className="p-3.5 bg-sand-950 border border-sand-800 font-mono text-[11px] text-sand-100 flex items-center justify-between select-all">
          <span>{claudeCommand}</span>
        </div>
      </div>

      {/* Option 2: Cursor / VS Code Integration */}
      <div className="minimal-card p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm text-sand-50">2. Connect Cursor / VS Code (`.cursor/mcp.json`)</span>
          <button
            onClick={handleCopyCursor}
            className="py-1.5 px-3 bg-sand-800 hover:bg-sand-700 text-sand-200 border border-sand-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            {copiedCursor ? <Check className="h-3.5 w-3.5 text-emerald-primary" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedCursor ? 'Copied' : 'Copy JSON'}
          </button>
        </div>

        <p className="text-sand-400 text-[11px]">
          Add this to your `.cursor/mcp.json` or Claude Desktop `claude_desktop_config.json`:
        </p>

        <div className="p-3.5 bg-sand-950 border border-sand-800 font-mono text-[11px] text-sand-100 overflow-x-auto whitespace-pre-wrap select-all">
          {cursorConfig}
        </div>
      </div>

      {/* Agent-Native Tools Catalog */}
      <div className="minimal-card p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-sand-50 uppercase tracking-wider">
            Agent-Native Tools Exposed via MCP
          </h4>
          <p className="text-sand-500 text-[11px]">
            Claude Code can invoke any of these actions directly during conversation or autonomous coding sessions:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Projects */}
          <div className="p-3.5 bg-sand-950 border border-sand-800 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sand-100">
              <FolderOpen className="h-3.5 w-3.5 text-emerald-primary" />
              <span>Project Management</span>
            </div>
            <ul className="space-y-1 font-mono text-[10px] text-sand-400">
              <li>• <span className="text-emerald-400">upfreq.project.create_project</span>: Create a new project</li>
              <li>• <span className="text-emerald-400">upfreq.project.list_projects</span>: List your projects</li>
            </ul>
          </div>

          {/* Robots */}
          <div className="p-3.5 bg-sand-950 border border-sand-800 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sand-100">
              <Bot className="h-3.5 w-3.5 text-emerald-primary" />
              <span>Robot Description &amp; USD Compiler</span>
            </div>
            <ul className="space-y-1 font-mono text-[10px] text-sand-400">
              <li>• <span className="text-emerald-400">upfreq.robot.create_description</span>: Synthesize parametric Xacro</li>
              <li>• <span className="text-emerald-400">upfreq.robot.validate_urdf</span>: Verify kinematic tree &amp; physics</li>
              <li>• <span className="text-emerald-400">upfreq.robot.compile_simulation</span>: Preflight compile to OpenUSD</li>
              <li>• <span className="text-emerald-400">upfreq.robot.calculate_inertias</span>: Check Sylvester positive-definiteness</li>
              <li>• <span className="text-emerald-400">upfreq.robot.save_robot</span>: Save a robot to a project for good</li>
              <li>• <span className="text-emerald-400">upfreq.robot.list_robots</span>: List robots already saved</li>
            </ul>
          </div>

          {/* Workspaces */}
          <div className="p-3.5 bg-sand-950 border border-sand-800 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sand-100">
              <FolderOpen className="h-3.5 w-3.5 text-emerald-primary" />
              <span>Local Workspace Memory</span>
            </div>
            <ul className="space-y-1 font-mono text-[10px] text-sand-400">
              <li>• <span className="text-emerald-400">upfreq.workspace.get_path</span>: Find this project's path on this machine</li>
              <li>• <span className="text-emerald-400">upfreq.workspace.register</span>: Remember a project's path on this machine</li>
              <li>• <span className="text-emerald-400">upfreq.workspace.list</span>: List every machine a project is checked out on</li>
            </ul>
          </div>

          {/* Environments */}
          <div className="p-3.5 bg-sand-950 border border-sand-800 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sand-100">
              <Layers className="h-3.5 w-3.5 text-emerald-primary" />
              <span>Simulation Environments</span>
            </div>
            <ul className="space-y-1 font-mono text-[10px] text-sand-400">
              <li>• <span className="text-emerald-400">upfreq.environment.list_environments</span>: List open-source stages</li>
              <li>• <span className="text-emerald-400">upfreq.environment.select_environment</span>: Stage warehouse/hospital in Isaac</li>
            </ul>
          </div>

          {/* Testing */}
          <div className="p-3.5 bg-sand-950 border border-sand-800 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sand-100">
              <FlaskConical className="h-3.5 w-3.5 text-emerald-primary" />
              <span>Isaac Sim Testing &amp; Diagnostics</span>
            </div>
            <ul className="space-y-1 font-mono text-[10px] text-sand-400">
              <li>• <span className="text-emerald-400">upfreq.testing.run_test_case</span>: Run a test against your Isaac Sim server &amp; record it</li>
              <li>• <span className="text-emerald-400">upfreq.testing.list_runs</span>: See what's already been tested</li>
              <li>• <span className="text-emerald-400">upfreq.testing.create_test_case</span>: Define custom assertion tests</li>
              <li>• <span className="text-emerald-400">upfreq.ros.validate_time_config</span>: Audit /clock &amp; use_sim_time</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
