'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderPlus, Plus, Trash2, GitFork, X, Globe, Sparkles,
  Loader2, AlertTriangle, Bot, Eye, ChevronLeft, ChevronRight
} from 'lucide-react';
import { RobotProfile, createDynamicRobotProfileFromUrl } from '@/lib/robot-profile';
import { saveRobotToLibrary } from '@/lib/robot-library';
import { useAuth } from '@/lib/auth-context';
import { StreamHud } from '@/components/agent/stream-hud';
import { CodebaseReview } from '@/components/dashboard/codebase-review';

interface ProjectRepo {
  id: string;
  url: string;
  name: string;
}

interface UserProject {
  id: string;
  name: string;
  description: string;
  repos: ProjectRepo[];
  isAudited: boolean;
  auditedRobotProfile?: RobotProfile;
}

const PAGE_SIZE = 8;

export default function ProjectsPage() {
  const { selectedRobot, setSelectedRobot, setIngestedRepoUrl } = useAuth();

  const [projects, setProjects] = useState<UserProject[]>([]);
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [repoUrlInput, setRepoUrlInput] = useState<Record<string, string>>({});

  // Only one audit runs at a time; tracked by which project it belongs to.
  // lastAuditProjectId stays set after completion so the resulting logs/error
  // are attributed to the right project even once auditingProjectId clears.
  const [auditingProjectId, setAuditingProjectId] = useState<string | null>(null);
  const [lastAuditProjectId, setLastAuditProjectId] = useState<string | null>(null);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Project detail is a modal now, not an inline accordion — this holds
  // which project's modal is open.
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('upfreq_user_projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // A robot loaded elsewhere (Robot Library, marketing page ingest) that
  // isn't yet tracked as a project here still needs to surface as one —
  // "project" is the robot's home, so materialize it rather than showing
  // the loaded robot in a separate, disconnected place.
  useEffect(() => {
    if (!selectedRobot) return;
    setProjects(prev => {
      const alreadyTracked = prev.some(p =>
        p.repos.some(r => r.url === selectedRobot.repoUrl) || p.auditedRobotProfile?.id === selectedRobot.id
      );
      if (alreadyTracked) return prev;

      const newProj: UserProject = {
        id: `proj_${Date.now()}`,
        name: selectedRobot.name,
        description: selectedRobot.description || `Autonomy codebase for ${selectedRobot.name}`,
        repos: [{ id: `repo_${Date.now()}`, url: selectedRobot.repoUrl, name: selectedRobot.repoUrl.split('/').pop() || selectedRobot.id }],
        isAudited: true,
        auditedRobotProfile: selectedRobot,
      };
      const next = [newProj, ...prev];
      localStorage.setItem('upfreq_user_projects', JSON.stringify(next));
      setViewingProjectId(newProj.id);
      return next;
    });
  }, [selectedRobot]);

  const saveProjects = (next: UserProject[]) => {
    setProjects(next);
    localStorage.setItem('upfreq_user_projects', JSON.stringify(next));
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    const newProj: UserProject = {
      id: `proj_${Date.now()}`,
      name: nameInput.trim(),
      description: descInput.trim() || "This robot's autonomy codebase",
      repos: [],
      isAudited: false
    };

    saveProjects([newProj, ...projects]);
    setNameInput('');
    setDescInput('');
    setShowCreateModal(false);
    setPage(1);
  };

  const handleDeleteProject = (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    const next = projects.filter(p => p.id !== id);
    saveProjects(next);
    const activeId = localStorage.getItem('upfreq_active_project_id');
    if (activeId === id) {
      localStorage.removeItem('upfreq_active_project_id');
    }
    if (viewingProjectId === id) setViewingProjectId(null);
  };

  const handleAddRepo = (projectId: string) => {
    const url = repoUrlInput[projectId]?.trim();
    if (!url) return;

    const repoName = url.split('/').pop() || 'robotics_repo';
    const next = projects.map(p => {
      if (p.id === projectId) {
        if (p.repos.some(r => r.url === url)) return p;
        return {
          ...p,
          repos: [...p.repos, { id: `repo_${Date.now()}`, url, name: repoName }]
        };
      }
      return p;
    });

    saveProjects(next);
    setRepoUrlInput(prev => ({ ...prev, [projectId]: '' }));
  };

  const handleRemoveRepo = (projectId: string, repoId: string) => {
    const next = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          repos: p.repos.filter(r => r.id !== repoId)
        };
      }
      return p;
    });
    saveProjects(next);
  };

  // Run the real agentic /api/analyze audit for a single project (robot),
  // streaming live logs into its modal and writing the resulting
  // RobotProfile back onto it once complete.
  const handleRunAudit = async (project: UserProject) => {
    if (project.repos.length === 0 || auditingProjectId) return;

    setAuditingProjectId(project.id);
    setLastAuditProjectId(project.id);
    setStreamLogs([]);
    setStreamError(null);
    setViewingProjectId(project.id);

    const targetUrls = project.repos.map(r => r.url);
    const primaryUrl = targetUrls[0];
    setIngestedRepoUrl(primaryUrl);

    let parsedResult: any = null;

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: primaryUrl, multiRepoUrls: targetUrls })
      });

      if (!res.ok || !res.body) {
        throw new Error('Audit API failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.log) setStreamLogs(prev => [...prev, data.log]);
            if (data.stage === 'ERROR') {
              setStreamError(data.message || 'ROS validation failed.');
            }
            if (data.stage === 'COMPLETE' && data.result) {
              parsedResult = data.result;
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      setStreamError('Network error reaching the analysis stream.');
    }

    if (parsedResult) {
      const dynamicProfile = createDynamicRobotProfileFromUrl(primaryUrl, parsedResult);
      saveRobotToLibrary(dynamicProfile);

      const nextProjects = projects.map(p =>
        p.id === project.id
          ? { ...p, isAudited: true, auditedRobotProfile: dynamicProfile }
          : p
      );
      saveProjects(nextProjects);

      setSelectedRobot(dynamicProfile);
      localStorage.setItem('upfreq_active_project_id', project.id);
    }

    setAuditingProjectId(null);
  };

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paginatedProjects = useMemo(
    () => projects.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE),
    [projects, clampedPage]
  );

  const viewingProject = projects.find(p => p.id === viewingProjectId) || null;

  return (
    <div className="space-y-8 font-sans pb-16">

      {/* Title Bar */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-display font-extrabold text-sand-50 tracking-tight">
          Projects
        </h1>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-emerald-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <FolderPlus className="h-4 w-4" />
          Create New Project
        </button>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <ModalShell onClose={() => setShowCreateModal(false)} title="Create New Robot Project" icon={FolderPlus}>
          <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
            <div>
              <label className="block text-sand-300 font-bold mb-1">Robot / Project Name:</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Autonomous Mobile Delivery Robot"
                className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
              />
            </div>

            <div>
              <label className="block text-sand-300 font-bold mb-1">Description:</label>
              <input
                type="text"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="ROS 2 Humble Slam, Nav2, and Hardware sub-packages"
                className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-300 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-emerald-primary py-2 px-4 text-xs font-bold cursor-pointer"
              >
                Create Project
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Projects Table */}
      {projects.length > 0 ? (
        <div className="minimal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-sand-925 border-b border-sand-800 text-sand-300 font-semibold text-xs uppercase tracking-wide">
                  <th className="py-3.5 px-4">Project</th>
                  <th className="py-3.5 px-4">Repos</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Robots Found</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-800">
                {paginatedProjects.map((p) => {
                  const isAuditingThis = auditingProjectId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-sand-925/60 transition-colors cursor-pointer" onClick={() => setViewingProjectId(p.id)}>
                      <td className="py-4 px-4 max-w-72">
                        <div className="font-bold text-base text-sand-50 truncate">{p.name}</div>
                        <div className="text-xs text-sand-500 truncate">{p.description}</div>
                      </td>
                      <td className="py-4 px-4 text-sand-300">
                        {p.repos.length}
                      </td>
                      <td className="py-4 px-4">
                        {isAuditingThis ? (
                          <span className="px-2.5 py-1 rounded-full bg-sand-800 text-sand-300 border border-sand-700 text-xs font-bold flex items-center gap-1.5 w-fit">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Auditing
                          </span>
                        ) : p.isAudited && p.auditedRobotProfile ? (
                          p.auditedRobotProfile.usedAgenticAnalysis ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-light text-emerald-text border border-emerald-border text-xs font-bold flex items-center gap-1.5 w-fit">
                              <Bot className="h-3.5 w-3.5" /> Gemini Agent
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1.5 w-fit">
                              <AlertTriangle className="h-3.5 w-3.5" /> Heuristic Fallback
                            </span>
                          )
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-sand-800 text-sand-500 border border-sand-700 text-xs font-bold w-fit">
                            Not Audited
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-sand-300">
                        {p.isAudited && p.auditedRobotProfile ? (p.auditedRobotProfile.robotVariants || []).length : '—'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setViewingProjectId(p.id)}
                            className="p-2 text-sand-300 hover:text-sand-50 hover:bg-sand-800 rounded-lg border border-sand-700 transition-all cursor-pointer"
                            title="View Project"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(p.id)}
                            className="p-2 text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 font-bold transition-all cursor-pointer"
                            title="Delete Project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-sand-800 bg-sand-925/60 text-xs">
            <span className="text-sand-500">
              Showing {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, projects.length)} of {projects.length} project{projects.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={clampedPage <= 1}
                className="p-1.5 rounded-lg bg-sand-800 hover:bg-sand-700 text-sand-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-sand-700"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-sand-300 font-bold">Page {clampedPage} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={clampedPage >= totalPages}
                className="p-1.5 rounded-lg bg-sand-800 hover:bg-sand-700 text-sand-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-sand-700"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="minimal-card p-12 text-center space-y-4">
          <Globe className="h-10 w-10 mx-auto text-sand-600" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-sand-50">No Projects Created Yet</h3>
            <p className="text-xs text-sand-500 max-w-md mx-auto">
              Create a project for each robot to group its GitHub repositories and run an AI audit against its autonomy codebase.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-emerald-primary py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" />
            Create First Project
          </button>
        </div>
      )}

      {/* Project Detail Modal */}
      {viewingProject && (
        <ModalShell onClose={() => setViewingProjectId(null)} title={viewingProject.name} icon={GitFork} wide>
          <div className="space-y-5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sand-400 flex-1 min-w-0">{viewingProject.description}</p>
              {viewingProject.isAudited && viewingProject.auditedRobotProfile && (
                viewingProject.auditedRobotProfile.usedAgenticAnalysis ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-light text-emerald-text border border-emerald-border text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <Bot className="h-3 w-3" /> Gemini Agent
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <AlertTriangle className="h-3 w-3" /> Heuristic Fallback
                  </span>
                )
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={repoUrlInput[viewingProject.id] || ''}
                onChange={(e) => setRepoUrlInput({ ...repoUrlInput, [viewingProject.id]: e.target.value })}
                placeholder="https://github.com/org/sub-repo"
                className="flex-1 px-3.5 py-2 rounded-xl border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary min-w-0"
              />
              <button
                onClick={() => handleAddRepo(viewingProject.id)}
                className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-xl font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4 text-emerald-primary" />
                Add Sub-Repo
              </button>
            </div>

            {viewingProject.repos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {viewingProject.repos.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-sand-950 rounded-xl border border-sand-800">
                    <div className="flex items-center gap-2 truncate">
                      <GitFork className="h-3.5 w-3.5 text-emerald-primary shrink-0" />
                      <span className="font-bold text-sand-100 truncate">{r.name}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveRepo(viewingProject.id, r.id)}
                      className="p-1 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer"
                      title="Remove Sub-Repo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sand-600 italic">No sub-repositories attached to this project yet — add one above, then run the AI audit.</p>
            )}

            {viewingProject.repos.length > 0 && (
              <button
                onClick={() => handleRunAudit(viewingProject)}
                disabled={!!auditingProjectId}
                className="btn-emerald-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {auditingProjectId === viewingProject.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {auditingProjectId === viewingProject.id ? 'Auditing...' : viewingProject.isAudited ? 'Re-run AI Audit' : 'Run AI Audit'}
              </button>
            )}

            {auditingProjectId === viewingProject.id && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <StreamHud isStreaming logs={streamLogs} repoName={viewingProject.name} />
              </div>
            )}

            {auditingProjectId !== viewingProject.id && streamError && lastAuditProjectId === viewingProject.id && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-700">
                <span className="font-bold">AUDIT NOTICE: </span>{streamError}
              </div>
            )}

            {/* Codebase Review — the two-thing AI summary: which robots this
                codebase defines, and a fixed autonomy-feature checklist.
                Parameter Matrix / 3D Studio / full deep-dive explorer are
                out of scope for Phase 1 and stay commented out below. */}
            {viewingProject.isAudited && viewingProject.auditedRobotProfile && (
              <div className="pt-4 border-t border-sand-800 space-y-4">
                <div className="text-xs font-bold text-sand-100 uppercase tracking-wider">
                  Codebase Review
                </div>
                <CodebaseReview robot={viewingProject.auditedRobotProfile} />
              </div>
            )}

            {/*
            {viewingProject.isAudited && viewingProject.auditedRobotProfile && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => goToRobot(viewingProject.auditedRobotProfile!, '/matrix')}>Parameter Matrix</button>
                <button onClick={() => goToRobot(viewingProject.auditedRobotProfile!, '/studio')}>3D Studio</button>
              </div>
            )}
            */}
          </div>
        </ModalShell>
      )}

    </div>
  );
}

function ModalShell({
  onClose,
  title,
  icon: Icon,
  wide,
  children,
}: {
  onClose: () => void;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-sand-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={`minimal-card w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-top-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-sand-800 p-4 sm:p-5 shrink-0">
          <h3 className="text-sm font-bold text-sand-50 flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 text-emerald-primary shrink-0" />
            <span className="truncate">{title}</span>
          </h3>
          <button onClick={onClose} className="text-sand-500 hover:text-sand-50 p-1 rounded-lg hover:bg-sand-800 cursor-pointer shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
