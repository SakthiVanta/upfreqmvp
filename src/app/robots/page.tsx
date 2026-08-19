'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getRobotLibrary, SavedRobotEntry } from '@/lib/robot-library';
import { Lock, Bot, GitFork, Compass, Cpu, Trash2, ArrowRight, Box, Layers, RefreshCw, WifiOff } from 'lucide-react';

export default function RobotsPage() {
  const router = useRouter();
  const { isAuthenticated, loginWithGithub, setSelectedRobot, setIngestedRepoUrl, selectedRobot } = useAuth();
  const [library, setLibrary] = useState<SavedRobotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'db' | 'local-fallback'>('db');

  const loadFromDb = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/robots');
      if (!res.ok) throw new Error('fetch failed');
      const { robots } = await res.json();
      const entries: SavedRobotEntry[] = robots.map((r: any) => ({
        id: r.id,
        name: r.robotName,
        repoUrl: r.repoUrl,
        sensorCount: r.sensorCount,
        moduleCount: r.moduleCount,
        savedAt: r.analyzedAt,
        profile: r.profile,
      }));
      setLibrary(entries);
      setSource('db');
    } catch (e) {
      // Database unreachable (or DATABASE_URL not configured) — fall back
      // to this browser's local cache rather than showing an empty state.
      setLibrary(getRobotLibrary());
      setSource('local-fallback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadFromDb();
  }, [isAuthenticated]);

  const handleLoad = (entry: SavedRobotEntry, destination: '/matrix' | '/studio' | '/projects') => {
    setSelectedRobot(entry.profile);
    setIngestedRepoUrl(entry.repoUrl);
    router.push(destination);
  };

  const handleRemove = async (id: string) => {
    setLibrary(prev => prev.filter(r => r.id !== id));
    if (source === 'db') {
      await fetch(`/api/robots/${id}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto py-12 font-sans">
        <div className="minimal-card p-8 text-center space-y-6">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-amber-600">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-sand-50">Gated Library — Authentication Required</h1>
            <p className="text-xs text-sand-500 mt-1">
              Sign in with GitHub to view your saved robot library.
            </p>
          </div>
          <button
            onClick={() => loginWithGithub()}
            className="btn-robotics-primary py-2.5 px-6 text-xs mx-auto flex items-center gap-2 cursor-pointer"
          >
            Sign In with GitHub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap items-center justify-between border-b border-sand-800 pb-3 gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-sand-50 tracking-tight flex items-center gap-2">
            <Bot className="h-5 w-5 text-emerald-primary" />
            Robot Library
          </h1>
          <p className="text-xs text-sand-500">
            Every robot you've audited is persisted to Postgres — reload any of them into the Matrix or 3D Studio without re-running the analysis, from any browser.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {source === 'local-fallback' && (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg flex items-center gap-1.5" title="Database unreachable — showing this browser's local cache instead">
              <WifiOff className="h-3.5 w-3.5" />
              OFFLINE CACHE
            </span>
          )}
          <span className="text-xs font-bold text-emerald-text bg-emerald-light border border-emerald-border px-3 py-1 rounded-lg">
            {library.length} SAVED ROBOT{library.length === 1 ? '' : 'S'}
          </span>
          <button
            onClick={loadFromDb}
            disabled={loading}
            className="p-2 rounded-lg bg-sand-800 hover:bg-sand-700 text-sand-300 cursor-pointer disabled:opacity-50"
            title="Refresh from database"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="minimal-card p-12 text-center space-y-3">
          <RefreshCw className="h-6 w-6 mx-auto text-emerald-primary animate-spin" />
          <p className="text-xs text-sand-500">Loading robot library from Postgres...</p>
        </div>
      ) : library.length === 0 ? (
        <div className="minimal-card p-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-xl bg-sand-800 flex items-center justify-center mx-auto text-sand-500">
            <Bot className="h-6 w-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg font-bold text-sand-50">No Robots Saved Yet</h2>
            <p className="text-xs text-sand-500 leading-relaxed">
              Audit a GitHub repository from the Dashboard — every completed audit is automatically persisted here so you can reuse it later.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {library.map((entry) => {
            const isActive = selectedRobot?.repoUrl === entry.repoUrl;
            return (
              <div key={entry.id} className={`minimal-card p-5 space-y-4 ${isActive ? 'border-emerald-border' : ''}`}>
                <div className="flex items-start justify-between gap-3 border-b border-sand-800 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sand-50 text-sm truncate">{entry.name}</h3>
                      {isActive && (
                        <span className="text-[10px] bg-emerald-light text-emerald-text px-1.5 py-0.5 rounded font-bold border border-emerald-border shrink-0">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <a href={entry.repoUrl} target="_blank" rel="noreferrer" className="text-[11px] text-sand-500 font-mono hover:text-emerald-primary flex items-center gap-1 truncate">
                      <GitFork className="h-3 w-3 shrink-0" />
                      <span className="truncate">{entry.repoUrl}</span>
                    </a>
                  </div>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="p-1.5 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer"
                    title="Remove from Library"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-sand-400">
                  <span className="flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-emerald-primary" />
                    {entry.sensorCount} sensors
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-emerald-primary" />
                    {entry.moduleCount} modules
                  </span>
                  <span className="text-sand-600">
                    Saved {new Date(entry.savedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs pt-1">
                  <button
                    onClick={() => handleLoad(entry, '/matrix')}
                    className="flex-1 py-2 rounded-lg bg-sand-800 hover:bg-sand-700 text-sand-100 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Layers className="h-3.5 w-3.5 text-emerald-primary" />
                    Matrix
                  </button>
                  <button
                    onClick={() => handleLoad(entry, '/studio')}
                    className="flex-1 py-2 rounded-lg bg-sand-800 hover:bg-sand-700 text-sand-100 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Box className="h-3.5 w-3.5 text-emerald-primary" />
                    Studio
                  </button>
                  <button
                    onClick={() => handleLoad(entry, '/projects')}
                    className="px-3 py-2 rounded-lg btn-emerald-primary cursor-pointer"
                    title="Open in Projects"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
