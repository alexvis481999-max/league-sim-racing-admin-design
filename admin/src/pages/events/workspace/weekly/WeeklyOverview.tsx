import { Button, EmptyState, InfoPills, Meta, MetaGrid, Panel, StatusBadge, TextLink, count, longDay, period, shortDateTime } from '../../../../ui/v16';
import { scenarioLabel } from '../../current/event-labels';
import { useWorkspace, useWorkspaceNav } from '../context';
import { currentGroup, groupProgram, isFinal, isUncertain, isWaiting, type ProgramBlock, type ProgramGroup } from '../program';

export function groupHeading(group: ProgramGroup) {
  return group.tracks.length === 1 && !group.title.includes(group.tracks[0]) ? `${group.title} · ${group.tracks[0]}` : group.title;
}
export function groupPeriod(group: ProgramGroup, timeZone: string) {
  if (!group.firstStartsAt) return 'Гонок нет';
  const a = longDay(group.firstStartsAt, timeZone), b = longDay(group.lastStartsAt, timeZone);
  return a === b ? a : `${a} — ${b}`;
}

export function WeeklyOverview() {
  const { summary, timezone, eventId } = useWorkspace();
  const nav = useWorkspaceNav();
  const program = summary.program ?? [];
  const groups = groupProgram(program, 'Без недели');
  const weeks = groups.filter((g) => g.kind === 'WEEK');
  const current = currentGroup(groups, summary.currentStage?.key);
  const maxPerWeek = Math.max(0, ...weeks.map((w) => w.total));
  const liveBlock = current?.blocks.find((b) => b.key === summary.currentStage?.key) ?? current?.blocks.find((b) => !isFinal(b) && !isWaiting(b)) ?? current?.blocks.find(isWaiting) ?? null;
  const attention = program.filter((b) => b.displayStatus?.code === 'FAILED' || isUncertain(b)).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  const upcoming = program.filter(isWaiting).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 4);
  const event = summary.event;
  const schedule = event.displaySchedule;
  const { applications, runtime } = summary.activity;

  return (
    <div className="lsr-cols-overview">
      <div className="lsr-stack">
        <Panel title="Общая информация">
          <MetaGrid>
            <Meta label="ID события">{eventId}</Meta>
            <Meta label="Организатор">{summary.metadata.organizer?.name ?? 'Организатор не сохранён'}</Meta>
            <Meta label="Тип">{scenarioLabel(event.scenarioCode)} / {event.scenarioTitle ?? event.scenarioCode}</Meta>
            <Meta label="Период">{period(schedule?.startsAt ?? event.startsAt, schedule ? schedule.endsAt : event.endsAt, timezone)}</Meta>
            <Meta label="Сценарий">{event.scenarioCode}</Meta>
            <Meta label="Опубликовано">{summary.metadata.publishedAt ? `${shortDateTime(summary.metadata.publishedAt, timezone)}${summary.metadata.author ? ' · ' + summary.metadata.author.displayName : ''}` : 'Не опубликовано'}</Meta>
          </MetaGrid>
          <hr className="lsr-rule" />
          <InfoPills items={[count(weeks.length, ['неделя', 'недели', 'недель']), `${maxPerWeek} ${maxPerWeek === 1 ? 'гонка' : 'гонок'} / неделя`, `${count(summary.counts.stages, ['запуск', 'запуска', 'запусков'])} по расписанию`]} />
        </Panel>
        <Panel title="Текущая неделя">
          {!current ? <EmptyState compact>Гонки серии ещё не запланированы.</EmptyState> : (
            <>
              <div className="lsr-between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="lsr-eyebrow">{current.kind === 'WEEK' ? `Неделя ${current.index + 1} / ${weeks.length}` : current.title}</div>
                  <h3 style={{ margin: '6px 0', fontSize: 20, fontWeight: 750, letterSpacing: '-.3px' }}>{groupHeading(current)}</h3>
                  <div className="lsr-muted">{groupPeriod(current, timezone)} · {current.tracks.length ? `трасса ${current.tracks.join(', ')}` : 'трасса не указана'} · {count(current.total, ['старт', 'старта', 'стартов'])}</div>
                </div>
                <Button variant="primary" onClick={() => nav.week(current.key)}>Открыть неделю →</Button>
              </div>
              {liveBlock && (
                <>
                  <hr className="lsr-rule" />
                  <div className="lsr-between">
                    <div>
                      <div className="lsr-hstack" style={{ gap: 9 }}><b>{liveBlock.title}</b><StatusBadge status={liveBlock.displayStatus} small /></div>
                      <div className="lsr-muted" style={{ marginTop: 4 }}>План {shortDateTime(liveBlock.startsAt, timezone)} · Факт {shortDateTime(liveBlock.startedAt, timezone)}{liveBlock.finishedAt ? ` · окончание ${shortDateTime(liveBlock.finishedAt, timezone)}` : ''}</div>
                    </div>
                    <Button onClick={() => nav.race(liveBlock.key)}>К гонке</Button>
                  </div>
                </>
              )}
            </>
          )}
        </Panel>
      </div>
      <div className="lsr-stack">
        <Panel title="Требуют внимания">
          <div className="lsr-cards-inline">
            {attention.slice(0, 5).map((b) => <AttentionLine key={b.key} block={b} onOpen={() => nav.race(b.key)} />)}
            {applications.pending > 0 && (
              <div className="lsr-item-line"><div><div className="lsr-strong">{count(applications.pending, ['заявка ожидает', 'заявки ожидают', 'заявок ожидают'])} решения</div><div className="lsr-mutedline">Допущено: {applications.accepted}</div></div><TextLink onClick={() => nav.section('participants')}>Открыть →</TextLink></div>
            )}
            {runtime.uncertain > 0 && (
              <div className="lsr-item-line"><div><div className="lsr-strong">{count(runtime.uncertain, ['запуск без связи', 'запуска без связи', 'запусков без связи'])}</div><div className="lsr-mutedline">Состояние сервера не подтверждено свежими данными</div></div><TextLink onClick={() => nav.section('servers')}>Открыть →</TextLink></div>
            )}
            {!attention.length && !applications.pending && !runtime.uncertain && <div className="lsr-mutedline">Ошибок выполнения, неподтверждённых запусков и заявок на рассмотрении нет.</div>}
            {attention.length > 5 && <div className="lsr-mutedline">И ещё {attention.length - 5} — см. недели серии.</div>}
          </div>
        </Panel>
        <Panel title="Ближайшие запуски" body={false}>
          {upcoming.length ? (
            <div className="lsr-rows" style={{ padding: '8px 0' }}>
              {upcoming.map((b) => (
                <div className="lsr-row-item" key={b.key}>
                  <div><b>{b.title}</b><small>{shortDateTime(b.startsAt, timezone)}{b.group ? ` · ${b.group.title}` : ''}</small></div>
                  <TextLink onClick={() => nav.race(b.key)}>Открыть →</TextLink>
                </div>
              ))}
            </div>
          ) : <EmptyState compact>Запланированных запусков нет.</EmptyState>}
        </Panel>
      </div>
    </div>
  );
}

function AttentionLine({ block, onOpen }: { block: ProgramBlock; onOpen: () => void }) {
  const { timezone } = useWorkspace();
  const uncertain = isUncertain(block);
  return (
    <div className="lsr-item-line">
      <div style={{ minWidth: 0 }}>
        <div className="lsr-strong">{block.title} · {uncertain ? 'состояние уточняется' : 'ошибка выполнения'}</div>
        <div className="lsr-mutedline">{block.displayStatus?.reason?.message ?? block.displayStatus?.label}{block.startedAt ? ` · начало по факту ${shortDateTime(block.startedAt, timezone)}` : ''}</div>
      </div>
      <TextLink onClick={onOpen}>Открыть →</TextLink>
    </div>
  );
}
