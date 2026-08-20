import { RobotProfile } from './robot-profile';

const STORAGE_KEY = 'upfreq_robot_library';

export interface SavedRobotEntry {
  id: string;
  name: string;
  repoUrl: string;
  sensorCount: number;
  moduleCount: number;
  savedAt: string;
  profile: RobotProfile;
}

function getRobotLibrary(): SavedRobotEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveRobotToLibrary(profile: RobotProfile): SavedRobotEntry[] {
  const library = getRobotLibrary();
  const entry: SavedRobotEntry = {
    id: profile.id,
    name: profile.name,
    repoUrl: profile.repoUrl,
    sensorCount: profile.sensors.length,
    moduleCount: profile.autonomyModules?.length || 0,
    savedAt: new Date().toISOString(),
    profile,
  };

  const next = [entry, ...library.filter(r => r.id !== profile.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
