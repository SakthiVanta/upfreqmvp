'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bot, Upload, Loader2, Sparkles } from 'lucide-react';
import {
  fetchRobotDesign,
  uploadMeshFile,
  deleteMeshFile,
  updateRobotDesign,
  RobotDesign,
  BlueprintJointSuggestion,
} from '@/lib/user-robot-designs';
import { RobotLink, RobotJoint, Vec3, zeroOrigin } from '@/lib/urdf/types';
import { validateDesignDetailed } from '@/lib/urdf/serialize';
import { uniqueName, nameFromFilename } from '@/lib/naming';
import { loadBoundsMeters } from '@/lib/mesh/load-bounds';
import { useToast } from '@/components/ui/toast';
import { ModelViewer, LinkMeshRef } from '@/components/robots/model-viewer';
import { LinksPanel } from '@/components/robots/links-panel';
import { JointsPanel } from '@/components/robots/joints-panel';
import { UrdfPreview } from '@/components/robots/urdf-preview';
import { AiGeneratePanel, LinkMeshInfo } from '@/components/robots/ai-generate-panel';
import { ModalShell } from '@/components/ui/modal-shell';

const PERSIST_DEBOUNCE_MS = 500;
const ALLOWED_MESH_EXTENSIONS = ['stl', 'obj', 'glb', 'gltf'];

