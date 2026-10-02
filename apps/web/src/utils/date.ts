export const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];

const pad = (n: number) => String(n).padStart(2, '0');

// YYYY-MM-DD in the user's local time zone (toISOString() would shift the day for UTC+5 users at night).
export function toLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Whole days from today (local) until dateStr; negative when overdue.
export function daysUntil(dateStr: string): number {
  const today = parseLocalDate(toLocalDateString());
  const target = parseLocalDate(dateStr);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
