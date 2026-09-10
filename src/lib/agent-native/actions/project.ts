import { z } from 'zod';
import { AgentNativeAction } from '../types';

export const createProjectAction: AgentNativeAction = {
  id: 'upfreq.project.create_project',
  namespace: 'upfreq.project',
  name: 'create_project',
  description: 'Creates a new robotics project in UpFreq.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({
    name: z.string().describe('Name of the robotics project'),
    description: z.string().optional().describe('Project description'),
  }),
  async execute(input, context) {
    if (!context.userId) {
      return { success: false, message: 'No authenticated user for this action.' };
    }

    const { createProject } = await import('@/lib/db/projects');
    const project = await createProject(context.userId, {
      name: input.name,
      description: input.description || 'Autonomous robotics project managed via UpFreq MCP',
      repos: [],
    });

    return {
      success: true,
      project,
      message: `Project "${project.name}" created successfully.`,
    };
  },
};

export const listProjectsAction: AgentNativeAction = {
  id: 'upfreq.project.list_projects',
  namespace: 'upfreq.project',
  name: 'list_projects',
  description: 'Lists all robotics projects in UpFreq.',
  defaultPolicy: 'ALLOWED',
  schema: z.object({}),
  async execute(_input, context) {
    if (!context.userId) {
      return { count: 0, projects: [] };
    }

    const { listProjects } = await import('@/lib/db/projects');
    const projects = await listProjects(context.userId);
    return {
      count: projects.length,
      projects,
    };
  },
};

export const projectActions = [
  createProjectAction,
  listProjectsAction,
];
