import { NextRequest } from 'next/server';
import { listRegistryAssets, getRegistryAsset } from '@/lib/assets/registry';
import { validateAssetContract } from '@/lib/assets/contract';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || undefined;
  const assetId = searchParams.get('assetId');

  if (assetId) {
    const asset = getRegistryAsset(assetId);
    if (!asset) {
      return Response.json({ error: `Asset not found: ${assetId}` }, { status: 404 });
    }
    return Response.json({ asset });
  }

  const assets = listRegistryAssets(type);
  return Response.json({
    count: assets.length,
    assets,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateAssetContract(body);

    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    return Response.json({
      valid: true,
      message: 'Asset contract conforms to UpFreq semantic specification.',
      contract: validation.contract,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Asset validation failed.' }, { status: 500 });
  }
}
