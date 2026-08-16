import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import { differenceInCalendarDays } from 'date-fns';
import { db } from './db';
import { blockouts, bookings, workingHours } from '../../db/schema';
import type { Service } from '../../db/schema';
import { getSetting } from './settings';
import { SLOT_GRID_MINUTES, dateStr, isoDayOfWeek, parseDateOnly, zonedDateTime } from './tz';

export const SIZES = ['small', 'medium', 'large', 'xl'] as const;
export type Size = (typeof SIZES)[number];

export const SIZE_LABELS: Record<Size, string> = {
  small: 'Small (up to 10kg)',
  medium: 'Medium (10–25kg)',
  large: 'Large (25–40kg)',
  xl: 'Extra Large (40kg+)',
};

const SIZE_SUFFIX: Record<Size, 'S' | 'M' | 'L' | 'Xl'> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  xl: 'Xl',
};

export function priceFor(service: Service, size: Size | null): number {
  if (!service.hasSizes || !size) return service.priceFlat ?? 0;
  return service[`price${SIZE_SUFFIX[size]}`] ?? 0;
}

export function durationFor(service: Service, size: Size | null): number {
  if (!service.hasSizes || !size) return service.durationFlat ?? 60;
  return service[`duration${SIZE_SUFFIX[size]}`] ?? 60;
}

/** True when the business-tz date is an "on" Saturday under the biweekly rule. */
export function isOnSaturday(s: string, anchor: string): boolean {
  return differenceInCalendarDays(parseDateOnly(s), parseDateOnly(anchor)) % 14 === 0;
}

async function biweeklySatOpen(s: string): Promise<boolean> {
  if (isoDayOfWeek(s) !== 6) return true;
  const anchor = await getSetting('biweekly_sat_anchor');
  if (!anchor) return true; // no anchor -> every Saturday is open
  return isOnSaturday(s, anchor);
}

/** Open/close window (UTC) for a business-tz date, or null if closed. */
export async function getWorkingWindow(s: string): Promise<{ start: Date; end: Date } | null> {
  const day = isoDayOfWeek(s) % 7; // 0=Sun .. 6=Sat
  const rows = await db.select().from(workingHours).where(eq(workingHours.dayOfWeek, day)).limit(1);
  if (!rows.length) return null;
  if (day === 6 && !(await biweeklySatOpen(s))) return null;
  return { start: zonedDateTime(s, rows[0].openTime), end: zonedDateTime(s, rows[0].closeTime) };
}

async function busyRanges(from: Date, to: Date): Promise<[Date, Date][]> {
  const [blocks, live] = await Promise.all([
    db
      .select({ s: blockouts.startAt, e: blockouts.endAt })
      .from(blockouts)
      .where(and(lt(blockouts.startAt, to), gt(blockouts.endAt, from))),
    db
      .select({ s: bookings.slotStart, e: bookings.slotEnd })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, ['pending', 'confirmed']),
          lt(bookings.slotStart, to),
          gt(bookings.slotEnd, from),
        ),
      ),
  ]);
  return [...blocks.map((b) => [b.s, b.e]), ...live.map((b) => [b.s, b.e])];
}

export function overlaps(s: Date, e: Date, busy: [Date, Date][]): boolean {
  return busy.some(([bs, be]) => s < be && bs < e);
}

/**
 * Valid start times for a window + duration, on the 30-min grid.
 * Sessions longer than the window are allowed to run past closing time,
 * but only at the window's opening time (so a 3h groom on a 2h shift
 * is only bookable at 6:30pm, never at 8pm).
 */
export function slotStartTimes(
  window: { start: Date; end: Date },
  durationMinutes: number,
  now: Date | null,
): Date[] {
  const windowMs = window.end.getTime() - window.start.getTime();
  const durMs = durationMinutes * 60000;
  const minT = now ? now.getTime() : -Infinity;

  if (durMs > windowMs) {
    return window.start.getTime() > minT ? [new Date(window.start.getTime())] : [];
  }

  const starts: Date[] = [];
  for (
    let t = window.start.getTime();
    t + durMs <= window.end.getTime();
    t += SLOT_GRID_MINUTES * 60000
  ) {
    if (t > minT) starts.push(new Date(t));
  }
  return starts;
}

/** Free slot start times (UTC) for a business-tz date and a service duration. */
export async function getFreeSlots(s: string, durationMinutes: number): Promise<Date[]> {
  const window = await getWorkingWindow(s);
  if (!window) return [];
  const busy = await busyRanges(window.start, window.end);
  return slotStartTimes(window, durationMinutes, new Date()).filter((st) => {
    const end = new Date(st.getTime() + durationMinutes * 60000);
    return !overlaps(st, end, busy);
  });
}

/** Booking-time trust check: does this exact range fit an open window with no conflicts? */
export async function isSlotFree(start: Date, end: Date): Promise<boolean> {
  const window = await getWorkingWindow(dateStr(start));
  if (!window) return false;
  const allowed = slotStartTimes(window, (end.getTime() - start.getTime()) / 60000, null).some(
    (s) => s.getTime() === start.getTime(),
  );
  if (!allowed) return false;
  const busy = await busyRanges(start, end);
  return !overlaps(start, end, busy);
}
