'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, GitFork, X, Sparkles,
  Loader2, AlertTriangle, Bot, ChevronDown, ChevronUp, Check, Pencil
} from 'lucide-react';
import { fetchProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject, UserProject } from '@/lib/user-projects';
import { CodebaseReview } from '@/components/dashboard/codebase-review';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const projectId = params.id as string;

  const [project, setProject] = useState<UserProject | null | undefined>(undefined);
  const [repoUrlInput, setRepoUrlInput] = useState('');
  // Collapsed by default once a project is already audited — repo setup is
  // secondary at that point and shouldn't compete with the Codebase Review.
  const [repoSectionOpen, setRepoSectionOpen] = useState(false);

  const [isAuditing, setIsAuditing] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchProject(projectId).then(found => {
      if (cancelled) return;
      setProject(found);
      setRepoSectionOpen(!found?.isAudited);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleAddRepo = async () => {
    const url = repoUrlInput.trim();
    if (!url || !project) return;
    if (project.repos.some(r => r.url === url)) return;

    setRepoUrlInput('');
    const updated = await apiUpdateProject(projectId, { addRepo: { url } });
    if (updated) setProject(updated);
  };

  const handleRemoveRepo = async (repoId: string) => {
    const updated = await apiUpdateProject(projectId, { removeRepoId: repoId });
    if (updated) setProject(updated);
  };

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

  // Run the real agentic /api/analyze audit for this project, streaming live
  // logs into the page and writing the resulting RobotProfile back onto it
  // once complete — reads the freshest project data from storage directly
  // rather than a closed-over React variable, so a slow audit always saves
  // against current state even if something else changed it meanwhile.
  const handleRunAudit = async () => {
    if (!project || project.repos.length === 0 || isAuditing) return;

    setIsAuditing(true);
    setStreamLogs([]);
    setStreamError(null);

    const targetUrls = project.repos.map(r => r.url);
    const primaryUrl = targetUrls[0];

    let parsedResult: any = null;

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: primaryUrl, multiRepoUrls: targetUrls, projectId })
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
      // The server already persisted this exact profile (linked to this
      // project) before streaming it back — no second write needed here,
      // just reflect it in local state.
      setProject(prev => (prev ? { ...prev, isAudited: true, auditedRobotProfile: parsedResult } : prev));
    }

    setIsAuditing(false);
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
          {project.isAudited && project.auditedRobotProfile && (
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

              <div>
                <label className="block text-sand-300 font-bold mb-1">Repositories:</label>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    type="url"
                    value={repoUrlInput}
                    onChange={(e) => setRepoUrlInput(e.target.value)}
                    placeholder="https://github.com/org/repo"
                    className="flex-1 px-3.5 py-2 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary min-w-0"
                  />
                  <button
                    onClick={handleAddRepo}
                    disabled={!repoUrlInput.trim()}
                    className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-lg font-bold shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title={repoUrlInput.trim() ? undefined : 'Enter a repository URL first'}
                  >
                    Add
                  </button>
                </div>

                {project.repos.length > 0 ? (
                  <div className="space-y-2">
                    {project.repos.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-2.5 bg-sand-950 rounded-lg border border-dashed border-sand-700">
                        <span className="font-bold text-sand-100 truncate">{r.name}</span>
                        <button
                          onClick={() => handleRemoveRepo(r.id)}
                          className="p-1 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer"
                          title="Remove Repo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sand-600 italic">No repositories attached yet.</p>
                )}
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

      {/* The page's single dominant action always matches what the data
          needs next: an unaudited project has nothing worth showing yet, so
          "Run AI Audit" IS the page — one hero, not a small status card plus
          a separate collapsed accordion competing for attention. Once
          audited, the Codebase Review becomes primary and repo setup drops
          to a secondary, collapsed-by-default accordion below it. */}
      {project.isAudited && project.auditedRobotProfile ? (
        <>
          <div className="minimal-card p-5 sm:p-6">
            <CodebaseReview
              robot={project.auditedRobotProfile}
              onUpdate={(updated) => {
                setProject(prev => (prev ? { ...prev, auditedRobotProfile: updated } : prev));
                apiUpdateProject(projectId, { auditedRobotProfile: updated }).catch(() => {});
              }}
            />
          </div>

          <div className="minimal-card overflow-hidden text-xs">
            <button
              onClick={() => setRepoSectionOpen(o => !o)}
              className="w-full flex items-center justify-between gap-3 p-5 sm:px-6 cursor-pointer"
            >
              <span className="text-[11px] font-bold text-sand-500 uppercase tracking-wider">
                Repository Setup {project.repos.length > 0 && `(${project.repos.length})`}
              </span>
              {repoSectionOpen ? <ChevronUp className="h-4 w-4 text-sand-500" /> : <ChevronDown className="h-4 w-4 text-sand-500" />}
            </button>

            {repoSectionOpen && (
              <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-5 animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={repoUrlInput}
                    onChange={(e) => setRepoUrlInput(e.target.value)}
                    placeholder="https://github.com/org/sub-repo"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary min-w-0"
                  />
                  <button
                    onClick={handleAddRepo}
                    disabled={!repoUrlInput.trim()}
                    className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-xl font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title={repoUrlInput.trim() ? undefined : 'Enter a repository URL first'}
                  >
                    <Plus className="h-4 w-4 text-emerald-primary" />
                    Add Sub-Repo
                  </button>
                </div>

                {project.repos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {project.repos.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-sand-950 rounded-xl border border-dashed border-sand-700">
                        <div className="flex items-center gap-2 truncate">
                          <GitFork className="h-3.5 w-3.5 text-emerald-primary shrink-0" />
                          <span className="font-bold text-sand-100 truncate">{r.name}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveRepo(r.id)}
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

                {project.repos.length > 0 && (
                  <button
                    onClick={handleRunAudit}
                    disabled={isAuditing}
                    className="btn-emerald-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isAuditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {isAuditing ? 'Auditing...' : 'Re-run AI Audit'}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <RunAuditHero
          repos={project.repos}
          repoUrlInput={repoUrlInput}
          setRepoUrlInput={setRepoUrlInput}
          onAddRepo={handleAddRepo}
          onRunAudit={handleRunAudit}
          isAuditing={isAuditing}
        />
      )}

      {isAuditing && <AuditProgressModal repoName={project.name} logs={streamLogs} />}

      {!isAuditing && streamError && (
        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-700 text-xs">
          <span className="font-bold">AUDIT NOTICE: </span>{streamError}
        </div>
      )}

    </div>
  );
}

// The dominant, decluttered call-to-action for a project with no audit yet.
// This page is for one thing: viewing the audit, or running it. Repo setup
// is a one-time prerequisite, not something to keep managing here — once
// there's at least one repo, it's just named in passing and the only real
// action left on screen is the audit button.
function RunAuditHero({
  repos,
  repoUrlInput,
  setRepoUrlInput,
  onAddRepo,
  onRunAudit,
  isAuditing,
}: {
  repos: { id: string; url: string; name: string }[];
  repoUrlInput: string;
  setRepoUrlInput: (v: string) => void;
  onAddRepo: () => void;
  onRunAudit: () => void;
  isAuditing: boolean;
}) {
  const hasRepos = repos.length > 0;

  return (
    <div className="minimal-card p-8 sm:p-12 space-y-6">
      <div className="text-center space-y-2 max-w-lg mx-auto">
        <h2 className={`font-display font-normal text-sand-500 tracking-tight ${hasRepos ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
          No Audit Yet
        </h2>
        {hasRepos ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-sand-500">
            <span>Repos:</span>
            {repos.map((r) => (
              <span key={r.id} className="px-2.5 py-1 rounded-lg border border-dashed border-sand-700 text-sand-300">
                {r.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-sand-500">
            Attach this robot&apos;s GitHub repositories, then run the audit to see which robots the codebase defines and its autonomy feature checklist.
          </p>
        )}
      </div>

      {!hasRepos && (
        <div className="max-w-xl mx-auto w-full space-y-2 text-xs">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={repoUrlInput}
              onChange={(e) => setRepoUrlInput(e.target.value)}
              placeholder="https://github.com/org/repo"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary min-w-0"
            />
            <button
              onClick={onAddRepo}
              disabled={!repoUrlInput.trim()}
              className="px-4 py-2.5 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-xl font-bold flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={repoUrlInput.trim() ? undefined : 'Enter a repository URL first'}
            >
              Add Repo
            </button>
          </div>
          <p className="text-sand-600 italic text-center">No repositories attached yet — add one above to enable the audit.</p>
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onRunAudit}
          disabled={!hasRepos || isAuditing}
          className="btn-emerald-primary py-3.5 px-8 text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isAuditing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isAuditing ? 'Auditing...' : 'Run AI Audit'}
        </button>
        {!hasRepos && (
          <span className="text-[11px] text-sand-600">Add a repository above to enable the audit</span>
        )}
      </div>
    </div>
  );
}

// A live stepper of exactly what the backend audit pipeline is doing —
// every entry here is a real `log` line as it arrives over the /api/analyze
// SSE stream (GitHub API calls, package/URDF parsing, and the Gemini
// agent's own real tool calls — which file it's reading, right down to the
// path). Nothing here is a simulated/generic "thinking" placeholder: if the
// backend hasn't sent an event yet, the step just isn't shown yet.
function AuditProgressModal({ repoName, logs }: { repoName: string; logs: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div className="fixed inset-0 z-50 bg-sand-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="minimal-card w-full max-w-lg max-h-[85vh] p-6 flex flex-col space-y-4 animate-in fade-in slide-in-from-top-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-primary shrink-0" />
          <h3 className="text-sm font-bold text-sand-50 truncate">Auditing {repoName}</h3>
        </div>

        <div ref={scrollRef} className="overflow-y-auto space-y-2.5 text-xs pr-1">
          {logs.length === 0 && (
            <div className="flex items-start gap-2.5 text-sand-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mt-0.5" />
              <span>Connecting to the audit pipeline...</span>
            </div>
          )}
          {logs.map((log, idx) => {
            const isLast = idx === logs.length - 1;
            return (
              <div
                key={idx}
                className={`flex items-start gap-2.5 leading-relaxed ${isLast ? 'text-sand-50 font-semibold' : 'text-sand-500'}`}
              >
                {isLast ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mt-0.5 text-emerald-primary" />
                ) : (
                  <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-primary" />
                )}
                <span className="wrap-break-word">{log}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
