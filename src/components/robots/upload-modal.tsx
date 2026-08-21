'use client';

import { useState, useRef } from 'react';
import { Upload, FileCode2, Layers, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { SUPPORTED_3D_EXTENSIONS } from '@/lib/mesh/cad-loader';

interface UploadModalProps {
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
  isBusy: boolean;
}

const ACCEPT_FILTER = SUPPORTED_3D_EXTENSIONS.map((e) => `.${e}`).join(',');

export function UploadModal({ onClose, onUpload, isBusy }: UploadModalProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    await onUpload(files);
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isBusy) return;
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) {
      handleFilesSelected(dropped);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Upload 3D CAD & Mesh Files" icon={Upload} wide>
      <div className="space-y-5 text-sand-200">
        {/* Minimal Workflow & Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 bg-sand-950 border border-sand-800 rounded space-y-2">
            <div className="flex items-center gap-2 text-sand-50 font-bold text-xs">
              <Layers className="h-4 w-4 text-emerald-primary" />
              <span>Supported CAD & Robotics Formats</span>
            </div>
            <p className="text-[11px] text-sand-400 leading-relaxed">
              Upload raw CAD parts or simulation meshes directly from your modeling software:
            </p>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-start gap-1.5 text-[11px]">
                <span className="font-mono text-[9px] uppercase px-1 py-0.5 bg-sand-900 border border-sand-700 text-sand-300 rounded font-bold shrink-0">
                  STEP / IGES
                </span>
                <span className="text-sand-300">
                  SolidWorks, Onshape, Fusion 360, Creo, Inventor, FreeCAD (preserves B-Rep geometry & part names).
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-[11px]">
                <span className="font-mono text-[9px] uppercase px-1 py-0.5 bg-sand-900 border border-sand-700 text-sand-300 rounded font-bold shrink-0">
                  DAE / STL / OBJ
                </span>
                <span className="text-sand-300">ROS 1 & ROS 2 Gazebo simulation packages, RViz, and 3D print models.</span>
              </div>
              <div className="flex items-start gap-1.5 text-[11px]">
                <span className="font-mono text-[9px] uppercase px-1 py-0.5 bg-sand-900 border border-sand-700 text-sand-300 rounded font-bold shrink-0">
                  GLTF / 3MF / PLY
                </span>
                <span className="text-sand-300">NVIDIA Isaac Sim, Bambu/Prusa additive manufacturing, LiDAR point clouds.</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-sand-950 border border-sand-800 rounded space-y-2">
            <div className="flex items-center gap-2 text-sand-50 font-bold text-xs">
              <FileCode2 className="h-4 w-4 text-emerald-primary" />
              <span>How It Works</span>
            </div>
            <ul className="space-y-2 text-[11px] text-sand-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="text-sand-100">1 File = 1 Link:</strong> Each file uploaded is created as an independent robot link, automatically named after your part.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="text-sand-100">Multi-File Batch:</strong> Select all your robot parts at once (e.g. chassis, wheels, arm links, lidar).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="text-sand-100">AI Structure Assembly:</strong> After uploading, click <em>AI Generate</em> to propose the joint tree and compute joint offsets automatically from physical geometry.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-emerald-primary bg-sand-900/60'
              : 'border-sand-700 bg-sand-950 hover:border-sand-500 hover:bg-sand-900/30'
          } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_FILTER}
            className="hidden"
            disabled={isBusy}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              if (files.length > 0) handleFilesSelected(files);
            }}
          />

          {isBusy ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-emerald-primary animate-spin" />
              <p className="text-xs font-bold text-sand-50">Uploading and processing 3D files...</p>
            </div>
          ) : (
            <>
              <div className="p-3 rounded bg-sand-900 border border-sand-800 text-sand-50">
                <Upload className="h-6 w-6 text-emerald-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-sand-50">Drag and drop your 3D files here</p>
                <p className="text-xs text-sand-500">or click to browse from your computer</p>
              </div>
              <button
                type="button"
                className="btn-emerald-primary py-2 px-5 text-xs font-bold mt-2 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Browse 3D Files
              </button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
