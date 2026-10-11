import { useMemo, useState } from 'react';
import {
  AsyncView, Button, EmptyState, InfoTiles, Meta, MetaGrid, Notice, PageHeader, Panel, PillButtons, SearchInput, StatusBadge, Table, TextLink,
  clickableRow, count, longDay, shortDateTime, shortWeekday, usePageChrome, weekday,
} from '../../../../ui/v16';
import { useWorkspaceData } from '../data';
import { workspacePath } from '../data';
import { useWorkspace, useWorkspaceNav } from '../context';
import { blocksByDay, groupProgram, isLive, isUncertain, isWaiting, type ProgramBlock, type ProgramGroup } from '../program';
import type { ConditionsResponse } from '../common/conditions';
import { conditionsSummary } from '../common/conditions';
import { groupHeading, groupPeriod } from './WeeklyOverview';

type StatusFilter = 'all' | 'live' | 'done' | 'failed' | 'pending';
const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' }, { value: 'live', label: 'Идут' }, { value: 'done', label: 'Завершены' }, { value: 'failed', label: 'Ошибки' }, { value: 'pending', label: 'Предстоящие' },
];
const matches = (b: ProgramBlock, f: StatusFilter) =>
  f === 'all' || (f === 'live' && isLive(b)) || (f === 'done' && b.displayStatus?.code === 'COMPLETED') || (f === 'failed' && (b.displayStatus?.code === 'FAILED' || isUncertain(b))) || (f === 'pending' && isWaiting(b));

export function WeekPage({ weekKey }: { weekKey: string }) {
  const { summary, timezone, eventId } = useWorkspace();
  const nav = useWorkspaceNav();
  const groups = useMemo(() => groupProgram(summary.program, 'Без недели'), [summary.program]);
  const group = groups.find((g) => g.key === weekKey);
  usePageChrome({ variant: 'event', back: { label: 'Назад', to: `/events/${eventId}?section=weeks` }, crumbs: [{ label: summary.event.title, to: `/events/${eventId}` }, { label: 'Недели', to: `/events/${eventId}?section=weeks` }, { label: group ? groupHeading(group) : weekKey }] });
  if (!group) return <EmptyState title="Неделя не найдена" action={<Button onClick={() => nav.section('weeks')}>← Все недели</Button>}>В текущем расписании нет гонок с группой «{weekKey}». Возможно, гонки перенесены в другую неделю.</EmptyState>;
  return <WeekContent group={group} total={groups.filter((g) => g.kind === 'WEEK').length} timezone={timezone} />;
}

