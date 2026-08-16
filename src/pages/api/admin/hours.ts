import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../lib/db';
import { workingHours } from '../../../../db/schema';
import { setSetting } from '../../../lib/settings';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();

  // Weekly hours: 7 rows keyed by day 0..6.
  for (let day = 0; day <= 6; day++) {
    const open = String(form.get(`open_${day}`) ?? '').trim();
    const close = String(form.get(`close_${day}`) ?? '').trim();
    const enabled = form.get(`enabled_${day}`) === 'on';
    const existing = await db
      .select({ id: workingHours.id })
      .from(workingHours)
      .where(eq(workingHours.dayOfWeek, day))
      .limit(1);
    if (enabled && open && close) {
      if (existing[0]) {
        await db
          .update(workingHours)
          .set({ openTime: open, closeTime: close })
          .where(eq(workingHours.id, existing[0].id));
      } else {
        await db.insert(workingHours).values({ dayOfWeek: day, openTime: open, closeTime: close });
      }
    } else if (!enabled && existing[0]) {
      await db.delete(workingHours).where(and(eq(workingHours.dayOfWeek, day)));
    }
  }

  const anchor = String(form.get('biweekly_sat_anchor') ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(anchor) || anchor === '') {
    await setSetting('biweekly_sat_anchor', anchor);
  }

  return redirect('/admin?tab=hours');
};
