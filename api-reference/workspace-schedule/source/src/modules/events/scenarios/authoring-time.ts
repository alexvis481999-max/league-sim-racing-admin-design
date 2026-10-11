/** Calendar operations are explicit about the event timezone; the process timezone is irrelevant. */
export function localDateTime(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

/** Rejects nonexistent and ambiguous local times instead of silently moving a race around DST. */
export function calendarInstant(local: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)) throw new Error('Укажите дату и время');
  const target = local.length === 16 ? `${local}:00` : local;
  const utc = Date.parse(`${target}Z`), candidates = new Set<string>();
  if (!Number.isFinite(utc)) throw new Error('Некорректная дата');
  for (const delta of [-36, -12, 0, 12, 36]) {
    const sample = utc + delta * 3600000;
    const offset = Date.parse(`${localDateTime(new Date(sample).toISOString(), timezone)}Z`) - sample;
    const candidate = new Date(utc - offset).toISOString();
    if (localDateTime(candidate, timezone) === target) candidates.add(candidate);
  }
  if (candidates.size !== 1) throw new Error('Неоднозначное или отсутствующее местное время; выберите другое время');
  return [...candidates][0];
}

/** Adds calendar dates, not elapsed 24-hour periods. */
export function calendarDay(date: string, days: number): string {
  const instant = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== date) throw new Error('Некорректная дата');
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

/** The calendar ends at the last millisecond of the final racing day, not at estimated race completion. */
export function calendarEnd(instant: string, timezone: string): string {
  const tomorrow = calendarDay(localDateTime(instant, timezone).slice(0, 10), 1);
  return new Date(Date.parse(calendarInstant(`${tomorrow}T00:00`, timezone)) - 1).toISOString();
}