function WeekContent({ group, total, timezone }: { group: ProgramGroup; total: number; timezone: string }) {
  const nav = useWorkspaceNav();
  const { eventId, summary } = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [day, setDay] = useState('all');
  const days = blocksByDay(group.blocks, timezone);
  const q = query.trim().toLowerCase();
  const rows = group.blocks.filter((b) => matches(b, status) && (!q || `${b.title} ${b.key} ${shortDateTime(b.startsAt, timezone)}`.toLowerCase().includes(q)));
  const visibleDays = blocksByDay(rows, timezone).filter((d) => day === 'all' || d.key === day);
  const shown = visibleDays.reduce((n, d) => n + d.blocks.length, 0);
  const sample = group.blocks[0];
  const conditions = useWorkspaceData<ConditionsResponse>(workspacePath(eventId, 'conditions') + `?stageKey=${encodeURIComponent(sample.key)}`, true);
  const editable = summary.editableFields.includes('settings');

  return (
    <>
      <PageHeader
        title={groupHeading(group)}
        description={`${groupPeriod(group, timezone)} · ${group.tracks.length ? `трасса ${group.tracks.join(', ')}` : 'трасса не указана'} · ${count(group.total, ['запуск', 'запуска', 'запусков'])}${group.kind === 'WEEK' ? ` · неделя ${group.index + 1} из ${total}` : ''}`}
        actions={<>{group.kind === 'WEEK' && <Button onClick={() => nav.week(group.key, 'settings')} title={editable ? undefined : 'Сервер сейчас разрешает менять только описание события'}>Настройки недели</Button>}<Button onClick={() => nav.section('weeks')}>← Все недели</Button></>}
      />
      <InfoTiles items={[{ label: 'Всего гонок', value: group.total }, { label: 'Завершено', value: group.completed }, { label: 'Идут', value: group.live }, { label: 'Ошибки', value: group.failed + group.uncertain }]} />
      <div className="lsr-cols-2" style={{ margin: '16px 0' }}>
        <Panel title="Параметры недели" sub={`Сохранённые условия гонки «${sample.title}»`}>
          <AsyncView resource={conditions} compact isEmpty={(d) => !d.stages?.length} empty={<span className="lsr-mutedline">Условия гонок недели не сохранены в плане события.</span>}>
            {(data) => {
              const s = conditionsSummary(data.stages![0]);
              return (
                <MetaGrid>
                  <Meta label="Трасса">{group.tracks.length > 1 ? `Разные: ${group.tracks.join(', ')}` : s.track}</Meta>
                  <Meta label="Конфигурация">{s.layout}</Meta>
                  <Meta label="Погода">{s.weather}</Meta>
                  <Meta label="Температура">{s.temperature}</Meta>
                  <Meta label="Машины">{s.cars}</Meta>
                  <Meta label="Отличия">{s.overrides.length ? `Изменено: ${s.overrides.join(', ')}` : 'Наследуются'}</Meta>
                </MetaGrid>
              );
            }}
          </AsyncView>
        </Panel>
        <Notice>
          Плановый и фактический старт, а также окончание показываются отдельно у каждой гонки. Отсутствующий факт — «—». Условия выше загружены по первой гонке недели; если у отдельных гонок есть переопределения, они видны на странице гонки.
        </Notice>
      </div>
      <Panel title="Гонки недели" body={false}>
        <div className="lsr-panel-body" style={{ borderBottom: '1px solid var(--lsr-line2)' }}>
          <div className="lsr-filterbar">
            <SearchInput wide value={query} onChange={setQuery} placeholder="Поиск по ID или времени" label="Поиск гонки" />
            <PillButtons value={status} onChange={setStatus} options={statusFilters} label="Состояние гонок" size="lg" />
          </div>
          <div className="lsr-between" style={{ marginTop: 13 }}>
            <PillButtons value={day} onChange={setDay} label="День недели" prefix="День:" size="lg"
              options={[{ value: 'all', label: 'Все' }, ...days.map((d) => ({ value: d.key, label: shortWeekday(d.firstStartsAt, timezone), title: longDay(d.firstStartsAt, timezone) }))]} />
            <span className="lsr-muted">{shown} из {group.total}</span>
          </div>
        </div>
        {!visibleDays.length ? <EmptyState compact>Ничего не найдено.</EmptyState> : (
          <Table label="Гонки недели">
            <thead><tr><th>ID</th><th>План старта</th><th>Факт старта</th><th>Факт окончания</th><th>Состояние</th><th aria-hidden="true" /></tr></thead>
            {visibleDays.map((d) => (
              <tbody key={d.key}>
                <tr className="lsr-group-row"><td colSpan={6}>{weekday(d.firstStartsAt, timezone)} · {longDay(d.firstStartsAt, timezone)} <small>· {count(d.blocks.length, ['запуск', 'запуска', 'запусков'])}</small></td></tr>
                {d.blocks.map((b) => (
                  <tr key={b.key} {...clickableRow(() => nav.race(b.key), isLive(b) ? 'is-current' : b.displayStatus?.code === 'FAILED' ? 'is-alert' : '')} aria-label={`Открыть ${b.title}`}>
                    <td className="lsr-primary" title={b.key}>{b.title}</td>
                    <td className="lsr-num">{shortDateTime(b.startsAt, timezone)}</td>
                    <td className="lsr-num">{shortDateTime(b.startedAt, timezone)}</td>
                    <td className="lsr-num">{shortDateTime(b.finishedAt, timezone)}</td>
                    <td><StatusBadge status={b.displayStatus} small /></td>
                    <td><TextLink onClick={() => nav.race(b.key)}>Подробнее →</TextLink></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
