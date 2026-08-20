import { and, eq } from 'drizzle-orm';
import { getDb, DEMO_USER_ID } from './client';
import * as schema from '../schema';
import { encryptSecret, decryptSecret, maskSecret } from '../crypto';
import { ProviderId, PROVIDERS } from '../agent/types';

export interface ProviderKeyStatus {
  configured: boolean;
  /** Where the active key comes from — a saved user key always wins over
   * the env var fallback for the same provider. */
  source: 'user' | 'env' | 'none';
  /** Masked, e.g. "••••ab12" — only set when source === 'user'. Never the
   * real key. */
  preview: string | null;
}

async function getUserKeyRow(provider: ProviderId) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(schema.userApiKeys)
    .where(and(eq(schema.userApiKeys.userId, DEMO_USER_ID), eq(schema.userApiKeys.provider, provider)));
  return row || null;
}

/** DB-stored key first, server env var fallback second, null if neither. */
export async function resolveApiKey(provider: ProviderId): Promise<string | null> {
  const row = await getUserKeyRow(provider);
  if (row) {
    try {
      return decryptSecret(row.encryptedKey);
    } catch {
      // AUTH_SECRET rotated since this row was written, or the row is
      // otherwise unreadable — fall through to the env var rather than
      // hard-failing the audit.
    }
  }

  const info = PROVIDERS.find(p => p.id === provider);
  return (info && process.env[info.envKey]) || null;
}

/** One query for all four providers' key rows, not one query per provider —
 * this backs the Settings page's initial load, so it's worth keeping to a
 * single DB round-trip rather than fanning out N queries. */
export async function getProviderKeyStatuses(): Promise<Record<ProviderId, ProviderKeyStatus>> {
  const db = getDb();
  const rowsByProvider = new Map<string, { keyPreview: string }>();

  if (db) {
    const rows = await db.select().from(schema.userApiKeys).where(eq(schema.userApiKeys.userId, DEMO_USER_ID));
    for (const row of rows) rowsByProvider.set(row.provider, row);
  }

  const entries = PROVIDERS.map((p): [ProviderId, ProviderKeyStatus] => {
    const row = rowsByProvider.get(p.id);
    if (row) return [p.id, { configured: true, source: 'user', preview: row.keyPreview }];
    if (process.env[p.envKey]) return [p.id, { configured: true, source: 'env', preview: null }];
    return [p.id, { configured: false, source: 'none', preview: null }];
  });
  return Object.fromEntries(entries) as Record<ProviderId, ProviderKeyStatus>;
}

export async function saveUserApiKey(provider: ProviderId, rawKey: string): Promise<ProviderKeyStatus> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');

  const trimmed = rawKey.trim();
  if (!trimmed) throw new Error('API key cannot be empty');

  const encryptedKey = encryptSecret(trimmed);
  const keyPreview = maskSecret(trimmed);

  await db
    .insert(schema.userApiKeys)
    .values({ id: `${DEMO_USER_ID}:${provider}`, userId: DEMO_USER_ID, provider, encryptedKey, keyPreview })
    .onConflictDoUpdate({
      target: [schema.userApiKeys.userId, schema.userApiKeys.provider],
      set: { encryptedKey, keyPreview, updatedAt: new Date() },
    });

  return { configured: true, source: 'user', preview: keyPreview };
}

export async function deleteUserApiKey(provider: ProviderId): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .delete(schema.userApiKeys)
    .where(and(eq(schema.userApiKeys.userId, DEMO_USER_ID), eq(schema.userApiKeys.provider, provider)));
}
