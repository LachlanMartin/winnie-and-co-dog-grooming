import type { APIRoute } from 'astro';
import { getFreeSlots, loadDogSelections, totalDuration } from '../../lib/availability';

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

/** Per-day free-slot counts for a month, for the selected dog(s). */
export const GET: APIRoute = async ({ url }) => {
  const month = url.searchParams.get('month') ?? '';
  if (!/^\d{4}-\d{2}$/.test(month)) return json({ days: [] });

  const ids = url.searchParams.getAll('service').map(Number);
  const dogs = await loadDogSelections(ids, url.searchParams.getAll('size'));
  if (!dogs) return json({ days: [] });

  const duration = totalDuration(dogs);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const days: { date: string; slots: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${month}-${String(d).padStart(2, '0')}`;
    const slots = await getFreeSlots(day, duration);
    if (slots.length > 0) days.push({ date: day, slots: slots.length });
  }
  return json({ days });
};
