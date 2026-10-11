/** Display-only date formatting in the event time zone. Never use these values for calculations or requests. */
const valid = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
function parts(value: string, timeZone?: string) {
  const date = valid(value)!;
  try {
    const list = new Intl.DateTimeFormat('ru-RU', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'long', hourCycle: 'h23' }).formatToParts(date);
    const get = (type: string) => list.find((p) => p.type === type)?.value ?? '';
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), weekday: get('weekday') };
  } catch {
    return parts(value, undefined);
  }
}
export const NO_VALUE = '—';
/** 09.10 */
export function dayMonth(value: string | null | undefined, timeZone?: string) {
  if (!valid(value)) return NO_VALUE;
  const p = parts(value!, timeZone);
  return `${p.day}.${p.month}`;
}
/** 09.10.2026 */
export function fullDate(value: string | null | undefined, timeZone?: string) {
  if (!valid(value)) return NO_VALUE;
  const p = parts(value!, timeZone);
  return `${p.day}.${p.month}.${p.year}`;
}
/** 16:00 */
export function clock(value: string | null | undefined, timeZone?: string) {
  if (!valid(value)) return NO_VALUE;
  const p = parts(value!, timeZone);
  return `${p.hour}:${p.minute}`;
}
/** 09.10 16:00 */
export function shortDateTime(value: string | null | undefined, timeZone?: string) {
  if (!valid(value)) return NO_VALUE;
  return `${dayMonth(value, timeZone)} ${clock(value, timeZone)}`;
}
/** 09.10.2026 16:00 */
export function dateTime(value: string | null | undefined, timeZone?: string) {
  if (!valid(value)) return NO_VALUE;
  return `${fullDate(value, timeZone)} ${clock(value, timeZone)}`;
}
/** 5 октября */
export function longDay(value: string | null | undefined, timeZone?: string) {
  const date = valid(value);
  if (!date) return NO_VALUE;
  try { return new Intl.DateTimeFormat('ru-RU', { timeZone, day: 'numeric', month: 'long' }).format(date); } catch { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date); }
}
/** Понедельник */
export function weekday(value: string | null | undefined, timeZone?: string) {
  if (!valid(value)) return NO_VALUE;
  const w = parts(value!, timeZone).weekday;
  return w.charAt(0).toUpperCase() + w.slice(1);
}
/** Local calendar date key (YYYY-MM-DD) in the event zone, for grouping only. */
export function localDateKey(value: string | null | undefined, timeZone?: string) {
  if (!valid(value)) return '';
  const p = parts(value!, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}
/** 21.09 — 13.12.2026; omits the first year when both dates share it. */
export function period(start: string | null | undefined, end: string | null | undefined, timeZone?: string) {
  if (!valid(start) && !valid(end)) return NO_VALUE;
  if (!valid(end)) return `с ${fullDate(start, timeZone)}`;
  if (!valid(start)) return `до ${fullDate(end, timeZone)}`;
  const a = parts(start!, timeZone), b = parts(end!, timeZone);
  if (a.year === b.year && a.month === b.month && a.day === b.day) return fullDate(start, timeZone);
  return `${a.year === b.year ? `${a.day}.${a.month}` : fullDate(start, timeZone)} — ${fullDate(end, timeZone)}`;
}
export function plural(n: number, forms: [string, string, string]) {
  const a = Math.abs(n) % 100, b = a % 10;
  return forms[a > 10 && a < 20 ? 2 : b > 1 && b < 5 ? 1 : b === 1 ? 0 : 2];
}
export const count = (n: number, forms: [string, string, string]) => `${new Intl.NumberFormat('ru-RU').format(n)} ${plural(n, forms)}`;
/** mm:ss.mmm for lap times in milliseconds. */
export function lapTime(ms: unknown) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return NO_VALUE;
  const minutes = Math.floor(ms / 60000), rest = (ms % 60000) / 1000;
  return `${minutes}:${rest.toFixed(3).padStart(6, '0')}`;
}
