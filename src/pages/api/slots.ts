import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { services } from '../../../db/schema';
import { durationFor, getFreeSlots, SIZES } from '../../lib/availability';

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const serviceId = Number(url.searchParams.get('service'));
  const date = url.searchParams.get('date') ?? '';
  if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ slots: [] });

  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service) return json({ slots: [] });

  const size = service.hasSizes ? (url.searchParams.get('size') as (typeof SIZES)[number] | null) : null;
  if (service.hasSizes && (!size || !SIZES.includes(size))) return json({ slots: [] });

  const slots = await getFreeSlots(date, durationFor(service, size));
  return json({ slots: slots.map((s) => ({ start: s.toISOString() })) });
};
