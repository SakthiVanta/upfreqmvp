'use client';

import React from 'react';
import { CheckSquare, Square, Bot, ListChecks } from 'lucide-react';
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
// capabilities — not the full Parameter Matrix breakdown. Two clearly
// separate columns with big, unmistakable headers: robots on the left
// (shown as real cards, not small pills) and autonomy features on the right.
export function CodebaseReview({ robot }: { robot: RobotProfile }) {
  const robotVariants = robot.robotVariants || [];
  const codebaseReview = robot.codebaseReview || [];
  const presentCount = codebaseReview.reduce(
    (n, f) => n + (f.present ? 1 : 0) + (f.subChecks?.filter(sc => sc.present).length || 0),
    0
  );
  const totalCount = codebaseReview.reduce((n, f) => n + 1 + (f.subChecks?.length || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

      <div>
        <h3 className="text-xl font-display font-extrabold text-sand-50 tracking-tight mb-4">
          Robots ({robotVariants.length})
        </h3>
        {robotVariants.length > 0 ? (
          <div className="space-y-3">
            {robotVariants.map((v, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 rounded-xl border border-sand-800 bg-sand-950">
                <div className="h-10 w-10 rounded-lg bg-emerald-light border border-emerald-border flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-emerald-primary" />
                </div>
                <span className="font-mono font-bold text-base text-sand-50 truncate">{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-sand-500">No distinct robot URDF models were detected in this repository.</p>
        )}
      </div>

      <div className="pt-8 lg:pt-0 lg:pl-8 lg:border-l border-t lg:border-t-0 border-sand-800">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-xl font-display font-extrabold text-sand-50 tracking-tight">
            Autonomy Features
          </h3>
          {codebaseReview.length > 0 && (
            <span className="text-xs font-bold text-sand-500 flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              {presentCount} / {totalCount} present
            </span>
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
