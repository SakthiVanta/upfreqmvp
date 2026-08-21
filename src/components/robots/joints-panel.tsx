'use client';

import { Plus, Trash2, Cog, AlertTriangle } from 'lucide-react';
import { RobotJoint, RobotLink, JointType, jointRequiresAxis, jointRequiresLimit } from '@/lib/urdf/types';
import { ValidationIssue } from '@/lib/urdf/serialize';
import { NumberInput } from '@/components/ui/number-input';

const JOINT_TYPES: JointType[] = ['revolute', 'continuous', 'prismatic', 'fixed', 'floating', 'planar'];

interface JointsPanelProps {
  joints: RobotJoint[];
  links: RobotLink[];
  issues: ValidationIssue[];
  onAddJoint: () => void;
  onUpdateJoint: (jointId: string, patch: Partial<RobotJoint>) => void;
  onDeleteJoint: (jointId: string) => void;
}

export function JointsPanel({ joints, links, issues, onAddJoint, onUpdateJoint, onDeleteJoint }: JointsPanelProps) {
  const canAddJoint = links.length >= 2;

  return (
    <div className="minimal-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-sand-50 flex items-center gap-1.5">
          <Cog className="h-3.5 w-3.5 text-emerald-primary" />
          Joints ({joints.length})
        </h3>
        <button
          onClick={onAddJoint}
          disabled={!canAddJoint}
          title={canAddJoint ? undefined : 'Add at least two links first'}
          className="px-2.5 py-1.5 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-lg font-bold flex items-center gap-1 cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5 text-emerald-primary" />
          Add Joint
        </button>
      </div>

      {joints.length === 0 && (
        <p className="text-xs text-sand-500 text-center py-4">
          {canAddJoint ? 'No joints yet. Connect links to form the robot tree.' : 'Add at least two links before wiring up joints.'}
        </p>
      )}

      <div className="space-y-2">
        {joints.map((joint) => {
          const needsAxis = jointRequiresAxis(joint.type);
          const needsLimit = jointRequiresLimit(joint.type);
          const axis = joint.axis ?? { x: 0, y: 0, z: 1 };
          const limit = joint.limit ?? {};
          const rpy = joint.origin.rpy ?? { x: 0, y: 0, z: 0 };
          const jointIssues = issues.filter((i) => i.jointId === joint.id);

          return (
            <div key={joint.id} className="p-3 rounded-lg border border-sand-800 bg-sand-950 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={joint.name}
                  onChange={(e) => onUpdateJoint(joint.id, { name: e.target.value })}
                  title="Click to rename"
                  className="flex-1 min-w-0 bg-sand-950 border border-sand-700 rounded px-2 py-1 font-bold text-sand-100 text-xs focus:outline-none focus:border-emerald-primary truncate"
                />
                <button
                  onClick={() => onDeleteJoint(joint.id)}
                  className="p-1 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer"
                  title="Delete joint"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {jointIssues.length > 0 && (
                <div className="space-y-1">
                  {jointIssues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">Type</label>
                  <select
                    value={joint.type}
                    onChange={(e) => onUpdateJoint(joint.id, { type: e.target.value as JointType })}
                    className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                  >
                    {JOINT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">Parent</label>
                  <select
                    value={joint.parentLinkId}
                    onChange={(e) => onUpdateJoint(joint.id, { parentLinkId: e.target.value })}
                    className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                  >
                    {links.filter((l) => l.id !== joint.childLinkId).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">Child</label>
                  <select
                    value={joint.childLinkId}
                    onChange={(e) => onUpdateJoint(joint.id, { childLinkId: e.target.value })}
                    className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                  >
                    {links.filter((l) => l.id !== joint.parentLinkId).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-sand-600">Positions the child link relative to the parent — this is the field that actually moves things.</p>

              <div className="space-y-1.5">
                <div>
                  <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">Origin xyz (m)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['x', 'y', 'z'] as const).map((axisKey) => (
                      <NumberInput
                        key={axisKey}
                        value={joint.origin.xyz[axisKey]}
                        onChange={(v) =>
                          v !== undefined &&
                          onUpdateJoint(joint.id, {
                            origin: { ...joint.origin, xyz: { ...joint.origin.xyz, [axisKey]: v } },
                          })
                        }
                        className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">Origin rpy (rad)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['x', 'y', 'z'] as const).map((axisKey) => (
                      <NumberInput
                        key={axisKey}
                        value={rpy[axisKey]}
                        onChange={(v) =>
                          v !== undefined &&
                          onUpdateJoint(joint.id, {
                            origin: { ...joint.origin, rpy: { ...rpy, [axisKey]: v } },
                          })
                        }
                        className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {needsAxis && (
                <div>
                  <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">Axis xyz</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['x', 'y', 'z'] as const).map((axisKey) => (
                      <NumberInput
                        key={axisKey}
                        value={axis[axisKey]}
                        onChange={(v) => v !== undefined && onUpdateJoint(joint.id, { axis: { ...axis, [axisKey]: v } })}
                        className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                      />
                    ))}
                  </div>
                </div>
              )}

              {needsLimit && (
                <div>
                  <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">Limit (lower / upper)</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <NumberInput
                      value={limit.lower ?? 0}
                      onChange={(v) => v !== undefined && onUpdateJoint(joint.id, { limit: { ...limit, lower: v } })}
                      className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                    />
                    <NumberInput
                      value={limit.upper ?? 0}
                      onChange={(v) => v !== undefined && onUpdateJoint(joint.id, { limit: { ...limit, upper: v } })}
                      className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
