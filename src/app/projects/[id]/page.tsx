'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Trash2, X, Loader2, Bot, AlertTriangle, Pencil, Terminal,
  ChevronDown, ChevronUp, Cpu, Monitor, Clock,
} from 'lucide-react';
import { fetchProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject, UserProject } from '@/lib/user-projects';
import { fetchRobots, McpRobot } from '@/lib/user-robots';
import { fetchWorkspaces, WorkspaceRegistration } from '@/lib/user-workspaces';
import { CodebaseReview } from '@/components/dashboard/codebase-review';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { ClaudeMcpModal } from '@/components/mcp/claude-mcp-modal';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const projectId = params.id as string;

  const [project, setProject] = useState<UserProject | null | undefined>(undefined);
  const [robots, setRobots] = useState<McpRobot[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRegistration[]>([]);
  const [showMcpModal, setShowMcpModal] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchProject(projectId).then(found => {
      if (cancelled) return;
      setProject(found);
    });
    fetchRobots(projectId).then(r => { if (!cancelled) setRobots(r); }).catch(() => {});
    fetchWorkspaces(projectId).then(w => { if (!cancelled) setWorkspaces(w); }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  const openEditModal = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description);
    setEditModalOpen(true);
  };

  const handleSaveProjectDetails = async () => {
    if (!editName.trim()) return;
    const updated = await apiUpdateProject(projectId, { name: editName.trim(), description: editDescription.trim() });
    if (updated) setProject(updated);
    setEditModalOpen(false);
  };

  const handleDeleteProject = async () => {
    const ok = await confirm({
      message: 'Are you sure you want to delete this project? This cannot be undone.',
      confirmLabel: 'Delete Project',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteProject(projectId);
      router.push('/projects');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete project.');
    }
  };

  if (project === undefined) {
    return (
      <div className="minimal-card p-12 text-center">
        <Loader2 className="h-6 w-6 mx-auto text-sand-500 animate-spin" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="minimal-card p-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-sand-50">Project Not Found</h2>
        <p className="text-xs text-sand-500">This project may have been deleted.</p>
        <button
          onClick={() => router.push('/projects')}
          className="btn-emerald-primary py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
      </div>
    );
  }

  const hasLegacyAudit = project.isAudited && !!project.auditedRobotProfile;
  const hasAnyRobots = hasLegacyAudit || robots.length > 0;

  return (
    <div className="space-y-6 font-sans pb-16 w-full">

      <button
        onClick={() => router.push('/projects')}
        className="flex items-center gap-1.5 text-xs font-bold text-sand-400 hover:text-sand-100 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-3xl font-display font-extrabold text-sand-50 tracking-tight">{project.name}</h1>
          <p className="text-sm text-sand-500 mt-1">{project.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasLegacyAudit && project.auditedRobotProfile && (
            project.auditedRobotProfile.usedAgenticAnalysis ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-light text-emerald-text border border-emerald-border text-xs font-bold flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" /> AI Agent
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Heuristic Fallback
              </span>
            )
          )}
          <button
            onClick={openEditModal}
            className="p-2 text-sand-300 hover:text-sand-50 hover:bg-sand-800 rounded-lg border border-sand-700 transition-all cursor-pointer"
            title="Edit Project"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={handleDeleteProject}
            className="p-2 text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 font-bold transition-all cursor-pointer"
            title="Delete Project"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {editModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-sand-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => setEditModalOpen(false)}
        >
          <div
            className="minimal-card w-full max-w-md max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-top-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-sand-800 p-4 sm:p-5 shrink-0">
              <h3 className="text-sm font-bold text-sand-50">Edit Project</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-sand-500 hover:text-sand-50 p-1 rounded-lg hover:bg-sand-800 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs">
              <div>
                <label className="block text-sand-300 font-bold mb-1">Project Name:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
                />
              </div>
              <div>
                <label className="block text-sand-300 font-bold mb-1">Description:</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-sand-800 p-4 sm:p-5 shrink-0">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-300 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProjectDetails}
                className="btn-emerald-primary py-2 px-4 text-xs font-bold cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Robots for this project are created and kept up to date via Claude
          Code / Cursor over MCP, not from this page — this just reflects
          whatever's been saved via upfreq.robot.save_robot (plus any legacy
          audited profile from before the GitHub-audit flow was retired). */}
      {hasLegacyAudit && project.auditedRobotProfile && (
        <div className="minimal-card p-5 sm:p-6">
          <CodebaseReview
            robot={project.auditedRobotProfile}
            onUpdate={(updated) => {
              setProject(prev => (prev ? { ...prev, auditedRobotProfile: updated } : prev));
              apiUpdateProject(projectId, { auditedRobotProfile: updated }).catch(() => {});
            }}
          />
        </div>
      )}

      {robots.length > 0 && <McpRobotsCard robots={robots} />}

      {!hasAnyRobots && (
        <div className="minimal-card p-8 sm:p-12 space-y-6 text-center">
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="font-display font-normal text-sand-500 tracking-tight text-xl sm:text-2xl">
              No Robots Yet
            </h2>
            <p className="text-sm text-sand-500">
              Robots for this project are created and kept up to date via Claude Code or Cursor, connected over MCP — not from this page.
            </p>
          </div>
          <button
            onClick={() => setShowMcpModal(true)}
            className="btn-emerald-primary py-3 px-6 text-sm font-bold flex items-center gap-2 cursor-pointer mx-auto"
          >
            <Terminal className="h-4 w-4" />
            Connect Claude Code (MCP)
          </button>
        </div>
      )}

      {workspaces.length > 0 && <WorkspacesCard workspaces={workspaces} />}

      {showMcpModal && (
        <ClaudeMcpModal onClose={() => setShowMcpModal(false)} />
      )}

    </div>
  );
}

