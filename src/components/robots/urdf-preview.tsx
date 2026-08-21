'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, AlertTriangle, FileCode, Package, Loader2 } from 'lucide-react';
import { RobotDesign } from '@/lib/user-robot-designs';
import { validateDesign, buildUrdfXml } from '@/lib/urdf/serialize';
import { downloadRosPackage } from '@/lib/urdf/export-ros-package';
import { useToast } from '@/components/ui/toast';

interface UrdfPreviewProps {
  design: RobotDesign;
}

export function UrdfPreview({ design }: UrdfPreviewProps) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [isExportingPackage, setIsExportingPackage] = useState(false);

  const errors = useMemo(() => validateDesign(design), [design]);
  const xml = useMemo(() => (errors.length === 0 ? buildUrdfXml(design) : null), [design, errors]);

  const handleDownload = () => {
    if (!xml) return;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${design.name.trim().replace(/\s+/g, '_') || 'robot'}.urdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPackage = async () => {
    if (!xml) return;
    setIsExportingPackage(true);
    try {
      await downloadRosPackage(design);
    } catch (e: any) {
      toast.error(e.message || 'Failed to build ROS package.');
    } finally {
      setIsExportingPackage(false);
    }
  };

  return (
    <div className="minimal-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-xs font-bold text-sand-50 flex items-center gap-1.5">
          <FileCode className="h-3.5 w-3.5 text-emerald-primary" />
          URDF Export
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPackage}
            disabled={!xml || isExportingPackage}
            title={xml ? 'Bundles a real ROS package (package.xml, CMakeLists.txt, urdf/, meshes/) you can drop into a workspace' : errors[0]}
            className="px-3 py-1.5 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExportingPackage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5 text-emerald-primary" />}
            {isExportingPackage ? 'Building...' : 'Download ROS Package (.zip)'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!xml}
            title={xml ? undefined : errors[0]}
            className="btn-emerald-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Download URDF
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 text-sand-500 hover:text-sand-200 cursor-pointer">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {xml && (
        <p className="text-[11px] text-sand-500">
          <span className="font-bold text-sand-400">Download URDF</span> uses direct blob URLs — fine for previewing in a
          browser-based viewer. <span className="font-bold text-sand-400">Download ROS Package</span> bundles the actual mesh
          files with <code>package://</code> references — use this one for a real ROS workspace.
        </p>
      )}

      {expanded && xml && (
        <pre className="p-3 bg-sand-950 border border-sand-800 rounded-lg text-[11px] text-sand-300 overflow-x-auto max-h-96 overflow-y-auto">
          {xml}
        </pre>
      )}
    </div>
  );
}
