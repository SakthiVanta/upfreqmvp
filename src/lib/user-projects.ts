import { RobotProfile } from './robot-profile';

export interface ProjectRepo {
  id: string;
  url: string;
  name: string;
}

export interface UserProject {
  id: string;
  name: string;
  description: string;
  repos: ProjectRepo[];
  isAudited: boolean;
  auditedRobotProfile?: RobotProfile;
}

const STORAGE_KEY = 'upfreq_user_projects';

export function loadUserProjects(): UserProject[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch (e) {
    return [];
  }
}

export function saveUserProjects(projects: UserProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}
