import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { addons, bookings, invoiceItems, invoices, services, settings } from '../../db/schema';
import type { Booking, Service } from '../../db/schema';
import { priceFor } from './availability';
import { getSetting } from './settings';

async function nextInvoiceNumber(): Promise<string> {
  const prefix = (await getSetting('invoice_prefix')) || 'INV';
  const counter = Number((await getSetting('invoice_counter')) || '0');
  const number = `${prefix}-${String(counter + 1).padStart(4, '0')}`;
  await db
    .insert(settings)
    .values({ key: 'invoice_counter', value: String(counter + 1) })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(counter + 1) } });
  return number;
}

export async function createDraftInvoice(booking: Booking, service: Service): Promise<void> {
  const number = await nextInvoiceNumber();
  const basePrice = priceFor(service, booking.size);
  const addonRows = booking.addonIds.length
    ? await db.select().from(addons).where(and(eq(addons.active, true)))
    : [];
  const selected = addonRows.filter((a) => booking.addonIds.includes(a.id));

  const items = [
    { description: `${service.name}${booking.size ? ` — ${booking.size}` : ''}`, quantity: 1, unitPriceCents: basePrice },
    ...selected.map((a) => ({ description: a.name, quantity: 1, unitPriceCents: a.priceCents })),
    { description: 'Travel (within 10km of Berwick included)', quantity: 1, unitPriceCents: 0 },
  ];
  const total = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

  const [inv] = await db
    .insert(invoices)
    .values({
      bookingId: booking.id,
      token: randomUUID(),
      number,
      status: 'draft',
      subtotalCents: total,
      totalCents: total,
    })
    .returning();

  await db.insert(invoiceItems).values(items.map((i, idx) => ({ ...i, invoiceId: inv.id, sortOrder: idx })));
}

export async function recalcInvoiceTotals(invoiceId: number): Promise<void> {
  const rows = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  const total = rows.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
  await db
    .update(invoices)
    .set({ subtotalCents: total, totalCents: total })
    .where(eq(invoices.id, invoiceId));
}

export async function loadInvoiceByToken(token: string) {
  const [inv] = await db.select().from(invoices).where(eq(invoices.token, token)).limit(1);
  if (!inv) return null;
  const [booking, items] = await Promise.all([
    db.select().from(bookings).where(eq(bookings.id, inv.bookingId)).limit(1),
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id)).orderBy(invoiceItems.sortOrder),
  ]);
  if (!booking[0]) return null;
  const [service] = await db.select().from(services).where(eq(services.id, booking[0].serviceId)).limit(1);
  return { invoice: inv, booking: booking[0], service: service ?? null, items };
}

