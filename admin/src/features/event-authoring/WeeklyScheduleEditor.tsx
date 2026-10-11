import { useState } from 'react';
import { Field, type FieldsProps } from './Fields';
import { read, write } from './form-state';
import { weekCells, zonedInstant, zonedLocal } from './weekly-calendar';

/** weekly.dayTimes editor: stored in the event zone, displayed for the first week in the viewer zone. */
export function WeeklyScheduleEditor(props: FieldsProps) {
  const [step, setStep] = useState(2),
    [error, setError] = useState(''),
    [customDate, setCustomDate] = useState(''),
    [customTime, setCustomTime] = useState('');
  const zone = String(read(props.value, 'event.timezone')),
    viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const firstDate = String(read(props.value, 'weekly.firstDate')),
    times = (read(props.value, 'weekly.dayTimes') ?? {}) as Record<string, string[]>;
  let cells: ReturnType<typeof weekCells> = [],
    calendarError = '';
  try {
    cells = weekCells(firstDate, zone, viewerZone, times, step);
  } catch (e) {
    calendarError = (e as Error).message;
  }
  const toggle = (day: string, time: string) => {
    const current = times[day] ?? [];
    props.onChange(write(props.value, 'weekly.dayTimes.' + day, current.includes(time) ? current.filter((x) => x !== time) : [...current, time].sort()));
  };
  const add = (date: string, time: string) => {
    try {
      const source = zonedLocal(zonedInstant(date + 'T' + time, viewerZone), zone),
        day = String(new Date(source.slice(0, 10) + 'T12:00Z').getUTCDay());
      if (!(times[day] ?? []).includes(source.slice(11))) toggle(day, source.slice(11));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const dates = [...new Set(cells.map((x) => x.date))];
  const rows = [...new Set(cells.map((x) => x.time))].sort();
  const perWeek = Object.values(times).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
  const label = (date: string) => new Date(date + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long' });
  const shortDate = (date: string) => new Date(date + 'T12:00').toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <section className="lsr-formgroup">
      <h3>Расписание гонок по дням недели</h3>
      <p>Плановые старты повторяются по указанным дням и часам каждую неделю. Трассы и условия недель настраиваются ниже отдельно.</p>
      <div className="lsr-stack">
        <div className="lsr-fields">
          <Field {...props} path="weekly.firstDate" label="Дата начала первой недели" type="date" />
        </div>
        <div className="lsr-hstack" style={{ gap: 8 }}>
          <span className="lsr-pillbtn is-active" style={{ cursor: 'default' }}>{perWeek} {perWeek === 1 ? 'гонка' : 'гонок'} в неделю</span>
          <span className="lsr-muted">Сетка показана по часовому поясу браузера ({viewerZone}); сохраняется в поясе события ({zone || 'не указан'}).</span>
        </div>
        <div className="lsr-field">
          <span className="lsr-field-label">Шаг сетки</span>
          <div className="lsr-filterbar" role="group" aria-label="Шаг сетки">
            {[1, 2, 3, 6].map((n) => (
              <button key={n} type="button" aria-pressed={step === n} className={`lsr-pillbtn is-lg${step === n ? ' is-active' : ''}`} onClick={() => setStep(n)}>{n} ч</button>
            ))}
          </div>
        </div>
        {(error || calendarError) && <div className="lsr-notice is-danger" role="alert">{error || calendarError}</div>}
        {!!dates.length && (
          <div className="lsr-tablewrap" style={{ border: '1px solid var(--lsr-line)', borderRadius: 10 }}>
            <table className="lsr-table lsr-weekgrid" aria-label="Недельная сетка стартов">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Время</th>
                  {dates.map((date) => (
                    <th key={date} style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--lsr-ink)', fontSize: 12.5, textTransform: 'capitalize' }}>{label(date)}</div>
                      <div style={{ fontWeight: 500 }}>{shortDate(date)}</div>
                      <div style={{ color: 'var(--lsr-blue)' }}>{cells.filter((c) => c.date === date && c.selected).length} гонок</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((time) => (
                  <tr key={time}>
                    <td className="lsr-primary lsr-num">{time}</td>
                    {dates.map((date) => {
                      const cell = cells.find((c) => c.date === date && c.time === time);
                      return (
                        <td key={date} style={{ padding: 4 }}>
                          {cell && (
                            <button type="button" className={`lsr-slot${cell.selected ? ' is-on' : ''}`} aria-pressed={cell.selected} disabled={props.disabled}
                              aria-label={`${label(date)} ${time}`} onClick={() => toggle(cell.sourceDay, cell.sourceTime)}>{cell.selected ? '✓' : '+'}</button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="lsr-override" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto auto' }}>
          <div><label>Своё время старта</label><div className="lsr-inherit">Для запуска, которого нет в сетке</div></div>
          <select className="lsr-select" style={{ minWidth: 150 }} aria-label="День" value={customDate} disabled={props.disabled} onChange={(e) => setCustomDate(e.target.value)}>
            <option value="">День</option>
            {dates.map((date) => <option key={date} value={date}>{label(date)}</option>)}
          </select>
          <input className="lsr-select" style={{ minWidth: 110 }} type="time" aria-label="Время" value={customTime} disabled={props.disabled} onChange={(e) => setCustomTime(e.target.value)} />
          <button type="button" className="lsr-btn" disabled={props.disabled || !customDate || !customTime} onClick={() => { add(customDate, customTime); setCustomTime(''); }}>Добавить время</button>
        </div>
        <div className="lsr-mutedline">Сетка — инструмент выбора. В конфигурации сохраняются только конкретные часы каждого дня (weekly.dayTimes); смена шага не удаляет выбранные старты. Точные даты всех запусков — в разделе «Проверка».</div>
      </div>
    </section>
  );
}
