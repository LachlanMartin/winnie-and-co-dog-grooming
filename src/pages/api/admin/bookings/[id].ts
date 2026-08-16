import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../lib/db';
import { bookings, services } from '../../../../../db/schema';
import { emailBookingConfirmed, emailBookingDeclined } from '../../../../lib/email';

export const POST: APIRoute = async ({ request, redirect, params }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const action = String(form.get('action') ?? '');

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) return redirect('/admin');

  if (action === 'approve' && booking.status === 'pending') {
    await db.update(bookings).set({ status: 'confirmed' }).where(eq(bookings.id, id));
    const [service] = await db.select().from(services).where(eq(services.id, booking.serviceId)).limit(1);
    if (service) await emailBookingConfirmed({ ...booking, service });
  } else if (action === 'decline' && booking.status === 'pending') {
    await db.update(bookings).set({ status: 'declined' }).where(eq(bookings.id, id));
    const [service] = await db.select().from(services).where(eq(services.id, booking.serviceId)).limit(1);
    if (service) await emailBookingDeclined({ ...booking, service });
  } else if (action === 'cancel' && booking.status === 'confirmed') {
    await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, id));
  }

  return redirect('/admin');
};
