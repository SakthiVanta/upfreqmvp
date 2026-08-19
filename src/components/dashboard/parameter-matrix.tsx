'use client';

import React, { useState } from 'react';
import { RobotProfile } from '@/lib/andino-data';
import { Compass, Cpu, Layers, Radio, FileText, CheckCircle2, Copy, ExternalLink, HardDrive, AlertTriangle, GitFork, Package, ShieldCheck, Navigation, Map, Play, Terminal } from 'lucide-react';

export function ParameterMatrix({ 
  selectedRobot,
  onSelectRobot 
}: { 
  selectedRobot: RobotProfile;
  onSelectRobot?: (robot: RobotProfile) => void;
}) {
  const [activeTab, setActiveTab] = useState<'sensors' | 'navigation' | 'gazebo' | 'topics' | 'launch'>('sensors');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div id="diagnostics" className="minimal-card overflow-hidden bg-white border-slate-200 shadow-sm font-sans">
      
      {/* Robot Selector Bar */}
      <div className="border-b border-slate-200 bg-slate-100/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitFork className="h-4 w-4 text-robotics-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
            Active Robot Model Catalog:
          </span>
        </div>

        {/* Active Robot Badge */}
        <div className="flex items-center gap-2 font-mono">
          <span className="px-3 py-1.5 rounded-md text-xs font-extrabold bg-slate-900 text-white shadow-xs">
            {selectedRobot.name} ({selectedRobot.rosVersion})
          </span>
        </div>
      </div>

      {/* Matrix Tabs Bar */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-robotics-light border border-robotics-border text-robotics-primary">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Synthesized Intelligence Matrix — {selectedRobot.name}
            </h2>
            <p className="text-[11px] text-slate-500">
              Repo: {selectedRobot.repoUrl} ({selectedRobot.rosVersion})
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 overflow-x-auto shadow-xs text-xs">
          <button
            onClick={() => setActiveTab('sensors')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'sensors'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-robotics-primary" />
            1. Sensors ({selectedRobot.sensors.length})
          </button>

          <button
            onClick={() => setActiveTab('navigation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'navigation'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Navigation className="h-3.5 w-3.5 text-robotics-primary" />
            2. Nav2 & SLAM ({selectedRobot.navigationStack.length})
          </button>

          <button
            onClick={() => setActiveTab('gazebo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'gazebo'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            3. Simulation Plugins ({selectedRobot.gazeboPlugins.length})
          </button>

          <button
            onClick={() => setActiveTab('topics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'topics'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            4. ROS Topics ({selectedRobot.topics.length})
          </button>

          <button
            onClick={() => setActiveTab('launch')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'launch'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            5. Launch Files
          </button>
        </div>
      </div>

      {/* Dynamic Diagnostic Notice */}
      <div className="bg-amber-50 border-b border-amber-200 p-3.5 px-4 flex items-start gap-3 text-xs text-amber-900 font-mono">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">AGENTIC DIAGNOSTIC NOTICE:</span>
          <span className="ml-1.5">{selectedRobot.diagnosticsNotice}</span>
        </div>
      </div>

      {/* Tab 1: Physical Sensors Table */}
      {activeTab === 'sensors' && (
        <div className="p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Sensor Name</th>
                <th className="py-2.5 px-3">Link Name</th>
                <th className="py-2.5 px-3">Parent Link</th>
                <th className="py-2.5 px-3">Position (x, y, z) m</th>
                <th className="py-2.5 px-3">Orientation (r, p, y) rad</th>
                <th className="py-2.5 px-3">Collision Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {selectedRobot.sensors.map((sensor, idx) => (
                <tr key={sensor.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 text-slate-500 font-bold">{idx + 1}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-robotics-primary" />
                      {sensor.name}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-robotics-primary bg-robotics-light px-2 rounded border border-robotics-border inline-block my-2">
                    {sensor.linkName}
                  </td>
                  <td className="py-3 px-3 text-slate-700">{sensor.parentLink}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {sensor.position.x}, {sensor.position.y}, {sensor.position.z}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {sensor.orientation.r}, {sensor.orientation.p}, {sensor.orientation.y}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{sensor.collisionType || 'Custom Mesh'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Nav2 & SLAM Navigation Stack */}
      {activeTab === 'navigation' && (
        <div className="p-4 sm:p-6 space-y-6 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {selectedRobot.navigationStack.map((nav, idx) => (
              <div key={idx} className="minimal-card p-5 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 text-sm text-robotics-primary">{nav.module}</span>
                  <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {nav.packageProvider}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{nav.description}</p>

                <div className="space-y-1.5 pt-2 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Launch File:</span>
                    <span className="text-slate-900 font-semibold">{nav.launchFile}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Params YAML:</span>
                    <span className="text-slate-900 font-semibold">{nav.configYaml}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Primary Node:</span>
                    <span className="text-robotics-primary font-semibold">{nav.primaryNode}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="minimal-card p-5 bg-slate-900 text-slate-100 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-robotics-primary text-xs flex items-center gap-1.5">
                <Terminal className="h-4 w-4" />
                ROS 2 Nav2 & SLAM Terminal Launch Execution Commands
              </span>
              <span className="text-[10px] text-slate-400">ROS 2 Humble / Jazzy</span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div>
                <span className="text-slate-400">1. Real Robot Mobility Bringup:</span>
                <pre className="bg-slate-950 p-2 rounded text-robotics-primary mt-1 border border-slate-800">
                  ros2 launch andino_bringup andino_robot.launch.py
                </pre>
              </div>

              <div>
                <span className="text-slate-400">2. Gazebo Simulation Bringup:</span>
                <pre className="bg-slate-950 p-2 rounded text-robotics-primary mt-1 border border-slate-800">
                  ros2 launch andino_gz andino_gz.launch.py
                </pre>
              </div>

              <div>
                <span className="text-slate-400">3. Online Async SLAM Mapping (slam_toolbox):</span>
                <pre className="bg-slate-950 p-2 rounded text-robotics-primary mt-1 border border-slate-800">
                  ros2 launch andino_slam slam_toolbox_online_async.launch.py
                </pre>
              </div>

              <div>
                <span className="text-slate-400">4. Nav2 Autonomous Navigation Launch:</span>
                <pre className="bg-slate-950 p-2 rounded text-robotics-primary mt-1 border border-slate-800">
                  ros2 launch andino_navigation navigation.launch.py
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Gazebo System Plugins */}
      {activeTab === 'gazebo' && (
        <div className="p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-2.5 px-3">Plugin Name</th>
                <th className="py-2.5 px-3">Target Link</th>
                <th className="py-2.5 px-3">Sensor Type</th>
                <th className="py-2.5 px-3">ROS 2 Topic</th>
                <th className="py-2.5 px-3">Message Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {selectedRobot.gazeboPlugins.map((plugin, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">{plugin.name}</td>
                  <td className="py-3 px-3 text-robotics-primary font-semibold">{plugin.targetLink}</td>
                  <td className="py-3 px-3 text-slate-700">{plugin.sensorType}</td>
                  <td className="py-3 px-3 text-robotics-primary font-bold">{plugin.rosTopic}</td>
                  <td className="py-3 px-3 text-slate-600">{plugin.rosMessageType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: ROS 2 Topics Table */}
      {activeTab === 'topics' && (
        <div className="p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-2.5 px-3">ROS 2 Topic</th>
                <th className="py-2.5 px-3">Message Type</th>
                <th className="py-2.5 px-3">Direction</th>
                <th className="py-2.5 px-3">Node Owner</th>
                <th className="py-2.5 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {selectedRobot.topics.map((t, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-bold text-robotics-primary">{t.topic}</td>
                  <td className="py-3 px-3 text-slate-900 font-medium">{t.type}</td>
                  <td className="py-3 px-3">
                    <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700 font-semibold">
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700">{t.nodeOwner}</td>
                  <td className="py-3 px-3 text-slate-500">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Launch Architecture */}
      {activeTab === 'launch' && (
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
          <div className="minimal-card p-5 bg-white">
            <h3 className="font-bold text-slate-900 text-sm mb-3">ROS 2 Launch Registry</h3>
            <ul className="space-y-2 text-slate-700">
              {selectedRobot.launchFiles.map((file, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="text-robotics-primary font-semibold">{file}</span>
                  <button 
                    onClick={() => handleCopy(file, `launch-${idx}`)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    {copiedId === `launch-${idx}` ? <CheckCircle2 className="h-3.5 w-3.5 text-robotics-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="minimal-card p-5 bg-white">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Chassis Physical Parameters</h3>
            <div className="space-y-2 text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Total Robot Mass:</span>
                <span className="text-slate-900 font-bold">{selectedRobot.chassis.totalMassKg} kg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Dimensions (L x W x H):</span>
                <span className="text-slate-900 font-bold">
                  {selectedRobot.chassis.length}m x {selectedRobot.chassis.width}m x {selectedRobot.chassis.height}m
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Wheelbase Width:</span>
                <span className="text-slate-900 font-bold">{selectedRobot.chassis.wheelbase} m</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Wheel Radius:</span>
                <span className="text-slate-900 font-bold">{selectedRobot.chassis.wheelRadius} m</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
