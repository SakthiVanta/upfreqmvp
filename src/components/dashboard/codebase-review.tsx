'use client';

import React from 'react';
import { CheckSquare, Square, GitFork, ListChecks } from 'lucide-react';
import { AutonomyFeatureCheck, RobotProfile } from '@/lib/robot-profile';

// Evidence text is kept as a hover tooltip only — the checklist should be a
// scannable list of checkboxes, not a wall of quoted file paths.
function FeatureRow({ feature, indent }: { feature: AutonomyFeatureCheck; indent?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 py-2 ${indent ? 'pl-8' : ''}`} title={feature.evidence}>
      {feature.present ? (
        <CheckSquare className="h-4 w-4 text-emerald-primary shrink-0" />
      ) : (
        <Square className="h-4 w-4 text-sand-600 shrink-0" />
      )}
      <span className={`text-sm font-semibold ${feature.present ? 'text-sand-50' : 'text-sand-500'}`}>
        {feature.label}
      </span>
    </div>
  );
}

// Two-part audit summary shown right after a codebase is connected: which
// robot models it defines, and a fixed, restricted checklist of autonomy
// capabilities — not the full Parameter Matrix breakdown. Stacked into one
// clear flow (not two look-alike side-by-side cards) so it's obvious at a
// glance which part is "robots" and which is "features".
export function CodebaseReview({ robot }: { robot: RobotProfile }) {
  const robotVariants = robot.robotVariants || [];
  const codebaseReview = robot.codebaseReview || [];
  const presentCount = codebaseReview.reduce(
    (n, f) => n + (f.present ? 1 : 0) + (f.subChecks?.filter(sc => sc.present).length || 0),
    0
  );
  const totalCount = codebaseReview.reduce((n, f) => n + 1 + (f.subChecks?.length || 0), 0);

  return (
    <div className="space-y-6">

      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-sand-500 uppercase tracking-wider mb-3">
          <GitFork className="h-4 w-4 text-emerald-primary" />
          Robots Found ({robotVariants.length})
        </div>
        {robotVariants.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {robotVariants.map((v, idx) => (
              <span key={idx} className="px-3 py-1.5 rounded-lg bg-emerald-light text-emerald-text border border-emerald-border text-xs font-bold font-mono">
                {v}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-sand-500">No distinct robot URDF models were detected in this repository.</p>
        )}
      </div>

      <div className="border-t border-sand-800" />

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-xs font-bold text-sand-500 uppercase tracking-wider">
            <ListChecks className="h-4 w-4 text-emerald-primary" />
            Autonomy Features
          </div>
          {codebaseReview.length > 0 && (
            <span className="text-xs font-bold text-sand-500">{presentCount} / {totalCount} present</span>
          )}
        </div>
        {codebaseReview.length > 0 ? (
          <div className="divide-y divide-sand-800/60">
            {codebaseReview.map((f) => (
              <React.Fragment key={f.key}>
                <FeatureRow feature={f} />
                {f.subChecks?.map(sc => (
                  <FeatureRow key={sc.key} feature={sc} indent />
                ))}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <p className="text-xs text-sand-500">Not evaluated for this repository.</p>
        )}
      </div>

    </div>
  );
}
