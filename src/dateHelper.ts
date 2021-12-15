export const MS_PER_DAY = 60 * 60 * 24 * 1000;

export function toDate(dateAsString: string) {
  return new Date(dateAsString);
}

export function dateToString(d: Date) {
  return d.toISOString().substring(0, 10);
}

export function toEpoch(date: string) {
  return new Date(date).getTime();
}

export function epochToString(t: number) {
  return dateToString(new Date(t));
}

export function addDays(date: string, days: number) {
  const d = toDate(date);
  let res = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days, 0, 0, 0));
  res.setUTCHours(0, 0, 0, 0);
  return dateToString(res);
}

function getDayOfWeek(date: string) {
  return toDate(date).getUTCDay();
}

export function isBusinessDay(date: string) {
  let w = getDayOfWeek(date);
  return w >= 1 && w <= 5;
}

