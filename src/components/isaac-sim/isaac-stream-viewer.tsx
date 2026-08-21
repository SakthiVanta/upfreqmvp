'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Cpu,
  Settings,
  AlertCircle,
  Loader2,
  Layers,
  Radio,
} from 'lucide-react';
import {
  getSavedIsaacConfig,
  checkServerHealth,
  sendSimCommand,
} from '@/lib/isaac-sim/client';
import { IsaacSimServerConfig, IsaacSimTelemetry } from '@/lib/isaac-sim/types';

interface IsaacStreamViewerProps {
  robotName?: string;
  onOpenSettings: () => void;
}

export function IsaacStreamViewer({ robotName, onOpenSettings }: IsaacStreamViewerProps) {
  const [config, setConfig] = useState<IsaacSimServerConfig>(getSavedIsaacConfig());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<IsaacSimTelemetry | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isBusyAction, setIsBusyAction] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // Poll / connect to server telemetry & WebRTC
  useEffect(() => {
    let cancelled = false;
    const currentConfig = getSavedIsaacConfig();
    setConfig(currentConfig);

    async function initConnection() {
      setIsConnecting(true);
      setErrorMessage(null);

      try {
        const health = await checkServerHealth(currentConfig.serverUrl, currentConfig.apiKey);
        if (cancelled) return;

        setIsConnected(true);
        setIsConnecting(false);

        // Open WebSocket telemetry stream
        const wsUrl = currentConfig.serverUrl.replace(/^http/, 'ws') + '/ws/telemetry';
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(event.data) as IsaacSimTelemetry;
            setTelemetry(data);
            setIsPaused(data.paused);
          } catch {}
        };

        ws.onerror = () => {
          if (cancelled) return;
          console.warn('[Isaac Stream] Telemetry WebSocket connection error');
        };

        // Initialize WebRTC connection if stream URL is available
        const streamEndpoint = currentConfig.webrtcStreamUrl || health.webrtc.stream_url;
        if (streamEndpoint && typeof RTCPeerConnection !== 'undefined') {
          initWebRTC(streamEndpoint);
        }
      } catch (err: any) {
        if (cancelled) return;
        setIsConnected(false);
        setIsConnecting(false);
        setErrorMessage(err.message || 'Could not connect to Isaac Sim server.');
      }
    }

    function initWebRTC(signalingUrl: string) {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        // Setup signaling over websocket if needed
        const signalingWs = new WebSocket(signalingUrl);
        signalingWs.onopen = () => {
          pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: false })
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
              if (pc.localDescription) {
                signalingWs.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription.sdp }));
              }
            })
            .catch(() => {});
        };

        signalingWs.onmessage = async (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data.type === 'answer' && data.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(data));
            } else if (data.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
          } catch {}
        };
      } catch (e) {
        console.warn('[Isaac Stream] WebRTC initialization note:', e);
      }
    }

    initConnection();

    return () => {
      cancelled = true;
      if (wsRef.current) wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  const handleSimAction = async (action: 'play' | 'pause' | 'reset') => {
    setIsBusyAction(action);
    try {
      await sendSimCommand(config.serverUrl, action, config.apiKey);
      if (action === 'pause') setIsPaused(true);
      if (action === 'play') setIsPaused(false);
    } catch (e: any) {
      console.error(`Failed to ${action} simulation:`, e);
    } finally {
      setIsBusyAction(null);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (isConnecting) {
    return (
      <div className="w-full h-full min-h-96 bg-sand-950 border border-sand-800 flex flex-col items-center justify-center gap-3 text-sand-400">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-primary" />
        <p className="text-xs font-bold text-sand-100">Connecting to NVIDIA Isaac Sim Server...</p>
        <p className="text-[11px] text-sand-500">{config.serverUrl}</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="w-full h-full min-h-96 bg-sand-950 border border-sand-800 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="p-3 bg-sand-900 border border-sand-800 rounded">
          <Cpu className="h-8 w-8 text-sand-500" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h4 className="text-sm font-bold text-sand-100">Isaac Sim Server Not Reachable</h4>
          <p className="text-xs text-sand-400">
            {errorMessage || `Could not establish a connection to ${config.serverUrl}.`}
          </p>
          <p className="text-[11px] text-sand-600">
            Ensure the UpFreq Isaac Bridge is running on your Isaac Sim server (`python server.py`).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary-light py-2 px-4 text-xs font-bold cursor-pointer"
          >
            Retry Connection
          </button>
          <button
            onClick={onOpenSettings}
            className="btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" />
            Configure Server
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-96 bg-black border border-sand-800 overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Real WebRTC Video Element */}
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
        {/* Placeholder visual HUD when WebRTC video track is establishing */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
          <Layers className="h-16 w-16 text-emerald-primary mb-2" />
          <p className="text-xs uppercase font-mono tracking-widest text-sand-300">NVIDIA Omniverse RTX Stream</p>
        </div>
      </div>

      {/* Top HUD Bar */}
      <div className="relative z-10 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] font-mono font-bold rounded">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            LIVE RTX SIMULATION
          </span>
          {robotName && (
            <span className="px-2 py-1 bg-sand-900/80 border border-sand-700/80 text-sand-200 text-[10px] font-bold rounded">
              {robotName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-sand-300">
          <div>
            FPS: <span className="text-sand-50 font-bold">{telemetry?.fps ?? 60}</span>
          </div>
          <div>
            Time: <span className="text-sand-50 font-bold">{telemetry?.sim_time ?? '0.00'}s</span>
          </div>
          <button
            onClick={onOpenSettings}
            title="Configure Server Settings"
            className="p-1 hover:text-sand-50 rounded cursor-pointer text-sand-400 hover:bg-sand-800"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Simulation Control Bar */}
      <div className="relative z-10 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isPaused ? (
            <button
              onClick={() => handleSimAction('play')}
              disabled={isBusyAction === 'play'}
              className="px-3 py-1.5 bg-emerald-primary text-black font-bold text-xs rounded flex items-center gap-1.5 cursor-pointer hover:bg-emerald-primary/90"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Play
            </button>
          ) : (
            <button
              onClick={() => handleSimAction('pause')}
              disabled={isBusyAction === 'pause'}
              className="px-3 py-1.5 bg-sand-800 hover:bg-sand-700 text-sand-100 font-bold text-xs rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Pause className="h-3.5 w-3.5 fill-current" />
              Pause
            </button>
          )}

          <button
            onClick={() => handleSimAction('reset')}
            disabled={isBusyAction === 'reset'}
            className="p-2 bg-sand-900 hover:bg-sand-800 text-sand-300 hover:text-sand-100 rounded cursor-pointer"
            title="Reset Simulation Stage"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isBusyAction === 'reset' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-sand-900 hover:bg-sand-800 text-sand-300 hover:text-sand-100 rounded cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
