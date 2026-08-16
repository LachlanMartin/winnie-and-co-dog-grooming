import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const services = pgTable('services', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  active: boolean('active').notNull().default(true),
  hasSizes: boolean('has_sizes').notNull().default(true),
  priceFlat: integer('price_flat'),
  durationFlat: integer('duration_flat'),
  priceS: integer('price_s'),
  priceM: integer('price_m'),
  priceL: integer('price_l'),
  priceXl: integer('price_xl'),
  durationS: integer('duration_s'),
  durationM: integer('duration_m'),
  durationL: integer('duration_l'),
  durationXl: integer('duration_xl'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const addons = pgTable('addons', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  priceCents: integer('price_cents').notNull(),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const workingHours = pgTable('working_hours', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  dayOfWeek: integer('day_of_week').notNull(),
  openTime: time('open_time').notNull(),
  closeTime: time('close_time').notNull(),
});

export const blockouts = pgTable('blockouts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  note: text('note').notNull().default(''),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const bookings = pgTable(
  'bookings',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id),
    size: text('size'),
    slotStart: timestamp('slot_start', { withTimezone: true }).notNull(),
    slotEnd: timestamp('slot_end', { withTimezone: true }).notNull(),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone').notNull(),
    dogName: text('dog_name').notNull(),
    dogBreed: text('dog_breed').notNull().default(''),
    address: text('address').notNull().default(''),
    suburb: text('suburb').notNull().default(''),
    notes: text('notes').notNull().default(''),
    addonIds: jsonb('addon_ids').$type<number[]>().notNull().default([]),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // ponytail: same-start race backstop. Cross-overlap races (different start times)
    // are covered by the server-side overlap check; upgrade to a serializable txn or
    // gist exclusion constraint if double-booking ever shows up in practice.
    uniqueIndex('bookings_slot_live_idx')
      .on(t.slotStart)
      .where(sql`${t.status} in ('pending','confirmed')`),
    index('bookings_status_idx').on(t.status),
    index('bookings_slot_idx').on(t.slotStart),
  ],
);

export const invoices = pgTable('invoices', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  bookingId: integer('booking_id')
    .notNull()
    .references(() => bookings.id),
  token: text('token').notNull().unique(),
  number: text('number').notNull().unique(),
  status: text('status').notNull().default('draft'),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull().default(0),
  notes: text('notes').notNull().default(''),
  dueDate: date('due_date'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPriceCents: integer('unit_price_cents').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type Service = typeof services.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
