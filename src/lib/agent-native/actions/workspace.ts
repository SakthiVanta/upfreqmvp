import { z } from 'zod';
import { AgentNativeAction } from '../types';

const MACHINE_ID_HINT =
  'Requires a stable machineId identifying this computer — before calling, check for a UUID at ~/.upfreq/machine-id on the local machine; ' +
  'if it does not exist, generate one (e.g. `uuidgen` or `node -e "console.log(crypto.randomUUID())"`), write it there, and reuse it for every workspace call from this machine. ' +
  'This is a best-effort, client-reported identifier — not a verified hardware fingerprint.';

export const getWorkspacePathAction: AgentNativeAction = {
  id: 'upfreq.workspace.get_path',
  namespace: 'upfreq.workspace',
  name: 'get_path',
  description: `Looks up the local filesystem path this project was previously set up at on this machine, if any. ${MACHINE_ID_HINT}`,
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string(),
    machineId: z.string().describe('This machine\'s persisted UUID from ~/.upfreq/machine-id'),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { found: false };
    }

    const { getWorkspacePath } = await import('@/lib/db/workspace-registrations');
    const registration = await getWorkspacePath(context.userId, input.projectId, input.machineId);
    if (!registration) {
      return { found: false, message: 'No workspace registered for this project on this machine yet — set one up, then call upfreq.workspace.register.' };
    }
    return { found: true, localPath: registration.localPath, lastSeenAt: registration.lastSeenAt };
  },
};

export const registerWorkspaceAction: AgentNativeAction = {
  id: 'upfreq.workspace.register',
  namespace: 'upfreq.workspace',
  name: 'register',
  description: `Records (or updates) the local filesystem path a project lives at on this machine, so future sessions on the same machine can find it again. ${MACHINE_ID_HINT}`,
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string(),
    machineId: z.string().describe('This machine\'s persisted UUID from ~/.upfreq/machine-id'),
    localPath: z.string().describe('Absolute local filesystem path where this project is checked out, e.g. /Users/alex/code/warehouse-amr'),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { success: false, message: 'No authenticated user for this action.' };
    }

    const { registerWorkspacePath } = await import('@/lib/db/workspace-registrations');
    const registration = await registerWorkspacePath(context.userId, input.projectId, input.machineId, input.localPath);
    return { success: true, registration, message: `Registered ${input.localPath} for this project on this machine.` };
  },
};

export const listWorkspacesAction: AgentNativeAction = {
  id: 'upfreq.workspace.list',
  namespace: 'upfreq.workspace',
  name: 'list',
  description: 'Lists every (project, machine, local path) workspace registration for the current user, across all their machines.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    projectId: z.string().optional(),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { count: 0, workspaces: [] };
    }

    const { listWorkspaces } = await import('@/lib/db/workspace-registrations');
    const workspaces = await listWorkspaces(context.userId, input.projectId);
    return { count: workspaces.length, workspaces };
  },
};

export const workspaceActions = [
  getWorkspacePathAction,
  registerWorkspaceAction,
  listWorkspacesAction,
];
