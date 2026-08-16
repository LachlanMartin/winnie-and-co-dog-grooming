import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { services } from '../../../db/schema';
import { durationFor, getFreeSlots, SIZES } from '../../lib/availability';

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

/** Per-day free-slot counts for a month, for a given service+size. */
export const GET: APIRoute = async ({ url }) => {
  const serviceId = Number(url.searchParams.get('service'));
  const month = url.searchParams.get('month') ?? '';
  if (!serviceId || !/^\d{4}-\d{2}$/.test(month)) return json({ days: [] });

  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service) return json({ days: [] });

  const size = service.hasSizes ? (url.searchParams.get('size') as (typeof SIZES)[number] | null) : null;
  if (service.hasSizes && (!size || !SIZES.includes(size))) return json({ days: [] });

  const duration = durationFor(service, size);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const days: { date: string; slots: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const slots = await getFreeSlots(dateStr, duration);
    if (slots.length > 0) days.push({ date: dateStr, slots: slots.length });
  }
  return json({ days });
};
