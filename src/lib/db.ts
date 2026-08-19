import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'analyzed_repos.json');

export interface StoredRepoData {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  analyzedAt: string;
  isRosRepo: boolean;
  robotName: string;
  rosVersion: string;
  packages: Array<{
    name: string;
    version: string;
    description: string;
    buildType: string;
    dependencies: string[];
  }>;
  sensors: Array<{
    id: string;
    name: string;
    type: string;
    linkName: string;
    parentLink: string;
    position: { x: number; y: number; z: number };
    orientation: { r: number; p: number; y: number };
    frameId: string;
    collisionType?: string;
    mass?: number;
  }>;
  gazeboPlugins: Array<{
    name: string;
    targetLink: string;
    sensorType: string;
    pluginSystem: string;
    rosTopic: string;
    rosMessageType: string;
  }>;
  topics: Array<{
    topic: string;
    type: string;
    direction: 'Publisher' | 'Subscriber' | 'Bridge';
    nodeOwner: string;
    description: string;
  }>;
  navigationStack: Array<{
    module: string;
    packageProvider: string;
    launchFile: string;
    configYaml: string;
    primaryNode: string;
    description: string;
  }>;
  dependencies: Array<{
    category: string;
    packages: Array<{ name: string; type: string; version: string; isInstalled: boolean }>;
  }>;
  launchFiles: string[];
  diagnosticsNotice: string;
}

// Ensure database file exists
function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2), 'utf-8');
  }
}

export function saveRepoAnalysis(data: StoredRepoData): void {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const db = JSON.parse(raw || '{}');
    db[data.id] = data;
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save to database:', err);
  }
}

export function getRepoAnalysis(id: string): StoredRepoData | null {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const db = JSON.parse(raw || '{}');
    return db[id] || null;
  } catch (err) {
    return null;
  }
}
