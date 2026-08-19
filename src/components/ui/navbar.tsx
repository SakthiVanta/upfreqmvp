'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { GithubIcon } from '@/components/ui/github-icon';
import { Cpu, Layers, Box, LogOut, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/', label: '1. Repo Scanner', icon: null },
  { href: '/dashboard', label: '2. Live Agent Stream', icon: Cpu },
  { href: '/matrix', label: '3. Parameter Matrix', icon: Layers },
  { href: '/studio', label: '4. 3D Parametric Studio', icon: Box },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-sand-950/90 backdrop-blur-md border-b border-sand-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand Logo & Title */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-primary text-sand-950 flex items-center justify-center font-mono font-bold text-sm shadow-xs">
                UF
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-sm text-sand-50 tracking-tight flex items-center gap-1.5">
                  UpFreq Robotics
                  <span className="text-[10px] bg-emerald-light text-emerald-text px-1.5 py-0.5 rounded font-mono font-semibold border border-emerald-border">
                    v2.4
                  </span>
                </span>
                <span className="text-[11px] text-sand-500 font-mono">
                  Agentic Code Ingestion Engine
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-1 font-mono text-xs font-semibold">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                    pathname === href ? 'bg-emerald-primary text-sand-950' : 'text-sand-400 hover:text-sand-50 hover:bg-sand-800'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5 text-emerald-primary" />}
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* User Session & Mobile Menu Toggle */}
          <div className="flex items-center gap-3 font-mono text-xs">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 bg-sand-900 px-2.5 py-1 rounded-md border border-sand-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-primary animate-pulse" />
                  <span className="text-sand-100 font-bold">{user?.username}</span>
                </div>

                <button
                  onClick={logout}
                  className="px-2.5 py-1 rounded-md text-xs font-mono font-medium text-sand-400 hover:text-sand-50 hover:bg-sand-800 border border-sand-700 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="btn-emerald-primary py-1.5 px-3 text-xs"
                >
                  <GithubIcon className="h-3.5 w-3.5 fill-current" />
                  Sign In with GitHub
                </Link>
              </div>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-sand-400 hover:text-sand-50 rounded-lg border border-sand-700 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-sand-800 space-y-1 font-mono text-xs animate-in fade-in slide-in-from-top-2">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md hover:bg-sand-800 font-bold text-sand-100"
              >
                {label}
              </Link>
            ))}
          </div>
        )}

      </div>
    </header>
  );
}
