'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface ConnectOption {
  key: string;
  label: string;
  recommended?: boolean;
  description: string;
  snippet: string;
  toastLabel: string;
}

function buildOptions(origin: string): ConnectOption[] {
  const mcpUrl = `${origin}/api/mcp`;
  return [
    {
      key: 'claude',
      label: 'Claude Code CLI',
      recommended: true,
      description: 'Run this single command in your project terminal:',
      snippet: `claude mcp add --transport http upfreq ${mcpUrl}`,
      toastLabel: 'Claude Code CLI command',
    },
    {
      key: 'codex',
      label: 'OpenAI Codex CLI',
      description: 'Run this single command in your project terminal:',
      snippet: `codex mcp add upfreq --url ${mcpUrl}`,
      toastLabel: 'Codex CLI command',
    },
    {
      key: 'cursor',
      label: 'Cursor / VS Code (`.cursor/mcp.json`)',
      description: 'Add this to your `.cursor/mcp.json` or Claude Desktop `claude_desktop_config.json`:',
      snippet: JSON.stringify({ mcpServers: { upfreq: { url: mcpUrl } } }, null, 2),
      toastLabel: 'Cursor configuration JSON',
    },
  ];
}

// Two visual variants so this can drop into both the full Settings page
// (bigger cards, "1./2./3." numbering) and the compact connect modal
// ("Option A/B/C" numbering) without either losing its existing look.
const VARIANT_STYLES = {
  page: {
    wrapper: 'minimal-card p-5 sm:p-6 space-y-3',
    snippetBox: 'p-3.5 bg-sand-950 border border-sand-800 font-mono text-[11px] text-sand-100 overflow-x-auto whitespace-pre-wrap select-all',
    prefix: (i: number) => `${i + 1}.`,
  },
  modal: {
    wrapper: 'p-4 bg-sand-950 border border-sand-800 space-y-2.5',
    snippetBox: 'p-3 bg-black border border-sand-800 font-mono text-[11px] text-sand-100 overflow-x-auto whitespace-pre-wrap select-all',
    prefix: (i: number) => `Option ${String.fromCharCode(65 + i)}:`,
  },
} as const;

export function McpConnectOptions({ origin, variant }: { origin: string; variant: 'page' | 'modal' }) {
  const toast = useToast();
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const styles = VARIANT_STYLES[variant];

  const handleCopy = (opt: ConnectOption) => {
    navigator.clipboard.writeText(opt.snippet);
    setCopied((c) => ({ ...c, [opt.key]: true }));
    toast.success(`Copied ${opt.toastLabel} to clipboard!`);
    setTimeout(() => setCopied((c) => ({ ...c, [opt.key]: false })), 2000);
  };

  return (
    <>
      {buildOptions(origin).map((opt, i) => (
        <div key={opt.key} className={styles.wrapper}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sand-50 text-sm">
                {styles.prefix(i)} {opt.label}
              </span>
              {opt.recommended && (
                <span className="px-1.5 py-0.5 bg-emerald-primary text-sand-950 font-bold text-[10px]">Recommended</span>
              )}
            </div>
            <button
              onClick={() => handleCopy(opt)}
              className="py-1.5 px-3 bg-sand-800 hover:bg-sand-700 text-sand-200 border border-sand-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {copied[opt.key] ? <Check className="h-3.5 w-3.5 text-emerald-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copied[opt.key] ? 'Copied' : 'Copy'}
            </button>
          </div>

          <p className="text-sand-400 text-[11px]">{opt.description}</p>

          <div className={styles.snippetBox}>{opt.snippet}</div>
        </div>
      ))}
    </>
  );
}
