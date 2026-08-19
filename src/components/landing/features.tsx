'use client';

import React from 'react';
import { Cpu, Terminal, Eye, Layers, Sliders, FileCode, Check, ShieldCheck, Zap } from 'lucide-react';

export function Features() {
  const featureItems = [
    {
      icon: Terminal,
      title: "Real-time Agentic Thinking Stream",
      description: "Watch Gemini AI agents analyze URDF files, expand XACRO macros, trace spatial transform trees, and discover Gazebo plugins live."
    },
    {
      icon: Eye,
      title: "Sensor Origin & Datasheet Mining",
      description: "Extract exact physical sensor origins (x, y, z, r, p, y) from configuration YAMLs and cross-reference with scraped manufacturer specs."
    },
    {
      icon: Sliders,
      title: "Interactive 3D Parametric Studio",
      description: "Inspired by model customization tools, tweak sensor offsets, wheel dimensions, and chassis scales dynamically with real-time 3D feedback."
    },
    {
      icon: Layers,
      title: "Gazebo & ROS 2 Topic Bridge Graph",
      description: "Automatically map Ignition Gazebo system plugins (GPU LiDAR, DiffDrive) to ROS 2 topics (/scan, /image_raw, /cmd_vel, /odom)."
    },
    {
      icon: FileCode,
      title: "Automated URDF / XACRO Generation",
      description: "Export modified robot variants as ready-to-run XACRO parameter packages or JSON parametric profiles for your ROS 2 launch system."
    },
    {
      icon: ShieldCheck,
      title: "GitHub OAuth & Custom Repo Pipeline",
      description: "Connect your GitHub organization account securely via OAuth or evaluate public ROS/ROS2 repositories with one click."
    }
  ];

  return (
    <section className="py-20 bg-sand-900/40 border-t border-b border-sand-800/60 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5" /> Platform Capabilities
          </div>
          <h2 className="mt-4 text-3xl font-extrabold text-sand-50 sm:text-4xl tracking-tight">
            Designed for Next-Generation Robotics Engineers
          </h2>
          <p className="mt-4 text-sm sm:text-base text-sand-300">
            UpFreq combines deep static code analysis with Gemini LLM reasoning to automate ROS 2 documentation, simulation setup, and parametric model synthesis.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                className="sand-card p-6 border-sand-800/80 hover:border-emerald-500/40 hover:bg-sand-900/90 transition-all group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sand-850 border border-sand-700 text-emerald-400 group-hover:bg-emerald-950 group-hover:text-emerald-300 transition-colors shadow-md">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-sand-100 group-hover:text-emerald-400 transition-colors">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-sand-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
