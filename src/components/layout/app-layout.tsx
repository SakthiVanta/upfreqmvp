'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { GithubIcon } from '@/components/ui/github-icon';
import { 
  Cpu, Layers, Box, LogIn, LogOut, Compass, ChevronLeft, ChevronRight, 
  ShieldCheck, UserCheck, Terminal, Settings, Menu, X, RefreshCw, Database
} from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isResettingDb, setIsResettingDb] = useState(false);

  const handleResetDatabase = async () => {
    if (!confirm('Are you sure you want to reset the database and clear all workspace data to only the demo user?')) return;

    setIsResettingDb(true);
    try {
      await fetch('/api/db/reset', { method: 'POST' });
      localStorage.removeItem('upfreq_user_projects');
      localStorage.removeItem('upfreq_active_project_id');
      localStorage.removeItem('upfreq_selected_robot');
      localStorage.removeItem('upfreq_ingested_repo_url');
      alert('Database and workspace reset complete! Reinitialized with clean Demo User.');
      window.location.href = '/dashboard';
    } catch (e) {
      alert('Workspace reset finished.');
      window.location.reload();
    } finally {
      setIsResettingDb(false);
    }
  };

  // If user is NOT logged in or is on the marketing home page without logging in, render clean container
  if (!isAuthenticated || pathname === '/login') {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      
      {/* 1. Desktop Left Sidebar */}
      <aside className={`hidden md:flex bg-slate-900 text-slate-100 flex-col border-r border-slate-800 transition-all duration-300 z-30 ${
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

        {/* User Profile & Logout Section */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0 space-y-2">
          <button
            onClick={handleResetDatabase}
            disabled={isResettingDb}
            className="w-full py-1.5 px-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 rounded font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-700"
          >
            {isResettingDb ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-rose-400" />}
            {!sidebarCollapsed && <span>Reset DB (Demo User)</span>}
          </button>

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

      {/* 2. Mobile Responsive Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col">
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-emerald-primary text-white flex items-center justify-center font-mono font-bold text-xs">
                UF
              </div>
              <span className="font-bold text-sm font-mono">UpFreq Mobile Menu</span>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2 font-mono text-sm">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 text-white font-bold"
            >
              <Cpu className="h-5 w-5 text-emerald-primary" />
              1. Agent Workspace
            </Link>
            <Link
              href="/matrix"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 text-white font-bold"
            >
              <Layers className="h-5 w-5 text-emerald-primary" />
              2. Parameter Matrix
            </Link>
            <Link
              href="/studio"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 text-white font-bold"
            >
              <Box className="h-5 w-5 text-emerald-primary" />
              3. 3D Parametric Studio
            </Link>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <button
                onClick={handleResetDatabase}
                className="w-full py-3 bg-rose-950 text-rose-200 border border-rose-800 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Database className="h-4 w-4" />
                Reset DB to Demo User
              </button>

              <button
                onClick={() => { logout(); router.push('/'); }}
                className="w-full py-3 bg-slate-800 text-slate-300 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* 3. Main Responsive Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto w-full">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-primary animate-pulse shrink-0" />
              <span className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
                UpFreq Autonomous Robotics Suite
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <button
              onClick={handleResetDatabase}
              disabled={isResettingDb}
              className="hidden sm:flex px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold items-center gap-1.5 transition-all"
            >
              <Database className="h-3.5 w-3.5" />
              Reset DB
            </button>

            <button
              onClick={() => { logout(); router.push('/'); }}
              className="text-slate-600 hover:text-red-600 font-semibold transition-colors flex items-center gap-1 shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Main Content */}
        <main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
