'use client';

import { useRef, useState } from 'react';
import { Sparkles, Loader2, X, Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { RobotJoint, JointType, Vec3 } from '@/lib/urdf/types';
import { loadBoundsMeters } from '@/lib/mesh/load-bounds';
import { generateTopologySuggestion, TopologySuggestion, TopologyBlueprint, BlueprintJointSuggestion } from '@/lib/user-robot-designs';
import { useToast } from '@/components/ui/toast';

export interface LinkMeshInfo {
  linkId: string;
  name: string;
  url: string;
  extension: 'stl' | 'obj' | 'glb' | 'gltf';
  scale?: number;
}

interface AiGeneratePanelProps {
  linkMeshes: LinkMeshInfo[];
  /** Existing links: AI measures real geometry, proposes names + a joint
   * tree with computed origins. */
  onApply: (renames: { id: string; name: string }[], newJoints: RobotJoint[]) => void;
  /** No links yet: AI proposes a structure from a text description alone —
   * brand new link names + a joint tree by name, origins always zero since
   * there's no real geometry to measure. */
  onApplyBlueprint: (linkNames: string[], joints: BlueprintJointSuggestion[]) => void;
}

// Meant to live inside a ModalShell (see the header's AI icon button in the
// builder page) — no card chrome of its own. Nothing here uploads, deletes,
// renames, or creates anything until "Confirm & Apply" is clicked — the
// review below always comes first.
export function AiGeneratePanel({ linkMeshes, onApply, onApplyBlueprint }: AiGeneratePanelProps) {
  const toast = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<TopologySuggestion | null>(null);
  const [blueprint, setBlueprint] = useState<TopologyBlueprint | null>(null);
  const [centersById, setCentersById] = useState<Map<string, Vec3>>(new Map());
  const [coincidentWarning, setCoincidentWarning] = useState<string | null>(null);
  const [contextText, setContextText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<{ query: string; start: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasLinks = linkMeshes.length >= 1;
  const descriptionRequired = !hasLinks;
  const canGenerate = hasLinks || contextText.trim().length > 0;

  // A "mention" is an active "@word" being typed right at the cursor — look
  // backward from the cursor for the nearest "@" with no whitespace between
  // it and the cursor. Plain text insertion (no rich-text/contenteditable),
  // so it's just "@name " dropped into the textarea at that position.
  const updateMentionState = (text: string, cursorPos: number) => {
    const upToCursor = text.slice(0, cursorPos);
    const atIndex = upToCursor.lastIndexOf('@');
    if (atIndex === -1) {
      setMentionQuery(null);
      return;
    }
    const between = upToCursor.slice(atIndex + 1);
    if (/\s/.test(between)) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery({ query: between, start: atIndex });
  };

  const mentionCandidates = mentionQuery
    ? linkMeshes.filter((l) => l.name.toLowerCase().includes(mentionQuery.query.toLowerCase()))
    : [];

  const insertMention = (name: string) => {
    if (!mentionQuery) return;
    const before = contextText.slice(0, mentionQuery.start);
    const after = contextText.slice(mentionQuery.start + 1 + mentionQuery.query.length);
    const insertion = `@${name} `;
    const newText = `${before}${insertion}${after}`;
    setContextText(newText);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    try {
      if (!hasLinks) {
        const result = await generateTopologySuggestion([], contextText.trim());
        if (result.mode === 'blueprint') setBlueprint(result.blueprint);
        return;
      }

      const measured = await Promise.all(
        linkMeshes.map(async (l) => {
          const { center, size } = await loadBoundsMeters(l);
          return { id: l.linkId, currentName: l.name, sizeM: size, centerM: center };
        })
      );
      setCentersById(new Map(measured.map((m) => [m.id, m.centerM])));

      // Individually-authored mesh files (e.g. official ROS package meshes,
      // where each part is centered in its own local frame and the real
      // assembly position lives only in a hand-written URDF) measure to the
      // same — often (0,0,0) — center regardless of where they actually sit
      // on the robot. That's structurally different from files exported
      // together from one CAD assembly with position preserved, which is
      // what this measurement approach actually requires. Flag it rather
      // than silently emitting a joint origin of (0,0,0) as if it were real.
      const coincidentPairs: string[] = [];
      for (let i = 0; i < measured.length; i++) {
        for (let j = i + 1; j < measured.length; j++) {
          const a = measured[i].centerM;
          const b = measured[j].centerM;
          const dist = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
          if (dist < 0.001) coincidentPairs.push(`${measured[i].currentName} & ${measured[j].currentName}`);
        }
      }
      setCoincidentWarning(
        coincidentPairs.length > 0
          ? `${coincidentPairs.join(', ')} measured to the same position. Their mesh files likely don't share a common coordinate system (common for individually-sourced or official-package meshes, where each part is centered in its own local frame) — the joint origin between them below is probably wrong. Enter the real offset manually.`
          : null
      );

      const result = await generateTopologySuggestion(measured, contextText.trim() || undefined);
      if (result.mode === 'topology') setSuggestion(result.suggestion);
    } catch (e: any) {
      toast.error(e.message || 'AI generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = () => {
    if (!suggestion) return;
    const renames = suggestion.links.map((l) => ({ id: l.id, name: l.name }));

    const newJoints: RobotJoint[] = [];
    for (const j of suggestion.joints) {
      const parentCenter = centersById.get(j.parentId);
      const childCenter = centersById.get(j.childId);
      if (!parentCenter || !childCenter) continue;
      newJoints.push({
        id: crypto.randomUUID(),
        name: j.name,
        type: j.type as JointType,
        parentLinkId: j.parentId,
        childLinkId: j.childId,
        origin: {
          xyz: { x: childCenter.x - parentCenter.x, y: childCenter.y - parentCenter.y, z: childCenter.z - parentCenter.z },
          rpy: { x: 0, y: 0, z: 0 },
        },
        axis: j.axis,
      });
    }

    onApply(renames, newJoints);
    setSuggestion(null);
  };

  const handleConfirmBlueprint = () => {
    if (!blueprint) return;
    onApplyBlueprint(blueprint.linkNames, blueprint.joints);
    setBlueprint(null);
  };

  return (
    <div className="space-y-3 text-xs">
      {!suggestion && !blueprint && (
        <>
          <p className="text-sand-400">
            {hasLinks
              ? 'Measures the links you already uploaded (real bounding-box size and position) and asks AI to propose names and a joint tree — pure geometry sent, no mesh data. Nothing changes until you review and confirm below.'
              : 'No links yet — describe the robot you want and AI will propose a starting structure (names + a joint tree) with no positions guessed. You attach real mesh files to each link afterward, then re-run Generate to compute real joint origins from the measured geometry.'}
          </p>

          <div className="relative">
            <label className="block text-sand-500 font-bold mb-1">
              {descriptionRequired ? 'Describe your robot (required)' : 'Additional context (optional)'}
            </label>
            <textarea
              ref={textareaRef}
              value={contextText}
              rows={3}
              onChange={(e) => {
                setContextText(e.target.value);
                updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
              }}
              onKeyUp={(e) => updateMentionState(contextText, e.currentTarget.selectionStart ?? 0)}
              onClick={(e) => updateMentionState(contextText, e.currentTarget.selectionStart ?? 0)}
              onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
              placeholder={
                hasLinks
                  ? 'e.g. @left_tire and @right_tire are drive wheels, not casters. Type @ to reference an uploaded part.'
                  : 'e.g. A 4-wheel differential-drive rover with a lidar mounted on top and a camera at the front.'
              }
              className="w-full px-3 py-2 rounded-lg border border-sand-700 bg-sand-950 text-sand-100 focus:outline-none focus:border-emerald-primary resize-none"
            />
            {mentionQuery && mentionCandidates.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-sand-900 border border-sand-700 rounded-lg shadow-lg">
                {mentionCandidates.map((l) => (
                  <button
                    key={l.linkId}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertMention(l.name)}
                    className="w-full text-left px-3 py-1.5 text-sand-100 hover:bg-sand-800 cursor-pointer"
                  >
                    @{l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            title={canGenerate ? undefined : 'Describe the robot first'}
            className="btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isGenerating ? 'Analyzing...' : 'Generate'}
          </button>
        </>
      )}

      {suggestion && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-primary flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Proposed {suggestion.links.length} name{suggestion.links.length === 1 ? '' : 's'} + {suggestion.joints.length} joint
              {suggestion.joints.length === 1 ? '' : 's'} — review before applying
            </span>
            <button onClick={() => setSuggestion(null)} className="text-sand-500 hover:text-sand-200 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {suggestion.reasoningSummary && <p className="text-sand-500">{suggestion.reasoningSummary}</p>}

          {coincidentWarning && (
            <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{coincidentWarning}</span>
            </div>
          )}

          <div className="space-y-1">
            {suggestion.links.map((l) => {
              const original = linkMeshes.find((m) => m.linkId === l.id)?.name;
              return (
                <div key={l.id} className="flex items-center gap-1.5 text-sand-300">
                  <span className="text-sand-500 truncate">{original ?? l.id}</span>
                  <ArrowRight className="h-3 w-3 text-sand-600 shrink-0" />
                  <span className="font-bold text-sand-100 truncate">{l.name}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-1">
            {suggestion.joints.map((j, i) => {
              const parentName = suggestion.links.find((l) => l.id === j.parentId)?.name ?? j.parentId;
              const childName = suggestion.links.find((l) => l.id === j.childId)?.name ?? j.childId;
              return (
                <div key={i} className="flex items-center gap-1.5 text-sand-300">
                  <span className="font-bold text-sand-100 truncate">{parentName}</span>
                  <ArrowRight className="h-3 w-3 text-sand-600 shrink-0" />
                  <span className="font-bold text-sand-100 truncate">{childName}</span>
                  <span className="text-sand-500 shrink-0">({j.type})</span>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleConfirm}
            className="btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            Confirm & Apply
          </button>
        </div>
      )}

      {blueprint && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-primary flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Proposed {blueprint.linkNames.length} link{blueprint.linkNames.length === 1 ? '' : 's'} + {blueprint.joints.length} joint
              {blueprint.joints.length === 1 ? '' : 's'} — review before applying
            </span>
            <button onClick={() => setBlueprint(null)} className="text-sand-500 hover:text-sand-200 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {blueprint.reasoningSummary && <p className="text-sand-500">{blueprint.reasoningSummary}</p>}

          <p className="text-sand-600">
            Links will be created with no mesh attached — origins default to (0,0,0) since there&apos;s no geometry to
            measure yet. Attach a file to each link afterward, then re-run Generate to compute real joint origins.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {blueprint.linkNames.map((name) => (
              <span key={name} className="px-2 py-1 rounded bg-sand-950 border border-sand-800 font-bold text-sand-100">
                {name}
              </span>
            ))}
          </div>

          <div className="space-y-1">
            {blueprint.joints.map((j, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sand-300">
                <span className="font-bold text-sand-100 truncate">{j.parentName}</span>
                <ArrowRight className="h-3 w-3 text-sand-600 shrink-0" />
                <span className="font-bold text-sand-100 truncate">{j.childName}</span>
                <span className="text-sand-500 shrink-0">({j.type})</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleConfirmBlueprint}
            className="btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            Confirm & Create Links
          </button>
        </div>
      )}
    </div>
  );
}
