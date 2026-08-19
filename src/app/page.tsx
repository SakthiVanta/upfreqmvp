'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createDynamicRobotProfileFromUrl } from '@/lib/andino-data';
import { GithubIcon } from '@/components/ui/github-icon';
import { StreamHud } from '@/components/agent/stream-hud';
import { RobotDetailExplorer } from '@/components/dashboard/robot-detail-explorer';
import { 
  Cpu, Layers, Box, ArrowRight, ShieldCheck, Terminal, Play, 
  Loader2, Compass, Lock, Activity, Check, Zap, FileCode, Radio,
  Server, GitBranch, Eye, Sliders, Shield, Globe, ChevronRight,
  TrendingUp, Award, HelpCircle, CheckCircle, Info
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loginWithGithub, setActiveAnalysis } = useAuth();

  const [repoUrl, setRepoUrl] = useState('https://github.com/Ekumen-OS/andino');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'3d' | 'sse' | 'nav2' | 'isaac'>('3d');

  const handleStartAnalysis = async () => {
    if (!isAuthenticated) {
      loginWithGithub();
    }

    setIsAnalyzing(true);
    setStreamLogs([]);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl })
      });

      if (!response.ok || !response.body) {
        setErrorMessage('Failed to connect to analysis stream endpoint.');
        setIsAnalyzing(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.log) setStreamLogs(prev => [...prev, data.log]);

              if (data.stage === 'ERROR') {
                setErrorMessage(data.message || 'ROS validation failed.');
                setIsAnalyzing(false);
                return;
              }

              if (data.stage === 'COMPLETE' && data.result) {
                setActiveAnalysis(data.result);
                setIsAnalyzing(false);
                setStreamLogs(prev => [...prev, '✓ Database Persisted! Redirecting to Dashboard...']);
                setTimeout(() => router.push('/dashboard'), 1500);
              }
            } catch (e) {}
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(`Network error: ${err.message}`);
      setIsAnalyzing(false);
    }
  };

  // If user IS authenticated, render post-login App Workspace directly
  if (isAuthenticated) {
    return (
      <div className="space-y-6 font-sans">
        
        {/* Repo Ingest Control Bar */}
        <div className="minimal-card p-6 bg-white border-zinc-200 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-indigo-600" />
              <h1 className="text-sm font-bold text-zinc-900 uppercase tracking-wider font-mono">
                Live GitHub Repository Ingestion Engine
              </h1>
            </div>
            <span className="text-xs font-mono text-indigo-700 bg-indigo-50 px-3 py-1 rounded-md font-bold border border-indigo-100">
              Authenticated Session
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 bg-zinc-50 font-mono text-xs text-zinc-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
            />
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
              className="btn-robotics-primary py-2.5 px-6 font-mono text-xs flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Streaming Live Audit...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Load & Analyze Repository
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg text-xs font-mono text-rose-900">
              <span className="font-bold">ROS VALIDATION ERROR: </span>
              {errorMessage}
            </div>
          )}

          {(isAnalyzing || streamLogs.length > 0) && (
            <div className="minimal-card p-4 bg-zinc-950 text-zinc-100 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-indigo-400 font-bold flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Live SSE Stream Execution Console
                </span>
              </div>
              <div className="h-36 overflow-y-auto space-y-1 p-2 bg-zinc-900 rounded border border-zinc-800 text-[11px]">
                {streamLogs.map((log, idx) => (
                  <div key={idx} className="text-zinc-300">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Stream HUD */}
        <StreamHud repoUrl={repoUrl} isStreaming={isAnalyzing} />

        {/* Exhaustive Robot Detail Explorer */}
        <RobotDetailExplorer robot={createDynamicRobotProfileFromUrl(repoUrl)} />
      </div>
    );
  }

  // Production Grade Marketing Landing Page for Unauthenticated Visitors
  return (
    <div className="space-y-16 font-sans text-zinc-900 -mt-6 pb-20">
      
      {/* Marketing Single-Page Header Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-mono font-bold text-sm">
            UF
          </div>
          <span className="font-bold text-base text-zinc-900 tracking-tight">UpFreq Robotics</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 font-mono text-xs font-semibold text-zinc-600">
          <a href="#about" className="hover:text-indigo-600 transition-colors">Platform Purpose</a>
          <a href="#how-to-use" className="hover:text-indigo-600 transition-colors">How To Use</a>
          <a href="#showcase" className="hover:text-indigo-600 transition-colors">Live Interactive Showcase</a>
          <a href="#takeaways" className="hover:text-indigo-600 transition-colors">Key Takeaways</a>
        </nav>

        <div className="flex items-center gap-3 font-mono text-xs">
          <Link href="/login" className="btn-robotics-primary py-2 px-5 text-xs font-bold shadow-xs">
            Sign In to App
          </Link>
        </div>
      </header>

      {/* Hero Section with Clear UX Overview */}
      <section className="max-w-5xl mx-auto text-center space-y-8 pt-8 px-4">
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-900 leading-[1.15]">
          Agentic ROS 2 Codebase Inspection & <br />
          <span className="text-indigo-600">
            Parameter Intelligence Platform
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 font-mono max-w-3xl mx-auto leading-relaxed">
          Connect your robotics GitHub repository to perform real-time ROS/ROS 2 tree validation, parse URDF sensor origins, synthesize Nav2 navigation stacks, and export 3D STL transform models.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 font-mono text-xs">
          <button
            onClick={() => loginWithGithub()}
            className="btn-robotics-primary py-3.5 px-8 text-sm font-bold shadow-sm flex items-center gap-2.5"
          >
            <GithubIcon className="h-4.5 w-4.5 fill-current" />
            Connect GitHub OAuth
          </button>

          <Link
            href="/login"
            className="btn-secondary-light py-3.5 px-8 text-sm font-semibold border-zinc-300 hover:border-zinc-400"
          >
            Sign In with Password
          </Link>
        </div>

        {/* Clear UX Summary Ribbon */}
        <div id="about" className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left font-mono text-xs">
          <div className="p-5 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <Compass className="h-4.5 w-4.5" />
              1. What Is This Application?
            </div>
            <p className="text-zinc-600 leading-relaxed text-[11px]">
              An enterprise platform engineered for robotics CTOs & engineers to audit GitHub repositories, extract physical sensor origins, and synthesize Nav2 & SLAM configurations.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <HelpCircle className="h-4.5 w-4.5" />
              2. How Do You Use It?
            </div>
            <p className="text-zinc-600 leading-relaxed text-[11px]">
              Input your target GitHub repository URL, authorize sign-in, and stream real-time ROS validation logs as URDF transforms and packages are parsed.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <Award className="h-4.5 w-4.5" />
              3. What Is The Takeaway?
            </div>
            <p className="text-zinc-600 leading-relaxed text-[11px]">
              Zero manual URDF editing — instant automated parameter matrix extraction, 3D WebGL STL transform visualizer, and NVIDIA Isaac Sim test automation.
            </p>
          </div>
        </div>
      </section>

      {/* 3-Step Quick Start Guide Bar */}
      <section id="how-to-use" className="max-w-6xl mx-auto px-4 space-y-6 font-mono text-xs">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Quick User Workflow
          </h2>
          <h3 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            Get Started in 3 Simple Steps
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="minimal-card p-6 bg-white space-y-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-sm">
              STEP 1
            </div>
            <h4 className="font-bold text-zinc-900 text-sm">Submit GitHub Repo URL</h4>
            <p className="text-zinc-600 leading-relaxed">
              Paste your robotics repository URL (e.g. <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">Ekumen-OS/andino</code>) or select a benchmark robot.
            </p>
          </div>

          <div className="minimal-card p-6 bg-white space-y-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-sm">
              STEP 2
            </div>
            <h4 className="font-bold text-zinc-900 text-sm">Stream ROS 2 Validation</h4>
            <p className="text-zinc-600 leading-relaxed">
              The server validates <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">package.xml</code> manifests and streams live XML AST parser logs via Server-Sent Events.
            </p>
          </div>

          <div className="minimal-card p-6 bg-white space-y-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-sm">
              STEP 3
            </div>
            <h4 className="font-bold text-zinc-900 text-sm">Explore Matrix & 3D Studio</h4>
            <p className="text-zinc-600 leading-relaxed">
              Inspect the 7-layer parameter matrix, manipulate 3D STL sensor origins, and export custom <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">.urdf.xacro</code> code files.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Live Product Showcase Section */}
      <section id="showcase" className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 font-mono">
            Interactive Product Showcase
          </h2>
          <h3 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
            See How UpFreq Inspects & Customizes Mobile Robots
          </h3>
        </div>

        {/* Showcase Switcher Pills */}
        <div className="flex justify-center gap-2 font-mono text-xs overflow-x-auto">
          <button
            onClick={() => setActiveShowcaseTab('3d')}
            className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
              activeShowcaseTab === '3d'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Box className="h-4 w-4 text-indigo-400" />
            1. 3D Studio & Composite STL
          </button>

          <button
            onClick={() => setActiveShowcaseTab('sse')}
            className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
              activeShowcaseTab === 'sse'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Terminal className="h-4 w-4 text-indigo-400" />
            2. Real-Time SSE Stream Scanner
          </button>

          <button
            onClick={() => setActiveShowcaseTab('nav2')}
            className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
              activeShowcaseTab === 'nav2'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Layers className="h-4 w-4 text-indigo-400" />
            3. Nav2 & SLAM Parameter Matrix
          </button>

          <button
            onClick={() => setActiveShowcaseTab('isaac')}
            className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${
              activeShowcaseTab === 'isaac'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Zap className="h-4 w-4 text-indigo-400" />
            4. NVIDIA Isaac Sim Test Suite
          </button>
        </div>

        {/* Tab 1 Showcase: 3D Studio */}
        {activeShowcaseTab === '3d' && (
          <div className="minimal-card p-6 bg-white space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 font-mono">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-zinc-800 ml-2">
                  3D WebGL Studio — 5 Composite STL Meshes Loaded Concurrently
                </span>
              </div>
              <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-md border border-indigo-100">
                tf2_ros Transform Tree Active
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 bg-zinc-950 rounded-xl p-6 text-zinc-100 font-mono text-xs space-y-4 border border-zinc-800">
                <div className="flex justify-between items-center text-[11px] border-b border-zinc-800 pb-2">
                  <span className="text-indigo-400 font-bold">REAL GITHUB STL MESHES (Ekumen-OS/andino)</span>
                  <span className="text-zinc-400">FPS: 60 • WebGL 2.0</span>
                </div>
                <div className="h-56 bg-zinc-900 rounded-lg flex flex-col items-center justify-center border border-zinc-800 text-center p-4 relative overflow-hidden">
                  <div className="absolute top-3 left-3 bg-zinc-950 px-2.5 py-1 rounded text-[10px] text-indigo-400 border border-zinc-800">
                    odom -&gt; base_link -&gt; rplidar_laser_link
                  </div>
                  <Box className="h-12 w-12 text-indigo-500 mb-2 animate-bounce" />
                  <span className="font-bold text-sm text-zinc-100">Ekumen Andino Composite 3D Model</span>
                  <span className="text-[11px] text-zinc-400 mt-1">
                    base_chassis.stl (525KB) • rplidar-a1.stl (314KB) • camera_mount.stl (29KB) • wheel.stl (1.04MB)
                  </span>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4 font-mono text-xs text-zinc-600">
                <div className="flex items-center gap-2 font-bold text-zinc-900 text-sm">
                  <Sliders className="h-4.5 w-4.5 text-indigo-600" />
                  Live Real-Time Kinematic Manipulation
                </div>
                <p className="leading-relaxed">
                  Adjust sensor origin offsets ($x, y, z, r, p, y$) in real-time. Instantly re-calculates transform trees and exports standard <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-900">.urdf.xacro</code> code files.
                </p>
                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-2">
                  <div className="flex justify-between">
                    <span>LiDAR Height Offset (Z):</span>
                    <span className="text-indigo-600 font-bold">0.0848 m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Camera Forward Offset (X):</span>
                    <span className="text-indigo-600 font-bold">0.0980 m</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2 Showcase: Real-Time SSE Stream Scanner */}
        {activeShowcaseTab === 'sse' && (
          <div className="minimal-card p-6 bg-zinc-950 text-zinc-100 font-mono text-xs space-y-4 border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-indigo-400 font-bold text-sm flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-indigo-400" />
                Live Server-Sent Events (SSE) Stream Execution Log
              </span>
              <span className="text-[10px] text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                HTTP Streaming ReadableStream
              </span>
            </div>

            <div className="h-64 overflow-y-auto space-y-2 p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-[11px] leading-relaxed">
              <div className="text-zinc-400">[14:28:01] Connecting to GitHub API [Ekumen-OS/andino] on branch 'main'...</div>
              <div className="text-zinc-400">[14:28:02] Fetched repository file tree: 48 total files discovered.</div>
              <div className="text-indigo-300 font-bold">[14:28:02] VALID ROS REPOSITORY CONFIRMED! Found package.xml and URDF manifests.</div>
              <div className="text-zinc-300">[14:28:02] Parsing ROS package manifest: andino_description/package.xml...</div>
              <div className="text-zinc-300">[14:28:03] Auditing URDF/XACRO kinematics: andino_description/urdf/andino.urdf.xacro...</div>
              <div className="text-zinc-300">[14:28:03] Extracted sensor link 'rplidar_laser_link' at origin xyz="0.0666 0.0 0.084808".</div>
              <div className="text-zinc-300">[14:28:03] Auditing Nav2 navigation stack (andino_navigation) & slam_toolbox...</div>
              <div className="text-emerald-400 font-bold">[14:28:04] ✓ Analysis synthesized and persisted to local database store!</div>
            </div>
          </div>
        )}

        {/* Tab 3 Showcase: Nav2 Parameter Matrix */}
        {activeShowcaseTab === 'nav2' && (
          <div className="minimal-card p-6 bg-white font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <span className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                <Layers className="h-4.5 w-4.5 text-indigo-600" />
                Synthesized Nav2 Navigation Stack & SLAM Toolbox Matrix
              </span>
              <span className="rounded bg-indigo-50 text-indigo-700 px-2.5 py-1 text-xs font-bold border border-indigo-100">
                100% Parsed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-2">
                <span className="font-bold text-indigo-600 block text-xs">andino_navigation (Nav2 Stack)</span>
                <p className="text-zinc-600 text-[11px]">Autonomous path planning, global/local costmaps, and goal navigation.</p>
                <div className="pt-2 text-[10px] space-y-1 text-zinc-500">
                  <div>Launch: <code className="text-zinc-900 font-bold">andino_navigation/launch/navigation.launch.py</code></div>
                  <div>Params: <code className="text-zinc-900 font-bold">andino_navigation/config/nav2_params.yaml</code></div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-2">
                <span className="font-bold text-indigo-600 block text-xs">andino_slam (slam_toolbox)</span>
                <p className="text-zinc-600 text-[11px]">Online asynchronous 2D occupancy grid mapping delegating lifecycle node management.</p>
                <div className="pt-2 text-[10px] space-y-1 text-zinc-500">
                  <div>Launch: <code className="text-zinc-900 font-bold">andino_slam/launch/slam_toolbox_online_async.launch.py</code></div>
                  <div>Solver: <code className="text-zinc-900 font-bold">solver_plugins::CsparseSolver</code></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4 Showcase: NVIDIA Isaac Sim */}
        {activeShowcaseTab === 'isaac' && (
          <div className="minimal-card p-6 bg-white font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <span className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                <Zap className="h-4.5 w-4.5 text-indigo-600" />
                NVIDIA Isaac Sim WebRTC Hardware-in-the-Loop Test Runner
              </span>
              <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded text-xs font-bold border border-rose-100">
                Omniverse PhysX Connected
              </span>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900 text-zinc-100 space-y-3">
              <div className="flex justify-between items-center text-[11px] border-b border-zinc-800 pb-2">
                <span className="text-indigo-400 font-bold">TC-03: NVIDIA Isaac Sim WebRTC HIL Test</span>
                <span className="text-emerald-400 font-bold">✓ TEST PASSED</span>
              </div>
              <pre className="text-[10px] text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                python3 scripts/test_isaac_sim_bridge.py --usd models/andino.usd --physx-step 0.001
              </pre>
            </div>
          </div>
        )}
      </section>

      {/* Key Takeaways Section */}
      <section id="takeaways" className="max-w-4xl mx-auto px-4">
        <div className="minimal-card p-8 bg-zinc-900 text-zinc-100 text-center space-y-6 border-zinc-800">
          <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 px-3.5 py-1 rounded-full text-xs font-mono text-indigo-400 font-bold">
            KEY PLATFORM TAKEAWAYS
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Automate Robotics Parameter Engineering Today
          </h3>

          <p className="text-xs text-zinc-400 font-mono max-w-xl mx-auto leading-relaxed">
            Sign in with your GitHub OAuth account or organization credentials to unlock full agentic analysis, Nav2 parameter matrix extraction, and 3D STL customizer.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-xs">
            <button
              onClick={() => loginWithGithub()}
              className="btn-robotics-primary py-3.5 px-8 text-sm font-bold flex items-center gap-2.5 shadow-md"
            >
              <GithubIcon className="h-4.5 w-4.5 fill-current" />
              Sign In with GitHub OAuth
            </button>

            <Link
              href="/login"
              className="px-6 py-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold border border-zinc-700 transition-all"
            >
              Sign In with Password
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
