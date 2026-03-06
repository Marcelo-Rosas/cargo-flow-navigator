import { cleanupE2E, seedE2E, SeedResult } from './supabase-seed';
import { getUserIdFromStorageState } from './get-user-id-from-storage';

export async function setupSeededData(storagePath = '.auth/user.json'): Promise<SeedResult> {
  const runId = process.env.PW_RUN_ID ?? `local-${Date.now()}`;
  const createdBy = getUserIdFromStorageState(storagePath);
  const seeded = await seedE2E({ runId, createdBy });
  return seeded;
}

export async function cleanupSeededData(runId: string): Promise<void> {
  await cleanupE2E({ runId });
}
