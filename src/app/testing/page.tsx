'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FlaskConical,
  Play,
  Plus,
  RotateCcw,
  Cpu,
  Settings,
  Bot,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { fetchProjects, UserProject } from '@/lib/user-projects';
import { fetchRobotDesigns, RobotDesign } from '@/lib/user-robot-designs';
import { buildUrdfXml } from '@/lib/urdf/serialize';
import { useToast } from '@/components/ui/toast';
import { IsaacStreamViewer } from '@/components/isaac-sim/isaac-stream-viewer';
import { IsaacServerModal } from '@/components/isaac-sim/isaac-server-modal';
import { getSavedIsaacConfig, checkServerHealth, loadRobotToIsaacSim } from '@/lib/isaac-sim/client';
import { TestCase, SimEnvironmentPreset, TestCategory } from '@/lib/testing/types';
import { STANDARD_TEST_PRESETS } from '@/lib/testing/test-presets';
import { executeTestCase } from '@/lib/testing/runner';
import { TestCaseCard } from '@/components/testing/test-case-card';
import { CreateTestModal } from '@/components/testing/create-test-modal';
import { TestReportModal } from '@/components/testing/test-report-modal';

export default function TestingPage() {
  const toast = useToast();

  // Data sources
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [robotDesigns, setRobotDesigns] = useState<RobotDesign[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Selection
  const [targetType, setTargetType] = useState<'project' | 'robot_design'>('project');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedRobotDesignId, setSelectedRobotDesignId] = useState<string>('');

  // Environment & Stage
  const [selectedEnvironment, setSelectedEnvironment] = useState<SimEnvironmentPreset>('grid');
  const [isLoadingToIsaac, setIsLoadingToIsaac] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);

  // Test Suite
  const [testCases, setTestCases] = useState<TestCase[]>(STANDARD_TEST_PRESETS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [activeLog, setActiveLog] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reportingTestCase, setReportingTestCase] = useState<TestCase | null>(null);

  // Load initial projects and robot designs
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProjects(), fetchRobotDesigns()])
      .then(([projs, designs]) => {
        if (cancelled) return;
        setProjects(projs);
        setRobotDesigns(designs);
        if (projs.length > 0) setSelectedProjectId(projs[0].id);
        else if (designs.length > 0) {
          setTargetType('robot_design');
          setSelectedRobotDesignId(designs[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });

    // Check server status
    const config = getSavedIsaacConfig();
    checkServerHealth(config.serverUrl, config.apiKey)
      .then(() => setIsServerOnline(true))
      .catch(() => setIsServerOnline(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const selectedRobotDesign = useMemo(
    () => robotDesigns.find((d) => d.id === selectedRobotDesignId),
    [robotDesigns, selectedRobotDesignId]
  );

  const activeRobotName = useMemo(() => {
    if (targetType === 'project') {
      return (
        selectedProject?.auditedRobotProfile?.name ||
        selectedProject?.auditedRobotProfile?.robotVariants?.[0] ||
        selectedProject?.name ||
        'Project Robot'
      );
    }
    return selectedRobotDesign?.name || 'Robot Design';
  }, [targetType, selectedProject, selectedRobotDesign]);

  const filteredTestCases = useMemo(() => {
    if (selectedCategory === 'all') return testCases;
    return testCases.filter((t) => t.category === selectedCategory);
  }, [testCases, selectedCategory]);

  // Load selected robot and environment into Isaac Sim
  const handleLoadStageToIsaac = async () => {
    const config = getSavedIsaacConfig();
    setIsLoadingToIsaac(true);

    try {
      let urdfContent = '';
      const meshFilesMap: Record<string, string> = {};

      if (targetType === 'robot_design' && selectedRobotDesign) {
        urdfContent = buildUrdfXml(selectedRobotDesign);
      }

      const result = await loadRobotToIsaacSim(
        config.serverUrl,
        {
          robot_name: activeRobotName.replace(/[^a-zA-Z0-9_]/g, '_'),
          urdf_content: urdfContent || undefined,
          mesh_files: meshFilesMap,
          fix_base: false,
          merge_fixed_joints: false,
        },
        config.apiKey
      );

      toast.success(`Stage loaded in Isaac Sim! Environment: ${selectedEnvironment}`);
      setIsServerOnline(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect to Isaac Sim server.');
      setIsServerOnline(false);
      setShowServerModal(true);
    } finally {
      setIsLoadingToIsaac(false);
    }
  };

  // Run a single test case
  const handleRunTestCase = async (testCase: TestCase) => {
    const config = getSavedIsaacConfig();
    setRunningTestId(testCase.id);
    setActiveLog([]);

    try {
      const record = await executeTestCase(
        config.serverUrl,
        config.apiKey,
        testCase,
        (line) => setActiveLog((prev) => [...prev, line])
      );

      setTestCases((prev) =>
        prev.map((t) => (t.id === testCase.id ? { ...t, lastRun: record } : t))
      );

      if (record.status === 'passed') {
        toast.success(`Test "${testCase.name}" PASSED`);
      } else {
        toast.error(`Test "${testCase.name}" FAILED`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Test execution encountered an error.');
    } finally {
      setRunningTestId(null);
    }
  };

  // Run all test cases sequentially
  const handleRunAllTests = async () => {
    if (isRunningAll) return;
    setIsRunningAll(true);
    const config = getSavedIsaacConfig();

    for (const testCase of testCases) {
      setRunningTestId(testCase.id);
      setActiveLog([]);
      try {
        const record = await executeTestCase(
          config.serverUrl,
          config.apiKey,
          testCase,
          (line) => setActiveLog((prev) => [...prev, line])
        );
        setTestCases((prev) =>
          prev.map((t) => (t.id === testCase.id ? { ...t, lastRun: record } : t))
        );
      } catch (e) {
        console.error(e);
      }
    }

    setRunningTestId(null);
    setIsRunningAll(false);
    toast.success('Completed all test suites!');
  };

  const handleAddCustomTestCase = (newCase: TestCase) => {
    setTestCases((prev) => [newCase, ...prev]);
    toast.success(`Added test case: "${newCase.name}"`);
  };

  if (isLoadingData) {
    return (
      <div className="minimal-card p-12 text-center">
        <Loader2 className="h-6 w-6 mx-auto text-sand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-8 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-light border border-emerald-border rounded">
              <FlaskConical className="h-5 w-5 text-emerald-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-sand-50 tracking-tight">
              Simulation & Validation Testing
            </h1>
          </div>
          <p className="text-sand-500 text-xs sm:text-sm">
            Load robots into NVIDIA Isaac Sim environments, run automated physics test suites, and verify kinematics & dynamics assertions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowServerModal(true)}
            className="btn-secondary-light py-2 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" />
            Isaac Server Settings
          </button>
        </div>
      </div>

      {/* Target Robot & Environment Stage Selection Card */}
      <div className="minimal-card p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Target Model Selector */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-sand-400 uppercase tracking-wider">
              1. Select Robot Target
            </label>
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => setTargetType('project')}
                className={`flex-1 py-1 text-[11px] font-bold border rounded ${
                  targetType === 'project'
                    ? 'bg-sand-800 text-sand-50 border-sand-700'
                    : 'text-sand-500 border-sand-800'
                }`}
              >
                Project Repo
              </button>
              <button
                type="button"
                onClick={() => setTargetType('robot_design')}
                className={`flex-1 py-1 text-[11px] font-bold border rounded ${
                  targetType === 'robot_design'
                    ? 'bg-sand-800 text-sand-50 border-sand-700'
                    : 'text-sand-500 border-sand-800'
                }`}
              >
                Robot Studio
              </button>
            </div>

            {targetType === 'project' ? (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.auditedRobotProfile ? `(${p.auditedRobotProfile.name || p.auditedRobotProfile.robotVariants?.[0] || 'Audited'})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedRobotDesignId}
                onChange={(e) => setSelectedRobotDesignId(e.target.value)}
                className="w-full px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
              >
                {robotDesigns.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.links.length} links, {d.joints.length} joints)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Environment Preset */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-sand-400 uppercase tracking-wider">
              2. Simulation Stage Environment
            </label>
            <select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value as any)}
              className="w-full px-3 py-2 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
            >
              <option value="grid">Metric Precision Grid (0.1m Calibration)</option>
              <option value="warehouse">Logistics Warehouse (Shelving & Pallets)</option>
              <option value="laboratory">Robotics Testbed Lab (Obstacle Course)</option>
              <option value="incline_slope">15° Incline Slope (Traction & Slope)</option>
              <option value="rough_terrain">Rough Terrain Elevation (Outdoor Heightmap)</option>
              <option value="empty">Empty USD Stage</option>
            </select>
          </div>

          {/* Load in Isaac Sim Button */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-sand-400 uppercase tracking-wider">
              3. Deploy Stage
            </label>
            <button
              onClick={handleLoadStageToIsaac}
              disabled={isLoadingToIsaac}
              className="w-full btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoadingToIsaac ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
              {isLoadingToIsaac ? 'Deploying to Isaac Sim...' : 'Load Stage in Isaac Sim'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Live Viewport on Left, Test Suites on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Isaac Sim WebRTC Viewport */}
        <div className="lg:col-span-7 space-y-4">
          <div className="h-[480px] w-full rounded border border-sand-800 overflow-hidden bg-black">
            <IsaacStreamViewer
              robotName={activeRobotName}
              onOpenSettings={() => setShowServerModal(true)}
            />
          </div>

          {/* Real-time Stepper Log during test runs */}
          {runningTestId && (
            <div className="p-3.5 bg-sand-950 border border-sand-800 rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Live Test Execution Log
                </span>
                <span className="font-mono text-[10px] text-sand-500">30Hz PhysX Stepper</span>
              </div>
              <div className="font-mono text-[11px] text-sand-300 space-y-1 max-h-32 overflow-y-auto">
                {activeLog.map((line, idx) => (
                  <div key={idx} className="leading-tight">{line}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Test Suites & Cases */}
        <div className="lg:col-span-5 space-y-4">
          <div className="minimal-card p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold text-sand-50 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-emerald-primary" />
                Validation Test Suites ({filteredTestCases.length})
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-2.5 py-1 bg-sand-800 hover:bg-sand-700 text-sand-100 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3 text-emerald-primary" />
                  New Test
                </button>

                <button
                  onClick={handleRunAllTests}
                  disabled={isRunningAll || runningTestId !== null}
                  className="btn-emerald-primary py-1 px-3 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isRunningAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                  {isRunningAll ? 'Running All...' : 'Run All Suites'}
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
              {['all', 'kinematics', 'velocity_braking', 'collision_avoidance', 'incline_stability', 'payload_capacity'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded font-bold uppercase transition-colors shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-sand-800 text-emerald-400 border border-sand-700'
                      : 'bg-sand-950 text-sand-500 hover:text-sand-300'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Test Cases List */}
            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
              {filteredTestCases.map((tc) => (
                <TestCaseCard
                  key={tc.id}
                  testCase={tc}
                  isRunning={runningTestId === tc.id}
                  onRun={() => handleRunTestCase(tc)}
                  onViewReport={() => setReportingTestCase(tc)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showServerModal && (
        <IsaacServerModal
          onClose={() => setShowServerModal(false)}
          onConfigSaved={() => {
            const config = getSavedIsaacConfig();
            checkServerHealth(config.serverUrl, config.apiKey)
              .then(() => setIsServerOnline(true))
              .catch(() => setIsServerOnline(false));
          }}
        />
      )}

      {showCreateModal && (
        <CreateTestModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleAddCustomTestCase}
        />
      )}

      {reportingTestCase && (
        <TestReportModal
          testCase={reportingTestCase}
          onClose={() => setReportingTestCase(null)}
        />
      )}
    </div>
  );
}
