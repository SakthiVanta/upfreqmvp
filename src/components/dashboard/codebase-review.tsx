'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Bot, ListChecks, Info, X, Cpu, FileCode, Ruler, Pencil, Plus, Compass, Waypoints } from 'lucide-react';
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
export function CodebaseReview({ robot, onUpdate }: { robot: RobotProfile; onUpdate?: (updated: RobotProfile) => void }) {
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
  const [editOpen, setEditOpen] = useState(false);

  const handleSaveRobotDetail = (updated: RobotModelDetail) => {
    if (!onUpdate) return;
    const idx = viewingDetail ? robotModels.indexOf(viewingDetail) : -1;
    const nextModels = idx >= 0
      ? robotModels.map((m, i) => (i === idx ? updated : m))
      : [...robotModels, updated];
    onUpdate({ ...robot, robotModels: nextModels });
  };

  // Sensors and simulationPlugins are top-level RobotProfile fields, not
  // per-variant robotModels data, so they need their own save path straight
  // onto the full profile rather than going through handleSaveRobotDetail.
  const handleSaveSensorsAndPlugins = (
    sensors: RobotProfile['sensors'],
    simulationPlugins: RobotProfile['simulationPlugins']
  ) => {
    if (!onUpdate) return;
    onUpdate({ ...robot, sensors, simulationPlugins });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-sand-100 uppercase tracking-wider">
          Codebase Review
        </span>
        {onUpdate && (
          <button
            onClick={() => setEditOpen(true)}
            className="p-1.5 text-sand-400 hover:text-sand-50 hover:bg-sand-800 rounded-lg border border-sand-700 transition-all cursor-pointer"
            title="Edit Robots & Autonomy Features"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

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

      </div>

      {viewingVariant && (
        <RobotDetailModal
          variant={viewingVariant}
          detail={viewingDetail}
          sensors={robot.sensors}
          simulationPlugins={robot.simulationPlugins}
          onClose={() => setViewingVariant(null)}
          onSave={onUpdate ? handleSaveRobotDetail : undefined}
          onSaveSensorsAndPlugins={onUpdate ? handleSaveSensorsAndPlugins : undefined}
        />
      )}

      {editOpen && onUpdate && (
        <EditReviewModal
          robotVariants={robotVariants}
          codebaseReview={codebaseReview}
          onCancel={() => setEditOpen(false)}
          onConfirm={(nextVariants, nextFeatures) => {
            onUpdate({ ...robot, robotVariants: nextVariants, codebaseReview: nextFeatures });
            setEditOpen(false);
          }}
        />
      )}

    </div>
  );
}

type DraftRobot = { id: string; original: string | null; value: string };

function flattenFeatures(features: AutonomyFeatureCheck[]): { key: string; label: string; present: boolean }[] {
  const out: { key: string; label: string; present: boolean }[] = [];
  for (const f of features) {
    out.push({ key: f.key, label: f.label, present: f.present });
    f.subChecks?.forEach(sc => out.push({ key: sc.key, label: sc.label, present: sc.present }));
  }
  return out;
}

// Edit → review → confirm. Nothing is written back via onUpdate until the
// user has seen an explicit diff of what changed and confirms it — editing
// AI-derived audit data is a deliberate override, not a casual toggle, so
// it gets a checkpoint before it's saved.
function EditReviewModal({
  robotVariants,
  codebaseReview,
  onCancel,
  onConfirm,
}: {
  robotVariants: string[];
  codebaseReview: AutonomyFeatureCheck[];
  onCancel: () => void;
  onConfirm: (nextVariants: string[], nextFeatures: AutonomyFeatureCheck[]) => void;
}) {
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [draftRobots, setDraftRobots] = useState<DraftRobot[]>(
    () => robotVariants.map((v, i) => ({ id: `orig-${i}`, original: v, value: v }))
  );
  const [draftFeatures, setDraftFeatures] = useState<AutonomyFeatureCheck[]>(
    () => JSON.parse(JSON.stringify(codebaseReview))
  );
  const [newRobotName, setNewRobotName] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleAddRobot = () => {
    const name = newRobotName.trim();
    if (!name) return;
    setDraftRobots(prev => [...prev, { id: `new-${Date.now()}`, original: null, value: name }]);
    setNewRobotName('');
  };

  const toggleFeature = (key: string) => {
    setDraftFeatures(prev => prev.map((f) => {
      if (f.key === key) {
        const nextPresent = !f.present;
        return { ...f, present: nextPresent, evidence: nextPresent ? 'Manually marked present by user.' : 'Manually marked absent by user.' };
      }
      if (f.subChecks) {
        return {
          ...f,
          subChecks: f.subChecks.map((sc) => {
            if (sc.key !== key) return sc;
            const nextPresent = !sc.present;
            return { ...sc, present: nextPresent, evidence: nextPresent ? 'Manually marked present by user.' : 'Manually marked absent by user.' };
          }),
        };
      }
      return f;
    }));
  };

  // Diff, computed fresh each render from draft vs. the original props —
  // this is what the review step shows and what "no changes" is judged by.
  const presentIds = new Set(draftRobots.map(r => r.id));
  const removedRobots = robotVariants.filter((_, i) => !presentIds.has(`orig-${i}`));
  const addedRobots = draftRobots.filter(r => r.original === null && r.value.trim() !== '').map(r => r.value.trim());
  const renamedRobots = draftRobots
    .filter(r => r.original !== null && r.value.trim() !== '' && r.value.trim() !== r.original)
    .map(r => ({ from: r.original as string, to: r.value.trim() }));

  const originalFlat = flattenFeatures(codebaseReview);
  const draftFlat = flattenFeatures(draftFeatures);
  const toggledFeatures = draftFlat.filter((d) => {
    const orig = originalFlat.find(o => o.key === d.key);
    return orig && orig.present !== d.present;
  });

  const hasChanges = removedRobots.length > 0 || addedRobots.length > 0 || renamedRobots.length > 0 || toggledFeatures.length > 0;

  const handleConfirm = () => {
    const finalVariants = draftRobots.map(r => r.value.trim()).filter(Boolean);
    onConfirm(finalVariants, draftFeatures);
  };

  return (
    <div className="fixed inset-0 z-50 bg-sand-950/70 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in" onClick={onCancel}>
      <div
        className="minimal-card w-full max-w-lg max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-top-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-sand-800 p-4 sm:p-5 shrink-0">
          <h3 className="text-sm font-bold text-sand-50">
            {step === 'edit' ? 'Edit Robots & Autonomy Features' : 'Review Changes'}
          </h3>
          <button onClick={onCancel} className="text-sand-500 hover:text-sand-50 p-1 rounded-lg hover:bg-sand-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-6 text-xs">
          {step === 'edit' ? (
            <>
              <div>
                <label className="block text-sand-300 font-bold mb-2">Robots</label>
                <div className="space-y-2">
                  {draftRobots.map((r) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={r.value}
                        onChange={(e) => setDraftRobots(prev => prev.map(x => x.id === r.id ? { ...x, value: e.target.value } : x))}
                        className="flex-1 px-3 py-2 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary min-w-0"
                      />
                      <button
                        onClick={() => setDraftRobots(prev => prev.filter(x => x.id !== r.id))}
                        className="p-1.5 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer"
                        title="Remove Robot"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newRobotName}
                    onChange={(e) => setNewRobotName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddRobot(); }}
                    placeholder="New robot name"
                    className="flex-1 px-3 py-2 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary min-w-0"
                  />
                  <button
                    onClick={handleAddRobot}
                    disabled={!newRobotName.trim()}
                    className="p-1.5 text-sand-400 hover:text-sand-50 hover:bg-sand-800 rounded-lg border border-sand-700 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title={newRobotName.trim() ? 'Add Robot' : 'Enter a robot name first'}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sand-300 font-bold mb-2">Autonomy Features</label>
                <div className="divide-y divide-sand-800/60">
                  {draftFeatures.map((f) => (
                    <React.Fragment key={f.key}>
                      <label className="flex items-center gap-2.5 py-2 cursor-pointer">
                        <input type="checkbox" checked={f.present} onChange={() => toggleFeature(f.key)} className="accent-emerald-primary h-3.5 w-3.5 cursor-pointer" />
                        <span className={`font-semibold ${f.present ? 'text-sand-50' : 'text-sand-500'}`}>{f.label}</span>
                      </label>
                      {f.subChecks?.map((sc) => (
                        <label key={sc.key} className="flex items-center gap-2.5 py-2 pl-6 cursor-pointer">
                          <input type="checkbox" checked={sc.present} onChange={() => toggleFeature(sc.key)} className="accent-emerald-primary h-3.5 w-3.5 cursor-pointer" />
                          <span className={`font-semibold ${sc.present ? 'text-sand-50' : 'text-sand-500'}`}>{sc.label}</span>
                        </label>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {hasChanges ? (
                <ul className="space-y-1.5">
                  {addedRobots.map((name) => (
                    <li key={`add-${name}`} className="text-sand-200">+ Added robot <span className="font-bold text-sand-50">{name}</span></li>
                  ))}
                  {removedRobots.map((name) => (
                    <li key={`rm-${name}`} className="text-sand-200">− Removed robot <span className="font-bold text-sand-50">{name}</span></li>
                  ))}
                  {renamedRobots.map((r) => (
                    <li key={`rn-${r.from}`} className="text-sand-200">Renamed <span className="font-bold text-sand-50">{r.from}</span> → <span className="font-bold text-sand-50">{r.to}</span></li>
                  ))}
                  {toggledFeatures.map((f) => (
                    <li key={`ft-${f.key}`} className="text-sand-200">
                      {f.label}: <span className={`font-bold ${f.present ? 'text-emerald-primary' : 'text-sand-500'}`}>{f.present ? 'marked present' : 'marked absent'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sand-500 italic">No changes made.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-sand-800 p-4 sm:p-5 shrink-0">
          {step === 'edit' ? (
            <>
              <button onClick={onCancel} className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-300 rounded-lg font-semibold cursor-pointer">
                Cancel
              </button>
              <button onClick={() => setStep('review')} className="btn-emerald-primary py-2 px-4 text-xs font-bold cursor-pointer">
                Review Changes
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep('edit')} className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-300 rounded-lg font-semibold cursor-pointer">
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={!hasChanges}
                className="btn-emerald-primary py-2 px-4 text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm & Save
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type MetricsDraft = Record<keyof RobotModelDetail['metrics'], string>;

const METRIC_FIELDS: Array<{ key: keyof RobotModelDetail['metrics']; label: string; unit: string }> = [
  { key: 'lengthM', label: 'Length', unit: 'm' },
  { key: 'widthM', label: 'Width', unit: 'm' },
  { key: 'heightM', label: 'Height', unit: 'm' },
  { key: 'wheelbaseM', label: 'Wheelbase', unit: 'm' },
  { key: 'wheelRadiusM', label: 'Wheel Radius', unit: 'm' },
  { key: 'massKg', label: 'Mass', unit: 'kg' },
  { key: 'maxLinearSpeedMs', label: 'Max Linear Speed', unit: 'm/s' },
  { key: 'maxAngularSpeedRads', label: 'Max Angular Speed', unit: 'rad/s' },
];

function metricsToDraft(m: RobotModelDetail['metrics'] | undefined): MetricsDraft {
  const src = m || ({} as RobotModelDetail['metrics']);
  const draft = {} as MetricsDraft;
  for (const { key } of METRIC_FIELDS) {
    const v = src[key];
    draft[key] = v == null ? '' : String(v);
  }
  return draft;
}

// Which metric fields to show, editable, at all — not every robot is a
// wheeled differential-drive base with a wheelbase and a wheel radius (a
// leg/arm/aerial robot, or one a user adds by hand, has neither), so only
// the metrics the codebase actually resolved a value for are shown by
// default. The rest are one click away via "+ Add metric", not presumed.
function visibleMetricsFrom(m: RobotModelDetail['metrics'] | undefined): Set<string> {
  const src = m || ({} as RobotModelDetail['metrics']);
  return new Set(METRIC_FIELDS.filter(({ key }) => src[key] != null).map(f => f.key));
}

interface SensorDraft {
  id: string;
  name: string; type: string; linkName: string; parentLink: string; frameId: string;
  x: string; y: string; z: string; r: string; p: string; yaw: string;
  detailedParams: RobotProfile['sensors'][number]['detailedParams'];
}
interface PluginDraft {
  name: string; targetLink: string; sensorType: string; pluginSystem: string; rosTopic: string; rosMessageType: string;
  parameters: RobotProfile['simulationPlugins'][number]['parameters'];
}

function sensorToDraft(s: RobotProfile['sensors'][number]): SensorDraft {
  return {
    id: s.id,
    name: s.name, type: s.type, linkName: s.linkName, parentLink: s.parentLink, frameId: s.frameId,
    x: s.position?.x?.toString() ?? '', y: s.position?.y?.toString() ?? '', z: s.position?.z?.toString() ?? '',
    r: s.orientation?.r?.toString() ?? '', p: s.orientation?.p?.toString() ?? '', yaw: s.orientation?.y?.toString() ?? '',
    detailedParams: s.detailedParams,
  };
}
function draftToSensor(d: SensorDraft): RobotProfile['sensors'][number] {
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const x = num(d.x), y = num(d.y), z = num(d.z), r = num(d.r), p = num(d.p), yaw = num(d.yaw);
  return {
    id: d.id,
    name: d.name.trim(), type: d.type.trim(), linkName: d.linkName.trim(), parentLink: d.parentLink.trim(), frameId: d.frameId.trim(),
    position: x != null && y != null && z != null ? { x, y, z } : null,
    orientation: r != null && p != null && yaw != null ? { r, p, y: yaw } : null,
    detailedParams: d.detailedParams,
  };
}
function pluginToDraft(p: RobotProfile['simulationPlugins'][number]): PluginDraft {
  return { name: p.name, targetLink: p.targetLink, sensorType: p.sensorType, pluginSystem: p.pluginSystem, rosTopic: p.rosTopic, rosMessageType: p.rosMessageType, parameters: p.parameters };
}
function draftToPlugin(d: PluginDraft): RobotProfile['simulationPlugins'][number] {
  return { name: d.name.trim(), targetLink: d.targetLink.trim(), sensorType: d.sensorType.trim(), pluginSystem: d.pluginSystem.trim(), rosTopic: d.rosTopic.trim(), rosMessageType: d.rosMessageType.trim(), parameters: d.parameters };
}
function emptySensorDraft(): SensorDraft {
  return { id: `sensor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: '', type: '', linkName: '', parentLink: '', frameId: '', x: '', y: '', z: '', r: '', p: '', yaw: '', detailedParams: [] };
}
const EMPTY_PLUGIN_DRAFT: PluginDraft = { name: '', targetLink: '', sensorType: '', pluginSystem: '', rosTopic: '', rosMessageType: '', parameters: [] };

function RobotDetailModal({
  variant,
  detail,
  sensors,
  simulationPlugins,
  onClose,
  onSave,
  onSaveSensorsAndPlugins,
}: {
  variant: string;
  detail: RobotModelDetail | null;
  sensors: RobotProfile['sensors'];
  simulationPlugins: RobotProfile['simulationPlugins'];
  onClose: () => void;
  onSave?: (updated: RobotModelDetail) => void;
  onSaveSensorsAndPlugins?: (sensors: RobotProfile['sensors'], simulationPlugins: RobotProfile['simulationPlugins']) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draftFormFactor, setDraftFormFactor] = useState(detail?.formFactor || '');
  const [draftRolePurpose, setDraftRolePurpose] = useState(detail?.rolePurpose || '');
  const [draftMetrics, setDraftMetrics] = useState<MetricsDraft>(() => metricsToDraft(detail?.metrics));
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(() => visibleMetricsFrom(detail?.metrics));
  const [draftActuators, setDraftActuators] = useState<string[]>(detail?.actuatorsSensors ? [...detail.actuatorsSensors] : []);
  const [draftAssets, setDraftAssets] = useState<{ label: string; path: string }[]>(
    detail?.simulationAssets ? detail.simulationAssets.map(a => ({ ...a })) : []
  );
  const [draftCustomMetrics, setDraftCustomMetrics] = useState<{ label: string; value: string }[]>(
    detail?.customMetrics ? detail.customMetrics.map(m => ({ ...m })) : []
  );
  const [draftSensors, setDraftSensors] = useState<SensorDraft[]>(() => sensors.map(sensorToDraft));
  const [draftPlugins, setDraftPlugins] = useState<PluginDraft[]>(() => simulationPlugins.map(pluginToDraft));
  const [newActuator, setNewActuator] = useState('');
  const [newAssetLabel, setNewAssetLabel] = useState('');
  const [newAssetPath, setNewAssetPath] = useState('');
  const [newMetricLabel, setNewMetricLabel] = useState('');
  const [newMetricValue, setNewMetricValue] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const enterEditMode = () => {
    setDraftFormFactor(detail?.formFactor || '');
    setDraftRolePurpose(detail?.rolePurpose || '');
    setDraftMetrics(metricsToDraft(detail?.metrics));
    setVisibleMetrics(visibleMetricsFrom(detail?.metrics));
    setDraftActuators(detail?.actuatorsSensors ? [...detail.actuatorsSensors] : []);
    setDraftAssets(detail?.simulationAssets ? detail.simulationAssets.map(a => ({ ...a })) : []);
    setDraftCustomMetrics(detail?.customMetrics ? detail.customMetrics.map(m => ({ ...m })) : []);
    setDraftSensors(sensors.map(sensorToDraft));
    setDraftPlugins(simulationPlugins.map(pluginToDraft));
    setEditMode(true);
  };

  const handleAddCustomMetric = () => {
    const label = newMetricLabel.trim();
    const value = newMetricValue.trim();
    if (!label || !value) return;
    setDraftCustomMetrics(prev => [...prev, { label, value }]);
    setNewMetricLabel('');
    setNewMetricValue('');
  };

  const handleAddActuator = () => {
    const v = newActuator.trim();
    if (!v) return;
    setDraftActuators(prev => [...prev, v]);
    setNewActuator('');
  };

  const handleAddAsset = () => {
    const label = newAssetLabel.trim();
    const path = newAssetPath.trim();
    if (!label || !path) return;
    setDraftAssets(prev => [...prev, { label, path }]);
    setNewAssetLabel('');
    setNewAssetPath('');
  };

  const handleSave = () => {
    if (onSave) {
      const metrics = {} as RobotModelDetail['metrics'];
      for (const { key } of METRIC_FIELDS) {
        if (!visibleMetrics.has(key)) { metrics[key] = null; continue; }
        const raw = draftMetrics[key].trim();
        metrics[key] = raw === '' ? null : Number(raw);
      }
      onSave({
        modelName: detail?.modelName || variant,
        modelVariable: detail?.modelVariable || variant,
        formFactor: draftFormFactor.trim(),
        rolePurpose: draftRolePurpose.trim(),
        actuatorsSensors: draftActuators,
        simulationAssets: draftAssets,
        metrics,
        customMetrics: draftCustomMetrics,
      });
    }
    if (onSaveSensorsAndPlugins) {
      onSaveSensorsAndPlugins(draftSensors.map(draftToSensor), draftPlugins.map(draftToPlugin));
    }
    setEditMode(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-sand-950/70 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="minimal-card w-[85vw] h-[85vh] max-w-4xl flex flex-col animate-in fade-in slide-in-from-top-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-sand-800 p-4 sm:p-5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-emerald-light border border-emerald-border flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-emerald-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-display font-extrabold text-sand-50 truncate">
                {detail?.modelName || variant}
              </h3>
              {!editMode && detail?.formFactor && (
                <p className="text-xs text-sand-500 truncate">{detail.formFactor}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(onSave || onSaveSensorsAndPlugins) && !editMode && (
              <button onClick={enterEditMode} className="text-sand-400 hover:text-sand-50 p-1.5 rounded-lg hover:bg-sand-800 cursor-pointer" title="Edit">
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="text-sand-500 hover:text-sand-50 p-1.5 rounded-lg hover:bg-sand-800 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-sm">
          {editMode ? (
            <>
              <div>
                <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2">Form Factor</h4>
                <input
                  type="text"
                  value={draftFormFactor}
                  onChange={(e) => setDraftFormFactor(e.target.value)}
                  placeholder="e.g. 4-wheel differential-drive rover"
                  className="w-full px-3.5 py-2 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary"
                />
              </div>

              <div>
                <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2">Role & Purpose</h4>
                <textarea
                  value={draftRolePurpose}
                  onChange={(e) => setDraftRolePurpose(e.target.value)}
                  rows={3}
                  placeholder="What this robot variant is for"
                  className="w-full px-3.5 py-2 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 text-sm leading-relaxed focus:outline-none focus:border-emerald-primary resize-y"
                />
              </div>

              <div>
                <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5" />
                  Metrics
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {METRIC_FIELDS.filter(({ key }) => visibleMetrics.has(key)).map(({ key, label, unit }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-sand-500 uppercase font-bold">{label} ({unit})</span>
                        <button
                          onClick={() => setVisibleMetrics(prev => { const next = new Set(prev); next.delete(key); return next; })}
                          className="text-sand-600 hover:text-rose-400 cursor-pointer leading-none"
                          title="Remove metric"
                        >
                          ×
                        </button>
                      </div>
                      <input
                        type="number"
                        value={draftMetrics[key]}
                        onChange={(e) => setDraftMetrics(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder="—"
                        className="w-full px-2.5 py-2 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary"
                      />
                    </div>
                  ))}
                </div>
                {METRIC_FIELDS.some(({ key }) => !visibleMetrics.has(key)) && (
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) setVisibleMetrics(prev => new Set(prev).add(e.target.value)); }}
                    className="mt-2 px-2.5 py-1.5 rounded-lg border border-dashed border-sand-700 bg-sand-950 text-sand-400 text-xs focus:outline-none focus:border-emerald-primary cursor-pointer"
                  >
                    <option value="">+ Add metric</option>
                    {METRIC_FIELDS.filter(({ key }) => !visibleMetrics.has(key)).map(({ key, label, unit }) => (
                      <option key={key} value={key}>{label} ({unit})</option>
                    ))}
                  </select>
                )}

                {/* Not limited to the fixed set above — a metric this robot
                    needs that isn't length/mass/speed/etc. (payload
                    capacity, battery runtime, ...) can always be added here,
                    with no dependency on removing anything first. */}
                <div className="mt-3 space-y-2">
                  {draftCustomMetrics.map((m, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        value={m.label}
                        onChange={(e) => setDraftCustomMetrics(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                        placeholder="Metric name"
                        className="w-full sm:w-40 sm:shrink-0 px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={m.value}
                          onChange={(e) => setDraftCustomMetrics(prev => prev.map((x, i) => i === idx ? { ...x, value: e.target.value } : x))}
                          placeholder="Value (e.g. 5 kg)"
                          className="flex-1 px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary min-w-0"
                        />
                        <button onClick={() => setDraftCustomMetrics(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="text"
                      value={newMetricLabel}
                      onChange={(e) => setNewMetricLabel(e.target.value)}
                      placeholder="Metric name"
                      className="w-full sm:w-40 sm:shrink-0 px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newMetricValue}
                        onChange={(e) => setNewMetricValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomMetric(); }}
                        placeholder="Value (e.g. 5 kg)"
                        className="flex-1 px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary min-w-0"
                      />
                      <button
                        onClick={handleAddCustomMetric}
                        disabled={!newMetricLabel.trim() || !newMetricValue.trim()}
                        className="p-1.5 text-sand-400 hover:text-sand-50 hover:bg-sand-800 border border-sand-700 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!newMetricLabel.trim() || !newMetricValue.trim() ? 'Fill in both a name and a value first' : 'Add metric'}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  Actuators & Sensors
                </h4>
                <div className="space-y-2">
                  {draftActuators.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={s}
                        onChange={(e) => setDraftActuators(prev => prev.map((x, i) => i === idx ? e.target.value : x))}
                        className="flex-1 px-3 py-2 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary min-w-0"
                      />
                      <button onClick={() => setDraftActuators(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newActuator}
                      onChange={(e) => setNewActuator(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddActuator(); }}
                      placeholder="Add actuator or sensor"
                      className="flex-1 px-3 py-2 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary min-w-0"
                    />
                    <button
                      onClick={handleAddActuator}
                      disabled={!newActuator.trim()}
                      className="p-1.5 text-sand-400 hover:text-sand-50 hover:bg-sand-800 rounded-lg border border-sand-700 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title={newActuator.trim() ? 'Add' : 'Enter a value first'}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5" />
                  Simulation Assets in Codebase
                </h4>
                <div className="space-y-2">
                  {draftAssets.map((a, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        value={a.label}
                        onChange={(e) => setDraftAssets(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                        placeholder="Label"
                        className="w-full sm:w-32 sm:shrink-0 px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={a.path}
                          onChange={(e) => setDraftAssets(prev => prev.map((x, i) => i === idx ? { ...x, path: e.target.value } : x))}
                          placeholder="Path"
                          className="flex-1 px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-sm font-mono focus:outline-none focus:border-emerald-primary min-w-0"
                        />
                        <button onClick={() => setDraftAssets(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="text"
                      value={newAssetLabel}
                      onChange={(e) => setNewAssetLabel(e.target.value)}
                      placeholder="Label"
                      className="w-full sm:w-32 sm:shrink-0 px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-sm focus:outline-none focus:border-emerald-primary"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newAssetPath}
                        onChange={(e) => setNewAssetPath(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddAsset(); }}
                        placeholder="Path"
                        className="flex-1 px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-sm font-mono focus:outline-none focus:border-emerald-primary min-w-0"
                      />
                      <button
                        onClick={handleAddAsset}
                        disabled={!newAssetLabel.trim() || !newAssetPath.trim()}
                        className="p-1.5 text-sand-400 hover:text-sand-50 hover:bg-sand-800 border border-sand-700 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!newAssetLabel.trim() || !newAssetPath.trim() ? 'Fill in both a label and a path first' : 'Add'}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : detail ? (
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
                    {detail.customMetrics?.map((m, idx) => (
                      <div key={idx} className="p-3 bg-sand-950 rounded-lg border border-sand-800">
                        <span className="text-[10px] text-sand-500 uppercase font-bold block mb-1">{m.label}</span>
                        <span className="text-sand-50 font-bold text-sm">{m.value}</span>
                      </div>
                    ))}
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
                {onSave
                  ? 'Re-run the AI audit to fetch it, or click Edit above to fill it in yourself.'
                  : 'This audit ran without the Gemini agent, or was run before per-robot detail was added. Re-run the AI audit to fetch it.'}
              </p>
            </div>
          )}

          {/* Repo-wide, not per-variant — shown regardless of whether the
              agent resolved a per-variant deep breakdown above, since this
              comes from the top-level audit, not robotModels. Editable
              under the same single Edit toggle as everything else here,
              saved via onSaveSensorsAndPlugins (a separate path from
              onSave since these are RobotProfile fields, not
              RobotModelDetail ones). */}
          {editMode ? (
            <>
              <div>
                <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5" />
                  Sensors
                </h4>
                <div className="space-y-3">
                  {draftSensors.map((s, idx) => (
                    <div key={idx} className="p-3 border border-sand-800 bg-sand-950 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="grid grid-cols-2 gap-2 flex-1">
                          <input type="text" value={s.name} onChange={(e) => setDraftSensors(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                            placeholder="Sensor name" className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary" />
                          <input type="text" value={s.type} onChange={(e) => setDraftSensors(prev => prev.map((x, i) => i === idx ? { ...x, type: e.target.value } : x))}
                            placeholder="Type, e.g. LiDAR" className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary" />
                        </div>
                        <button onClick={() => setDraftSensors(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={s.linkName} onChange={(e) => setDraftSensors(prev => prev.map((x, i) => i === idx ? { ...x, linkName: e.target.value } : x))}
                          placeholder="Link name" className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary" />
                        <input type="text" value={s.parentLink} onChange={(e) => setDraftSensors(prev => prev.map((x, i) => i === idx ? { ...x, parentLink: e.target.value } : x))}
                          placeholder="Parent link" className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary" />
                      </div>
                      <div>
                        <span className="text-[10px] text-sand-500 uppercase font-bold">Position (x, y, z)</span>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          {(['x', 'y', 'z'] as const).map((axis) => (
                            <input key={axis} type="number" step="any" value={s[axis]} onChange={(e) => setDraftSensors(prev => prev.map((x, i) => i === idx ? { ...x, [axis]: e.target.value } : x))}
                              placeholder={axis} className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary" />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-sand-500 uppercase font-bold">Orientation (r, p, y)</span>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          {(['r', 'p', 'yaw'] as const).map((axis) => (
                            <input key={axis} type="number" step="any" value={s[axis]} onChange={(e) => setDraftSensors(prev => prev.map((x, i) => i === idx ? { ...x, [axis]: e.target.value } : x))}
                              placeholder={axis === 'yaw' ? 'y' : axis} className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary" />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setDraftSensors(prev => [...prev, emptySensorDraft()])}
                    className="w-full py-2 border border-dashed border-sand-700 text-sand-400 hover:text-sand-50 hover:bg-sand-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Sensor
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Waypoints className="h-3.5 w-3.5" />
                  Simulation Plugins
                </h4>
                <div className="space-y-3">
                  {draftPlugins.map((p, idx) => (
                    <div key={idx} className="p-3 border border-sand-800 bg-sand-950 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input type="text" value={p.name} onChange={(e) => setDraftPlugins(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                          placeholder="Plugin name" className="flex-1 px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary" />
                        <button onClick={() => setDraftPlugins(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={p.targetLink} onChange={(e) => setDraftPlugins(prev => prev.map((x, i) => i === idx ? { ...x, targetLink: e.target.value } : x))}
                          placeholder="Target link" className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary" />
                        <input type="text" value={p.sensorType} onChange={(e) => setDraftPlugins(prev => prev.map((x, i) => i === idx ? { ...x, sensorType: e.target.value } : x))}
                          placeholder="Sensor type" className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary" />
                      </div>
                      <input type="text" value={p.pluginSystem} onChange={(e) => setDraftPlugins(prev => prev.map((x, i) => i === idx ? { ...x, pluginSystem: e.target.value } : x))}
                        placeholder="Plugin system identifier" className="w-full px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={p.rosTopic} onChange={(e) => setDraftPlugins(prev => prev.map((x, i) => i === idx ? { ...x, rosTopic: e.target.value } : x))}
                          placeholder="ROS topic" className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary" />
                        <input type="text" value={p.rosMessageType} onChange={(e) => setDraftPlugins(prev => prev.map((x, i) => i === idx ? { ...x, rosMessageType: e.target.value } : x))}
                          placeholder="Message type" className="px-2.5 py-1.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs font-mono focus:outline-none focus:border-emerald-primary" />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setDraftPlugins(prev => [...prev, { ...EMPTY_PLUGIN_DRAFT }])}
                    className="w-full py-2 border border-dashed border-sand-700 text-sand-400 hover:text-sand-50 hover:bg-sand-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Simulation Plugin
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {sensors.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5" />
                    Sensors ({sensors.length})
                  </h4>
                  <div className="overflow-x-auto border border-sand-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-sand-925 border-b border-sand-800 text-sand-500 font-semibold uppercase tracking-wide">
                          <th className="py-2 px-3">Sensor</th>
                          <th className="py-2 px-3">Link</th>
                          <th className="py-2 px-3">Position (x, y, z)</th>
                          <th className="py-2 px-3">Orientation (r, p, y)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand-800">
                        {sensors.map((s, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 align-top">
                              <div className="font-bold text-sand-50">{s.name}</div>
                              <div className="text-sand-500">{s.type}</div>
                              {s.detailedParams && s.detailedParams.length > 0 && (
                                <div className="text-[10px] text-sand-500 mt-1 leading-relaxed">
                                  {s.detailedParams.map((p, i) => (
                                    <span key={i}>
                                      {i > 0 && ' · '}
                                      {p.label}: {p.value}{p.unit ? ` ${p.unit}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top font-mono text-sand-300">{s.linkName}</td>
                            <td className="py-2.5 px-3 align-top font-mono text-sand-300">
                              {s.position ? `${s.position.x}, ${s.position.y}, ${s.position.z}` : (
                                <span className="text-amber-600 font-bold">Not determined</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top font-mono text-sand-300">
                              {s.orientation ? `${s.orientation.r}, ${s.orientation.p}, ${s.orientation.y}` : (
                                <span className="text-amber-600 font-bold">Not determined</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {simulationPlugins.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Waypoints className="h-3.5 w-3.5" />
                    Simulation Plugins ({simulationPlugins.length})
                  </h4>
                  <div className="overflow-x-auto border border-sand-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-sand-925 border-b border-sand-800 text-sand-500 font-semibold uppercase tracking-wide">
                          <th className="py-2 px-3">Plugin</th>
                          <th className="py-2 px-3">Target Link</th>
                          <th className="py-2 px-3">ROS Topic</th>
                          <th className="py-2 px-3">Message Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand-800">
                        {simulationPlugins.map((p, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 align-top">
                              <div className="font-bold text-sand-50">{p.name}</div>
                              <div className="text-sand-500">
                                {p.sensorType}{p.updateRateHz != null ? ` · ${p.updateRateHz} Hz` : ''}
                              </div>
                              {p.parameters && p.parameters.length > 0 && (
                                <div className="text-[10px] text-sand-500 mt-1 leading-relaxed">
                                  {p.parameters.map((x, i) => (
                                    <span key={i}>
                                      {i > 0 && ' · '}
                                      {x.label}: {x.value}{x.unit ? ` ${x.unit}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top font-mono text-sand-300">{p.targetLink}</td>
                            <td className="py-2.5 px-3 align-top font-mono text-emerald-primary font-bold">{p.rosTopic}</td>
                            <td className="py-2.5 px-3 align-top text-sand-400">{p.rosMessageType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {editMode && (
          <div className="flex justify-end gap-2 border-t border-sand-800 p-4 sm:p-5 shrink-0">
            <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-300 rounded-lg font-semibold cursor-pointer">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-emerald-primary py-2 px-4 text-xs font-bold cursor-pointer">
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
