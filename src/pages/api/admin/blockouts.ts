import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../lib/db';
import { blockouts } from '../../../../db/schema';
import { zonedDateTime } from '../../../lib/tz';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('action') ?? '');

  if (action === 'delete') {
    const id = Number(form.get('id'));
    await db.delete(blockouts).where(eq(blockouts.id, id));
    return redirect('/admin?tab=blockouts');
  }

  const date = String(form.get('date') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return redirect('/admin?tab=blockouts?error=1');

  const allDay = form.get('all_day') === 'on';
  const start = allDay ? zonedDateTime(date, '00:00') : zonedDateTime(date, String(form.get('start_time') ?? '09:00'));
  const end = allDay
    ? zonedDateTime(date, '23:59')
    : zonedDateTime(date, String(form.get('end_time') ?? '17:00'));

  if (end <= start) return redirect('/admin?tab=blockouts');

  await db.insert(blockouts).values({
    startAt: start,
    endAt: end,
    note: String(form.get('note') ?? '').trim(),
  });
  return redirect('/admin?tab=blockouts');
};
