'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { GithubIcon } from '@/components/ui/github-icon';
import { Cpu, Layers, Box, LogIn, LogOut, CheckCircle2, ShieldAlert } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs border border-slate-800">
                UF
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
                  UpFreq Robotics
                  <span className="text-[10px] bg-emerald-light text-emerald-text px-1.5 py-0.2 rounded font-mono font-semibold border border-emerald-border">
                    v2.4
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Agentic Code Ingestion Engine
                </span>
              </div>
            </Link>

            {/* Real Page Nav Links */}
            <nav className="hidden md:flex items-center gap-1 font-mono text-xs font-semibold">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  pathname === '/' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                1. Repo Scanner
              </Link>

              <Link
                href="/dashboard"
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  pathname === '/dashboard' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Cpu className="h-3.5 w-3.5 text-emerald-primary" />
                2. Live Agent Stream
              </Link>

              <Link
                href="/matrix"
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  pathname === '/matrix' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-emerald-primary" />
                3. Parameter Matrix
              </Link>

              <Link
                href="/studio"
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  pathname === '/studio' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Box className="h-3.5 w-3.5 text-emerald-primary" />
                4. 3D Parametric Studio
              </Link>
            </nav>
          </div>

          {/* User Session & Auth Action */}
          <div className="flex items-center gap-3 font-mono text-xs">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-primary animate-pulse" />
                  <span className="text-slate-800 font-bold">{user?.username}</span>
                  <span className="text-[10px] text-slate-500">(Authenticated)</span>
                </div>

                <button
                  onClick={logout}
                  className="px-2.5 py-1 rounded-md text-xs font-mono font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden sm:flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                  <ShieldAlert className="h-3 w-3" />
                  Gated Access
                </span>

                <Link
                  href="/login"
                  className="btn-emerald-primary py-1.5 px-3 text-xs"
                >
                  <GithubIcon className="h-3.5 w-3.5 fill-current" />
                  Sign In with GitHub
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
