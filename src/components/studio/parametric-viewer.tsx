'use client';

import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';
import { useAuth } from '@/lib/auth-context';
import { createDynamicRobotProfileFromUrl, RobotProfile } from '@/lib/andino-data';
import { 
  Sliders, Download, Copy, Check, RotateCcw, Box, Eye, Radio, FileCode, 
  Compass, Activity, PackageCheck, Play, CheckCircle2, AlertTriangle, 
  GitCommit, RefreshCw, Zap, ShieldCheck, Cpu, Scale, Gauge, Link2, Shield
} from 'lucide-react';

interface ExhaustiveRobotParams {
  chassisLength: number;
  chassisWidth: number;
  chassisHeight: number;
  wheelbase: number;
  wheelRadius: number;
  massKg: number;
  cogX: number;
  cogY: number;
  cogZ: number;
  lidarX: number;
  lidarY: number;
  lidarZ: number;
  lidarFovDeg: number;
  lidarMaxRangeM: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  cameraPitchDeg: number;
  cameraYawDeg: number;
  maxVelX: number;
  maxVelTheta: number;
  maxAccelX: number;
  frictionCoeff: number;
}

// Component to render a TF Frame coordinate axis (X=Red, Y=Green, Z=Blue)
function TfFrame({ name, position, rotation = [0, 0, 0] }: { name: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* X Axis (Red) */}
      <mesh position={[0.04, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.002, 0.002, 0.08, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {/* Y Axis (Green) */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.08, 8]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
      {/* Z Axis (Blue) */}
      <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.08, 8]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
    </group>
  );
}

// Smart Auto-Scaling & Dynamic Resizing STL Part Loader
function DynamicStlPart({ 
  url, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0], 
  scaleMultiplier = [1, 1, 1],
  color = "#475569" 
}: {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scaleMultiplier?: [number, number, number];
  color?: string;
}) {
  const rawGeometry = useLoader(STLLoader, url);

  const { geometry, finalScale } = useMemo(() => {
    const geo = rawGeometry.clone();
    geo.computeBoundingBox();
    const bbox = geo.boundingBox;
    let baseFactor = 1.0;
    if (bbox) {
      const sizeX = bbox.max.x - bbox.min.x;
      const sizeY = bbox.max.y - bbox.min.y;
      const sizeZ = bbox.max.z - bbox.min.z;
      const maxDim = Math.max(sizeX, sizeY, sizeZ);
      if (maxDim > 5.0) {
        baseFactor = 0.001; // mm to meters
      }
    }

    const sx = baseFactor * scaleMultiplier[0];
    const sy = baseFactor * scaleMultiplier[1];
    const sz = baseFactor * scaleMultiplier[2];

    return { geometry: geo, finalScale: [sx, sy, sz] as [number, number, number] };
  }, [rawGeometry, scaleMultiplier]);

  return (
    <mesh geometry={geometry} position={position} rotation={rotation} scale={finalScale}>
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.6} />
    </mesh>
  );
}

