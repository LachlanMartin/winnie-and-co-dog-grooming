import { inArray } from 'drizzle-orm';
import { db } from './db';
import { settings } from '../../db/schema';

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(inArray(settings.key, [key])).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
}
