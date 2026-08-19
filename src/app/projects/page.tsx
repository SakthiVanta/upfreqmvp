'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { 
  FolderPlus, Layers, Plus, Trash2, Edit3, GitFork, Check, X, 
  Globe, Sparkles, Box, ShieldCheck, Database, RefreshCw
} from 'lucide-react';
import { createDynamicRobotProfileFromUrl, RobotProfile } from '@/lib/andino-data';

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
  const { setSelectedRobot, setIngestedRepoUrl } = useAuth();
  
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Form states
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

  // 1. CREATE Project
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

  // 2. UPDATE Project Info
  const handleUpdateProjectInfo = (id: string, newName: string, newDesc: string) => {
    const next = projects.map(p => p.id === id ? { ...p, name: newName, description: newDesc } : p);
    saveProjects(next);
    setEditingProjectId(null);
  };

  // 3. DELETE Project
  const handleDeleteProject = (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    const next = projects.filter(p => p.id !== id);
    saveProjects(next);
    const activeId = localStorage.getItem('upfreq_active_project_id');
    if (activeId === id) {
      localStorage.removeItem('upfreq_active_project_id');
    }
  };

  // 4. ADD Repo to Project
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

  // 5. REMOVE Repo from Project
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-xl bg-slate-900 text-white font-mono font-bold">
            <Layers className="h-6 w-6 text-emerald-primary" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Project Fleet Management (CRUD Studio)
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Create, view, update, and manage your multi-repository robotics fleet projects
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-emerald-primary py-2.5 px-4 text-xs font-bold font-mono flex items-center gap-2 shadow-xs shrink-0"
        >
          <FolderPlus className="h-4 w-4" />
          Create New Project
        </button>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="minimal-card p-6 bg-slate-900 border-slate-800 text-slate-100 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-emerald-primary" />
              CREATE NEW ROBOTICS FLEET PROJECT
            </h3>
            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white font-mono text-xs">
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Project Name:</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Autonomous Mobile Delivery Fleet"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-primary"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Description:</label>
              <input
                type="text"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="ROS 2 Humble Slam, Nav2, and Hardware sub-packages"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-emerald-primary py-2 px-4 text-xs font-bold"
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
            <div key={p.id} className="minimal-card p-6 bg-white border-slate-200 shadow-xs space-y-5">
              
              {/* Project Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-slate-900 font-sans">
                      {p.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-light text-emerald-text font-mono text-[11px] font-bold border border-emerald-border">
                      {p.repos.length} REPOS
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {p.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <button
                    onClick={() => handleDeleteProject(p.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 font-bold transition-all"
                    title="Delete Project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Add Repo Form for this Project */}
              <div className="flex flex-col sm:flex-row gap-2 font-mono text-xs">
                <input
                  type="url"
                  value={repoUrlInput[p.id] || ''}
                  onChange={(e) => setRepoUrlInput({ ...repoUrlInput, [p.id]: e.target.value })}
                  placeholder="https://github.com/org/sub-repo"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-emerald-primary"
                />
                <button
                  onClick={() => handleAddRepo(p.id)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4 text-emerald-primary" />
                  Add Sub-Repo
                </button>
              </div>

              {/* Attached Sub-Repos List */}
              {p.repos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs pt-1">
                  {p.repos.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 truncate">
                        <GitFork className="h-3.5 w-3.5 text-emerald-primary shrink-0" />
                        <span className="font-bold text-slate-900 truncate">{r.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveRepo(p.id, r.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 shrink-0"
                        title="Remove Sub-Repo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-slate-400 italic">No sub-repositories attached to this project yet.</p>
              )}

            </div>
          ))}
        </div>
      ) : (
        <div className="minimal-card p-12 bg-white border-slate-200 text-center space-y-4 shadow-xs">
          <Globe className="h-10 w-10 mx-auto text-slate-400" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No Projects Created Yet</h3>
            <p className="text-xs text-slate-500 font-mono max-w-md mx-auto">
              Create a project to group multiple GitHub ROS 2 repositories into a single unified fleet.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-emerald-primary py-2.5 px-5 text-xs font-mono font-bold inline-flex items-center gap-2"
          >
            <FolderPlus className="h-4 w-4" />
            Create First Project
          </button>
        </div>
      )}

    </div>
  );
}
