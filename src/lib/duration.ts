export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return [hours ? `${hours}h` : '', mins ? `${mins}m` : ''].filter(Boolean).join(' ') || '0m';
}
