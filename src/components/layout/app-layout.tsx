'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { GithubIcon } from '@/components/ui/github-icon';
import { Cpu, Layers, Box, LogIn, LogOut, Compass, ChevronLeft, ChevronRight, ShieldCheck, UserCheck, Terminal, Settings } from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // If user is NOT logged in or is on the marketing home page without logging in, render clean container
  if (!isAuthenticated || pathname === '/login') {
    return <div className="w-full">{children}</div>;
  }

  // Authenticated Web App Sidebar Layout
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      
      {/* Left Collapsible Sidebar */}
      <aside className={`bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-all duration-300 z-30 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        
        {/* Sidebar Header / Brand */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-lg bg-emerald-primary text-white flex items-center justify-center font-mono font-bold text-sm shrink-0 shadow-xs">
              UF
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm text-white tracking-tight leading-none">
                  UpFreq Robotics
                </span>
                <span className="text-[10px] text-emerald-400 font-mono mt-0.5">
                  App Workspace v2.4
                </span>
              </div>
            )}
          </Link>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto font-mono text-xs">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              pathname === '/dashboard' || pathname === '/'
                ? 'bg-emerald-primary text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Cpu className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>1. Agent Workspace</span>}
          </Link>

          <Link
            href="/matrix"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              pathname === '/matrix'
                ? 'bg-emerald-primary text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>2. Parameter Matrix</span>}
          </Link>

          <Link
            href="/studio"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all ${
              pathname === '/studio'
                ? 'bg-emerald-primary text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Box className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>3. 3D Parametric Studio</span>}
          </Link>
        </nav>

        {/* User Profile & Logout Bottom Section */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400 shrink-0">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-100 truncate">{user?.username}</span>
                  <span className="text-[10px] text-slate-400 truncate capitalize">{user?.provider} Auth</span>
                </div>
              )}
            </div>

            <button
              onClick={() => { logout(); router.push('/'); }}
              className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Web App Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-emerald-primary animate-pulse" />
            <span className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider">
              Target Codebase: Ekumen-OS/andino (Humble / Jazzy)
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors">
              Marketing Page
            </Link>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => { logout(); router.push('/'); }}
              className="text-slate-600 hover:text-red-600 font-semibold transition-colors flex items-center gap-1"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
