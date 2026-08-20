import { eq } from 'drizzle-orm';
import { getDb, DEMO_USER_ID } from './client';
import * as schema from '../schema';
import { AgentSettings, DEFAULT_PROVIDER, DEFAULT_MODEL_BY_PROVIDER, ProviderId } from '../agent/types';

export async function getAgentSettings(): Promise<AgentSettings> {
  const fallback: AgentSettings = { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL_BY_PROVIDER[DEFAULT_PROVIDER] };

  const db = getDb();
  if (!db) return fallback;

  const [row] = await db.select().from(schema.agentSettings).where(eq(schema.agentSettings.userId, DEMO_USER_ID));
  if (!row) return fallback;

  return { provider: row.provider as ProviderId, model: row.model };
}

export async function updateAgentSettings(settings: AgentSettings): Promise<AgentSettings> {
  const db = getDb();
  if (!db) return settings;

  await db
    .insert(schema.agentSettings)
    .values({ userId: DEMO_USER_ID, provider: settings.provider, model: settings.model })
    .onConflictDoUpdate({
      target: schema.agentSettings.userId,
      set: { provider: settings.provider, model: settings.model, updatedAt: new Date() },
    });

  return settings;
}
