'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, GitFork, X, Sparkles,
  Loader2, AlertTriangle, Bot
} from 'lucide-react';
import { createDynamicRobotProfileFromUrl } from '@/lib/robot-profile';
import { saveRobotToLibrary } from '@/lib/robot-library';
import { useAuth } from '@/lib/auth-context';
import { loadUserProjects, saveUserProjects, UserProject } from '@/lib/user-projects';
import { StreamHud } from '@/components/agent/stream-hud';
import { CodebaseReview } from '@/components/dashboard/codebase-review';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { setSelectedRobot, setIngestedRepoUrl } = useAuth();

  const [project, setProject] = useState<UserProject | null | undefined>(undefined);
  const [repoUrlInput, setRepoUrlInput] = useState('');

  const [isAuditing, setIsAuditing] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    const projects = loadUserProjects();
    setProject(projects.find(p => p.id === projectId) || null);
  }, [projectId]);

  const updateProject = (updater: (p: UserProject) => UserProject) => {
    const projects = loadUserProjects();
    const next = projects.map(p => (p.id === projectId ? updater(p) : p));
    saveUserProjects(next);
    setProject(next.find(p => p.id === projectId) || null);
  };

  const handleAddRepo = () => {
    const url = repoUrlInput.trim();
    if (!url || !project) return;
    if (project.repos.some(r => r.url === url)) return;

    const repoName = url.split('/').pop() || 'robotics_repo';
    updateProject(p => ({ ...p, repos: [...p.repos, { id: `repo_${Date.now()}`, url, name: repoName }] }));
    setRepoUrlInput('');
  };

  const handleRemoveRepo = (repoId: string) => {
    updateProject(p => ({ ...p, repos: p.repos.filter(r => r.id !== repoId) }));
  };

  const handleDeleteProject = () => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    const projects = loadUserProjects();
    saveUserProjects(projects.filter(p => p.id !== projectId));
    const activeId = localStorage.getItem('upfreq_active_project_id');
    if (activeId === projectId) localStorage.removeItem('upfreq_active_project_id');
    router.push('/projects');
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

      updateProject(p => ({ ...p, isAudited: true, auditedRobotProfile: dynamicProfile }));

      setSelectedRobot(dynamicProfile);
      localStorage.setItem('upfreq_active_project_id', projectId);
    }

    setIsAuditing(false);
  };

  if (project === undefined) {
    return null;
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
    <div className="space-y-6 font-sans pb-16 max-w-3xl">

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
                <Bot className="h-3.5 w-3.5" /> Gemini Agent
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Heuristic Fallback
              </span>
            )
          )}
          <button
            onClick={handleDeleteProject}
            className="p-2 text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 font-bold transition-all cursor-pointer"
            title="Delete Project"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="minimal-card p-5 sm:p-6 space-y-5 text-xs">
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
            className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-xl font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-emerald-primary" />
            Add Sub-Repo
          </button>
        </div>

        {project.repos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {project.repos.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-sand-950 rounded-xl border border-sand-800">
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
            {isAuditing ? 'Auditing...' : project.isAudited ? 'Re-run AI Audit' : 'Run AI Audit'}
          </button>
        )}

        {isAuditing && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <StreamHud isStreaming logs={streamLogs} repoName={project.name} />
          </div>
        )}

        {!isAuditing && streamError && (
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-700">
            <span className="font-bold">AUDIT NOTICE: </span>{streamError}
          </div>
        )}

        {/* Codebase Review — the two-thing AI summary: which robots this
            codebase defines, and a fixed autonomy-feature checklist.
            Parameter Matrix / 3D Studio / full deep-dive explorer are out
            of scope for Phase 1 and stay out of this page for now. */}
        {project.isAudited && project.auditedRobotProfile && (
          <div className="pt-4 border-t border-sand-800 space-y-4">
            <div className="text-xs font-bold text-sand-100 uppercase tracking-wider">
              Codebase Review
            </div>
            <CodebaseReview robot={project.auditedRobotProfile} />
          </div>
        )}
      </div>

    </div>
  );
}
