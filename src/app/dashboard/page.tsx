'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StreamHud } from '@/components/agent/stream-hud';
import { RobotDetailExplorer } from '@/components/dashboard/robot-detail-explorer';
import { createDynamicRobotProfileFromUrl, RobotProfile } from '@/lib/andino-data';
import { useAuth } from '@/lib/auth-context';
import { 
  FolderPlus, GitFork, Plus, Layers, Check, Trash2, Globe, Shield, 
  Sparkles, Terminal, Box, ArrowRight, RefreshCw, Cpu
} from 'lucide-react';

interface UserProject {
  id: string;
  name: string;
  description: string;
  repos: { url: string; name: string }[];
  activeRepoUrl: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { setSelectedRobot, setIngestedRepoUrl } = useAuth();
  
  const [streamActive, setStreamActive] = useState(false);
  const [targetRepoUrl, setTargetRepoUrl] = useState('');
  const [loadedRobot, setLoadedRobot] = useState<RobotProfile | null>(null);

  // Multi-Project & Multi-Repo Management State
  const [projects, setProjects] = useState<UserProject[]>([
    {
      id: 'proj_andino_suite',
      name: 'Andino Differential Drive Suite',
      description: 'Unified ROS 2 Humble delivery robot codebase & Gazebo simulation stack',
      repos: [
        { url: 'https://github.com/Ekumen-OS/andino', name: 'andino' },
        { url: 'https://github.com/Ekumen-OS/andino_gz', name: 'andino_gz' },
        { url: 'https://github.com/Ekumen-OS/andino_hardware', name: 'andino_hardware' }
      ],
      activeRepoUrl: 'https://github.com/Ekumen-OS/andino'
    }
  ]);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newRepoUrlInput, setNewRepoUrlInput] = useState('');

  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProj: UserProject = {
      id: `proj_${Date.now()}`,
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || 'Custom ROS 2 Multi-Repo Project',
      repos: newRepoUrlInput.trim() ? [{ url: newRepoUrlInput.trim(), name: newRepoUrlInput.split('/').pop() || 'repo' }] : [],
      activeRepoUrl: newRepoUrlInput.trim() || ''
    };

    setProjects(prev => [...prev, newProj]);
    setActiveProjectId(newProj.id);
    setNewProjectName('');
    setNewProjectDesc('');
    setNewRepoUrlInput('');
    setShowNewProjectModal(false);
  };

  const handleIngestSubmit = (urlToAudit: string) => {
    const cleanUrl = urlToAudit.trim();
    if (!cleanUrl) return;

    setTargetRepoUrl(cleanUrl);
    setIngestedRepoUrl(cleanUrl);
    setStreamActive(true);
    setLoadedRobot(null);

    // Create dynamic profile strictly from the user's submitted GitHub URL
    setTimeout(() => {
      const matchedRobot = createDynamicRobotProfileFromUrl(cleanUrl);
      setSelectedRobot(matchedRobot);
      setLoadedRobot(matchedRobot);
    }, 4500);
  };

  return (
    <div className="space-y-8 font-sans pb-16">
      
      {/* 1. Multi-Project & Multi-Repo Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-900 text-white font-mono font-bold">
            <Layers className="h-6 w-6 text-emerald-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {activeProject ? activeProject.name : 'Select or Create a Robotics Project'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-light text-emerald-text font-mono text-[10px] font-bold border border-emerald-border">
                {activeProject ? `${activeProject.repos.length} REPOS` : '0 PROJECTS'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {activeProject ? activeProject.description : 'Group multiple ROS 2 repositories into unified fleet projects'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="btn-emerald-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <FolderPlus className="h-4 w-4" />
            + New Project
          </button>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="minimal-card p-6 bg-slate-900 border-slate-800 text-slate-100 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-emerald-primary" />
              CREATE NEW MULTI-REPO ROBOTICS PROJECT
            </h3>
            <button onClick={() => setShowNewProjectModal(false)} className="text-slate-400 hover:text-white font-mono text-xs">
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Project Name:</label>
              <input
                type="text"
                required
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. TurtleBot 4 Autonomous Fleet"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-primary"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Project Description:</label>
              <input
                type="text"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="ROS 2 Humble Slam & Nav2 Stack"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-primary"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Initial GitHub Repository Link (Optional):</label>
              <input
                type="url"
                value={newRepoUrlInput}
                onChange={(e) => setNewRepoUrlInput(e.target.value)}
                placeholder="https://github.com/organization/robot_repo"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-white focus:outline-none focus:border-emerald-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-emerald-primary py-2 px-4 text-xs font-bold"
              >
                Create & Switch to Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Repository Ingestion Card */}
      <div className="minimal-card p-8 bg-white border-slate-200 shadow-sm space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-primary uppercase tracking-wider">
            <Globe className="h-4 w-4" />
            GitHub Robotics Ingestion & Audit Studio
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Load & Audit ROS 2 Repository
          </h2>
          <p className="text-xs text-slate-600 font-mono leading-relaxed max-w-3xl">
            Enter any public or private GitHub repository link containing ROS 2 URDF/Xacro models, Nav2 configurations, or Gazebo plugins to perform a deep agentic audit.
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleIngestSubmit(targetRepoUrl); }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="url"
              required
              value={targetRepoUrl}
              onChange={(e) => setTargetRepoUrl(e.target.value)}
              placeholder="https://github.com/Ekumen-OS/andino"
              className="w-full px-4 py-3.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-primary focus:bg-white transition-all shadow-xs"
            />
          </div>

          <button
            type="submit"
            className="btn-emerald-primary py-3.5 px-6 font-mono text-xs font-bold shrink-0 flex items-center justify-center gap-2 shadow-xs"
          >
            <Sparkles className="h-4 w-4" />
            Load & Audit Repo
          </button>
        </form>

        {/* Quick Sample Links */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span className="font-semibold text-slate-700">Sample Repositories:</span>
          <button
            onClick={() => {
              setTargetRepoUrl('https://github.com/Ekumen-OS/andino');
              handleIngestSubmit('https://github.com/Ekumen-OS/andino');
            }}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-all border border-slate-200"
          >
            Ekumen Andino (Diff Drive)
          </button>

          <button
            onClick={() => {
              setTargetRepoUrl('https://github.com/turtlebot/turtlebot4');
              handleIngestSubmit('https://github.com/turtlebot/turtlebot4');
            }}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-all border border-slate-200"
          >
            TurtleBot 4 (iRobot Create 3)
          </button>

          <button
            onClick={() => {
              setTargetRepoUrl('https://github.com/clearpathrobotics/husky');
              handleIngestSubmit('https://github.com/clearpathrobotics/husky');
            }}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-all border border-slate-200"
          >
            Clearpath Husky UGV
          </button>
        </div>
      </div>

      {/* 3. Live Stream Agentic Reasoning HUD */}
      {streamActive && (
        <div className="animate-in fade-in slide-in-from-top-4">
          <StreamHud isStreaming={streamActive} repoUrl={targetRepoUrl} />
        </div>
      )}

      {/* 4. Loaded Robot Detail Explorer */}
      {loadedRobot ? (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <RobotDetailExplorer robot={loadedRobot} />
        </div>
      ) : !streamActive ? (
        <div className="minimal-card p-12 bg-white border-slate-200 text-center space-y-4 shadow-sm">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Box className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 font-sans">
              Workspace Empty — No Repository Loaded
            </h3>
            <p className="text-xs text-slate-500 font-mono max-w-md mx-auto">
              Submit your ROS 2 GitHub repository URL above to inspect physical URDF joint transforms, Nav2 costmaps, and 3D STL meshes.
            </p>
          </div>
        </div>
      ) : null}

    </div>
  );
}
