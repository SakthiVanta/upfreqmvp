'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { ParametricViewer } from '@/components/studio/parametric-viewer';
import { Lock, Box, Trash2 } from 'lucide-react';

export default function StudioPage() {
  const { isAuthenticated, loginWithGithub, selectedRobot, setSelectedRobot } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto py-12 font-sans">
        <div className="minimal-card p-8 text-center space-y-6">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-amber-700">
            <Lock className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-sand-50">Gated Studio — Authentication Required</h1>
            <p className="text-xs text-sand-500 font-mono mt-1">
              Sign in with GitHub to access the 3D Parametric Model Customizer & Xacro Code Generator.
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
            <Box className="h-5 w-5 text-emerald-primary" />
            3D Parametric Studio & Xacro Code Generator
          </h1>
          <p className="text-xs text-sand-500 font-mono">
            Manipulate 3D sensor origins in real-time and export custom <code className="bg-sand-800 px-1 py-0.5 rounded text-sand-100">.urdf.xacro</code> code macros.
          </p>
        </div>

        {selectedRobot && (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-xs font-bold text-emerald-text bg-emerald-light border border-emerald-border px-3 py-1 rounded-lg">
              Active Repository: {selectedRobot.name}
            </span>
            <button
              onClick={() => setSelectedRobot(null)}
              className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Unload Repository"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Unload
            </button>
          </div>
        )}
      </div>

      {selectedRobot ? (
        <ParametricViewer />
      ) : (
        <div className="minimal-card p-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-xl bg-sand-800 flex items-center justify-center mx-auto text-sand-500">
            <Box className="h-6 w-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg font-bold text-sand-50">Studio Empty — No 3D Model Loaded</h2>
            <p className="text-xs text-sand-500 font-mono leading-relaxed">
              Submit your robotics GitHub repository URL on the Dashboard, or load one from your Robot Library, to view its 3D WebGL model and edit kinematic offsets.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
