import { NextRequest } from 'next/server';
import { listRobotDesigns, createRobotDesign } from '@/lib/db/robot-designs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const designs = await listRobotDesigns();
    return Response.json(designs);
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

    const design = await createRobotDesign({
      name,
      description: typeof body.description === 'string' ? body.description : undefined,
      projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
    });

    return Response.json(design, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
