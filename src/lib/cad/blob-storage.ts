import { put, del } from '@vercel/blob';

// Real STL binaries don't belong inline in Postgres — Vercel Blob (already
// provisioned via BLOB_READ_WRITE_TOKEN, verified working during
// development: real upload/fetch/delete round-trip) is the actual storage
// tier, matching the intent the never-wired `assets` table was designed for
// (S3/MinIO-backed canonical asset storage) without standing up new infra.
export async function uploadStlToBlob(userId: string, partId: string, stl: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured — cannot store compiled mesh output.');
  }

  const blob = await put(`cad-parts/${userId}/${partId}.stl`, stl, {
    access: 'public',
    contentType: 'model/stl',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return blob.url;
}

export async function deleteStlFromBlob(url: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  await del(url, { token }).catch(() => {}); // best-effort cleanup, not worth failing the caller over
}
