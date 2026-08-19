'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Play, CheckCircle2, Cpu, ShieldCheck, Box, Compass } from 'lucide-react';
import { GithubIcon } from '@/components/ui/github-icon';

export function Hero() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState('https://github.com/Ekumen-OS/andino');

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/dashboard?preset=andino');
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-sand-400/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Top Partnership & Status Pill */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-sand-700/60 bg-sand-900/90 px-4 py-1.5 backdrop-blur-md shadow-lg">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-sand-200">
              Official Partnership with <strong className="text-emerald-400 font-semibold">UpFreq Robotics</strong>
            </span>
            <span className="h-3 w-px bg-sand-700" />
            <span className="text-[11px] text-sand-400 font-mono">ROS 2 Humble / Gazebo Ignition</span>
          </div>
        </div>

        {/* Main Title & Tagline */}
        <div className="mt-8 text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-sand-50 leading-[1.15]">
            Agentic AI Platform for <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-sand-100 via-emerald-300 to-emerald-500 bg-clip-text text-transparent">
              Autonomous Robotics Intelligence
            </span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-sand-300 max-w-2xl mx-auto leading-relaxed">
            Connect your GitHub ROS/ROS2 repository or use our preset benchmark. 
            Gemini AI agents automatically extract URDF kinematics, sensor spatial origins, 
            Gazebo simulation plugins, and render interactive 3D parametric models.
          </p>
        </div>

        {/* Repository Input Form */}
        <div className="mt-10 max-w-2xl mx-auto">
          <form 
            onSubmit={handleAnalyze} 
            className="sand-card p-2 sm:p-2.5 flex flex-col sm:flex-row items-center gap-2 border-emerald-500/30 shadow-2xl"
          >
            <div className="relative flex-1 w-full flex items-center">
              <GithubIcon className="absolute left-3.5 h-5 w-5 text-sand-400" />
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/ros-robot-repo"
                className="w-full bg-sand-950/80 border border-sand-800 text-sand-100 pl-11 pr-4 py-3 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            
            <button
              type="submit"
              className="w-full sm:w-auto btn-emerald-sand py-3 px-6 text-sm font-semibold whitespace-nowrap shadow-lg"
            >
              <Sparkles className="h-4 w-4" />
              Analyze with Gemini
            </button>
          </form>

          {/* Quick Preset Buttons */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-xs text-sand-400">
            <span>Or test with benchmark preset:</span>
            <button
              onClick={() => router.push('/dashboard?preset=andino')}
              className="inline-flex items-center gap-1.5 rounded-md bg-sand-900 border border-emerald-500/40 px-3 py-1 text-emerald-400 font-mono hover:bg-sand-850 hover:border-emerald-400 transition-colors cursor-pointer"
            >
              <Box className="h-3.5 w-3.5" />
              Ekumen-OS/andino
              <span className="rounded bg-emerald-950 px-1 py-0.5 text-[10px] text-emerald-300">Live Demo</span>
            </button>
          </div>
        </div>

        {/* Feature Pill Matrix */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="sand-card p-4 text-center border-sand-800">
            <div className="inline-flex p-2 rounded-lg bg-emerald-950/80 text-emerald-400 mb-2">
              <Compass className="h-5 w-5" />
            </div>
            <div className="text-xl font-bold text-sand-100 font-mono">2 Sensors</div>
            <div className="text-xs text-sand-400 mt-1">RPLidar A1M8 & Camera V2</div>
          </div>

          <div className="sand-card p-4 text-center border-sand-800">
            <div className="inline-flex p-2 rounded-lg bg-emerald-950/80 text-emerald-400 mb-2">
              <Cpu className="h-5 w-5" />
            </div>
            <div className="text-xl font-bold text-sand-100 font-mono">3 Plugins</div>
            <div className="text-xs text-sand-400 mt-1">Ignition GPU LiDAR & DiffDrive</div>
          </div>

          <div className="sand-card p-4 text-center border-sand-800">
            <div className="inline-flex p-2 rounded-lg bg-emerald-950/80 text-emerald-400 mb-2">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-xl font-bold text-sand-100 font-mono">7 Topics</div>
            <div className="text-xs text-sand-400 mt-1">LaserScan, Image, Twist, TF</div>
          </div>

          <div className="sand-card p-4 text-center border-sand-800">
            <div className="inline-flex p-2 rounded-lg bg-emerald-950/80 text-emerald-400 mb-2">
              <Box className="h-5 w-5" />
            </div>
            <div className="text-xl font-bold text-sand-100 font-mono">3D Parametric</div>
            <div className="text-xs text-sand-400 mt-1">Real-time model editor</div>
          </div>
        </div>

      </div>
    </section>
  );
}
