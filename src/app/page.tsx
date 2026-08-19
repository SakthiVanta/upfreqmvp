'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { GithubIcon } from '@/components/ui/github-icon';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loginWithGithub } = useAuth();

  // Projects (each representing one robot's autonomy codebase) is the one
  // real workspace — an authenticated visit to the marketing root just
  // forwards there instead of duplicating the ingest/audit UI here too.
  useEffect(() => {
    if (isAuthenticated) router.replace('/projects');
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-24 text-sand-500 text-xs gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Opening Robot Projects...
      </div>
    );
  }

  // Minimal marketing root for unauthenticated visitors: brand, pitch, sign in.
  return (
    <div className="font-sans text-sand-100 -mt-6 min-h-screen flex flex-col">

      <header className="sticky top-0 z-40 bg-sand-950/90 backdrop-blur-md border-b border-sand-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-primary text-sand-950 flex items-center justify-center font-bold text-sm">
            UF
          </div>
          <span className="font-display font-bold text-base text-sand-50 tracking-tight">UpFreq</span>
        </div>

        <Link href="/login" className="btn-robotics-primary py-2 px-5 text-xs font-bold">
          Sign In to App
        </Link>
      </header>

      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-8 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-87.5 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />

          <h1 className="text-4xl sm:text-6xl font-display font-extrabold tracking-tight text-sand-50 leading-[1.15] animate-in fade-in slide-in-from-bottom-4">
            Agentic ROS 2 Codebase Inspection & <br />
            <span className="text-emerald-primary">
              Parameter Intelligence Platform
            </span>
          </h1>

          <p className="text-base sm:text-lg text-sand-400 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-4 delay-75">
            Connect your robotics GitHub repository and let an AI agent audit its real codebase — sensors, autonomy modules, and everything in between.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs animate-in fade-in slide-in-from-bottom-4 delay-150">
            <button
              onClick={() => loginWithGithub()}
              className="btn-robotics-primary py-3.5 px-8 text-sm font-bold flex items-center gap-2.5 cursor-pointer"
            >
              <GithubIcon className="h-4.5 w-4.5 fill-current" />
              Connect GitHub OAuth
            </button>

            <Link
              href="/login"
              className="btn-secondary-light py-3.5 px-8 text-sm font-semibold"
            >
              Sign In with Password
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
