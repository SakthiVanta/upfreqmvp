'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { GithubIcon } from '@/components/ui/github-icon';
import {
  LogOut, Menu, X, RefreshCw, Database, FolderOpen
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/projects', label: 'Projects', icon: FolderOpen },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

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
      <aside className="hidden md:flex bg-sand-925 text-sand-200 flex-col border-r border-sand-800 w-64 xl:w-72 z-30">
        <div className="flex items-center border-b border-sand-800 shrink-0 h-16 lg:h-18 px-4 justify-between">
          <Link href="/projects" className="flex items-center gap-2.5 overflow-hidden">
            <div className="bg-emerald-primary text-sand-950 flex items-center justify-center font-bold shrink-0 h-9 w-9 lg:h-10 lg:w-10 text-sm lg:text-base">
              UF
            </div>
            <span className="font-display font-bold text-base lg:text-lg text-sand-50 tracking-tight leading-none">
              UpFreq
            </span>
          </Link>
        </div>

        {/* Sidebar Navigation Items — icon-nav-md / text-nav-md scale (see
            architecture/02_ui_design_system_and_palette.md "Sidebar
            Navigation Scale"), one step up on xl+ screens where there's
            room for it. */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto text-sm xl:text-base">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === '/projects' && pathname === '/');
            return (
              <Link
                key={href}
                href={href}
                className={`tap-scale flex items-center gap-3.5 px-3.5 py-3 font-semibold transition-all ${
                  active
                    ? 'bg-emerald-primary text-sand-950'
                    : 'text-sand-300 hover:bg-sand-800 hover:text-sand-50'
                }`}
              >
                <Icon className="shrink-0 h-5 w-5 xl:h-6 xl:w-6" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout Section */}
        <div className="p-3 border-t border-sand-800 bg-sand-950/60 shrink-0 space-y-2">
          <button
            onClick={handleResetDatabase}
            disabled={isResettingDb}
            className="w-full py-1.5 px-2 bg-sand-800 hover:bg-rose-950 hover:text-rose-300 text-sand-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-sand-700 cursor-pointer disabled:opacity-60"
          >
            {isResettingDb ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-rose-400" />}
            <span>Reset DB (Demo User)</span>
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="h-7 w-7 bg-sand-800 border border-sand-700 flex items-center justify-center font-bold text-xs text-emerald-400 shrink-0">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-sand-100 truncate">{user?.username}</span>
                <span className="text-[10px] text-sand-500 truncate capitalize">{user?.provider} Auth</span>
              </div>
            </div>

            <button
              onClick={() => { logout(); router.push('/'); }}
              className="p-1.5 text-sand-500 hover:text-red-400 hover:bg-sand-800 transition-colors cursor-pointer"
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
              <div className="h-7 w-7 bg-emerald-primary text-sand-950 flex items-center justify-center font-bold text-xs">
                UF
              </div>
              <span className="font-bold text-sm">UpFreq</span>
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
                  className={`tap-scale flex items-center gap-3 p-3 font-bold transition-colors ${
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
                className="w-full py-3 bg-rose-950 text-rose-200 border border-rose-800 font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Database className="h-4 w-4" />
                Reset DB to Demo User
              </button>

              <button
                onClick={() => { logout(); router.push('/'); }}
                className="w-full py-3 bg-sand-800 text-sand-300 font-bold flex items-center justify-center gap-2 cursor-pointer"
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
        {/* Top bar — mobile only; the sidebar already covers branding,
            navigation, reset, and sign-out on desktop, so nothing here is
            duplicated there. */}
        <header className="md:hidden h-14 bg-sand-925/95 backdrop-blur-md border-b border-sand-800 px-4 flex items-center justify-between shrink-0 sticky top-0 z-20">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-sand-300 hover:text-sand-50 border border-sand-700 cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>

          <span className="font-display font-bold text-sm text-sand-50">UpFreq</span>

          <button
            onClick={() => { logout(); router.push('/'); }}
            className="p-2 text-sand-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        {/* Dynamic Page Main Content */}
        <main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
