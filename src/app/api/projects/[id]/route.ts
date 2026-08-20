import { NextRequest } from 'next/server';
import { getProject, updateProject, deleteProject } from '@/lib/db/projects';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    return Response.json(project);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();

    const project = await updateProject(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      addRepo: body.addRepo && typeof body.addRepo.url === 'string'
        ? { url: body.addRepo.url.trim(), name: typeof body.addRepo.name === 'string' ? body.addRepo.name : undefined }
        : undefined,
      removeRepoId: typeof body.removeRepoId === 'string' ? body.removeRepoId : undefined,
      auditedRobotProfile: body.auditedRobotProfile ?? undefined,
    });

    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    return Response.json(project);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await deleteProject(id);
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