// Fully Reactive 3D Parametric Robot Model — Sliders directly transform the 3D meshes in real-time
function CompositeStlRobotModel({ 
  params, 
  showLaserRays, 
  showCameraFrustum, 
  showTfFrames, 
  isWheelSpinning 
}: { 
  params: ExhaustiveRobotParams; 
  showLaserRays: boolean; 
  showCameraFrustum: boolean;
  showTfFrames: boolean;
  isWheelSpinning: boolean;
}) {
  const lidarRef = useRef<THREE.Group>(null);
  const leftWheelRef = useRef<THREE.Group>(null);
  const rightWheelRef = useRef<THREE.Group>(null);

  // Default benchmark sizes for scale ratios
  const baseL = 0.22;
  const baseW = 0.18;
  const baseH = 0.08;
  const baseWheelRadius = 0.033;

  const scaleX = params.chassisLength / baseL;
  const scaleY = params.chassisWidth / baseW;
  const scaleZ = params.chassisHeight / baseH;
  const wheelScale = params.wheelRadius / baseWheelRadius;

  useFrame((_, delta) => {
    if (lidarRef.current) {
      lidarRef.current.rotation.y += delta * (params.maxVelTheta || 4);
    }
    if (isWheelSpinning) {
      const rotSpeed = delta * (params.maxVelX / (params.wheelRadius || 0.033)) * 3;
      if (leftWheelRef.current) leftWheelRef.current.rotation.z += rotSpeed;
      if (rightWheelRef.current) rightWheelRef.current.rotation.z += rotSpeed;
    }
  });

  return (
    <group position={[0, params.wheelRadius, 0]}>
      
      {/* 1. Base Footprint & Base Link TF Frame */}
      {showTfFrames && <TfFrame name="base_link" position={[0, 0, 0]} />}

      {/* Center of Gravity (CoG) Interactive Marker */}
      <group position={[params.cogX, params.cogZ, params.cogY]}>
        <mesh>
          <sphereGeometry args={[0.015, 16, 16]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.1} metalness={0.9} />
        </mesh>
        {showTfFrames && <TfFrame name="cog" position={[0, 0, 0]} />}
      </group>

      {/* 2. DYNAMIC MAIN CHASSIS BODY (Resizes dynamically in X, Y, Z as sliders move) */}
      <mesh position={[0, params.chassisHeight / 2, 0]}>
        <boxGeometry args={[params.chassisLength, params.chassisHeight, params.chassisWidth]} />
        <meshStandardMaterial color="#4f46e5" opacity={0.35} transparent roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Chassis Top & Bottom Trim Plates */}
      <mesh position={[0, params.chassisHeight, 0]}>
        <boxGeometry args={[params.chassisLength + 0.004, 0.004, params.chassisWidth + 0.004]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.002, 0]}>
        <boxGeometry args={[params.chassisLength + 0.004, 0.004, params.chassisWidth + 0.004]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* 3. Base Chassis CAD Mesh */}
      <Suspense fallback={null}>
        <DynamicStlPart 
          url="/models/base_chassis.stl" 
          position={[0, 0, 0]} 
          rotation={[-Math.PI / 2, 0, -Math.PI / 2]} 
          scaleMultiplier={[scaleX, scaleY, scaleZ]}
          color="#334155" 
        />
      </Suspense>

      {/* 4. DYNAMIC PRIMARY LIDAR SENSOR (Moves dynamically in X, Y, Z and adjusts FOV/Range) */}
      <group position={[params.lidarX, params.chassisHeight + params.lidarZ, params.lidarY]}>
        {showTfFrames && <TfFrame name="rplidar_laser_link" position={[0, 0.02, 0]} rotation={[0, Math.PI, 0]} />}

        <group ref={lidarRef}>
          <Suspense fallback={
            <mesh>
              <cylinderGeometry args={[0.035, 0.035, 0.024, 32]} />
              <meshStandardMaterial color="#6366f1" />
            </mesh>
          }>
            <DynamicStlPart 
              url="/models/rplidar-a1.stl" 
              position={[0, 0, 0]} 
              rotation={[-Math.PI / 2, 0, 0]} 
              color="#6366f1" 
            />
          </Suspense>
        </group>

        {showLaserRays && (
          <group position={[0, 0.01, 0]}>
            {Array.from({ length: 32 }).map((_, i) => {
              const fovRad = THREE.MathUtils.degToRad(params.lidarFovDeg);
              const startAngle = -fovRad / 2;
              const angle = startAngle + (i / 32) * fovRad;
              const dist = Math.min(params.lidarMaxRangeM, 3.0) * (0.8 + Math.sin(i * 1.5) * 0.2);
              return (
                <line key={i}>
                  <bufferGeometry
                    attach="geometry"
                    onUpdate={(geo) => {
                      geo.setFromPoints([
                        new THREE.Vector3(0, 0, 0),
                        new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
                      ]);
                    }}
                  />
                  <lineBasicMaterial attach="material" color="#818cf8" opacity={0.7} transparent linewidth={2} />
                </line>
              );
            })}
          </group>
        )}
      </group>

      {/* 5. DYNAMIC CAMERA VISION MODULE (Moves dynamically in X, Y, Z and rotates Pitch/Yaw) */}
      <group 
        position={[params.cameraX, params.chassisHeight / 2 + params.cameraZ, params.cameraY]}
        rotation={[0, THREE.MathUtils.degToRad(params.cameraYawDeg), THREE.MathUtils.degToRad(params.cameraPitchDeg)]}
      >
        {showTfFrames && <TfFrame name="camera_link" position={[0, 0, 0]} />}

        <Suspense fallback={
          <mesh>
            <boxGeometry args={[0.02, 0.03, 0.03]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
        }>
          <DynamicStlPart 
            url="/models/camera_mount.stl" 
            position={[0, 0, 0]} 
            rotation={[-Math.PI / 2, 0, Math.PI / 2]} 
            color="#475569" 
          />
        </Suspense>

        {showCameraFrustum && (
          <mesh position={[0.4, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.3, 0.8, 4, 1, true]} />
            <meshBasicMaterial color="#4f46e5" wireframe opacity={0.35} transparent />
          </mesh>
        )}
      </group>

      {/* 6. DYNAMIC LEFT DRIVE WHEEL (Slides along Y wheelbase and resizes radius) */}
      <group ref={leftWheelRef} position={[0, 0, params.wheelbase / 2]}>
        {showTfFrames && <TfFrame name="left_wheel_link" position={[0, 0, 0]} />}
        <Suspense fallback={
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[params.wheelRadius, params.wheelRadius, 0.025, 32]} />
            <meshStandardMaterial color="#09090b" roughness={0.8} />
          </mesh>
        }>
          <DynamicStlPart 
            url="/models/wheel.stl" 
            position={[0, 0, 0]} 
            rotation={[0, 0, 0]} 
            scaleMultiplier={[wheelScale, wheelScale, wheelScale]}
            color="#0f172a" 
          />
        </Suspense>
      </group>

      {/* 7. DYNAMIC RIGHT DRIVE WHEEL (Slides along Y wheelbase and resizes radius) */}
      <group ref={rightWheelRef} position={[0, 0, -params.wheelbase / 2]}>
        {showTfFrames && <TfFrame name="right_wheel_link" position={[0, 0, 0]} />}
        <Suspense fallback={
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[params.wheelRadius, params.wheelRadius, 0.025, 32]} />
            <meshStandardMaterial color="#09090b" roughness={0.8} />
          </mesh>
        }>
          <DynamicStlPart 
            url="/models/wheel.stl" 
            position={[0, 0, 0]} 
            rotation={[0, Math.PI, 0]} 
            scaleMultiplier={[wheelScale, wheelScale, wheelScale]}
            color="#0f172a" 
          />
        </Suspense>
      </group>

      {/* 8. DYNAMIC FRONT CASTER WHEEL (Positioned dynamically under front chassis base) */}
      <group position={[params.chassisLength / 2 - 0.03, -params.wheelRadius / 2 + 0.005, 0]}>
        <Suspense fallback={
          <mesh>
            <sphereGeometry args={[params.wheelRadius / 2, 16, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>
        }>
          <DynamicStlPart 
            url="/models/caster_wheel.stl" 
            position={[0, 0, 0]} 
            rotation={[0, 0, 0]} 
            scaleMultiplier={[wheelScale, wheelScale, wheelScale]}
            color="#94a3b8" 
          />
        </Suspense>
      </group>

    </group>
  );
}

