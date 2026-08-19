'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { ParameterMatrix } from '@/components/dashboard/parameter-matrix';
import { Lock, Layers, Trash2, GitFork } from 'lucide-react';

export default function MatrixPage() {
  const { isAuthenticated, loginWithGithub, selectedRobot, setSelectedRobot } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto py-12 font-sans">
        <div className="minimal-card p-8 bg-white border-zinc-200 shadow-xs text-center space-y-6">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-amber-600">
            <Lock className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-zinc-900">Gated Matrix — Authentication Required</h1>
            <p className="text-xs text-zinc-500 font-mono mt-1">
              Sign in with GitHub to view synthesized robot parameters and dependency trees.
            </p>
          </div>

          <button
            onClick={() => loginWithGithub()}
            className="btn-robotics-primary py-2.5 px-6 text-xs mx-auto flex items-center gap-2"
          >
            Sign In with GitHub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 pb-3 gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            Synthesized Robot Parameter Matrix
          </h1>
          <p className="text-xs text-zinc-500 font-mono">
            Full 7-layer audit of physical sensors, hardware datasheets, Nav2 stack, Gazebo system plugins, and ROS package dependencies.
          </p>
        </div>

        {selectedRobot && (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
              Active Repository: {selectedRobot.name}
            </span>
            <button
              onClick={() => setSelectedRobot(null)}
              className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold flex items-center gap-1 transition-all"
              title="Unload Repository"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Unload
            </button>
          </div>
        )}
      </div>

      {selectedRobot ? (
        <ParameterMatrix 
          selectedRobot={selectedRobot}
          onSelectRobot={setSelectedRobot}
        />
      ) : (
        <div className="minimal-card p-12 bg-white border-zinc-200 text-center space-y-4 font-sans">
          <div className="h-12 w-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto text-zinc-500">
            <GitFork className="h-6 w-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg font-bold text-zinc-900">Matrix Empty — No Repository Loaded</h2>
            <p className="text-xs text-zinc-500 font-mono leading-relaxed">
              Submit your robotics GitHub repository URL on the Dashboard to inspect its synthesized 7-layer parameter matrix and package dependencies.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
