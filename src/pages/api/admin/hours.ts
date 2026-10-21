import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../lib/db';
import { workingHours } from '../../../../db/schema';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const back = '/admin?tab=hours';

  const desired: { day: number; open: string; close: string }[] = [];
  for (let day = 0; day <= 6; day++) {
    if (form.get(`enabled_${day}`) !== 'on') continue;
    const open = String(form.get(`open_${day}`) ?? '').trim();
    const close = String(form.get(`close_${day}`) ?? '').trim();
    if (!TIME_RE.test(open) || !TIME_RE.test(close)) {
      return redirect(`${back}&error=${encodeURIComponent('Please enter a valid opening and closing time for every enabled day.')}`);
    }
    if (open >= close) {
      return redirect(`${back}&error=${encodeURIComponent('Closing time must be after opening time.')}`);
    }
    desired.push({ day, open, close });
  }

  for (let day = 0; day <= 6; day++) {
    const existing = await db
      .select({ id: workingHours.id })
      .from(workingHours)
      .where(eq(workingHours.dayOfWeek, day))
      .limit(1);
    const row = desired.find((d) => d.day === day);
    if (row) {
      if (existing[0]) {
        await db
          .update(workingHours)
          .set({ openTime: row.open, closeTime: row.close })
          .where(eq(workingHours.id, existing[0].id));
      } else {
        await db.insert(workingHours).values({ dayOfWeek: day, openTime: row.open, closeTime: row.close });
      }
    } else if (existing[0]) {
      await db.delete(workingHours).where(and(eq(workingHours.dayOfWeek, day)));
    }
  }

  return redirect(`${back}&saved=1`);
};
