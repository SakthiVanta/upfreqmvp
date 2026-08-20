import { NextRequest } from 'next/server';
import { listProjects, createProject } from '@/lib/db/projects';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const projects = await listProjects();
    return Response.json(projects);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    const project = await createProject({
      name,
      description: typeof body.description === 'string' ? body.description : undefined,
      repos: Array.isArray(body.repos)
        ? body.repos
            .filter((r: any) => typeof r?.url === 'string' && r.url.trim())
            .map((r: any) => ({ url: r.url.trim(), name: typeof r.name === 'string' ? r.name : undefined }))
        : undefined,
    });

    return Response.json(project, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