function McpRobotsCard({ robots }: { robots: McpRobot[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="minimal-card p-5 sm:p-6 space-y-4">
      <h3 className="text-[11px] font-bold text-sand-500 uppercase tracking-wider flex items-center gap-1.5">
        <Bot className="h-3.5 w-3.5" /> Robots ({robots.length})
      </h3>
      <div className="space-y-2.5">
        {robots.map((r) => {
          const expanded = expandedId === r.id;
          return (
            <div key={r.id} className="border border-sand-800 bg-sand-950 rounded-lg overflow-hidden text-xs">
              <button
                onClick={() => setExpandedId(expanded ? null : r.id)}
                className="w-full flex items-center justify-between gap-3 p-3.5 text-left cursor-pointer"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sand-50">{r.name}</span>
                    {r.driveType && (
                      <span className="px-1.5 py-0.5 bg-sand-900 border border-sand-700 text-sand-400 font-mono text-[10px] rounded">
                        {r.driveType}
                      </span>
                    )}
                    {r.chassis.massKg != null && (
                      <span className="text-sand-500 font-mono text-[10px]">{r.chassis.massKg}kg</span>
                    )}
                  </div>
                  {r.sensors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.sensors.map((s) => (
                        <span key={s} className="px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-900 text-emerald-400 text-[10px] rounded">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                {r.urdfXacroXml && (expanded ? <ChevronUp className="h-4 w-4 text-sand-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-sand-500 shrink-0" />)}
              </button>
              {expanded && r.urdfXacroXml && (
                <pre className="p-3.5 pt-0 text-[10px] text-sand-400 font-mono overflow-x-auto whitespace-pre-wrap break-all">{r.urdfXacroXml}</pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkspacesCard({ workspaces }: { workspaces: WorkspaceRegistration[] }) {
  return (
    <div className="minimal-card p-5 sm:p-6 space-y-4">
      <h3 className="text-[11px] font-bold text-sand-500 uppercase tracking-wider flex items-center gap-1.5">
        <Monitor className="h-3.5 w-3.5" /> Local Workspaces ({workspaces.length})
      </h3>
      <div className="space-y-2">
        {workspaces.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-3 p-3 bg-sand-950 border border-sand-800 rounded-lg text-xs">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 font-mono text-sand-300 truncate">
                <Cpu className="h-3 w-3 text-sand-500 shrink-0" />
                {w.machineId.slice(0, 8)}
              </div>
              <div className="font-mono text-sand-500 truncate" title={w.localPath}>{w.localPath}</div>
            </div>
            <div className="flex items-center gap-1.5 text-sand-500 shrink-0 whitespace-nowrap">
              <Clock className="h-3 w-3" />
              {new Date(w.lastSeenAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
