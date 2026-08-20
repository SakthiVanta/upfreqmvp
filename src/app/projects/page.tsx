'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderPlus, Plus, Trash2, GitFork, X, Globe,
  ChevronLeft, ChevronRight, Check, Search, Loader2
} from 'lucide-react';
import { fetchProjects, createProject, deleteProject, UserProject, ProjectRepo } from '@/lib/user-projects';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';

const PAGE_SIZE = 8;

const CREATE_STEPS = ['Details', 'Repositories', 'Review'] as const;

export default function ProjectsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [projects, setProjects] = useState<UserProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Client-side filter over the already-fetched list — projects are few
  // enough per user that a round-trip per keystroke would be slower, not
  // more correct.
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [stepRepoUrl, setStepRepoUrl] = useState('');
  const [stepRepos, setStepRepos] = useState<ProjectRepo[]>([]);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

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

  const handleFinishCreate = async () => {
    const name = nameInput.trim();
    if (!name || isCreating) return;

    setIsCreating(true);
    try {
      const newProj = await createProject({
        name,
        description: descInput.trim() || "This robot's autonomy codebase",
        repos: stepRepos.map(r => ({ url: r.url, name: r.name })),
      });
      setProjects(prev => [newProj, ...prev]);
      resetCreateFlow();
      router.push(`/projects/${newProj.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create project.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    const ok = await confirm({
      message: 'Are you sure you want to delete this project? This cannot be undone.',
      confirmLabel: 'Delete Project',
      danger: true,
    });
    if (!ok) return;
    const prevProjects = projects;
    setProjects(prev => prev.filter(p => p.id !== id));
    try {
      await deleteProject(id);
    } catch (e: any) {
      setProjects(prevProjects);
      toast.error(e.message || 'Failed to delete project.');
    }
  };

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  // Every new search starts from page 1 — staying on whatever page you were
  // on could silently land you on a page past the end of the new results.
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paginatedProjects = useMemo(
    () => filteredProjects.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE),
    [filteredProjects, clampedPage]
  );

  return (
    <div className="space-y-8 font-sans pb-4">

      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-4xl sm:text-5xl font-display font-normal text-sand-50 tracking-tight">
            Projects
          </h1>
          <p className="text-sand-500 text-sm sm:text-base">
            Manage your projects here
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative order-2 sm:order-1">
            <Search className="h-3.5 w-3.5 text-sand-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects"
              className="w-full sm:w-48 md:w-64 pl-9 pr-8 py-2.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sand-500 hover:text-sand-200 cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="order-1 sm:order-2 btn-emerald-primary py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create New Project
          </button>
        </div>
      </div>

      {/* Create Project Stepper Modal */}
      {showCreateModal && (
        <ModalShell onClose={resetCreateFlow} title="Create New Robot Project" icon={FolderPlus}>
          <div className="space-y-5 text-xs">

            {/* Step Indicator */}
            <div className="flex items-center">
              {CREATE_STEPS.map((label, idx) => (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <div className={`h-6 w-6 flex items-center justify-center font-bold shrink-0 ${
                      idx < createStep ? 'bg-emerald-primary text-sand-950' :
                      idx === createStep ? 'bg-emerald-primary text-sand-950' :
                      'bg-sand-800 text-sand-500'
                    }`}>
                      {idx < createStep ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </div>
                    <span className={`font-bold whitespace-nowrap ${idx === createStep ? 'text-sand-50' : 'text-sand-500 hidden sm:inline'}`}>
                      {label}
                    </span>
                  </div>
                  {idx < CREATE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1.5 sm:mx-3 ${idx < createStep ? 'bg-emerald-primary' : 'bg-sand-800'}`} />
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
                    disabled={!stepRepoUrl.trim()}
                    className="px-4 py-2.5 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-lg font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title={stepRepoUrl.trim() ? undefined : 'Enter a repository URL first'}
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
                  disabled={isCreating}
                  className="btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isCreating ? 'Creating...' : 'Create Project'}
                </button>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* Projects Table */}
      {isLoading ? (
        <div className="minimal-card p-12 text-center">
          <Loader2 className="h-6 w-6 mx-auto text-sand-500 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="bg-rose-50 border border-rose-200 p-4 text-rose-700 text-xs">
          <span className="font-bold">Couldn&apos;t load projects: </span>{loadError}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="minimal-card overflow-hidden">
          <div className="h-[calc(100vh-15rem)] min-h-64 max-h-160 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-sand-925 border-b border-sand-700 text-sand-300 font-semibold text-xs uppercase tracking-wide">
                  <th className="py-3.5 px-4">Project</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-700">
                {paginatedProjects.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-sand-925 transition-colors cursor-pointer"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <td className="py-4 px-4 max-w-72">
                      <div className="font-bold text-base text-sand-50 truncate">{p.name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteProject(p.id)}
                          className="p-2 text-rose-700 hover:bg-rose-50 border border-rose-200 font-bold transition-all cursor-pointer"
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
              Showing {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, filteredProjects.length)} of {filteredProjects.length} project{filteredProjects.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={clampedPage <= 1}
                className="p-1.5 bg-sand-800 hover:bg-sand-700 text-sand-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-sand-700"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-sand-300 font-bold">Page {clampedPage} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={clampedPage >= totalPages}
                className="p-1.5 bg-sand-800 hover:bg-sand-700 text-sand-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-sand-700"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : searchQuery.trim() ? (
        <div className="minimal-card p-12 text-center space-y-4">
          <Search className="h-10 w-10 mx-auto text-sand-600" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-sand-50">No Projects Match &quot;{searchQuery}&quot;</h3>
            <p className="text-xs text-sand-500 max-w-md mx-auto">
              Try a different name, or clear the search to see all projects.
            </p>
          </div>
          <button
            onClick={() => setSearchQuery('')}
            className="btn-secondary-light py-2.5 px-5 text-xs cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="minimal-card p-12 text-center space-y-4">
          <Globe className="h-10 w-10 mx-auto text-sand-600" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-sand-50">No Projects Created Yet</h3>
            <p className="text-xs text-sand-500 max-w-md mx-auto">
              Group each robot&apos;s repositories into a project to run an AI audit.
            </p>
          </div>
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
