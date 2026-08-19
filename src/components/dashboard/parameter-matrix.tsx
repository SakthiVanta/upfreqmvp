'use client';

import React, { useState } from 'react';
import { RobotProfile } from '@/lib/andino-data';
import { Compass, Cpu, Layers, Radio, FileText, CheckCircle2, Copy, GitFork, Navigation, Terminal, AlertTriangle } from 'lucide-react';

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

  const tabs: Array<{ id: typeof activeTab; label: string; icon: any; count: number }> = [
    { id: 'sensors', label: '1. Sensors', icon: Compass, count: selectedRobot.sensors.length },
    { id: 'navigation', label: '2. Nav2 & SLAM', icon: Navigation, count: selectedRobot.navigationStack.length },
    { id: 'gazebo', label: '3. Simulation Plugins', icon: Cpu, count: selectedRobot.gazeboPlugins.length },
    { id: 'topics', label: '4. ROS Topics', icon: Radio, count: selectedRobot.topics.length },
    { id: 'launch', label: '5. Launch Files', icon: FileText, count: selectedRobot.launchFiles.length },
  ];

  return (
    <div id="diagnostics" className="minimal-card overflow-hidden font-sans">

      {/* Robot Selector Bar */}
      <div className="border-b border-sand-800 bg-sand-925/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitFork className="h-4 w-4 text-emerald-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-sand-100 font-mono">
            Active Robot Model Catalog:
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="px-3 py-1.5 rounded-md text-xs font-extrabold bg-emerald-primary text-sand-950">
            {selectedRobot.name} ({selectedRobot.rosVersion})
          </span>
        </div>
      </div>

      {/* Matrix Tabs Bar */}
      <div className="border-b border-sand-800 bg-sand-950 px-4 py-3 flex flex-wrap items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-emerald-light border border-emerald-border text-emerald-primary">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-sand-50 uppercase tracking-wider">
              Synthesized Intelligence Matrix — {selectedRobot.name}
            </h2>
            <p className="text-[11px] text-sand-500">
              Repo: {selectedRobot.repoUrl} ({selectedRobot.rosVersion})
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-sand-925 p-1 rounded-lg border border-sand-800 overflow-x-auto text-xs">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === id
                  ? 'bg-emerald-primary text-sand-950 shadow-xs'
                  : 'text-sand-400 hover:text-sand-100 hover:bg-sand-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Diagnostic Notice */}
      <div className="bg-amber-50 border-b border-amber-200 p-3.5 px-4 flex items-start gap-3 text-xs text-amber-900 font-mono">
        <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">AGENTIC DIAGNOSTIC NOTICE:</span>
          <span className="ml-1.5">{selectedRobot.diagnosticsNotice}</span>
        </div>
      </div>

      {/* Tab 1: Physical Sensors Table */}
      {activeTab === 'sensors' && (
        <div className="p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse border border-sand-800 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-sand-925 border-b border-sand-800 text-sand-300 font-semibold">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Sensor Name</th>
                <th className="py-2.5 px-3">Link Name</th>
                <th className="py-2.5 px-3">Parent Link</th>
                <th className="py-2.5 px-3">Position (x, y, z) m</th>
                <th className="py-2.5 px-3">Orientation (r, p, y) rad</th>
                <th className="py-2.5 px-3">Collision Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-800">
              {selectedRobot.sensors.map((sensor, idx) => (
                <tr key={sensor.id} className="hover:bg-sand-925/60 transition-colors">
                  <td className="py-3 px-3 text-sand-500 font-bold">{idx + 1}</td>
                  <td className="py-3 px-3 font-bold text-sand-50">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-primary" />
                      {sensor.name}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-emerald-primary bg-emerald-light px-2 py-0.5 rounded border border-emerald-border inline-block">
                      {sensor.linkName}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sand-300">{sensor.parentLink}</td>
                  <td className="py-3 px-3 font-bold text-sand-100">
                    {sensor.position.x}, {sensor.position.y}, {sensor.position.z}
                  </td>
                  <td className="py-3 px-3 text-sand-400">
                    {sensor.orientation.r}, {sensor.orientation.p}, {sensor.orientation.y}
                  </td>
                  <td className="py-3 px-3 text-sand-400">{sensor.collisionType || 'Custom Mesh'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Nav2 & SLAM Navigation Stack */}
      {activeTab === 'navigation' && (
        <div className="p-4 sm:p-6 space-y-6 font-mono text-xs">
          {selectedRobot.navigationStack.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedRobot.navigationStack.map((nav, idx) => (
                <div key={idx} className="minimal-card p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-sand-800 pb-2">
                    <span className="font-bold text-sand-50 text-sm text-emerald-primary">{nav.module}</span>
                    <span className="text-[10px] font-bold text-sand-300 bg-sand-800 px-2 py-0.5 rounded border border-sand-700">
                      {nav.packageProvider}
                    </span>
                  </div>

                  <p className="text-xs text-sand-400 leading-relaxed">{nav.description}</p>

                  <div className="space-y-1.5 pt-2 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-sand-800">
                      <span className="text-sand-500">Launch File:</span>
                      <span className="text-sand-100 font-semibold">{nav.launchFile}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-sand-800">
                      <span className="text-sand-500">Params YAML:</span>
                      <span className="text-sand-100 font-semibold">{nav.configYaml}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-sand-500">Primary Node:</span>
                      <span className="text-emerald-primary font-semibold">{nav.primaryNode}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-sand-800 text-center text-sand-500">
              No Nav2/SLAM sub-packages were detected in this repository's package.xml manifests.
            </div>
          )}

          <div className="minimal-card p-5 bg-sand-950 space-y-3">
            <div className="flex items-center justify-between border-b border-sand-800 pb-2">
              <span className="font-bold text-emerald-primary text-xs flex items-center gap-1.5">
                <Terminal className="h-4 w-4" />
                ROS 2 Nav2 & SLAM Terminal Launch Execution Commands
              </span>
              <span className="text-[10px] text-sand-500">ROS 2 Humble / Jazzy</span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div>
                <span className="text-sand-500">1. Real Robot Mobility Bringup:</span>
                <pre className="bg-sand-925 p-2 rounded text-emerald-primary mt-1 border border-sand-800 overflow-x-auto">
                  ros2 launch {selectedRobot.id}_bringup {selectedRobot.id}_robot.launch.py
                </pre>
              </div>

              <div>
                <span className="text-sand-500">2. Gazebo Simulation Bringup:</span>
                <pre className="bg-sand-925 p-2 rounded text-emerald-primary mt-1 border border-sand-800 overflow-x-auto">
                  ros2 launch {selectedRobot.id}_gz {selectedRobot.id}_gz.launch.py
                </pre>
              </div>

              <div>
                <span className="text-sand-500">3. Online Async SLAM Mapping (slam_toolbox):</span>
                <pre className="bg-sand-925 p-2 rounded text-emerald-primary mt-1 border border-sand-800 overflow-x-auto">
                  ros2 launch {selectedRobot.id}_slam slam_toolbox_online_async.launch.py
                </pre>
              </div>

              <div>
                <span className="text-sand-500">4. Nav2 Autonomous Navigation Launch:</span>
                <pre className="bg-sand-925 p-2 rounded text-emerald-primary mt-1 border border-sand-800 overflow-x-auto">
                  ros2 launch {selectedRobot.id}_navigation navigation.launch.py
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Gazebo System Plugins */}
      {activeTab === 'gazebo' && (
        <div className="p-4 sm:p-6 overflow-x-auto">
          {selectedRobot.gazeboPlugins.length > 0 ? (
            <table className="w-full text-left font-mono text-xs border-collapse border border-sand-800 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-sand-925 border-b border-sand-800 text-sand-300 font-semibold">
                  <th className="py-2.5 px-3">Plugin Name</th>
                  <th className="py-2.5 px-3">Target Link</th>
                  <th className="py-2.5 px-3">Sensor Type</th>
                  <th className="py-2.5 px-3">ROS 2 Topic</th>
                  <th className="py-2.5 px-3">Message Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-800">
                {selectedRobot.gazeboPlugins.map((plugin, idx) => (
                  <tr key={idx} className="hover:bg-sand-925/60 transition-colors">
                    <td className="py-3 px-3 font-bold text-sand-50">{plugin.name}</td>
                    <td className="py-3 px-3 text-emerald-primary font-semibold">{plugin.targetLink}</td>
                    <td className="py-3 px-3 text-sand-300">{plugin.sensorType}</td>
                    <td className="py-3 px-3 text-emerald-primary font-bold">{plugin.rosTopic}</td>
                    <td className="py-3 px-3 text-sand-400">{plugin.rosMessageType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-sand-800 text-center text-sand-500">
              No `&lt;gazebo&gt;` sensor plugin tags were found in this repository's URDF/Xacro files.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: ROS 2 Topics Table */}
      {activeTab === 'topics' && (
        <div className="p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse border border-sand-800 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-sand-925 border-b border-sand-800 text-sand-300 font-semibold">
                <th className="py-2.5 px-3">ROS 2 Topic</th>
                <th className="py-2.5 px-3">Message Type</th>
                <th className="py-2.5 px-3">Direction</th>
                <th className="py-2.5 px-3">Node Owner</th>
                <th className="py-2.5 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-800">
              {selectedRobot.topics.map((t, idx) => (
                <tr key={idx} className="hover:bg-sand-925/60 transition-colors">
                  <td className="py-3 px-3 font-bold text-emerald-primary">{t.topic}</td>
                  <td className="py-3 px-3 text-sand-100 font-medium">{t.type}</td>
                  <td className="py-3 px-3">
                    <span className="rounded bg-sand-800 border border-sand-700 px-2 py-0.5 text-[10px] text-sand-300 font-semibold">
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sand-300">{t.nodeOwner}</td>
                  <td className="py-3 px-3 text-sand-500">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Launch Architecture */}
      {activeTab === 'launch' && (
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
          <div className="minimal-card p-5">
            <h3 className="font-bold text-sand-50 text-sm mb-3">ROS 2 Launch Registry</h3>
            {selectedRobot.launchFiles.length > 0 ? (
              <ul className="space-y-2 text-sand-300">
                {selectedRobot.launchFiles.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between p-2 rounded bg-sand-950 border border-sand-800 gap-2">
                    <span className="text-emerald-primary font-semibold truncate">{file}</span>
                    <button
                      onClick={() => handleCopy(file, `launch-${idx}`)}
                      className="text-sand-500 hover:text-sand-100 p-1 shrink-0 cursor-pointer"
                    >
                      {copiedId === `launch-${idx}` ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sand-500">No launch files detected.</p>
            )}
          </div>

          <div className="minimal-card p-5">
            <h3 className="font-bold text-sand-50 text-sm mb-3">Chassis Physical Parameters</h3>
            <div className="space-y-2 text-sand-300">
              <div className="flex justify-between py-1 border-b border-sand-800">
                <span>Total Robot Mass:</span>
                <span className="text-sand-50 font-bold">{selectedRobot.chassis.totalMassKg} kg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-sand-800">
                <span>Dimensions (L x W x H):</span>
                <span className="text-sand-50 font-bold">
                  {selectedRobot.chassis.length}m x {selectedRobot.chassis.width}m x {selectedRobot.chassis.height}m
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-sand-800">
                <span>Wheelbase Width:</span>
                <span className="text-sand-50 font-bold">{selectedRobot.chassis.wheelbase} m</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Wheel Radius:</span>
                <span className="text-sand-50 font-bold">{selectedRobot.chassis.wheelRadius} m</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
