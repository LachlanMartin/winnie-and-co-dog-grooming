import { randomUUID } from 'node:crypto';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { bookings, services } from '../../db/schema';
import type { Booking, Service } from '../../db/schema';
import { durationFor, isSlotFree, SIZES, scheduleSlots } from './availability';
import type { Size } from './availability';
import { createDraftInvoice } from './invoice';

export type SubmittedDog = { name: string; breed: string; serviceId: number; size: string | null };
export type OrderDog = { name: string; breed: string; service: Service; size: Size | null };
export type BookingView = Booking & { service: Service };

export function parseDogInput(raw: FormDataEntryValue | null | undefined): SubmittedDog[] | null {
  if (typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.length || parsed.length > 10) return null;

  const dogs: SubmittedDog[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const serviceId = Number(row.service);
    const size = typeof row.size === 'string' && row.size ? row.size : null;
    if (!name || !Number.isInteger(serviceId) || serviceId <= 0) return null;
    dogs.push({
      name,
      breed: typeof row.breed === 'string' ? row.breed.trim() : '',
      serviceId,
      size,
    });
  }
  return dogs;
}

export async function resolveDogs(dogs: SubmittedDog[]): Promise<OrderDog[] | null> {
  const rows = await db
    .select()
    .from(services)
    .where(inArray(services.id, [...new Set(dogs.map((d) => d.serviceId))]));
  const byId = new Map(rows.map((s) => [s.id, s]));

  const resolved: OrderDog[] = [];
  for (const dog of dogs) {
    const service = byId.get(dog.serviceId);
    if (!service || !service.active) return null;
    const size = service.hasSizes ? (SIZES.includes(dog.size as Size) ? (dog.size as Size) : null) : null;
    if (service.hasSizes && !size) return null;
    resolved.push({ ...dog, service, size });
  }
  return resolved;
}

export async function createOrder(input: {
  dogs: OrderDog[];
  start: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  suburb: string;
  notes: string;
  addonIds: number[];
  status: 'pending' | 'confirmed';
}): Promise<Booking[] | null> {
  const slots = scheduleSlots(
    input.start,
    input.dogs.map((d) => durationFor(d.service, d.size)),
  );
  const end = slots[slots.length - 1].end;
  if (!(await isSlotFree(input.start, end))) return null;

  const orderId = randomUUID();
  const rows = await db.transaction(async (tx) => {
    const inserted: Booking[] = [];
    for (let i = 0; i < input.dogs.length; i++) {
      const dog = input.dogs[i];
      const [row] = await tx
        .insert(bookings)
        .values({
          orderId,
          serviceId: dog.service.id,
          size: dog.size,
          slotStart: slots[i].start,
          slotEnd: slots[i].end,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          dogName: dog.name,
          dogBreed: dog.breed,
          address: input.address,
          suburb: input.suburb,
          notes: input.notes,
          addonIds: input.addonIds,
          status: input.status,
        })
        .returning();
      inserted.push(row);
    }
    return inserted;
  });

  for (let i = 0; i < rows.length; i++) {
    await createDraftInvoice(rows[i], input.dogs[i].service);
  }
  return rows;
}

/** All bookings in the same order, oldest start first. Legacy rows stand alone. */
export async function loadOrder(booking: Booking): Promise<Booking[]> {
  if (!booking.orderId) return [booking];
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.orderId, booking.orderId))
    .orderBy(asc(bookings.slotStart), asc(bookings.id));
}

export async function bookingViews(rows: Booking[]): Promise<BookingView[]> {
  if (!rows.length) return [];
  const serviceRows = await db
    .select()
    .from(services)
    .where(inArray(services.id, [...new Set(rows.map((r) => r.serviceId))]));
  const byId = new Map(serviceRows.map((s) => [s.id, s]));
  const views: BookingView[] = [];
  for (const row of rows) {
    const service = byId.get(row.serviceId);
    if (service) views.push({ ...row, service });
  }
  return views;
}

/** Move every dog in the order, keeping them back-to-back from the new start. */
export async function moveOrder(booking: Booking, start: Date): Promise<Booking[] | null> {
  const rows = await loadOrder(booking);
  const serviceRows = await db
    .select()
    .from(services)
    .where(inArray(services.id, [...new Set(rows.map((r) => r.serviceId))]));
  const byId = new Map(serviceRows.map((s) => [s.id, s]));

  const durations: number[] = [];
  for (const row of rows) {
    const service = byId.get(row.serviceId);
    const size = SIZES.includes(row.size as Size) ? (row.size as Size) : null;
    if (!service || (service.hasSizes && !size)) return null;
    durations.push(durationFor(service, size));
  }

  const slots = scheduleSlots(start, durations);
  const end = slots[slots.length - 1].end;
  const ids = new Set(rows.map((r) => r.id));
  if (!(await isSlotFree(start, end, ids))) return null;

  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      await tx
        .update(bookings)
        .set({ slotStart: slots[i].start, slotEnd: slots[i].end })
        .where(eq(bookings.id, rows[i].id));
    }
  });

  return rows.map((row, i) => ({ ...row, slotStart: slots[i].start, slotEnd: slots[i].end }));
}