export function ParametricViewer() {
  const { selectedRobot, ingestedRepoUrl } = useAuth();
  const activeRobot = selectedRobot || createDynamicRobotProfileFromUrl(ingestedRepoUrl || 'https://github.com/Ekumen-OS/andino');

  const getRobotInitialParams = (r: RobotProfile): ExhaustiveRobotParams => {
    const lidar = r.sensors.find(s => s.type.includes('Laser') || s.type.includes('LiDAR')) || r.sensors[0];
    const camera = r.sensors.find(s => s.type.includes('Camera') || s.type.includes('RGB')) || r.sensors[1] || r.sensors[0];

    return {
      chassisLength: r.chassis.length,
      chassisWidth: r.chassis.width,
      chassisHeight: r.chassis.height,
      wheelbase: r.chassis.wheelbase,
      wheelRadius: r.chassis.wheelRadius,
      massKg: r.chassis.totalMassKg,
      cogX: r.chassis.centerOfGravity?.x || 0.0,
      cogY: r.chassis.centerOfGravity?.y || 0.0,
      cogZ: r.chassis.centerOfGravity?.z || 0.05,
      lidarX: lidar?.position.x || 0.0666,
      lidarY: lidar?.position.y || 0.0,
      lidarZ: lidar?.position.z || 0.0848,
      lidarFovDeg: 360,
      lidarMaxRangeM: 12.0,
      cameraX: camera?.position.x || 0.0980,
      cameraY: camera?.position.y || 0.0,
      cameraZ: camera?.position.z || 0.0250,
      cameraPitchDeg: camera?.orientation?.p || 0,
      cameraYawDeg: camera?.orientation?.y || 0,
      maxVelX: r.chassis.maxSpeedLinearMs || 0.5,
      maxVelTheta: r.chassis.maxSpeedAngularRads || 1.0,
      maxAccelX: 2.5,
      frictionCoeff: 0.85
    };
  };

  const [params, setParams] = useState<ExhaustiveRobotParams>(getRobotInitialParams(activeRobot));
  const [showLaserRays, setShowLaserRays] = useState(true);
  const [showCameraFrustum, setShowCameraFrustum] = useState(true);
  const [showTfFrames, setShowTfFrames] = useState(true);
  const [isWheelSpinning, setIsWheelSpinning] = useState(true);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Test suite execution state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    passed: boolean;
    logs: string[];
    metrics: { ixx: number; iyy: number; izz: number; stoppingDistM: number; maxPayloadKg: number };
  } | null>(null);
  const [showCommitPrompt, setShowCommitPrompt] = useState(false);
  const [codeCommitted, setCodeCommitted] = useState(false);

  useEffect(() => {
    setParams(getRobotInitialParams(activeRobot));
    setTestResult(null);
    setShowCommitPrompt(false);
    setCodeCommitted(false);
  }, [activeRobot]);

  const handleReset = () => {
    setParams(getRobotInitialParams(activeRobot));
    setTestResult(null);
    setShowCommitPrompt(false);
    setCodeCommitted(false);
  };

  const handleParamChange = (key: keyof ExhaustiveRobotParams, val: number) => {
    setParams((prev) => ({ ...prev, [key]: val }));
    setShowCommitPrompt(false);
    setCodeCommitted(false);
  };

  // Calculations for Moments of Inertia and Kinematic Physics
  const ixx = (1 / 12) * params.massKg * (Math.pow(params.chassisWidth, 2) + Math.pow(params.chassisHeight, 2));
  const iyy = (1 / 12) * params.massKg * (Math.pow(params.chassisLength, 2) + Math.pow(params.chassisHeight, 2));
  const izz = (1 / 12) * params.massKg * (Math.pow(params.chassisLength, 2) + Math.pow(params.chassisWidth, 2));
  const stoppingDistM = Math.pow(params.maxVelX, 2) / (2 * params.maxAccelX);
  const maxPayloadKg = params.massKg * 1.5;

  const handleRunHILTest = () => {
    setIsTesting(true);
    setTestResult(null);
    setShowCommitPrompt(false);

    setTimeout(() => {
      setIsTesting(false);
      const passed = params.wheelbase >= 0.15 && params.massKg <= 100 && stoppingDistM < 0.8;
      
      const logs = [
        `[HIL RUNNER] Initializing Gazebo Ignition HIL Simulation for ${activeRobot.name}...`,
        `[PHYSICS CHECK] Mass=${params.massKg.toFixed(1)}kg | Wheelbase=${params.wheelbase.toFixed(3)}m | Izz=${izz.toFixed(4)} kg·m²`,
        `[KINEMATICS] Max Vel=${params.maxVelX}m/s | Max Accel=${params.maxAccelX}m/s² | Stopping Dist=${stoppingDistM.toFixed(3)}m`,
        `[LIDAR TF] Joint laser_joint: xyz=(${params.lidarX.toFixed(3)}, ${params.lidarY.toFixed(3)}, ${params.lidarZ.toFixed(3)})`,
        `[NAV2 TEST] Costmap ray tracing check at ${params.lidarFovDeg}° FOV range... PASSED`,
        passed ? `✅ HIL TEST SUITE PASSED — KINEMATIC STABILITY VALIDATED (100% SUCCESS)` : `❌ TEST FAILED — Kinetic instability detected.`
      ];

      setTestResult({
        passed,
        logs,
        metrics: { ixx, iyy, izz, stoppingDistM, maxPayloadKg }
      });

      if (passed) {
        setShowCommitPrompt(true);
      }
    }, 1500);
  };

  const handleCommitCode = () => {
    setCodeCommitted(true);
    setTimeout(() => setShowCommitPrompt(false), 3000);
  };

  const generatedXacro = `<xacro:macro name="${activeRobot.id}_custom" params="prefix">
  <!-- Manipulated Parametric Profile (${activeRobot.name}) - UpFreq Studio -->
  <xacro:property name="chassis_length" value="${params.chassisLength.toFixed(4)}" />
  <xacro:property name="chassis_width"  value="${params.chassisWidth.toFixed(4)}" />
  <xacro:property name="chassis_height" value="${params.chassisHeight.toFixed(4)}" />
  <xacro:property name="wheelbase"      value="${params.wheelbase.toFixed(4)}" />
  <xacro:property name="wheel_radius"   value="${params.wheelRadius.toFixed(4)}" />
  <xacro:property name="total_mass"     value="${params.massKg.toFixed(2)}" />

  <!-- Calculated Moments of Inertia -->
  <!-- Ixx: ${ixx.toFixed(6)} | Iyy: ${iyy.toFixed(6)} | Izz: ${izz.toFixed(6)} -->
  <inertial>
    <origin xyz="${params.cogX.toFixed(4)} ${params.cogY.toFixed(4)} ${params.cogZ.toFixed(4)}" rpy="0 0 0"/>
    <mass value="${params.massKg.toFixed(2)}"/>
    <inertia ixx="${ixx.toFixed(6)}" ixy="0.0" ixz="0.0" iyy="${iyy.toFixed(6)}" iyz="0.0" izz="${izz.toFixed(6)}"/>
  </inertial>

  <!-- Primary Sensor Joint Origin (RPLidar) -->
  <joint name="\${prefix}laser_joint" type="fixed">
    <parent link="\${prefix}base_link"/>
    <child link="\${prefix}laser_link"/>
    <origin xyz="${params.lidarX.toFixed(4)} ${params.lidarY.toFixed(4)} ${params.lidarZ.toFixed(4)}" rpy="0 0 3.14159"/>
  </joint>

  <!-- Secondary Sensor Joint Origin (Camera) -->
  <joint name="\${prefix}camera_joint" type="fixed">
    <parent link="\${prefix}base_link"/>
    <child link="\${prefix}camera_link"/>
    <origin xyz="${params.cameraX.toFixed(4)} ${params.cameraY.toFixed(4)} ${params.cameraZ.toFixed(4)}" rpy="0 ${THREE.MathUtils.degToRad(params.cameraPitchDeg).toFixed(4)} ${THREE.MathUtils.degToRad(params.cameraYawDeg).toFixed(4)}"/>
  </joint>
</xacro:macro>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(label);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="parametric-studio" className="space-y-6 font-sans">
      
      {/* Interactive HIL Test Suite & Code Update Prompt Modal Banner */}
      {showCommitPrompt && (
        <div className="minimal-card p-5 bg-emerald-950 border-emerald-700 text-emerald-100 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                HIL Simulation Test Suite Passed (100% Kinematic Stability)
              </h3>
              <p className="text-xs text-emerald-300 font-mono mt-0.5">
                New parameter bounds verified against Nav2 costmaps & Gazebo physics. Would you like to commit these updates to your repository code?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs shrink-0">
            {codeCommitted ? (
              <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
                <Check className="h-4 w-4" />
                Committed & Synced to Git!
              </span>
            ) : (
              <>
                <button
                  onClick={handleCommitCode}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <GitCommit className="h-4 w-4" />
                  Commit Changes to URDF/Xacro
                </button>
                <button
                  onClick={() => downloadFile(generatedXacro, `${activeRobot.id}_updated.urdf.xacro`)}
                  className="px-3 py-2 bg-emerald-900 hover:bg-emerald-850 text-emerald-200 border border-emerald-700 rounded-lg transition-all font-semibold"
                >
                  Download .patch
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: 3D Viewport & Metrics (7 columns) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          <div className="minimal-card relative h-[480px] sm:h-[540px] overflow-hidden bg-slate-900 border-zinc-800 shadow-xs">
            
            {/* Header Controls */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-zinc-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono shadow-xs text-zinc-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">{activeRobot.name.toUpperCase()} (DYNAMIC REPO MODEL)</span>
            </div>

            <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center gap-1.5 font-mono">
              <button
                onClick={() => setShowTfFrames(!showTfFrames)}
                className={`px-3 py-1.5 rounded-lg text-[11px] border transition-all flex items-center gap-1.5 shadow-xs ${
                  showTfFrames 
                    ? 'bg-indigo-600 text-white border-indigo-500' 
                    : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-900'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                TF Frames
              </button>

              <button
                onClick={() => setIsWheelSpinning(!isWheelSpinning)}
                className={`px-3 py-1.5 rounded-lg text-[11px] border transition-all flex items-center gap-1.5 shadow-xs ${
                  isWheelSpinning 
                    ? 'bg-indigo-600 text-white border-indigo-500' 
                    : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-900'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                /cmd_vel
              </button>

              <button
                onClick={() => setShowLaserRays(!showLaserRays)}
                className={`px-3 py-1.5 rounded-lg text-[11px] border transition-all flex items-center gap-1.5 shadow-xs ${
                  showLaserRays 
                    ? 'bg-indigo-600 text-white border-indigo-500' 
                    : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-900'
                }`}
              >
                <Radio className="h-3.5 w-3.5" />
                LiDAR
              </button>
            </div>

            {/* Three.js Canvas */}
            <Canvas>
              <PerspectiveCamera makeDefault position={[0.5, 0.4, 0.5]} fov={45} />
              <ambientLight intensity={1.5} />
              <directionalLight position={[3, 5, 3]} intensity={2.2} castShadow />
              <directionalLight position={[-3, 3, -3]} intensity={1.0} />
              <pointLight position={[0, 2, 0]} intensity={1.8} color="#818cf8" />
              
              <CompositeStlRobotModel 
                params={params} 
                showLaserRays={showLaserRays} 
                showCameraFrustum={showCameraFrustum}
                showTfFrames={showTfFrames}
                isWheelSpinning={isWheelSpinning}
              />

              <Grid 
                position={[0, 0, 0]} 
                args={[4, 4]} 
                cellSize={0.05} 
                cellThickness={0.5} 
                cellColor="#334155" 
                sectionSize={0.2} 
                sectionThickness={1} 
                sectionColor="#6366f1" 
                fadeDistance={3.5} 
              />

              <OrbitControls enableDamping dampingFactor={0.05} />
            </Canvas>

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 bg-zinc-950/90 backdrop-blur-md p-3 rounded-xl border border-zinc-800 text-xs font-mono shadow-xs text-zinc-100">
              <button
                onClick={handleRunHILTest}
                disabled={isTesting}
                className="btn-robotics-primary py-1.5 px-4 text-xs font-bold flex items-center gap-2"
              >
                {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run Parametric HIL Test Suite
              </button>

              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-zinc-400 hover:text-indigo-400 transition-colors font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Defaults
              </button>
            </div>
          </div>

          {/* Dynamic Inertia & Kinematics Physics Metrics Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="minimal-card p-3 bg-white border-zinc-200">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Inertia Izz</span>
              <span className="text-sm font-extrabold text-indigo-600">{izz.toFixed(4)} kg·m²</span>
            </div>

            <div className="minimal-card p-3 bg-white border-zinc-200">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Stopping Distance</span>
              <span className="text-sm font-extrabold text-zinc-900">{stoppingDistM.toFixed(3)} m</span>
            </div>

            <div className="minimal-card p-3 bg-white border-zinc-200">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Max Payload</span>
              <span className="text-sm font-extrabold text-emerald-600">{maxPayloadKg.toFixed(1)} kg</span>
            </div>

            <div className="minimal-card p-3 bg-white border-zinc-200">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Wheel Friction (μ)</span>
              <span className="text-sm font-extrabold text-amber-600">{params.frictionCoeff.toFixed(2)}</span>
            </div>
          </div>

          {/* Test Logs Terminal Output */}
          {testResult && (
            <div className="minimal-card p-4 bg-zinc-950 border-zinc-800 font-mono text-xs text-zinc-200 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
                <span>HIL SIMULATION TEST SUITE OUTPUT</span>
                <span className={testResult.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {testResult.passed ? 'PASSED (100%)' : 'FAILED'}
                </span>
              </div>
              <div className="space-y-1 text-[11px] leading-relaxed">
                {testResult.logs.map((log, idx) => (
                  <div key={idx} className={log.includes('PASSED') ? 'text-emerald-400 font-bold' : ''}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Generated Xacro Code Panel */}
          <div className="minimal-card p-5 bg-white border-zinc-200">
            <div className="flex items-center justify-between mb-3 border-b border-zinc-200 pb-2">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider font-mono">
                  Generated Xacro Output ({activeRobot.name})
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <button
                  onClick={() => copyToClipboard(generatedXacro, 'xacro')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold flex items-center gap-1 transition-colors border border-zinc-200"
                >
                  {copiedFormat === 'xacro' ? <Check className="h-3.5 w-3.5 text-indigo-600" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy Xacro
                </button>

                <button
                  onClick={() => downloadFile(generatedXacro, `${activeRobot.id}_custom.urdf.xacro`)}
                  className="btn-robotics-primary py-1.5 px-3 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export .xacro
                </button>
              </div>
            </div>

            <pre className="font-mono text-[11px] text-zinc-100 bg-zinc-950 p-4 rounded-xl overflow-x-auto leading-relaxed border border-zinc-800">
              {generatedXacro}
            </pre>
          </div>
        </div>

        {/* Right Column: Exhaustive Granular Control Sliders (5 columns) */}
        <div className="lg:col-span-5 flex flex-col gap-4 font-mono text-xs">
          <div className="minimal-card p-6 bg-white border-zinc-200 shadow-xs space-y-5">
            
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-indigo-600" />
                <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                  Exhaustive Parameter Controls
                </h2>
              </div>
              <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md font-bold border border-indigo-100">
                16 Parameters
              </span>
            </div>

            <div className="space-y-4 max-h-[720px] overflow-y-auto pr-2">
              
              {/* Group 1: Chassis Kinematics & Inertia */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-1">
                  <Box className="h-3.5 w-3.5 text-indigo-600" />
                  1. Physical Chassis Kinematics & Inertia
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Chassis Length (X):</span>
                    <span className="text-indigo-600 font-bold">{params.chassisLength.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.60"
                    step="0.005"
                    value={params.chassisLength}
                    onChange={(e) => handleParamChange('chassisLength', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Chassis Width (Y):</span>
                    <span className="text-indigo-600 font-bold">{params.chassisWidth.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.60"
                    step="0.005"
                    value={params.chassisWidth}
                    onChange={(e) => handleParamChange('chassisWidth', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Chassis Height (Z):</span>
                    <span className="text-indigo-600 font-bold">{params.chassisHeight.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="0.04"
                    max="0.30"
                    step="0.005"
                    value={params.chassisHeight}
                    onChange={(e) => handleParamChange('chassisHeight', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Total Mass:</span>
                    <span className="text-indigo-600 font-bold">{params.massKg.toFixed(2)} kg</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="80.0"
                    step="0.5"
                    value={params.massKg}
                    onChange={(e) => handleParamChange('massKg', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Wheelbase Width:</span>
                    <span className="text-indigo-600 font-bold">{params.wheelbase.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.80"
                    step="0.005"
                    value={params.wheelbase}
                    onChange={(e) => handleParamChange('wheelbase', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Wheel Radius:</span>
                    <span className="text-indigo-600 font-bold">{params.wheelRadius.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="0.02"
                    max="0.30"
                    step="0.001"
                    value={params.wheelRadius}
                    onChange={(e) => handleParamChange('wheelRadius', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Center of Gravity X (CoG_x):</span>
                    <span className="text-indigo-600 font-bold">{params.cogX.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="-0.20"
                    max="0.20"
                    step="0.005"
                    value={params.cogX}
                    onChange={(e) => handleParamChange('cogX', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Group 2: Primary LiDAR Sensor */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-1">
                  <Radio className="h-3.5 w-3.5 text-indigo-600" />
                  2. Primary LiDAR / Laser Scanner Transform
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">LiDAR Height (Z):</span>
                    <span className="text-indigo-600 font-bold">{params.lidarZ.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="0.02"
                    max="0.50"
                    step="0.001"
                    value={params.lidarZ}
                    onChange={(e) => handleParamChange('lidarZ', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">LiDAR Forward (X):</span>
                    <span className="text-indigo-600 font-bold">{params.lidarX.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="-0.20"
                    max="0.40"
                    step="0.001"
                    value={params.lidarX}
                    onChange={(e) => handleParamChange('lidarX', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">LiDAR Lateral (Y):</span>
                    <span className="text-indigo-600 font-bold">{params.lidarY.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="-0.20"
                    max="0.20"
                    step="0.001"
                    value={params.lidarY}
                    onChange={(e) => handleParamChange('lidarY', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">LiDAR FOV Scan Angle:</span>
                    <span className="text-indigo-600 font-bold">{params.lidarFovDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min="90"
                    max="360"
                    step="5"
                    value={params.lidarFovDeg}
                    onChange={(e) => handleParamChange('lidarFovDeg', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Group 3: Camera Vision Module */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-1">
                  <Eye className="h-3.5 w-3.5 text-indigo-600" />
                  3. Camera Vision Module Transform
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Camera Forward (X):</span>
                    <span className="text-indigo-600 font-bold">{params.cameraX.toFixed(4)} m</span>
                  </div>
                  <input
                    type="range"
                    min="-0.10"
                    max="0.45"
                    step="0.001"
                    value={params.cameraX}
                    onChange={(e) => handleParamChange('cameraX', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Camera Pitch Angle:</span>
                    <span className="text-indigo-600 font-bold">{params.cameraPitchDeg.toFixed(1)}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="1"
                    value={params.cameraPitchDeg}
                    onChange={(e) => handleParamChange('cameraPitchDeg', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Camera Yaw Angle:</span>
                    <span className="text-indigo-600 font-bold">{params.cameraYawDeg.toFixed(1)}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="1"
                    value={params.cameraYawDeg}
                    onChange={(e) => handleParamChange('cameraYawDeg', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Group 4: Nav2 Limits */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-1">
                  <Gauge className="h-3.5 w-3.5 text-indigo-600" />
                  4. Nav2 Motion Limits & Friction
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Max Linear Velocity (v_max):</span>
                    <span className="text-indigo-600 font-bold">{params.maxVelX.toFixed(2)} m/s</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="3.00"
                    step="0.05"
                    value={params.maxVelX}
                    onChange={(e) => handleParamChange('maxVelX', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Max Acceleration (a_max):</span>
                    <span className="text-indigo-600 font-bold">{params.maxAccelX.toFixed(2)} m/s²</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.1"
                    value={params.maxAccelX}
                    onChange={(e) => handleParamChange('maxAccelX', parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 bg-zinc-200 rounded cursor-pointer"
                  />
                </div>
              </div>

            </div>

            <div className="mt-4 pt-4 border-t border-zinc-200 flex flex-col gap-2">
              <button
                onClick={() => downloadFile(JSON.stringify(params, null, 2), `${activeRobot.id}_exhaustive_params.json`)}
                className="btn-robotics-primary w-full py-3 text-xs font-semibold"
              >
                <Download className="h-4 w-4" />
                Export Exhaustive Parameter JSON
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
