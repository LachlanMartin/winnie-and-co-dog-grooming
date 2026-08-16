import 'dotenv/config';
import { isOnSaturday, overlaps, slotStartTimes } from './availability';

// Run with: npx tsx src/lib/availability.check.ts
let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failed++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}
const starts = (w: [string, string], dur: number) =>
  slotStartTimes(
    { start: new Date(`2026-08-17T${w[0]}Z`), end: new Date(`2026-08-17T${w[1]}Z`) },
    dur,
    null,
  ).map((d) => d.toISOString().slice(11, 16));

// Biweekly Saturday rule: anchor is a known "on" Saturday.
const anchor = '2026-08-22';
check('anchor itself is on', isOnSaturday('2026-08-22', anchor), true);
check('+2 weeks is on', isOnSaturday('2026-09-05', anchor), true);
check('+4 weeks is on', isOnSaturday('2026-10-03', anchor), true);
check('+1 week is off', isOnSaturday('2026-08-29', anchor), false);
check('+3 weeks is off', isOnSaturday('2026-09-12', anchor), false);

// Overlap detection.
const busy: [Date, Date][] = [
  [new Date('2026-08-22T01:00:00Z'), new Date('2026-08-22T03:00:00Z')], // 11:00–13:00 AEST
];
check('exact match overlaps', overlaps(new Date('2026-08-22T01:00:00Z'), new Date('2026-08-22T03:00:00Z'), busy), true);
check('enclosing overlaps', overlaps(new Date('2026-08-22T00:30:00Z'), new Date('2026-08-22T04:00:00Z'), busy), true);
check('adjacent (end == start) is free', overlaps(new Date('2026-08-22T03:00:00Z'), new Date('2026-08-22T04:00:00Z'), busy), false);
check('before is free', overlaps(new Date('2026-08-22T00:00:00Z'), new Date('2026-08-22T01:00:00Z'), busy), false);

// Slot starts on a 2h weekday window (18:30–20:30 AEST = 08:30–10:30 UTC).
check('1h session fits: 3 starts', starts(['08:30', '10:30'], 60), ['08:30', '09:00', '09:30']);
check('90min session: 2 starts', starts(['08:30', '10:30'], 90), ['08:30', '09:00']);
check('2h session in 2h window: only open', starts(['08:30', '10:30'], 120), ['08:30']);
check('2.5h session over-length: only open', starts(['08:30', '10:30'], 150), ['08:30']);
check('3h session over-length: only open', starts(['08:30', '10:30'], 180), ['08:30']);
check('3.5h session over-length: only open', starts(['08:30', '10:30'], 210), ['08:30']);

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('All availability checks passed.');
