import { asc, sql } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from '../schema';
import { ProviderId, PROVIDERS, MODEL_PRESETS, DEFAULT_MODEL_BY_PROVIDER } from '../agent/types';

export interface ProviderModelRecord {
  id: string;
  label: string;
  isDefault: boolean;
}

/** All curated models, grouped by provider. Falls back to the code-level
 * MODEL_PRESETS (same data the seed below writes) if the DB is unreachable
 * — mirrors how the rest of this app degrades when DATABASE_URL is unset. */
export async function listProviderModels(): Promise<Record<ProviderId, ProviderModelRecord[]>> {
  const fallback = Object.fromEntries(
    PROVIDERS.map(p => [
      p.id,
      MODEL_PRESETS[p.id].map(m => ({ id: m.id, label: m.label, isDefault: m.id === DEFAULT_MODEL_BY_PROVIDER[p.id] })),
    ])
  ) as Record<ProviderId, ProviderModelRecord[]>;

  const db = getDb();
  if (!db) return fallback;

  const rows = await db.select().from(schema.providerModels).orderBy(asc(schema.providerModels.sortOrder));
  if (rows.length === 0) return fallback;

  const grouped = Object.fromEntries(PROVIDERS.map(p => [p.id, [] as ProviderModelRecord[]])) as Record<ProviderId, ProviderModelRecord[]>;
  for (const row of rows) {
    const provider = row.provider as ProviderId;
    if (grouped[provider]) grouped[provider].push({ id: row.modelId, label: row.label, isDefault: row.isDefault });
  }
  return grouped;
}

/** Upserts the curated model catalog (MODEL_PRESETS) into `provider_models`.
 * Safe to re-run — each (provider, modelId) pair is upserted by its unique
 * index, so running this again after MODEL_PRESETS gains a new model just
 * adds the new rows without duplicating or disturbing existing ones. One
 * bulk INSERT ... ON CONFLICT, not one round-trip per model — this used to
 * be a 15-query loop, which is exactly the kind of thing that turns a
 * one-off admin action (Reset DB) into a multi-second request. */
export async function seedProviderModels(): Promise<{ seeded: number }> {
  const db = getDb();
  if (!db) return { seeded: 0 };

  const rows = PROVIDERS.flatMap((provider) =>
    MODEL_PRESETS[provider.id].map((m, i) => ({
      id: `${provider.id}:${m.id}`,
      provider: provider.id,
      modelId: m.id,
      label: m.label,
      isDefault: m.id === DEFAULT_MODEL_BY_PROVIDER[provider.id],
      sortOrder: i,
    }))
  );

  await db
    .insert(schema.providerModels)
    .values(rows)
    .onConflictDoUpdate({
      target: [schema.providerModels.provider, schema.providerModels.modelId],
      set: {
        label: sql`excluded.label`,
        isDefault: sql`excluded.is_default`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  return { seeded: rows.length };
}
