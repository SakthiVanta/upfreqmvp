'use client';

import React from 'react';
import { CheckSquare, Square, GitFork, ListChecks } from 'lucide-react';
import { AutonomyFeatureCheck, RobotProfile } from '@/lib/robot-profile';

function FeatureRow({ feature, indent }: { feature: AutonomyFeatureCheck; indent?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 py-1.5 ${indent ? 'pl-7' : ''}`} title={feature.evidence}>
      {feature.present ? (
        <CheckSquare className="h-4 w-4 text-emerald-primary shrink-0 mt-0.5" />
      ) : (
        <Square className="h-4 w-4 text-sand-600 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <span className={`text-xs font-bold ${feature.present ? 'text-sand-50' : 'text-sand-500'}`}>
          {feature.label}
        </span>
        <p className="text-[11px] text-sand-500 font-mono mt-0.5 leading-snug">{feature.evidence}</p>
      </div>
    </div>
  );
}

// Two-part audit summary shown right after a codebase is connected: which
// robot models it defines, and a fixed, restricted checklist of autonomy
// capabilities — not the full Parameter Matrix breakdown.
export function CodebaseReview({ robot }: { robot: RobotProfile }) {
  const robotVariants = robot.robotVariants || [];
  const codebaseReview = robot.codebaseReview || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">

      <div className="minimal-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-sand-100 uppercase tracking-wider">
          <GitFork className="h-4 w-4 text-emerald-primary" />
          Robots Found in This Codebase ({robotVariants.length})
        </div>
        {robotVariants.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {robotVariants.map((v, idx) => (
              <span key={idx} className="px-3 py-1.5 rounded-lg bg-emerald-light text-emerald-text border border-emerald-border text-xs font-bold">
                {v}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-sand-500">No distinct robot URDF models were detected in this repository.</p>
        )}
      </div>

      <div className="minimal-card p-5 space-y-0.5">
        <div className="flex items-center gap-2 text-xs font-bold text-sand-100 uppercase tracking-wider mb-2">
          <ListChecks className="h-4 w-4 text-emerald-primary" />
          Autonomy Feature Checklist
        </div>
        {codebaseReview.length > 0 ? (
          codebaseReview.map((f) => (
            <React.Fragment key={f.key}>
              <FeatureRow feature={f} />
              {f.subChecks?.map(sc => (
                <FeatureRow key={sc.key} feature={sc} indent />
              ))}
            </React.Fragment>
          ))
        ) : (
          <p className="text-xs text-sand-500">Not evaluated for this repository.</p>
        )}
      </div>

    </div>
  );
}
