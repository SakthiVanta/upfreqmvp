'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderPlus, Layers, Plus, Trash2, GitFork, X, Globe, Sparkles,
  Loader2, ChevronDown, ChevronUp, Box, Cpu, AlertTriangle, Bot
} from 'lucide-react';
import { RobotProfile, createDynamicRobotProfileFromUrl } from '@/lib/robot-profile';
import { saveRobotToLibrary } from '@/lib/robot-library';
import { useAuth } from '@/lib/auth-context';
import { StreamHud } from '@/components/agent/stream-hud';
import { RobotDetailExplorer } from '@/components/dashboard/robot-detail-explorer';

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

export default function ProjectsPage() {
  const router = useRouter();
  const { selectedRobot, setSelectedRobot, setIngestedRepoUrl } = useAuth();

  const [projects, setProjects] = useState<UserProject[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [repoUrlInput, setRepoUrlInput] = useState<Record<string, string>>({});

  // Quick-start: paste a repo URL to instantly create a project (robot) for
  // it and kick off the audit, without going through the modal first.
  const [quickUrl, setQuickUrl] = useState('');

  // Only one audit runs at a time; tracked by which project it belongs to.
  // lastAuditProjectId stays set after completion so the resulting logs/error
  // are attributed to the right card even once auditingProjectId clears.
  const [auditingProjectId, setAuditingProjectId] = useState<string | null>(null);
  const [lastAuditProjectId, setLastAuditProjectId] = useState<string | null>(null);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

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
      setExpandedProjectId(newProj.id);
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

    saveProjects([...projects, newProj]);
    setNameInput('');
    setDescInput('');
    setShowCreateModal(false);
  };

  const handleDeleteProject = (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    const next = projects.filter(p => p.id !== id);
    saveProjects(next);
    const activeId = localStorage.getItem('upfreq_active_project_id');
    if (activeId === id) {
      localStorage.removeItem('upfreq_active_project_id');
    }
    if (expandedProjectId === id) setExpandedProjectId(null);
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
  // streaming live logs into that project's card and writing the resulting
  // RobotProfile back onto it once complete.
  const handleRunAudit = async (project: UserProject) => {
    if (project.repos.length === 0 || auditingProjectId) return;

    setAuditingProjectId(project.id);
    setLastAuditProjectId(project.id);
    setStreamLogs([]);
    setStreamError(null);
    setExpandedProjectId(project.id);

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

  // Quick-start form: create a project named after the repo and immediately
  // audit it — the fastest path from "paste a URL" to "see the analysis."
  const handleQuickStart = (e: React.FormEvent) => {
    e.preventDefault();
    const url = quickUrl.trim();
    if (!url || auditingProjectId) return;

    const repoName = url.split('/').pop() || 'robotics_repo';
    const cleanName = repoName.charAt(0).toUpperCase() + repoName.slice(1);

    const newProj: UserProject = {
      id: `proj_${Date.now()}`,
      name: cleanName,
      description: `Autonomy codebase for ${cleanName}`,
      repos: [{ id: `repo_${Date.now()}`, url, name: repoName }],
      isAudited: false
    };

    const nextProjects = [...projects, newProj];
    saveProjects(nextProjects);
    setQuickUrl('');
    handleRunAudit(newProj);
  };

  const goToRobot = (profile: RobotProfile, destination: '/matrix' | '/studio') => {
    setSelectedRobot(profile);
    router.push(destination);
  };

  return (
    <div className="space-y-8 font-sans pb-16">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 minimal-card p-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-xl bg-sand-800 text-white font-mono font-bold shrink-0">
            <Layers className="h-6 w-6 text-emerald-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-extrabold text-sand-50 tracking-tight">
              Robot Projects
            </h1>
            <p className="text-xs text-sand-500 font-mono mt-0.5">
              Each project is one robot's autonomy codebase — attach its GitHub repositories, then run the AI audit to synthesize sensors, chassis, and autonomy modules.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-emerald-primary py-2.5 px-4 text-xs font-bold font-mono flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <FolderPlus className="h-4 w-4" />
          Create New Project
        </button>
      </div>

      {/* Quick-Start Ingest Card */}
      <div className="minimal-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-primary uppercase tracking-wider">
          <Globe className="h-4 w-4" />
          Quick Start
        </div>
        <p className="text-xs text-sand-400 font-mono leading-relaxed max-w-3xl">
          Paste a GitHub ROS 2 repository URL to create a new robot project for it and run the agentic audit immediately.
        </p>
        <form onSubmit={handleQuickStart} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            required
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="https://github.com/organization/repository"
            className="flex-1 px-4 py-3 rounded-xl border border-sand-700 bg-sand-950 text-sand-50 font-mono text-xs focus:outline-none focus:border-emerald-primary min-w-0"
          />
          <button
            type="submit"
            disabled={!!auditingProjectId}
            className="btn-emerald-primary py-3 px-6 font-mono text-xs font-bold shrink-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Create & Audit
          </button>
        </form>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="minimal-card p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-sand-800 pb-3">
            <h3 className="text-sm font-bold text-sand-50 font-mono flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-emerald-primary" />
              CREATE NEW ROBOT PROJECT
            </h3>
            <button onClick={() => setShowCreateModal(false)} className="text-sand-500 hover:text-sand-50 font-mono text-xs cursor-pointer">
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-4 font-mono text-xs">
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
        </div>
      )}

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {projects.map((p) => {
            const isAuditingThis = auditingProjectId === p.id;
            const isExpanded = expandedProjectId === p.id;

            return (
              <div key={p.id} className="minimal-card p-6 space-y-5">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sand-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-display font-extrabold text-sand-50">
                        {p.name}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-light text-emerald-text font-mono text-[11px] font-bold border border-emerald-border">
                        {p.repos.length} REPO{p.repos.length === 1 ? '' : 'S'}
                      </span>
                      {p.isAudited && p.auditedRobotProfile && (
                        p.auditedRobotProfile.usedAgenticAnalysis ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-light text-emerald-text font-mono text-[11px] font-bold border border-emerald-border flex items-center gap-1">
                            <Bot className="h-3 w-3" /> Gemini Agent
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-mono text-[11px] font-bold border border-amber-200 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Heuristic Fallback
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-xs text-sand-500 font-mono mt-0.5">
                      {p.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                    {p.repos.length > 0 && (
                      <button
                        onClick={() => handleRunAudit(p)}
                        disabled={!!auditingProjectId}
                        className="btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        {isAuditingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {isAuditingThis ? 'Auditing...' : p.isAudited ? 'Re-run AI Audit' : 'Run AI Audit'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteProject(p.id)}
                      className="p-2 text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 font-bold transition-all cursor-pointer"
                      title="Delete Project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 font-mono text-xs">
                  <input
                    type="url"
                    value={repoUrlInput[p.id] || ''}
                    onChange={(e) => setRepoUrlInput({ ...repoUrlInput, [p.id]: e.target.value })}
                    placeholder="https://github.com/org/sub-repo"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary min-w-0"
                  />
                  <button
                    onClick={() => handleAddRepo(p.id)}
                    className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-50 rounded-xl font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-emerald-primary" />
                    Add Sub-Repo
                  </button>
                </div>

                {p.repos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs pt-1">
                    {p.repos.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-sand-950 rounded-xl border border-sand-800">
                        <div className="flex items-center gap-2 truncate">
                          <GitFork className="h-3.5 w-3.5 text-emerald-primary shrink-0" />
                          <span className="font-bold text-sand-100 truncate">{r.name}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveRepo(p.id, r.id)}
                          className="p-1 text-sand-500 hover:text-rose-400 shrink-0 cursor-pointer"
                          title="Remove Sub-Repo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-mono text-sand-600 italic">No sub-repositories attached to this project yet — add one above, then run the AI audit.</p>
                )}

                {/* Live Agentic Reasoning Stream (this project's audit only) */}
                {isAuditingThis && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <StreamHud isStreaming logs={streamLogs} repoName={p.name} />
                  </div>
                )}

                {!isAuditingThis && streamError && lastAuditProjectId === p.id && (
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs font-mono text-rose-700">
                    <span className="font-bold">AUDIT NOTICE: </span>{streamError}
                  </div>
                )}

                {/* Audited Result Actions */}
                {p.isAudited && p.auditedRobotProfile && (
                  <div className="pt-2 border-t border-sand-800 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <button
                        onClick={() => setExpandedProjectId(isExpanded ? null : p.id)}
                        className="px-3.5 py-2 rounded-lg bg-sand-800 hover:bg-sand-700 text-sand-100 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isExpanded ? 'Hide Full Analysis' : 'View Full Analysis'}
                      </button>
                      <button
                        onClick={() => goToRobot(p.auditedRobotProfile!, '/matrix')}
                        className="px-3.5 py-2 rounded-lg bg-sand-800 hover:bg-sand-700 text-sand-100 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Cpu className="h-3.5 w-3.5 text-emerald-primary" />
                        Parameter Matrix
                      </button>
                      <button
                        onClick={() => goToRobot(p.auditedRobotProfile!, '/studio')}
                        className="px-3.5 py-2 rounded-lg bg-sand-800 hover:bg-sand-700 text-sand-100 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Box className="h-3.5 w-3.5 text-emerald-primary" />
                        3D Studio
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <RobotDetailExplorer robot={p.auditedRobotProfile} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="minimal-card p-12 text-center space-y-4">
          <Globe className="h-10 w-10 mx-auto text-sand-600" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-sand-50">No Projects Created Yet</h3>
            <p className="text-xs text-sand-500 font-mono max-w-md mx-auto">
              Create a project for each robot to group its GitHub repositories and run an AI audit against its autonomy codebase.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-emerald-primary py-2.5 px-5 text-xs font-mono font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" />
            Create First Project
          </button>
        </div>
      )}

    </div>
  );
}
