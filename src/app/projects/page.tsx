'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderPlus, Layers, Plus, Trash2, GitFork, X, Globe
} from 'lucide-react';
import { RobotProfile } from '@/lib/robot-profile';

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
  const [projects, setProjects] = useState<UserProject[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [repoUrlInput, setRepoUrlInput] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('upfreq_user_projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

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
      description: descInput.trim() || 'Multi-Repository ROS 2 Fleet Project',
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
              Project Fleet Management
            </h1>
            <p className="text-xs text-sand-500 font-mono mt-0.5">
              Create, view, update, and manage your multi-repository robotics fleet projects
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

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="minimal-card p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-sand-800 pb-3">
            <h3 className="text-sm font-bold text-sand-50 font-mono flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-emerald-primary" />
              CREATE NEW ROBOTICS FLEET PROJECT
            </h3>
            <button onClick={() => setShowCreateModal(false)} className="text-sand-500 hover:text-sand-50 font-mono text-xs cursor-pointer">
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block text-sand-300 font-bold mb-1">Project Name:</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Autonomous Mobile Delivery Fleet"
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

      {/* Projects CRUD Grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {projects.map((p) => (
            <div key={p.id} className="minimal-card p-6 space-y-5">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sand-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-display font-extrabold text-sand-50">
                      {p.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-light text-emerald-text font-mono text-[11px] font-bold border border-emerald-border">
                      {p.repos.length} REPOS
                    </span>
                  </div>
                  <p className="text-xs text-sand-500 font-mono mt-0.5">
                    {p.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
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
                <p className="text-xs font-mono text-sand-600 italic">No sub-repositories attached to this project yet.</p>
              )}

            </div>
          ))}
        </div>
      ) : (
        <div className="minimal-card p-12 text-center space-y-4">
          <Globe className="h-10 w-10 mx-auto text-sand-600" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-sand-50">No Projects Created Yet</h3>
            <p className="text-xs text-sand-500 font-mono max-w-md mx-auto">
              Create a project to group multiple GitHub ROS 2 repositories into a single unified fleet.
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
