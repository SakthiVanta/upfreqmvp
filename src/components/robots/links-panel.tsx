'use client';

import { useRef, useState } from 'react';
import { Plus, Trash2, Link2, AlertTriangle, ChevronDown, ChevronUp, Loader2, Info } from 'lucide-react';
import { RobotLink, Vec3 } from '@/lib/urdf/types';
import { ValidationIssue } from '@/lib/urdf/serialize';
import { NumberInput } from '@/components/ui/number-input';

const ALLOWED_EXTENSIONS = ['stl', 'obj', 'glb', 'gltf'];

interface LinksPanelProps {
  links: RobotLink[];
  selectedLinkId?: string;
  issues: ValidationIssue[];
  onSelectLink: (id: string) => void;
  onAddLink: (file: File) => Promise<void>;
  onReplaceMesh: (linkId: string, file: File) => Promise<void>;
  onUpdateOrigin: (linkId: string, xyz: Vec3) => void;
  onUpdateRpy: (linkId: string, rpy: Vec3) => void;
  onUpdateScale: (linkId: string, scale: number | undefined) => void;
  onUpdatePhysical: (linkId: string, patch: { mass?: number; inertia?: RobotLink['inertia'] }) => void;
  onEstimateInertia: (linkId: string) => void;
  isEstimatingInertia: string | null;
  onRenameLink: (linkId: string, name: string) => void;
  onDeleteLink: (linkId: string) => void;
  deleteBlockedReason: (linkId: string) => string | null;
  isBusy: boolean;
  errorMessage: (message: string) => void;
}

