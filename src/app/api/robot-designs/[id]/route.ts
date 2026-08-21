import { NextRequest } from 'next/server';
import { getRobotDesign, updateRobotDesign, deleteRobotDesign } from '@/lib/db/robot-designs';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const design = await getRobotDesign(id);
    if (!design) return Response.json({ error: 'Robot design not found' }, { status: 404 });
    return Response.json(design);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();

    const design = await updateRobotDesign(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      links: Array.isArray(body.links) ? body.links : undefined,
      joints: Array.isArray(body.joints) ? body.joints : undefined,
      urdfXml: typeof body.urdfXml === 'string' ? body.urdfXml : undefined,
      status: body.status === 'draft' || body.status === 'exported' ? body.status : undefined,
    });

    if (!design) return Response.json({ error: 'Robot design not found' }, { status: 404 });
    return Response.json(design);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await deleteRobotDesign(id);
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
