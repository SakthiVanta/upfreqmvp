'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { GithubIcon } from '@/components/ui/github-icon';
import {
  LogOut, ChevronLeft, ChevronRight,
  Menu, X, RefreshCw, Database, FolderPlus
  // Layers, Box, Bot — Parameter Matrix / 3D Studio / Robot Library nav
  // icons, unused while those tabs are commented out below.
} from 'lucide-react';

// Phase 1 scope: project creation, attaching a GitHub repo, and running the
// AI agent audit — that's it for now. Parameter Matrix, 3D Parametric
// Studio, and Robot Library are commented out (not deleted) until a later
// phase; their routes still work if linked to directly, they're just off
// the nav.
const NAV_ITEMS = [
  { href: '/projects', label: 'Projects', icon: FolderPlus },
  // { href: '/matrix', label: '2. Parameter Matrix', icon: Layers },
  // { href: '/studio', label: '3. 3D Parametric Studio', icon: Box },
  // { href: '/robots', label: '4. Robot Library', icon: Bot },
];

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
      window.location.href = '/projects';
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
    <div className="flex h-screen overflow-hidden bg-sand-950 font-sans">

      {/* 1. Desktop Left Sidebar */}
      <aside className={`hidden md:flex bg-sand-925 text-sand-200 flex-col border-r border-sand-800 transition-all duration-300 z-30 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        {/* Sidebar Header / Brand */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-sand-800 shrink-0">
          <Link href="/projects" className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-lg bg-emerald-primary text-sand-950 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              UF
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-display font-bold text-sm text-sand-50 tracking-tight leading-none">
                  UpFreq Robotics
                </span>
                <span className="text-[10px] text-emerald-400 mt-0.5">
                  App Workspace v2.4
                </span>
              </div>
            )}
          </Link>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-md text-sand-500 hover:text-sand-50 hover:bg-sand-800 transition-colors cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto text-xs">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === '/projects' && pathname === '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all ${
                  active
                    ? 'bg-emerald-primary text-sand-950 shadow-xs'
                    : 'text-sand-300 hover:bg-sand-800 hover:text-sand-50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout Section */}
        <div className="p-3 border-t border-sand-800 bg-sand-950/60 shrink-0 space-y-2">
          <button
            onClick={handleResetDatabase}
            disabled={isResettingDb}
            className="w-full py-1.5 px-2 bg-sand-800 hover:bg-rose-950 hover:text-rose-300 text-sand-300 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-sand-700 cursor-pointer disabled:opacity-60"
          >
            {isResettingDb ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-rose-400" />}
            {!sidebarCollapsed && <span>Reset DB (Demo User)</span>}
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="h-7 w-7 rounded-full bg-sand-800 border border-sand-700 flex items-center justify-center font-bold text-xs text-emerald-400 shrink-0">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-sand-100 truncate">{user?.username}</span>
                  <span className="text-[10px] text-sand-500 truncate capitalize">{user?.provider} Auth</span>
                </div>
              )}
            </div>

            <button
              onClick={() => { logout(); router.push('/'); }}
              className="p-1.5 rounded text-sand-500 hover:text-red-400 hover:bg-sand-800 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Mobile Responsive Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-sand-950/90 backdrop-blur-sm flex flex-col animate-in fade-in">
          <div className="bg-sand-925 text-sand-50 p-4 flex items-center justify-between border-b border-sand-800">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-emerald-primary text-sand-950 flex items-center justify-center font-bold text-xs">
                UF
              </div>
              <span className="font-bold text-sm">UpFreq Mobile Menu</span>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-sand-400 hover:text-sand-50 cursor-pointer">
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2 text-sm overflow-y-auto">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 p-3 rounded-xl font-bold transition-colors ${
                    active ? 'bg-emerald-primary text-sand-950' : 'bg-sand-800 text-sand-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? '' : 'text-emerald-primary'}`} />
                  {label}
                </Link>
              );
            })}

            <div className="pt-4 border-t border-sand-800 space-y-3">
              <button
                onClick={handleResetDatabase}
                className="w-full py-3 bg-rose-950 text-rose-200 border border-rose-800 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Database className="h-4 w-4" />
                Reset DB to Demo User
              </button>

              <button
                onClick={() => { logout(); router.push('/'); }}
                className="w-full py-3 bg-sand-800 text-sand-300 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer"
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
        <header className="h-16 bg-sand-925/95 backdrop-blur-md border-b border-sand-800 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-sand-300 hover:text-sand-50 rounded-lg border border-sand-700 cursor-pointer shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-primary animate-pulse shrink-0" />
              <span className="text-xs font-bold text-sand-100 uppercase tracking-wider truncate">
                UpFreq Autonomous Robotics Suite
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            <button
              onClick={handleResetDatabase}
              disabled={isResettingDb}
              className="hidden sm:flex px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
            >
              <Database className="h-3.5 w-3.5" />
              Reset DB
            </button>

            <button
              onClick={() => { logout(); router.push('/'); }}
              className="text-sand-400 hover:text-red-400 font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
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
