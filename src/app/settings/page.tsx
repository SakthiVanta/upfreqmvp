'use client';

import React from 'react';
import { McpSettingsTab } from '@/components/settings/mcp-settings-tab';

export default function SettingsPage() {
  return (
    <div className="space-y-8 font-sans pb-4 max-w-3xl">

      <div className="space-y-1.5">
        <h1 className="text-4xl sm:text-5xl font-display font-normal text-sand-50 tracking-tight">
          Settings
        </h1>
        <p className="text-sand-500 text-sm sm:text-base">
          Connect Claude Code, Cursor, or any MCP-compatible tool to your UpFreq account.
        </p>
      </div>

      <McpSettingsTab />

    </div>
  );
}