export default function RobotBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const designId = params.id as string;

  const [design, setDesign] = useState<RobotDesign | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);
  const [estimatingInertiaLinkId, setEstimatingInertiaLinkId] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRobotDesign(designId)
      .then((found) => {
        if (cancelled) return;
        setDesign(found);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setLoadError(e.message);
      });
    return () => {
      cancelled = true;
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [designId]);

  const meshFileById = useMemo(() => {
    const map = new Map<string, { extension: string }>();
    design?.meshFiles.forEach((f) => map.set(f.id, f));
    return map;
  }, [design]);

  const meshByLinkId = useMemo(() => {
    const map = new Map<string, LinkMeshRef>();
    design?.links.forEach((l) => {
      if (!l.meshUrl) return;
      map.set(l.id, {
        url: l.meshUrl,
        extension: (l.meshFileId && (meshFileById.get(l.meshFileId)?.extension as LinkMeshRef['extension'])) || 'stl',
        scale: l.meshScale,
      });
    });
    return map;
  }, [design, meshFileById]);

  const linkMeshes: LinkMeshInfo[] = useMemo(() => {
    if (!design) return [];
    return design.links
      .filter((l) => l.meshUrl)
      .map((l) => ({
        linkId: l.id,
        name: l.name,
        url: l.meshUrl!,
        extension: (l.meshFileId && (meshFileById.get(l.meshFileId)?.extension as LinkMeshInfo['extension'])) || 'stl',
        scale: l.meshScale,
      }));
  }, [design, meshFileById]);

  const issues = useMemo(() => (design ? validateDesignDetailed(design) : []), [design]);

  // Local edits apply to `design` state immediately (every handler below
  // calls setDesign before this runs) — this only controls when the PATCH
  // actually goes over the wire, so rapid field edits (typing a number,
  // dragging) collapse into one request instead of one per keystroke.
  const persist = useCallback(
    (targetId: string, patch: { links?: RobotLink[]; joints?: RobotJoint[] }, immediate = false) => {
      const run = async () => {
        try {
          const updated = await updateRobotDesign(targetId, patch);
          if (updated) setDesign(updated);
        } catch (e: any) {
          toast.error(e.message || 'Failed to save changes.');
        }
      };
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (immediate) {
        run();
      } else {
        persistTimer.current = setTimeout(run, PERSIST_DEBOUNCE_MS);
      }
    },
    [toast]
  );

  // Shared by the top-of-page "Upload 3D Files" button (usually several
  // files at once, one per link) and LinksPanel's single-file "+ Add Link".
  // Each link is named after its own file (deduped against what's already
  // there) — the user renames inline afterward if they want something else,
  // same as every other editable field on this page.
  const handleUploadFiles = async (files: File[]) => {
    if (!design || files.length === 0) return;
    setIsBusy(true);
    try {
      const taken = new Set(design.links.map((l) => l.name));
      const newLinks: RobotLink[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_MESH_EXTENSIONS.includes(ext)) {
          toast.error(`Skipped "${file.name}" — unsupported file type ".${ext}"`);
          continue;
        }
        const name = uniqueName(nameFromFilename(file.name), taken);
        taken.add(name);
        const meshFile = await uploadMeshFile(design.id, file);
        newLinks.push({
          id: crypto.randomUUID(),
          name,
          meshFileId: meshFile.id,
          meshUrl: meshFile.url,
          visualOrigin: zeroOrigin(),
        });
      }
      if (newLinks.length === 0) return;
      const mergedLinks = [...design.links, ...newLinks];
      setDesign({ ...design, links: mergedLinks });
      persist(design.id, { links: mergedLinks }, true);
    } catch (e: any) {
      toast.error(e.message || 'Failed to upload file(s).');
    } finally {
      setIsBusy(false);
    }
  };

  const handleApplyAiSuggestion = (renames: { id: string; name: string }[], newJoints: RobotJoint[]) => {
    if (!design) return;
    const nameById = new Map(renames.map((r) => [r.id, r.name]));
    const newLinks = design.links.map((l) => (nameById.has(l.id) ? { ...l, name: nameById.get(l.id)! } : l));
    const mergedJoints = newJoints.length > 0 ? [...design.joints, ...newJoints] : design.joints;
    setDesign({ ...design, links: newLinks, joints: mergedJoints });
    persist(design.id, { links: newLinks, joints: mergedJoints }, true);
    setShowAiModal(false);
  };

  // No links existed yet — AI proposed a skeleton from a text description
  // alone. Links are created with no mesh; joint origins are always zero
  // since there's no real geometry to measure (the user attaches a mesh to
  // each link afterward, then re-runs Generate to compute real origins).
  const handleApplyBlueprint = (linkNames: string[], joints: BlueprintJointSuggestion[]) => {
    if (!design) return;
    const idByName = new Map<string, string>();
    const newLinks: RobotLink[] = linkNames.map((name) => {
      const id = crypto.randomUUID();
      idByName.set(name, id);
      return { id, name, visualOrigin: zeroOrigin() };
    });

    const newJoints: RobotJoint[] = [];
    for (const j of joints) {
      const parentLinkId = idByName.get(j.parentName);
      const childLinkId = idByName.get(j.childName);
      if (!parentLinkId || !childLinkId) continue;
      newJoints.push({
        id: crypto.randomUUID(),
        name: j.name,
        type: j.type,
        parentLinkId,
        childLinkId,
        origin: zeroOrigin(),
        axis: j.axis,
      });
    }

    const mergedLinks = [...design.links, ...newLinks];
    const mergedJoints = [...design.joints, ...newJoints];
    setDesign({ ...design, links: mergedLinks, joints: mergedJoints });
    persist(design.id, { links: mergedLinks, joints: mergedJoints }, true);
    setShowAiModal(false);
  };

  const handleReplaceMesh = async (linkId: string, file: File) => {
    if (!design) return;
    const oldLink = design.links.find((l) => l.id === linkId);
    setIsBusy(true);
    try {
      const meshFile = await uploadMeshFile(design.id, file);
      const newLinks = design.links.map((l) =>
        l.id === linkId ? { ...l, meshFileId: meshFile.id, meshUrl: meshFile.url } : l
      );
      setDesign({ ...design, links: newLinks });
      persist(design.id, { links: newLinks }, true);
      if (oldLink?.meshFileId) await deleteMeshFile(design.id, oldLink.meshFileId).catch(() => undefined);
    } catch (e: any) {
      toast.error(e.message || 'Failed to replace mesh file.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateOrigin = (linkId: string, xyz: Vec3) => {
    if (!design) return;
    const newLinks = design.links.map((l) =>
      l.id === linkId ? { ...l, visualOrigin: { xyz, rpy: l.visualOrigin?.rpy ?? { x: 0, y: 0, z: 0 } } } : l
    );
    setDesign({ ...design, links: newLinks });
    persist(design.id, { links: newLinks });
  };

  const handleUpdateRpy = (linkId: string, rpy: Vec3) => {
    if (!design) return;
    const newLinks = design.links.map((l) =>
      l.id === linkId ? { ...l, visualOrigin: { xyz: l.visualOrigin?.xyz ?? { x: 0, y: 0, z: 0 }, rpy } } : l
    );
    setDesign({ ...design, links: newLinks });
    persist(design.id, { links: newLinks });
  };

  const handleUpdateScale = (linkId: string, scale: number | undefined) => {
    if (!design) return;
    const newLinks = design.links.map((l) => (l.id === linkId ? { ...l, meshScale: scale } : l));
    setDesign({ ...design, links: newLinks });
    persist(design.id, { links: newLinks });
  };

  const handleUpdatePhysical = (linkId: string, patch: { mass?: number; inertia?: RobotLink['inertia'] }) => {
    if (!design) return;
    const newLinks = design.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l));
    setDesign({ ...design, links: newLinks });
    persist(design.id, { links: newLinks });
  };

  // Solid-box approximation from the mesh's own measured dimensions — the
  // same "measure real geometry, don't invent numbers" principle as AI
  // Generate. Mass stays user-entered (no material/density assumption this
  // app can make honestly); only the inertia tensor is derived from it.
  const handleEstimateInertia = async (linkId: string) => {
    if (!design) return;
    const link = design.links.find((l) => l.id === linkId);
    if (!link?.meshUrl || link.mass === undefined) return;
    const info = linkMeshes.find((m) => m.linkId === linkId);
    if (!info) return;

    setEstimatingInertiaLinkId(linkId);
    try {
      const { size } = await loadBoundsMeters(info);
      const m = link.mass;
      const inertia = {
        ixx: (m * (size.y * size.y + size.z * size.z)) / 12,
        iyy: (m * (size.x * size.x + size.z * size.z)) / 12,
        izz: (m * (size.x * size.x + size.y * size.y)) / 12,
      };
      const newLinks = design.links.map((l) => (l.id === linkId ? { ...l, inertia } : l));
      setDesign({ ...design, links: newLinks });
      persist(design.id, { links: newLinks }, true);
    } catch (e: any) {
      toast.error(e.message || 'Failed to estimate inertia.');
    } finally {
      setEstimatingInertiaLinkId(null);
    }
  };

  const handleRenameLink = (linkId: string, name: string) => {
    if (!design) return;
    const newLinks = design.links.map((l) => (l.id === linkId ? { ...l, name } : l));
    setDesign({ ...design, links: newLinks });
    persist(design.id, { links: newLinks });
  };

  const deleteBlockedReason = (linkId: string): string | null => {
    if (!design) return null;
    const referencing = design.joints.find((j) => j.parentLinkId === linkId || j.childLinkId === linkId);
    if (!referencing) return null;
    return `Remove joint "${referencing.name}" first — it references this link.`;
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!design) return;
    const link = design.links.find((l) => l.id === linkId);
    const newLinks = design.links.filter((l) => l.id !== linkId);
    setDesign({ ...design, links: newLinks });
    persist(design.id, { links: newLinks }, true);
    if (link?.meshFileId) await deleteMeshFile(design.id, link.meshFileId).catch(() => undefined);
    if (selectedLinkId === linkId) setSelectedLinkId(undefined);
  };

  const handleAddJoint = () => {
    if (!design || design.links.length < 2) return;
    const newJoint: RobotJoint = {
      id: crypto.randomUUID(),
      name: `joint_${design.joints.length + 1}`,
      type: 'fixed',
      parentLinkId: design.links[0].id,
      childLinkId: design.links[1].id,
      origin: zeroOrigin(),
    };
    const newJoints = [...design.joints, newJoint];
    setDesign({ ...design, joints: newJoints });
    persist(design.id, { joints: newJoints }, true);
  };

  const handleUpdateJoint = (jointId: string, patch: Partial<RobotJoint>) => {
    if (!design) return;
    const newJoints = design.joints.map((j) => (j.id === jointId ? { ...j, ...patch } : j));
    setDesign({ ...design, joints: newJoints });
    persist(design.id, { joints: newJoints });
  };

  const handleDeleteJoint = (jointId: string) => {
    if (!design) return;
    const newJoints = design.joints.filter((j) => j.id !== jointId);
    setDesign({ ...design, joints: newJoints });
    persist(design.id, { joints: newJoints }, true);
  };

  if (design === undefined) {
    if (loadError) {
      return (
        <div className="bg-rose-50 border border-rose-200 p-4 text-rose-700 text-xs">
          <span className="font-bold">Couldn&apos;t load robot: </span>{loadError}
        </div>
      );
    }
    return (
      <div className="minimal-card p-12 text-center">
        <Loader2 className="h-6 w-6 mx-auto text-sand-500 animate-spin" />
      </div>
    );
  }

  if (design === null) {
    return (
      <div className="minimal-card p-12 text-center space-y-4">
        <Bot className="h-10 w-10 mx-auto text-sand-600" />
        <h3 className="text-base font-bold text-sand-50">Robot Not Found</h3>
        <button onClick={() => router.push('/robots')} className="btn-secondary-light py-2.5 px-5 text-xs cursor-pointer">
          Back to Robots
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1.5">
          <button
            onClick={() => router.push('/robots')}
            className="flex items-center gap-1.5 text-sand-500 hover:text-sand-200 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Robots
          </button>
          <h1 className="text-3xl sm:text-4xl font-display font-normal text-sand-50 tracking-tight">
            {design.name}
          </h1>
          {design.description && <p className="text-sand-500 text-sm">{design.description}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowAiModal(true)}
            title={
              design.links.length === 0
                ? 'AI Generate Structure — describe your robot and AI proposes a starting skeleton (no links yet, so a description is required)'
                : 'AI Generate Structure — propose link names and a joint tree from your uploaded links'
            }
            className="p-3 bg-sand-800 hover:bg-sand-700 text-emerald-primary rounded-lg cursor-pointer"
          >
            <Sparkles className="h-4.5 w-4.5" />
          </button>

          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept=".stl,.obj,.glb,.gltf"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              if (files.length > 0) handleUploadFiles(files);
            }}
            disabled={isBusy}
          />
          <button
            onClick={() => uploadInputRef.current?.click()}
            disabled={isBusy}
            className="btn-emerald-primary py-3 px-5 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isBusy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Upload className="h-4.5 w-4.5" />}
            {isBusy ? 'Uploading...' : 'Upload 3D Files'}
          </button>
        </div>
      </div>

      {showAiModal && (
        <ModalShell onClose={() => setShowAiModal(false)} title="AI Generate Structure" icon={Sparkles} wide>
          <AiGeneratePanel linkMeshes={linkMeshes} onApply={handleApplyAiSuggestion} onApplyBlueprint={handleApplyBlueprint} />
        </ModalShell>
      )}

      {design.links.length === 0 && (
        <p className="text-xs text-sand-500 -mt-3">
          Start here: upload one or more .stl/.obj/.glb/.gltf files — each becomes a link. Add joints between them below, then export URDF.
        </p>
      )}

      {/* Viewer on the left; Links and Joints stacked together on the right
          since building a joint means picking two links — keeping them
          adjacent instead of on separate rows is the whole point. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 lg:sticky lg:top-4 lg:self-start h-[calc(100vh-10rem)] min-h-96">
          <ModelViewer
            links={design.links}
            joints={design.joints}
            meshByLinkId={meshByLinkId}
            selectedLinkId={selectedLinkId}
            onSelectMesh={setSelectedLinkId}
          />
        </div>

        <div className="space-y-4">
          <LinksPanel
            links={design.links}
            selectedLinkId={selectedLinkId}
            issues={issues}
            onSelectLink={setSelectedLinkId}
            onAddLink={(file) => handleUploadFiles([file])}
            onReplaceMesh={handleReplaceMesh}
            onUpdateOrigin={handleUpdateOrigin}
            onUpdateRpy={handleUpdateRpy}
            onUpdateScale={handleUpdateScale}
            onUpdatePhysical={handleUpdatePhysical}
            onEstimateInertia={handleEstimateInertia}
            isEstimatingInertia={estimatingInertiaLinkId}
            onRenameLink={handleRenameLink}
            onDeleteLink={handleDeleteLink}
            deleteBlockedReason={deleteBlockedReason}
            isBusy={isBusy}
            errorMessage={(msg) => toast.error(msg)}
          />
          <JointsPanel
            joints={design.joints}
            links={design.links}
            issues={issues}
            onAddJoint={handleAddJoint}
            onUpdateJoint={handleUpdateJoint}
            onDeleteJoint={handleDeleteJoint}
          />
        </div>
      </div>

      <UrdfPreview design={design} />
    </div>
  );
}
