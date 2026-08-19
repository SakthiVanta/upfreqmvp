'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderPlus, Plus, Trash2, GitFork, X, Globe,
  AlertTriangle, Bot, Eye, ChevronLeft, ChevronRight, Check
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { loadUserProjects, saveUserProjects, UserProject, ProjectRepo } from '@/lib/user-projects';

const PAGE_SIZE = 8;

const CREATE_STEPS = ['Details', 'Repositories', 'Review'] as const;

export default function ProjectsPage() {
  const router = useRouter();
  const { selectedRobot } = useAuth();

  const [projects, setProjects] = useState<UserProject[]>([]);
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [stepRepoUrl, setStepRepoUrl] = useState('');
  const [stepRepos, setStepRepos] = useState<ProjectRepo[]>([]);

  useEffect(() => {
    setProjects(loadUserProjects());
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
      saveUserProjects(next);
      return next;
    });
  }, [selectedRobot]);

  const saveProjects = (next: UserProject[]) => {
    setProjects(next);
    saveUserProjects(next);
  };

  const resetCreateFlow = () => {
    setShowCreateModal(false);
    setCreateStep(0);
    setNameInput('');
    setDescInput('');
    setStepRepoUrl('');
    setStepRepos([]);
  };

  const handleAddStepRepo = () => {
    const url = stepRepoUrl.trim();
    if (!url || stepRepos.some(r => r.url === url)) return;
    const repoName = url.split('/').pop() || 'robotics_repo';
    setStepRepos(prev => [...prev, { id: `repo_${Date.now()}`, url, name: repoName }]);
    setStepRepoUrl('');
  };

  const handleFinishCreate = () => {
    if (!nameInput.trim()) return;

    const newProj: UserProject = {
      id: `proj_${Date.now()}`,
      name: nameInput.trim(),
      description: descInput.trim() || "This robot's autonomy codebase",
      repos: stepRepos,
      isAudited: false
    };

    saveProjects([newProj, ...projects]);
    resetCreateFlow();
    router.push(`/projects/${newProj.id}`);
  };

  const handleDeleteProject = (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    const next = projects.filter(p => p.id !== id);
    saveProjects(next);
    const activeId = localStorage.getItem('upfreq_active_project_id');
    if (activeId === id) {
      localStorage.removeItem('upfreq_active_project_id');
    }
  };

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paginatedProjects = useMemo(
    () => projects.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE),
    [projects, clampedPage]
  );

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

      {/* Create Project Stepper Modal */}
      {showCreateModal && (
        <ModalShell onClose={resetCreateFlow} title="Create New Robot Project" icon={FolderPlus}>
          <div className="space-y-5 text-xs">

            {/* Step Indicator */}
            <div className="flex items-center">
              {CREATE_STEPS.map((label, idx) => (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold shrink-0 ${
                      idx < createStep ? 'bg-emerald-primary text-sand-950' :
                      idx === createStep ? 'bg-emerald-primary text-sand-950' :
                      'bg-sand-800 text-sand-500'
                    }`}>
                      {idx < createStep ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </div>
                    <span className={`font-bold whitespace-nowrap ${idx === createStep ? 'text-sand-50' : 'text-sand-500'}`}>
                      {label}
                    </span>
                  </div>
                  {idx < CREATE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 ${idx < createStep ? 'bg-emerald-primary' : 'bg-sand-800'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step 1: Details */}
            {createStep === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sand-300 font-bold mb-1">Robot / Project Name:</label>
                  <input
                    type="text"
                    required
                    autoFocus
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
              </div>
            )}

            {/* Step 2: Repositories */}
            {createStep === 1 && (
              <div className="space-y-4">
                <p className="text-sand-500">Attach one or more GitHub repositories now, or skip and add them later.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={stepRepoUrl}
                    onChange={(e) => setStepRepoUrl(e.target.value)}
                    placeholder="https://github.com/org/repo"
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary min-w-0"
                  />
                  <button
                    onClick={handleAddStepRepo}
                    className="px-4 py-2.5 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-lg font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-emerald-primary" />
                    Add
                  </button>
                </div>
                {stepRepos.length > 0 && (
                  <div className="space-y-2">
                    {stepRepos.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-2.5 bg-sand-950 rounded-lg border border-sand-800">
                        <div className="flex items-center gap-2 truncate">
                          <GitFork className="h-3.5 w-3.5 text-emerald-primary shrink-0" />
                          <span className="font-bold text-sand-100 truncate">{r.name}</span>
                        </div>
                        <button
                          onClick={() => setStepRepos(prev => prev.filter(x => x.id !== r.id))}
                          className="p-1 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {createStep === 2 && (
              <div className="space-y-3">
                <div className="p-3.5 bg-sand-950 rounded-lg border border-sand-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sand-500">Name:</span>
                    <span className="font-bold text-sand-100">{nameInput || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-500">Description:</span>
                    <span className="font-bold text-sand-100 text-right">{descInput || "This robot's autonomy codebase"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-500">Repositories:</span>
                    <span className="font-bold text-sand-100">{stepRepos.length}</span>
                  </div>
                </div>
                <p className="text-sand-500">You can run the AI audit right after creating the project.</p>
              </div>
            )}

            {/* Step Navigation */}
            <div className="flex justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => (createStep === 0 ? resetCreateFlow() : setCreateStep(s => s - 1))}
                className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-300 rounded-lg font-semibold cursor-pointer"
              >
                {createStep === 0 ? 'Cancel' : 'Back'}
              </button>
              {createStep < CREATE_STEPS.length - 1 ? (
                <button
                  type="button"
                  disabled={createStep === 0 && !nameInput.trim()}
                  onClick={() => setCreateStep(s => s + 1)}
                  className="btn-emerald-primary py-2 px-4 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishCreate}
                  className="btn-emerald-primary py-2 px-4 text-xs font-bold cursor-pointer"
                >
                  Create Project
                </button>
              )}
            </div>
          </div>
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
                {paginatedProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-sand-925/60 transition-colors cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                    <td className="py-4 px-4 max-w-72">
                      <div className="font-bold text-base text-sand-50 truncate">{p.name}</div>
                      <div className="text-xs text-sand-500 truncate">{p.description}</div>
                    </td>
                    <td className="py-4 px-4 text-sand-300">
                      {p.repos.length}
                    </td>
                    <td className="py-4 px-4">
                      {p.isAudited && p.auditedRobotProfile ? (
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
                          onClick={() => router.push(`/projects/${p.id}`)}
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
                ))}
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
