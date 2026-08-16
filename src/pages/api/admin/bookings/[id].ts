import type { APIRoute } from 'astro';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../../lib/db';
import { bookings, services, invoices, invoiceItems } from '../../../../../db/schema';
import { emailBookingConfirmed, emailBookingDeclined } from '../../../../lib/email';

async function deleteBookingInvoice(bookingId: number) {
  const rows = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.bookingId, bookingId));
  const ids = rows.map((r) => r.id);
  if (!ids.length) return;
  await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, ids));
  await db.delete(invoices).where(inArray(invoices.id, ids));
}

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
    await deleteBookingInvoice(id);
    const [service] = await db.select().from(services).where(eq(services.id, booking.serviceId)).limit(1);
    if (service) await emailBookingDeclined({ ...booking, service });
  } else if (action === 'cancel' && booking.status === 'confirmed') {
    await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, id));
    await deleteBookingInvoice(id);
  }

  return redirect('/admin');
};
