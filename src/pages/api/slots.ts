import type { APIRoute } from 'astro';
import { getFreeSlots, loadDogSelections, totalDuration } from '../../lib/availability';

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const date = url.searchParams.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ slots: [] });

  const ids = url.searchParams.getAll('service').map(Number);
  const dogs = await loadDogSelections(ids, url.searchParams.getAll('size'));
  if (!dogs) return json({ slots: [] });

  const slots = await getFreeSlots(date, totalDuration(dogs));
  return json({ slots: slots.map((s) => ({ start: s.toISOString() })) });
};
