import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { parse } from 'date-fns';

export const BUSINESS_TZ = 'Australia/Melbourne';
export const SLOT_GRID_MINUTES = 30;

/** YYYY-MM-DD string for a UTC Date, in the business timezone. */
export function dateStr(d: Date): string {
  return formatInTimeZone(d, BUSINESS_TZ, 'yyyy-MM-dd');
}

/** Date-only value for a YYYY-MM-DD string (represents that calendar date). */
export function parseDateOnly(s: string): Date {
  return parse(s, 'yyyy-MM-dd', new Date());
}

/** ISO weekday of a date-only value in business tz (1=Mon..7=Sun). */
export function isoDayOfWeek(s: string): number {
  return Number(formatInTimeZone(parseDateOnly(s), BUSINESS_TZ, 'i'));
}

/**
 * Turn "HH:mm" on a business-tz date into a UTC Date (the slot boundary).
 * E.g. ("2026-08-22", "08:30") -> the instant that is 8:30am in Melbourne.
 */
export function zonedDateTime(dateStr_: string, hm: string): Date {
  const [h, m] = hm.split(':');
  return fromZonedTime(`${dateStr_}T${h}:${m}:00`, BUSINESS_TZ);
}

/** Local time "HH:mm" of a UTC Date, in business tz. */
export function timeOfDay(d: Date): string {
  return formatInTimeZone(d, BUSINESS_TZ, 'HH:mm');
}

export function dayLabel(d: Date): string {
  return formatInTimeZone(d, BUSINESS_TZ, 'EEEE d MMM');
}

export function slotLabel(d: Date): string {
  return formatInTimeZone(d, BUSINESS_TZ, 'EEE d MMM, h:mm a');
}

export function monthYear(d: Date): string {
  return formatInTimeZone(d, BUSINESS_TZ, 'MMMM yyyy');
}
