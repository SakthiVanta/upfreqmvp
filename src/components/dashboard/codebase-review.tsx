'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Bot, ListChecks, Info, X, Cpu, FileCode, Ruler } from 'lucide-react';
import { AutonomyFeatureCheck, RobotModelDetail, RobotProfile } from '@/lib/robot-profile';

function MetricValue({ value, unit }: { value: number | null; unit: string }) {
  if (value == null) return <span className="text-amber-600 font-bold text-sm">Not determined</span>;
  return <span className="text-sand-50 font-bold text-sm">{value} {unit}</span>;
}

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

// robotVariants (filename-derived) and robotModels (agent-derived deep
// breakdown) come from different sources and don't share a key — this is a
// best-effort fuzzy match between a variant's short name and the agent's
// own modelVariable/modelName for it.
function matchModelDetail(variant: string, models: RobotModelDetail[]): RobotModelDetail | null {
  const v = variant.toLowerCase();
  return models.find(m => {
    const mv = (m.modelVariable || '').toLowerCase();
    const mn = (m.modelName || '').toLowerCase().replace(/\s+/g, '_');
    return (!!mv && (v.includes(mv) || mv.includes(v))) || (!!mn && (v.includes(mn) || mn.includes(v)));
  }) || null;
}

// Two-part audit summary shown right after a codebase is connected: which
// robot models it defines, and a fixed, restricted checklist of autonomy
// capabilities — not the full Parameter Matrix breakdown. Two clearly
// separate columns with big, unmistakable headers: robots on the left
// (shown as real cards, not small pills) and autonomy features on the right.
export function CodebaseReview({ robot }: { robot: RobotProfile }) {
  const robotVariants = robot.robotVariants || [];
  const robotModels = robot.robotModels || [];
  const codebaseReview = robot.codebaseReview || [];
  const presentCount = codebaseReview.reduce(
    (n, f) => n + (f.present ? 1 : 0) + (f.subChecks?.filter(sc => sc.present).length || 0),
    0
  );
  const totalCount = codebaseReview.reduce((n, f) => n + 1 + (f.subChecks?.length || 0), 0);

  const [viewingVariant, setViewingVariant] = useState<string | null>(null);
  const viewingDetail = viewingVariant ? matchModelDetail(viewingVariant, robotModels) : null;

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
                <span className="font-mono font-bold text-base text-sand-50 truncate flex-1 min-w-0">{v}</span>
                <button
                  onClick={() => setViewingVariant(v)}
                  className="p-2 text-sand-400 hover:text-sand-50 hover:bg-sand-800 rounded-lg border border-sand-700 transition-all cursor-pointer shrink-0"
                  title="View Details"
                >
                  <Info className="h-4 w-4" />
                </button>
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

      {viewingVariant && (
        <RobotDetailModal
          variant={viewingVariant}
          detail={viewingDetail}
          onClose={() => setViewingVariant(null)}
        />
      )}

    </div>
  );
}

function RobotDetailModal({
  variant,
  detail,
  onClose,
}: {
  variant: string;
  detail: RobotModelDetail | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-sand-950/70 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="minimal-card w-[85vw] h-[85vh] max-w-4xl flex flex-col animate-in fade-in slide-in-from-top-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-sand-800 p-5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-emerald-light border border-emerald-border flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-emerald-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-display font-extrabold text-sand-50 truncate">
                {detail?.modelName || variant}
              </h3>
              {detail?.formFactor && (
                <p className="text-xs text-sand-500 truncate">{detail.formFactor}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-sand-500 hover:text-sand-50 p-1.5 rounded-lg hover:bg-sand-800 cursor-pointer shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-sm">
          {detail ? (
            <>
              {detail.rolePurpose && (
                <div>
                  <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2">Role & Purpose</h4>
                  <p className="text-sand-200 leading-relaxed">{detail.rolePurpose}</p>
                </div>
              )}

              {detail.metrics && (
                <div>
                  <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Ruler className="h-3.5 w-3.5" />
                    Metrics
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-sand-950 rounded-lg border border-sand-800">
                      <span className="text-[10px] text-sand-500 uppercase font-bold block mb-1">Dimensions (L×W×H)</span>
                      {detail.metrics.lengthM != null && detail.metrics.widthM != null && detail.metrics.heightM != null ? (
                        <span className="text-sand-50 font-bold text-sm">{detail.metrics.lengthM}×{detail.metrics.widthM}×{detail.metrics.heightM} m</span>
                      ) : (
                        <span className="text-amber-600 font-bold text-sm">Not determined</span>
                      )}
                    </div>
                    <div className="p-3 bg-sand-950 rounded-lg border border-sand-800">
                      <span className="text-[10px] text-sand-500 uppercase font-bold block mb-1">Mass</span>
                      <MetricValue value={detail.metrics.massKg} unit="kg" />
                    </div>
                    <div className="p-3 bg-sand-950 rounded-lg border border-sand-800">
                      <span className="text-[10px] text-sand-500 uppercase font-bold block mb-1">Wheelbase</span>
                      <MetricValue value={detail.metrics.wheelbaseM} unit="m" />
                    </div>
                    <div className="p-3 bg-sand-950 rounded-lg border border-sand-800">
                      <span className="text-[10px] text-sand-500 uppercase font-bold block mb-1">Wheel Radius</span>
                      <MetricValue value={detail.metrics.wheelRadiusM} unit="m" />
                    </div>
                    <div className="p-3 bg-sand-950 rounded-lg border border-sand-800">
                      <span className="text-[10px] text-sand-500 uppercase font-bold block mb-1">Max Linear Speed</span>
                      <MetricValue value={detail.metrics.maxLinearSpeedMs} unit="m/s" />
                    </div>
                    <div className="p-3 bg-sand-950 rounded-lg border border-sand-800">
                      <span className="text-[10px] text-sand-500 uppercase font-bold block mb-1">Max Angular Speed</span>
                      <MetricValue value={detail.metrics.maxAngularSpeedRads} unit="rad/s" />
                    </div>
                  </div>
                </div>
              )}

              {detail.actuatorsSensors.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" />
                    Actuators & Sensors
                  </h4>
                  <ul className="space-y-1.5">
                    {detail.actuatorsSensors.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sand-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-primary shrink-0 mt-1.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.simulationAssets.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileCode className="h-3.5 w-3.5" />
                    Simulation Assets in Codebase
                  </h4>
                  <div className="space-y-2">
                    {detail.simulationAssets.map((a, idx) => (
                      <div key={idx} className="p-2.5 bg-sand-950 rounded-lg border border-sand-800">
                        <span className="text-[11px] text-sand-500 font-bold uppercase block mb-0.5">{a.label}</span>
                        <span className="font-mono text-xs text-sand-200 break-all">{a.path}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!detail.rolePurpose && !detail.metrics && detail.actuatorsSensors.length === 0 && detail.simulationAssets.length === 0 && (
                <p className="text-sand-500">The agent didn't resolve further detail for this variant.</p>
              )}
            </>
          ) : (
            <div className="text-center py-12 space-y-2">
              <p className="text-sand-300 font-bold">Detailed breakdown not available for this robot</p>
              <p className="text-sand-500 max-w-sm mx-auto">
                This audit ran without the Gemini agent, or was run before per-robot detail was added. Re-run the AI audit to fetch it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