export function LinksPanel({
  links,
  selectedLinkId,
  issues,
  onSelectLink,
  onAddLink,
  onReplaceMesh,
  onUpdateOrigin,
  onUpdateRpy,
  onUpdateScale,
  onUpdatePhysical,
  onEstimateInertia,
  isEstimatingInertia,
  onRenameLink,
  onDeleteLink,
  deleteBlockedReason,
  isBusy,
  errorMessage,
}: LinksPanelProps) {
  const [expandedPhysicalId, setExpandedPhysicalId] = useState<string | null>(null);
  const [expandedOffsetId, setExpandedOffsetId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const handleAddFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      errorMessage(`Unsupported file type ".${ext}" — use .stl, .obj, .glb, or .gltf`);
      return;
    }
    await onAddLink(file);
  };

  return (
    <div className="minimal-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-sand-50 flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-emerald-primary" />
          Links ({links.length})
        </h3>
        <input
          ref={addInputRef}
          type="file"
          accept=".stl,.obj,.glb,.gltf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) handleAddFile(file);
          }}
          disabled={isBusy}
        />
        <button
          onClick={() => addInputRef.current?.click()}
          disabled={isBusy}
          className="px-2.5 py-1.5 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-lg font-bold flex items-center gap-1 cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 text-emerald-primary" />}
          Add Link
        </button>
      </div>

      {links.length === 0 && (
        <p className="text-xs text-sand-500 text-center py-4">No links yet. Each link needs its own mesh file — pick one and it&apos;ll be named after the file automatically.</p>
      )}

      <div className="space-y-2">
        {links.map((link) => {
          const blockedReason = deleteBlockedReason(link.id);
          const origin = link.visualOrigin?.xyz ?? { x: 0, y: 0, z: 0 };
          const rpy = link.visualOrigin?.rpy ?? { x: 0, y: 0, z: 0 };
          const isSelected = link.id === selectedLinkId;
          const linkIssues = issues.filter((i) => i.linkId === link.id);
          const physicalOpen = expandedPhysicalId === link.id;
          const offsetOpen = expandedOffsetId === link.id;

          return (
            <div
              key={link.id}
              onClick={() => onSelectLink(link.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected ? 'border-emerald-primary bg-sand-900' : 'border-sand-800 bg-sand-950 hover:bg-sand-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={link.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onRenameLink(link.id, e.target.value)}
                  title="Click to rename"
                  className="flex-1 min-w-0 bg-sand-950 border border-sand-700 rounded px-2 py-1 font-bold text-sand-100 text-xs focus:outline-none focus:border-emerald-primary truncate"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (blockedReason) {
                      errorMessage(blockedReason);
                      return;
                    }
                    onDeleteLink(link.id);
                  }}
                  title={blockedReason ?? 'Delete link'}
                  className={`p-1 shrink-0 cursor-pointer ${blockedReason ? 'text-sand-700 cursor-not-allowed' : 'text-sand-500 hover:text-rose-400'}`}
                  disabled={!!blockedReason}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {linkIssues.length > 0 && (
                <div className="mt-1.5 space-y-1" onClick={(e) => e.stopPropagation()}>
                  {linkIssues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {link.meshUrl ? (
                <div className="mt-2 flex items-center gap-3 text-[11px] text-sand-500">
                  <span className="truncate">Mesh attached</span>
                  <label className="text-emerald-primary font-bold cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                    Replace
                    <input
                      type="file"
                      accept=".stl,.obj,.glb,.gltf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) onReplaceMesh(link.id, file);
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3 text-[11px]" onClick={(e) => e.stopPropagation()}>
                  <span className="text-amber-500">No mesh attached</span>
                  <label className="text-emerald-primary font-bold cursor-pointer shrink-0">
                    Attach Mesh
                    <input
                      type="file"
                      accept=".stl,.obj,.glb,.gltf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) onReplaceMesh(link.id, file);
                      }}
                    />
                  </label>
                </div>
              )}

              {link.meshUrl && (
                <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <label className="text-sand-600 text-[10px] font-bold uppercase shrink-0">Mesh scale</label>
                  <NumberInput
                    value={link.meshScale ?? 1}
                    onChange={(v) => onUpdateScale(link.id, v !== undefined && v > 0 ? v : undefined)}
                    className="w-20 px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                  />
                  <button
                    onClick={() => onUpdateScale(link.id, 0.001)}
                    className="p-1 text-sand-500 hover:text-emerald-primary cursor-pointer shrink-0"
                    title="Model looks huge or the camera seems stuck inside it? STL files are commonly authored in millimeters — click to scale this mesh down to meters (×0.001)."
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedOffsetId(offsetOpen ? null : link.id);
                }}
                className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-sand-500 hover:text-sand-300 cursor-pointer"
                title="A small mesh-alignment correction, not a way to position this link — use the joint's origin for that"
              >
                {offsetOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Mesh offset (rarely needed)
              </button>

              {offsetOpen && (
                <div className="mt-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  <p className="text-[10px] text-sand-600">
                    Corrects mesh alignment within this link only — to position the link itself, edit its joint&apos;s origin instead.
                  </p>
                  <div>
                    <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">xyz (m)</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <NumberInput
                          key={axis}
                          value={origin[axis]}
                          onChange={(v) => v !== undefined && onUpdateOrigin(link.id, { ...origin, [axis]: v })}
                          className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">rpy (rad)</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <NumberInput
                          key={axis}
                          value={rpy[axis]}
                          onChange={(v) => v !== undefined && onUpdateRpy(link.id, { ...rpy, [axis]: v })}
                          className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedPhysicalId(physicalOpen ? null : link.id);
                }}
                className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-sand-500 hover:text-sand-300 cursor-pointer"
              >
                {physicalOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Physical properties (optional)
              </button>

              {physicalOpen && (
                <div className="mt-2 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <label className="block text-sand-600 text-[10px] font-bold uppercase mb-0.5">Mass (kg)</label>
                    <NumberInput
                      value={link.mass}
                      allowEmpty
                      placeholder="—"
                      onChange={(v) => onUpdatePhysical(link.id, { mass: v })}
                      className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-sand-600 text-[10px] font-bold uppercase">Inertia (ixx / iyy / izz)</label>
                      {link.meshUrl && (
                        <button
                          onClick={() => onEstimateInertia(link.id)}
                          disabled={link.mass === undefined || isEstimatingInertia === link.id}
                          title={link.mass === undefined ? 'Enter a mass first' : 'Estimate ixx/iyy/izz from a solid-box approximation of the mesh\'s real measured dimensions'}
                          className="text-[10px] font-bold text-emerald-primary hover:underline cursor-pointer disabled:text-sand-700 disabled:no-underline disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {isEstimatingInertia === link.id && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                          Estimate from size
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['ixx', 'iyy', 'izz'] as const).map((key) => (
                        <NumberInput
                          key={key}
                          value={link.inertia?.[key]}
                          allowEmpty
                          placeholder="—"
                          onChange={(v) => {
                            const base = link.inertia ?? { ixx: 0, iyy: 0, izz: 0 };
                            onUpdatePhysical(link.id, { inertia: { ...base, [key]: v ?? 0 } });
                          }}
                          className="w-full px-1.5 py-1 rounded border border-sand-700 bg-sand-950 text-sand-100 text-[11px] focus:outline-none focus:border-emerald-primary"
                        />
                      ))}
                    </div>
                  </div>
                  <p className="col-span-2 text-[10px] text-sand-600">Leave blank to omit the &lt;inertial&gt; block — URDF doesn&apos;t require it.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
