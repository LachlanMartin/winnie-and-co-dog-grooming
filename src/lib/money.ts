export const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

export function money(cents: number): string {
  return AUD.format(cents / 100);
}

export function dollarsToCents(input: string | number): number {
  const n = typeof input === 'string' ? Number(input) : input;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
