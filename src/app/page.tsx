'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createDynamicRobotProfileFromUrl } from '@/lib/andino-data';
import { saveRobotToLibrary } from '@/lib/robot-library';
import { GithubIcon } from '@/components/ui/github-icon';
import { StreamHud } from '@/components/agent/stream-hud';
import { RobotDetailExplorer } from '@/components/dashboard/robot-detail-explorer';
import {
  Cpu, Layers, Box, Terminal, Play,
  Loader2, Compass, HelpCircle,
  Award, Workflow
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loginWithGithub, selectedRobot, setSelectedRobot, setIngestedRepoUrl } = useAuth();

  const [repoUrl, setRepoUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'3d' | 'pipeline' | 'matrix' | 'autonomy'>('3d');

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
                const profile = createDynamicRobotProfileFromUrl(repoUrl, data.result);
                setSelectedRobot(profile);
                setIngestedRepoUrl(repoUrl);
                saveRobotToLibrary(profile);
                setIsAnalyzing(false);
                setStreamLogs(prev => [...prev, '✓ Database Persisted! Redirecting to Dashboard...']);
                setTimeout(() => router.push('/dashboard'), 1200);
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
        <div className="minimal-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-sand-800 pb-3">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-emerald-primary" />
              <h1 className="text-sm font-bold text-sand-100 uppercase tracking-wider font-mono">
                Live GitHub Repository Ingestion Engine
              </h1>
            </div>
            <span className="text-xs font-mono text-emerald-text bg-emerald-light px-3 py-1 rounded-md font-bold border border-emerald-border">
              Authenticated Session
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="flex-1 px-4 py-2.5 rounded-lg border border-sand-700 bg-sand-950 font-mono text-xs text-sand-50 focus:outline-none focus:border-emerald-primary min-w-0"
            />
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing || !repoUrl.trim()}
              className="btn-robotics-primary py-2.5 px-6 font-mono text-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
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
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg text-xs font-mono text-rose-700">
              <span className="font-bold">ROS VALIDATION ERROR: </span>
              {errorMessage}
            </div>
          )}

          {(isAnalyzing || streamLogs.length > 0) && (
            <div className="minimal-card p-4 bg-sand-950 text-sand-100 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-sand-800 pb-2">
                <span className="text-emerald-primary font-bold flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Live SSE Stream Execution Console
                </span>
              </div>
              <div className="h-36 overflow-y-auto space-y-1 p-2 bg-sand-925 rounded border border-sand-800 text-[11px]">
                {streamLogs.map((log, idx) => (
                  <div key={idx} className="text-sand-300 animate-in fade-in">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Stream HUD */}
        <StreamHud repoUrl={repoUrl} isStreaming={isAnalyzing} logs={streamLogs} />

        {/* Exhaustive Robot Detail Explorer — only for a repo that was
            actually analyzed. No fabricated placeholder profile: an
            unaudited repo shows an honest empty state instead. */}
        {selectedRobot ? (
          <RobotDetailExplorer robot={selectedRobot} />
        ) : !isAnalyzing ? (
          <div className="minimal-card p-12 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-sand-800 text-sand-500 flex items-center justify-center">
              <Compass className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-sand-50 font-sans">
                Nothing Analyzed Yet
              </h3>
              <p className="text-xs text-sand-500 font-mono max-w-md mx-auto">
                Enter a GitHub repository URL above and run the audit — the pipeline diagram, sensor matrix, and autonomy module classification only appear once real analysis has completed.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // Production Grade Marketing Landing Page for Unauthenticated Visitors
  return (
    <div className="space-y-16 font-sans text-sand-100 -mt-6 pb-20">

      {/* Marketing Single-Page Header */}
      <header className="sticky top-0 z-40 bg-sand-950/90 backdrop-blur-md border-b border-sand-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-primary text-sand-950 flex items-center justify-center font-mono font-bold text-sm">
            UF
          </div>
          <span className="font-display font-bold text-base text-sand-50 tracking-tight">UpFreq Robotics</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 font-mono text-xs font-semibold text-sand-400">
          <a href="#about" className="hover:text-emerald-primary transition-colors">Platform Purpose</a>
          <a href="#how-to-use" className="hover:text-emerald-primary transition-colors">How To Use</a>
          <a href="#showcase" className="hover:text-emerald-primary transition-colors">Live Interactive Showcase</a>
          <a href="#takeaways" className="hover:text-emerald-primary transition-colors">Key Takeaways</a>
        </nav>

        <div className="flex items-center gap-3 font-mono text-xs">
          <Link href="/login" className="btn-robotics-primary py-2 px-5 text-xs font-bold">
            Sign In to App
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto text-center space-y-8 pt-8 px-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-87.5 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />

        <h1 className="text-4xl sm:text-6xl font-display font-extrabold tracking-tight text-sand-50 leading-[1.15] animate-in fade-in slide-in-from-bottom-4">
          Agentic ROS 2 Codebase Inspection & <br />
          <span className="text-emerald-primary">
            Parameter Intelligence Platform
          </span>
        </h1>

        <p className="text-base sm:text-lg text-sand-400 max-w-3xl mx-auto leading-relaxed font-mono animate-in fade-in slide-in-from-bottom-4 delay-75">
          Connect your robotics GitHub repository to perform real-time ROS/ROS 2 tree validation, parse URDF sensor origins, classify Nav2 &amp; SLAM autonomy modules from real codebase evidence, and render interactive 3D parametric models.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 font-mono text-xs animate-in fade-in slide-in-from-bottom-4 delay-150">
          <button
            onClick={() => loginWithGithub()}
            className="btn-robotics-primary py-3.5 px-8 text-sm font-bold flex items-center gap-2.5 cursor-pointer"
          >
            <GithubIcon className="h-4.5 w-4.5 fill-current" />
            Connect GitHub OAuth
          </button>

          <Link
            href="/login"
            className="btn-secondary-light py-3.5 px-8 text-sm font-semibold"
          >
            Sign In with Password
          </Link>
        </div>

        {/* Clear UX Summary Ribbon */}
        <div id="about" className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left font-mono text-xs">
          {[
            { icon: Compass, title: '1. What Is This Application?', body: "An enterprise platform engineered for robotics CTOs & engineers to audit GitHub repositories, extract physical sensor origins, and classify Nav2 & SLAM autonomy modules from real codebase evidence." },
            { icon: HelpCircle, title: '2. How Do You Use It?', body: "Input your target GitHub repository URL, authorize sign-in, and stream real-time ROS validation logs as URDF transforms and packages are parsed." },
            { icon: Award, title: '3. What Is The Takeaway?', body: "Zero manual URDF editing — automated parameter matrix extraction, a real evidence-based autonomy pipeline diagram, and a 3D parametric model studio." },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={title} className={`minimal-card p-5 space-y-2 animate-in fade-in slide-in-from-bottom-4 delay-${i === 0 ? '150' : i === 1 ? '300' : '300'}`}>
              <div className="flex items-center gap-2 text-emerald-primary font-bold text-sm">
                <Icon className="h-4.5 w-4.5" />
                {title}
              </div>
              <p className="text-sand-400 leading-relaxed text-[11px]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3-Step Quick Start Guide Bar */}
      <section id="how-to-use" className="max-w-6xl mx-auto px-4 space-y-6 font-mono text-xs">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-primary">
            Quick User Workflow
          </h2>
          <h3 className="text-2xl font-display font-extrabold text-sand-50 tracking-tight">
            Get Started in 3 Simple Steps
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: 'STEP 1', title: 'Submit GitHub Repo URL', body: <>Paste your robotics repository URL (e.g. <code className="bg-sand-800 px-1 py-0.5 rounded text-sand-100">Ekumen-OS/andino</code>) or select a benchmark robot.</> },
            { step: 'STEP 2', title: 'Stream ROS 2 Validation', body: <>The server validates <code className="bg-sand-800 px-1 py-0.5 rounded text-sand-100">package.xml</code> manifests and streams live XML AST parser logs via Server-Sent Events.</> },
            { step: 'STEP 3', title: 'Explore Matrix & 3D Studio', body: <>Inspect the parameter matrix, manipulate 3D sensor origins, and export custom <code className="bg-sand-800 px-1 py-0.5 rounded text-sand-100">.urdf.xacro</code> code files.</> },
          ].map(({ step, title, body }) => (
            <div key={step} className="minimal-card p-6 space-y-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-light border border-emerald-border flex items-center justify-center font-bold text-emerald-primary text-sm">
                {step.slice(-1)}
              </div>
              <h4 className="font-bold text-sand-50 text-sm">{title}</h4>
              <p className="text-sand-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Live Product Showcase Section */}
      <section id="showcase" className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-primary font-mono">
            Interactive Product Showcase
          </h2>
          <h3 className="text-3xl font-display font-extrabold text-sand-50 tracking-tight">
            See How UpFreq Inspects & Customizes Mobile Robots
          </h3>
        </div>

        <p className="text-center text-[11px] text-sand-600 font-mono -mt-4">
          Real screenshots from a live audit of <code className="bg-sand-800 px-1 py-0.5 rounded text-sand-300">Ekumen-OS/andino</code> — not mockups.
        </p>

        {/* Showcase Switcher Pills */}
        <div className="flex justify-start sm:justify-center gap-2 font-mono text-xs overflow-x-auto pb-1">
          {[
            { id: '3d' as const, label: '1. 3D Parametric Studio', icon: Box },
            { id: 'pipeline' as const, label: '2. Data-Flow Pipeline Diagram', icon: Workflow },
            { id: 'matrix' as const, label: '3. Parameter Matrix', icon: Layers },
            { id: 'autonomy' as const, label: '4. Autonomy Module Evidence', icon: Cpu },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveShowcaseTab(id)}
              className={`px-4 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeShowcaseTab === id
                  ? 'bg-emerald-primary text-sand-950'
                  : 'bg-sand-925 text-sand-300 border border-sand-800 hover:bg-sand-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab 1 Showcase: 3D Studio */}
        {activeShowcaseTab === '3d' && (
          <div className="minimal-card p-3 sm:p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between px-2 pt-1 font-mono flex-wrap gap-2">
              <span className="text-xs font-bold text-sand-100">3D Parametric Studio — real sensor origins, live kinematic sliders</span>
              <span className="text-xs text-emerald-primary font-bold bg-emerald-light px-3 py-1 rounded-md border border-emerald-border shrink-0">
                Andino 3D model, live-rendered
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/studio-3d-viewport.png" alt="UpFreq 3D Parametric Studio showing the Andino robot's real chassis, LiDAR, and camera meshes with TF frames" className="w-full h-auto rounded-xl border border-sand-800" loading="lazy" />
          </div>
        )}

        {/* Tab 2 Showcase: Data-Flow Pipeline Diagram */}
        {activeShowcaseTab === 'pipeline' && (
          <div className="minimal-card p-3 sm:p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between px-2 pt-1 font-mono flex-wrap gap-2">
              <span className="text-xs font-bold text-sand-100">Interactive node-graph — real sensor→driver→autonomy→control edges</span>
              <span className="text-xs text-emerald-primary font-bold bg-emerald-light px-3 py-1 rounded-md border border-emerald-border shrink-0">
                Built with React Flow
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/pipeline-diagram.png" alt="UpFreq data-flow pipeline diagram showing real ROS topic connections from LiDAR sensor through the SLAM module to motor control" className="w-full h-auto rounded-xl border border-sand-800" loading="lazy" />
          </div>
        )}

        {/* Tab 3 Showcase: Parameter Matrix */}
        {activeShowcaseTab === 'matrix' && (
          <div className="minimal-card p-3 sm:p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between px-2 pt-1 font-mono flex-wrap gap-2">
              <span className="text-xs font-bold text-sand-100">Synthesized parameter matrix — sensors, Nav2/SLAM, Gazebo plugins, topics</span>
              <span className="text-xs text-emerald-primary font-bold bg-emerald-light px-3 py-1 rounded-md border border-emerald-border shrink-0">
                Parsed from real URDF
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/parameter-matrix.png" alt="UpFreq parameter matrix table showing real sensor link names, positions, and orientations parsed from the Andino robot's URDF" className="w-full h-auto rounded-xl border border-sand-800" loading="lazy" />
          </div>
        )}

        {/* Tab 4 Showcase: Autonomy Module Evidence */}
        {activeShowcaseTab === 'autonomy' && (
          <div className="minimal-card p-3 sm:p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between px-2 pt-1 font-mono flex-wrap gap-2">
              <span className="text-xs font-bold text-sand-100">Evidence-based module classification — implemented vs. missing, not guessed</span>
              <span className="text-xs text-emerald-primary font-bold bg-emerald-light px-3 py-1 rounded-md border border-emerald-border shrink-0">
                From real package.xml + launch files
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/autonomy-modules.png" alt="UpFreq autonomy module classification showing SLAM and Navigation marked Implemented in Codebase with real evidence, and Localization marked Missing / Unreferenced" className="w-full h-auto rounded-xl border border-sand-800" loading="lazy" />
          </div>
        )}
      </section>

      {/* Key Takeaways Section */}
      <section id="takeaways" className="max-w-4xl mx-auto px-4">
        <div className="minimal-card p-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-emerald-950 border border-emerald-800 px-3.5 py-1 rounded-full text-xs font-mono text-emerald-100 font-bold">
            KEY PLATFORM TAKEAWAYS
          </div>

          <h3 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-sand-50">
            Automate Robotics Parameter Engineering Today
          </h3>

          <p className="text-xs text-sand-400 font-mono max-w-xl mx-auto leading-relaxed">
            Sign in with your GitHub OAuth account or organization credentials to unlock full agentic analysis, evidence-based Nav2/SLAM classification, and the 3D parametric studio.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-xs">
            <button
              onClick={() => loginWithGithub()}
              className="btn-robotics-primary py-3.5 px-8 text-sm font-bold flex items-center gap-2.5 cursor-pointer"
            >
              <GithubIcon className="h-4.5 w-4.5 fill-current" />
              Sign In with GitHub OAuth
            </button>

            <Link
              href="/login"
              className="px-6 py-3.5 rounded-lg bg-sand-800 hover:bg-sand-700 text-sand-50 font-semibold border border-sand-700 transition-all"
            >
              Sign In with Password
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
