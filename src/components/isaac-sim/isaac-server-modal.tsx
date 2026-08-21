'use client';

import { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, AlertCircle, Loader2, Save, ExternalLink, Activity } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import {
  getSavedIsaacConfig,
  saveIsaacConfig,
  checkServerHealth,
  DEFAULT_ISAAC_CONFIG,
} from '@/lib/isaac-sim/client';
import { IsaacSimServerConfig, IsaacSimHealthResponse } from '@/lib/isaac-sim/types';

interface IsaacServerModalProps {
  onClose: () => void;
  onConfigSaved?: (config: IsaacSimServerConfig) => void;
}

export function IsaacServerModal({ onClose, onConfigSaved }: IsaacServerModalProps) {
  const [config, setConfig] = useState<IsaacSimServerConfig>(DEFAULT_ISAAC_CONFIG);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    data?: IsaacSimHealthResponse;
    error?: string;
  } | null>(null);

  useEffect(() => {
    setConfig(getSavedIsaacConfig());
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const data = await checkServerHealth(config.serverUrl, config.apiKey || undefined);
      setTestResult({ success: true, data });
      if (data.webrtc?.stream_url && !config.webrtcStreamUrl) {
        setConfig((prev) => ({ ...prev, webrtcStreamUrl: data.webrtc.stream_url }));
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e.message || 'Connection failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    saveIsaacConfig(config);
    onConfigSaved?.(config);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} title="Configure NVIDIA Isaac Sim Server" icon={Cpu} wide>
      <div className="space-y-4 text-xs font-sans text-sand-200">
        <p className="text-sand-400 leading-relaxed">
          Connect UpFreq directly to your NVIDIA Isaac Sim server (running locally, on a dedicated workstation, or in the cloud). UpFreq streams live RTX ray-traced simulation and loads URDF models directly onto the USD stage.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sand-500 font-bold uppercase text-[10px]">
              Isaac Sim Bridge Server URL
            </label>
            <input
              type="text"
              value={config.serverUrl}
              onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
              placeholder="http://localhost:8000 or http://192.168.1.100:8000"
              className="w-full px-3 py-2 rounded border border-sand-700 bg-sand-950 text-sand-100 text-xs focus:outline-none focus:border-emerald-primary"
            />
            <p className="text-[10px] text-sand-600">The HTTP/WebSocket port of the UpFreq Isaac Bridge (default: 8000).</p>
          </div>

          <div className="space-y-1">
            <label className="block text-sand-500 font-bold uppercase text-[10px]">
              WebRTC Live Stream WebSocket URL
            </label>
            <input
              type="text"
              value={config.webrtcStreamUrl || ''}
              onChange={(e) => setConfig({ ...config, webrtcStreamUrl: e.target.value })}
              placeholder="ws://localhost:49100"
              className="w-full px-3 py-2 rounded border border-sand-700 bg-sand-950 text-sand-100 text-xs focus:outline-none focus:border-emerald-primary"
            />
            <p className="text-[10px] text-sand-600">Omniverse WebRTC signaling endpoint (default port: 49100).</p>
          </div>

          <div className="space-y-1">
            <label className="block text-sand-500 font-bold uppercase text-[10px]">
              API Key / Auth Secret (Optional)
            </label>
            <input
              type="password"
              value={config.apiKey || ''}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="Leave blank if authentication is not enabled"
              className="w-full px-3 py-2 rounded border border-sand-700 bg-sand-950 text-sand-100 text-xs focus:outline-none focus:border-emerald-primary"
            />
            <p className="text-[10px] text-sand-600">Matches X-UpFreq-Key if set on your bridge server.</p>
          </div>

          <div className="space-y-1">
            <label className="block text-sand-500 font-bold uppercase text-[10px]">
              Default Ground Plane Environment
            </label>
            <select
              value={config.groundPlane}
              onChange={(e) => setConfig({ ...config, groundPlane: e.target.value as any })}
              className="w-full px-3 py-2 rounded border border-sand-700 bg-sand-950 text-sand-100 text-xs focus:outline-none focus:border-emerald-primary"
            >
              <option value="grid">Metric Precision Grid</option>
              <option value="warehouse">Logistics Warehouse</option>
              <option value="laboratory">Robotics Testbed Lab</option>
              <option value="empty">Empty USD Stage</option>
            </select>
            <p className="text-[10px] text-sand-600">Physics environment loaded upon simulation startup.</p>
          </div>
        </div>

        {/* Server Test Feedback */}
        {testResult && (
          <div
            className={`p-3 rounded border ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-primary" />
                  <span>Successfully connected to Isaac Sim Bridge</span>
                </div>
                <div className="text-[11px] text-sand-400 grid grid-cols-2 gap-2 mt-1">
                  <div>Status: <span className="text-sand-100 font-mono">Online</span></div>
                  <div>FPS: <span className="text-sand-100 font-mono">{testResult.data?.isaac_sim.fps}</span></div>
                  <div>Simulation: <span className="text-sand-100 font-mono">{testResult.data?.isaac_sim.running ? 'Running' : 'Ready'}</span></div>
                  <div>Stream URL: <span className="text-sand-100 font-mono">{testResult.data?.webrtc.stream_url}</span></div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Connection Failed: </span>
                  <span className="text-[11px]">{testResult.error}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-sand-800">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !config.serverUrl}
            className="btn-secondary-light py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5 text-emerald-primary" />}
            {isTesting ? 'Testing Connection...' : 'Test Connection'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs text-sand-400 hover:text-sand-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
