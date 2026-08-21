export interface IsaacSimServerConfig {
  serverUrl: string; // e.g. "http://localhost:8000" or "http://192.168.1.100:8000"
  webrtcStreamUrl?: string; // e.g. "ws://localhost:49100"
  apiKey?: string;
  autoConnect: boolean;
  groundPlane: 'grid' | 'warehouse' | 'laboratory' | 'empty';
}

export interface IsaacSimHealthResponse {
  status: 'online' | 'offline';
  service: string;
  version: string;
  isaac_sim: {
    running: boolean;
    paused: boolean;
    fps: number;
    sim_time: number;
    active_robots: string[];
  };
  webrtc: {
    signaling_port: number;
    media_port: number;
    public_endpoint: string;
    stream_url: string;
  };
}

export interface IsaacSimTelemetry {
  running: boolean;
  paused: boolean;
  sim_time: number;
  step_count: number;
  fps: number;
  robot_count: number;
  active_robots: string[];
  webrtc_stream_url: string;
}

export interface LoadToIsaacSimPayload {
  robot_name: string;
  urdf_content?: string;
  package_zip_url?: string;
  mesh_files?: Record<string, string>;
  fix_base?: boolean;
  merge_fixed_joints?: boolean;
  self_collision?: boolean;
  default_drive_type?: 'position' | 'velocity' | 'none';
  default_drive_stiffness?: number;
  default_drive_damping?: number;
}

export interface LoadToIsaacSimResult {
  success: boolean;
  robot_name: string;
  prim_path: string;
  usd_path?: string;
  joint_names: string[];
  link_names: string[];
  dof_count: number;
  message: string;
}
