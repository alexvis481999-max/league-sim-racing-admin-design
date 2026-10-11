/** Converts the first calendar week for display without changing its stored recurrence zone. */
export function zonedLocal(instant: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const p = (key: string) => parts.find((x) => x.type === key)!.value;
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`;
}
export function zonedInstant(local: string, zone: string): string {
  const utc = Date.parse(local + 'Z'),
    matches = new Set<string>();
  if (!Number.isFinite(utc)) throw Error('Выберите корректную дату и время');
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = utc + hours * 3600000,
      offset = Date.parse(zonedLocal(new Date(sample).toISOString(), zone) + 'Z') - sample;
    const instant = new Date(utc - offset).toISOString();
    if (zonedLocal(instant, zone) === local) matches.add(instant);
  }
  if (matches.size !== 1)
    throw Error('Это время пропущено или повторяется при переводе часов. Выберите другое');
  return [...matches][0];
}
export function weekCells(
  firstDate: string,
  zone: string,
  viewerZone: string,
  times: Record<string, string[]>,
  step: number,
) {
  const cells: {
    date: string;
    time: string;
    sourceDay: string;
    sourceTime: string;
    selected: boolean;
  }[] = [];
  for (let index = 0; index < 7; index++) {
    const date = new Date(firstDate + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + index);
    const sourceDate = date.toISOString().slice(0, 10),
      sourceDay = String(date.getUTCDay()),
      selected = times[sourceDay] ?? [];
    const hours = Array.from(
      { length: Math.ceil(24 / step) },
      (_, i) => String(i * step).padStart(2, '0') + ':00',
    );
    for (const sourceTime of new Set([...hours, ...selected])) {
      let display: string;
      try {
        display = zonedLocal(zonedInstant(sourceDate + 'T' + sourceTime, zone), viewerZone);
      } catch {
        if (selected.includes(sourceTime)) throw Error('Выбранное время попадает на перевод часов');
        continue;
      }
      cells.push({
        date: display.slice(0, 10),
        time: display.slice(11),
        sourceDay,
        sourceTime,
        selected: selected.includes(sourceTime),
      });
    }
  }
  return cells.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
