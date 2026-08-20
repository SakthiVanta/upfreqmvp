// One-off/idempotent seed for the `provider_models` table — the Settings
// page's model dropdown. Safe to re-run any time MODEL_PRESETS
// (src/lib/agent/types.ts) changes; it upserts by (provider, model_id).
//
// Usage: pnpm db:seed
import { seedProviderModels } from '../src/lib/db/provider-models';

seedProviderModels()
  .then(({ seeded }) => {
    console.log(`Seeded ${seeded} provider model row(s).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
