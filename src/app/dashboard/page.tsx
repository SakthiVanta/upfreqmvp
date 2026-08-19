'use client';

import React, { useState, useEffect } from 'react';
import { StreamHud } from '@/components/agent/stream-hud';
import { RobotDetailExplorer } from '@/components/dashboard/robot-detail-explorer';
import { createDynamicRobotProfileFromUrl, RobotProfile } from '@/lib/andino-data';
import { saveRobotToLibrary } from '@/lib/robot-library';
import { useAuth } from '@/lib/auth-context';
import {
  FolderPlus, GitFork, Plus, Layers, Globe, Shield,
  Sparkles, Box, Cpu, X
} from 'lucide-react';

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

export default function DashboardPage() {
  const { selectedRobot, setSelectedRobot, setIngestedRepoUrl } = useAuth();

  // Projects State with LocalStorage Persistence
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // New Project Modal State
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // Add Repository to Active Project Input State
  const [addRepoUrlInput, setAddRepoUrlInput] = useState('');

  // Single Quick Audit State
  const [singleRepoUrl, setSingleRepoUrl] = useState('');

  // AI Stream Audit Execution State
  const [streamActive, setStreamActive] = useState(false);
  const [auditTargetLabel, setAuditTargetLabel] = useState('');
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [loadedRobot, setLoadedRobot] = useState<RobotProfile | null>(null);

  // 1. Restore Saved Projects & Active Robot Profile on Page Mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('upfreq_user_projects');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        setProjects(parsed);
      } catch (e) {}
    }

    const savedActiveId = localStorage.getItem('upfreq_active_project_id');
    if (savedActiveId) {
      setActiveProjectId(savedActiveId);
    }

    if (selectedRobot) {
      setLoadedRobot(selectedRobot);
    }
  }, []);

  // Sync selectedRobot when context changes
  useEffect(() => {
    if (selectedRobot) {
      setLoadedRobot(selectedRobot);
    }
  }, [selectedRobot]);

  // 2. Persist Projects Array to LocalStorage
  const updateProjectsWithPersistence = (newProjects: UserProject[]) => {
    setProjects(newProjects);
    localStorage.setItem('upfreq_user_projects', JSON.stringify(newProjects));
  };

  const handleSelectActiveProject = (id: string | null) => {
    setActiveProjectId(id);
    if (id) {
      localStorage.setItem('upfreq_active_project_id', id);
      const proj = projects.find(p => p.id === id);
      if (proj && proj.auditedRobotProfile) {
        setSelectedRobot(proj.auditedRobotProfile);
        setLoadedRobot(proj.auditedRobotProfile);
      }
    } else {
      localStorage.removeItem('upfreq_active_project_id');
    }
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Create a New Empty Robotics Project
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProj: UserProject = {
      id: `proj_${Date.now()}`,
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || 'Multi-Repository ROS 2 System',
      repos: [],
      isAudited: false
    };

    const nextProjects = [...projects, newProj];
    updateProjectsWithPersistence(nextProjects);
    handleSelectActiveProject(newProj.id);

    setNewProjectName('');
    setNewProjectDesc('');
    setShowNewProjectModal(false);
  };

  // Add a GitHub Repository to Active Project
  const handleAddRepoToProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addRepoUrlInput.trim() || !activeProjectId) return;

    const cleanUrl = addRepoUrlInput.trim();
    const repoName = cleanUrl.split('/').pop() || 'robotics_repo';

    const nextProjects = projects.map(p => {
      if (p.id === activeProjectId) {
        if (p.repos.some(r => r.url === cleanUrl)) return p;
        return {
          ...p,
          repos: [...p.repos, { id: `repo_${Date.now()}`, url: cleanUrl, name: repoName }]
        };
      }
      return p;
    });

    updateProjectsWithPersistence(nextProjects);
    setAddRepoUrlInput('');
  };

  // Remove a Repository from Active Project
  const handleRemoveRepoFromProject = (repoId: string) => {
    if (!activeProjectId) return;
    const nextProjects = projects.map(p => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          repos: p.repos.filter(r => r.id !== repoId)
        };
      }
      return p;
    });
    updateProjectsWithPersistence(nextProjects);
  };

  // Trigger AI Agent Ingestion Audit — streams the real /api/analyze SSE
  // response and uses its parsed result instead of discarding it.
  const handleTriggerAudit = async (targetUrls: string[], label: string) => {
    if (targetUrls.length === 0) return;

    setAuditTargetLabel(label);
    setStreamActive(true);
    setStreamLogs([]);
    setStreamError(null);

    const primaryUrl = targetUrls[0];
    setIngestedRepoUrl(primaryUrl);

    let parsedResult: any = null;
    let failed = false;

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
              failed = true;
              setStreamError(data.message || 'ROS validation failed.');
            }
            if (data.stage === 'COMPLETE' && data.result) {
              parsedResult = data.result;
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      failed = true;
      setStreamError('Network error reaching the analysis stream — falling back to a default profile.');
    }

    const repoName = primaryUrl.split('/').pop() || 'robotics_repo';
    const dynamicProfile = createDynamicRobotProfileFromUrl(primaryUrl, parsedResult || undefined);
    saveRobotToLibrary(dynamicProfile);

    if (!activeProjectId) {
      const autoProjectName = `${repoName.charAt(0).toUpperCase() + repoName.slice(1)} System Fleet`;
      const autoProj: UserProject = {
        id: `proj_${Date.now()}`,
        name: autoProjectName,
        description: `Multi-repository ROS 2 system for ${repoName}`,
        repos: [{ id: `repo_${Date.now()}`, url: primaryUrl, name: repoName }],
        isAudited: true,
        auditedRobotProfile: dynamicProfile
      };
      const nextProjects = [...projects, autoProj];
      updateProjectsWithPersistence(nextProjects);
      handleSelectActiveProject(autoProj.id);
    } else {
      const nextProjects = projects.map(p => {
        if (p.id === activeProjectId) {
          const hasRepo = p.repos.some(r => r.url === primaryUrl);
          return {
            ...p,
            repos: hasRepo ? p.repos : [...p.repos, { id: `repo_${Date.now()}`, url: primaryUrl, name: repoName }],
            isAudited: true,
            auditedRobotProfile: dynamicProfile
          };
        }
        return p;
      });
      updateProjectsWithPersistence(nextProjects);
    }

    setSelectedRobot(dynamicProfile);
    setLoadedRobot(dynamicProfile);
    setStreamActive(false);
    if (!failed) setStreamError(null);
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-16">

      {/* 1. Multi-Project & Multi-Repo Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 minimal-card p-5 sm:p-6">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-3.5 rounded-xl bg-sand-800 text-white font-mono font-bold shrink-0">
            <Layers className="h-6 w-6 text-emerald-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-display font-extrabold text-sand-50 tracking-tight truncate">
                {activeProject ? activeProject.name : 'Robotics Fleet Projects'}
              </h1>
              {activeProject && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-light text-emerald-text font-mono text-[11px] font-bold border border-emerald-border shrink-0">
                  {activeProject.repos.length} REPOSITOR{activeProject.repos.length === 1 ? 'Y' : 'IES'} ATTACHED
                </span>
              )}
            </div>
            <p className="text-xs text-sand-500 font-mono mt-0.5">
              {activeProject ? activeProject.description : 'Group multiple ROS 2 repositories so the AI agent synthesizes your complete robot system'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs shrink-0">
          {projects.length > 0 && (
            <select
              value={activeProjectId || ''}
              onChange={(e) => handleSelectActiveProject(e.target.value || null)}
              className="px-3 py-2 rounded-xl border border-sand-700 bg-sand-950 text-sand-100 font-bold focus:outline-none focus:border-emerald-primary max-w-45"
            >
              <option value="">-- Switch Project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.repos.length} repos)
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowNewProjectModal(true)}
            className="btn-emerald-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" />
            Create Project
          </button>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="minimal-card p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-sand-800 pb-3">
            <h3 className="text-sm font-bold text-sand-50 font-mono flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-emerald-primary" />
              CREATE MULTI-REPOSITORY ROBOTICS PROJECT
            </h3>
            <button onClick={() => setShowNewProjectModal(false)} className="text-sand-500 hover:text-sand-50 font-mono text-xs cursor-pointer">
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block text-sand-300 font-bold mb-1">Project Name:</label>
              <input
                type="text"
                required
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Autonomous Mobile Delivery Fleet"
                className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
              />
            </div>

            <div>
              <label className="block text-sand-300 font-bold mb-1">Project Description:</label>
              <input
                type="text"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="ROS 2 Humble Slam, Nav2, and Hardware packages"
                className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
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

      {/* 2. Active Project Multi-Repo Workspace Container */}
      {activeProject ? (
        <div className="minimal-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sand-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-sand-50 font-sans">
                Project Repositories Container: {activeProject.name}
              </h2>
              <p className="text-xs text-sand-500 font-mono mt-0.5">
                Attach all your sub-repositories (description, navigation, simulation, hardware) so the AI agent synthesizes them as a single system.
              </p>
            </div>

            {activeProject.repos.length > 0 && (
              <button
                onClick={() => handleTriggerAudit(activeProject.repos.map(r => r.url), activeProject.name)}
                disabled={streamActive}
                className="btn-emerald-primary py-3 px-5 text-xs font-bold flex items-center gap-2 font-mono shrink-0 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                Run Unified Multi-Repo AI Audit
              </button>
            )}
          </div>

          {/* Add Repository Form */}
          <form onSubmit={handleAddRepoToProject} className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              required
              value={addRepoUrlInput}
              onChange={(e) => setAddRepoUrlInput(e.target.value)}
              placeholder="https://github.com/your-org/your-robot-repo"
              className="flex-1 px-4 py-3 rounded-xl border border-sand-700 bg-sand-950 text-sand-50 font-mono text-xs focus:outline-none focus:border-emerald-primary min-w-0"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-sand-800 hover:bg-sand-700 text-sand-50 font-mono text-xs font-bold flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4 text-emerald-primary" />
              Add Repository to Project
            </button>
          </form>

          {/* List of Attached Repositories in this Project */}
          {activeProject.repos.length > 0 ? (
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-sand-300 font-mono block uppercase tracking-wider">
                Attached GitHub Repositories ({activeProject.repos.length}):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                {activeProject.repos.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3.5 bg-sand-950 rounded-xl border border-sand-800">
                    <div className="flex items-center gap-2.5 truncate">
                      <GitFork className="h-4 w-4 text-emerald-primary shrink-0" />
                      <span className="font-bold text-sand-100 truncate">{r.name}</span>
                      <span className="text-[10px] text-sand-600 truncate">({r.url})</span>
                    </div>
                    <button
                      onClick={() => handleRemoveRepoFromProject(r.id)}
                      className="p-1.5 text-sand-500 hover:text-rose-400 transition-colors shrink-0 cursor-pointer"
                      title="Remove Repository"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-sand-950 rounded-xl border border-dashed border-sand-800 text-center font-mono text-xs text-sand-500 space-y-2">
              <Globe className="h-8 w-8 mx-auto text-sand-600" />
              <p className="font-bold text-sand-300">No Repositories Attached Yet</p>
              <p className="text-[11px]">Enter your GitHub repository URLs above to add them to this project.</p>
            </div>
          )}
        </div>
      ) : null}

      {/* 3. Single Repository Ingestion Card (Clean Ingest Input) */}
      <div className="minimal-card p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-primary uppercase tracking-wider">
            <Globe className="h-4 w-4" />
            GitHub ROS 2 Repository Ingestion & Audit Studio
          </div>
          <h2 className="text-xl font-display font-extrabold text-sand-50 tracking-tight">
            Load & Audit GitHub Repository
          </h2>
          <p className="text-xs text-sand-400 font-mono leading-relaxed max-w-3xl">
            Enter any public or private GitHub repository link containing ROS 2 URDF/Xacro models, Nav2 configurations, or Gazebo plugins to perform a deep agentic audit.
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (singleRepoUrl.trim()) handleTriggerAudit([singleRepoUrl.trim()], singleRepoUrl.trim().split('/').pop() || 'repo'); }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <input
              type="url"
              required
              value={singleRepoUrl}
              onChange={(e) => setSingleRepoUrl(e.target.value)}
              placeholder="https://github.com/organization/repository"
              className="w-full px-4 py-3.5 rounded-xl border border-sand-700 bg-sand-950 text-sand-50 font-mono text-xs focus:outline-none focus:border-emerald-primary transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={streamActive}
            className="btn-emerald-primary py-3.5 px-6 font-mono text-xs font-bold shrink-0 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Load & Audit Repo
          </button>
        </form>

        {streamError && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg text-xs font-mono text-rose-700 flex items-start gap-2">
            <Shield className="h-4 w-4 shrink-0 mt-0.5" />
            <span><span className="font-bold">AUDIT NOTICE: </span>{streamError}</span>
          </div>
        )}
      </div>

      {/* 4. Live Stream Agentic Reasoning HUD */}
      {streamActive && (
        <div className="animate-in fade-in slide-in-from-top-4">
          <StreamHud isStreaming={streamActive} repoName={auditTargetLabel} logs={streamLogs} />
        </div>
      )}

      {/* 5. Loaded Robot Detail Explorer */}
      {loadedRobot ? (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <RobotDetailExplorer robot={loadedRobot} />
        </div>
      ) : !streamActive ? (
        <div className="minimal-card p-12 text-center space-y-4">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-sand-800 text-sand-500 flex items-center justify-center">
            <Box className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-sand-50 font-sans">
              Workspace Empty — No Repository Loaded
            </h3>
            <p className="text-xs text-sand-500 font-mono max-w-md mx-auto">
              Submit your GitHub repository URL above or create a multi-repository project to inspect physical URDF joint transforms, Nav2 costmaps, and 3D STL meshes.
            </p>
          </div>
        </div>
      ) : null}

    </div>
  );
}
