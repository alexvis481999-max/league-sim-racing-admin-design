import { AsyncView, Button, EmptyState, InfoPills, InfoTiles, Meta, MetaGrid, Notice, PageHeader, Panel, StatusBadge, TextLink, count, shortDateTime, usePageChrome } from '../../../../ui/v16';
import { useWorkspaceData } from '../data';
import { workspacePath } from '../data';
import { useWorkspace, useWorkspaceNav } from '../context';
import { currentGroup, groupProgram, groupStateText, groupStateTone, isWaiting, type ProgramGroup } from '../program';
import { conditionsSummary, type ConditionsResponse } from '../common/conditions';
import { BlockPanel, BlockTimes, EventFacts, UpcomingList, blockTypeLabel } from '../common/overview';
import { ResultRevisions } from '../common/results';

export function ChampionshipOverview() {
  const { summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const groups = groupProgram(summary.program, 'Без этапа');
  const stages = groups.filter((g) => g.kind === 'STAGE');
  const current = currentGroup(groups, summary.currentStage?.key);
  const race = current?.blocks.find((b) => b.type === 'RACE') ?? current?.blocks.at(-1);
  const upcoming = groups.filter((g) => g.state === 'scheduled').map((g) => g.blocks.find((b) => b.type === 'RACE') ?? g.blocks[0]).filter((b) => b && isWaiting(b)).slice(0, 4);
  return (
    <div className="lsr-cols-overview">
      <div className="lsr-stack">
        <EventFacts extra={[['Допуск', summary.activity.hasRegistration ? 'Регистрация на событие' : 'Без регистрации']]}
          footer={<InfoPills items={[count(stages.length, ['этап', 'этапа', 'этапов']), `${stages.filter((s) => s.state === 'done' || s.state === 'done-with-errors').length} завершены`, `${stages.filter((s) => s.state === 'live').length} идёт`, `${stages.filter((s) => s.state === 'scheduled').length} впереди`]} />} />
        <Panel title="Текущий этап">
          {!current || !race ? <EmptyState compact>Этапы ещё не запланированы.</EmptyState> : (
            <>
              <div className="lsr-between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="lsr-eyebrow">{current.kind === 'STAGE' ? `Этап ${current.index + 1} из ${stages.length}` : current.title}</div>
                  <h3 style={{ margin: '6px 0', fontSize: 20, fontWeight: 750 }}>{current.title}</h3>
                  <div className="lsr-hstack" style={{ gap: 7 }}><span className="lsr-muted">{shortDateTime(race.startsAt, summary.event.timezone)}</span><StatusBadge status={race.displayStatus} small /></div>
                </div>
                <Button variant="primary" onClick={() => nav.week(current.key)}>Открыть этап →</Button>
              </div>
              <hr className="lsr-rule" />
              <BlockTimes block={race} />
              <div style={{ marginTop: 12 }}><TextLink onClick={() => nav.race(race.key)}>Проведение конкретной гонки →</TextLink></div>
            </>
          )}
        </Panel>
      </div>
      <div className="lsr-stack">
        <UpcomingList title="Ближайшие этапы" blocks={upcoming} empty="Запланированных этапов нет." />
        <Panel title="Чемпионат и его зачёт">
          <p style={{ margin: '0 0 12px' }}>Очки начисляются по этапам. Итоговый зачёт — отдельный результат события, а не таблица одной гонки.</p>
          <Button onClick={() => nav.section('standings')}>Открыть зачёт</Button>
        </Panel>
      </div>
    </div>
  );
}

/** Page of one stage/round group: its blocks and the stored conditions of the race block. */
export function GroupPage({ groupKey }: { groupKey: string }) {
  const { summary, eventId, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const groups = groupProgram(summary.program);
  const group = groups.find((g) => g.key === groupKey);
  const listSection = group?.kind === 'ROUND' ? 'program' : 'stages';
  usePageChrome({ variant: 'event', back: { label: 'Назад', to: `/events/${eventId}?section=${listSection}` }, crumbs: [{ label: summary.event.title, to: `/events/${eventId}` }, { label: group?.kind === 'ROUND' ? 'Сетка' : 'Этапы', to: `/events/${eventId}?section=${listSection}` }, { label: group?.title ?? groupKey }] });
  if (!group) return <EmptyState title="Группа не найдена" action={<Button onClick={() => nav.section(listSection)}>← Назад</Button>}>В расписании нет блоков с группой «{groupKey}».</EmptyState>;
  return <GroupContent group={group} total={groups.filter((g) => g.kind === group.kind).length} timezone={timezone} listSection={listSection} />;
}
function GroupContent({ group, total, timezone, listSection }: { group: ProgramGroup; total: number; timezone: string; listSection: 'program' | 'stages' }) {
  const { eventId } = useWorkspace();
  const nav = useWorkspaceNav();
  const race = group.blocks.find((b) => b.type === 'RACE') ?? group.blocks.at(-1)!;
  const conditions = useWorkspaceData<ConditionsResponse>(workspacePath(eventId, 'conditions') + `?stageKey=${encodeURIComponent(race.key)}`, true);
  const unit = group.kind === 'ROUND' ? 'Раунд' : 'Этап';
  return (
    <>
      <PageHeader title={group.title} description={`${unit} ${group.index + 1} из ${total}${group.tracks.length ? ` · трасса ${group.tracks.join(', ')}` : ''}`}
        actions={<Button onClick={() => nav.section(listSection)}>← Все {group.kind === 'ROUND' ? 'раунды' : 'этапы'}</Button>} />
      <InfoTiles items={[
        { label: 'Состояние', value: <StatusBadge status={{ code: group.state, label: groupStateText(group.state, group.kind) }} tone={groupStateTone[group.state]} />, small: true },
        { label: 'Блоков', value: `${group.completed} / ${group.total}` },
        { label: 'Трасса', value: group.tracks.join(', ') || '—' },
        { label: 'Дата', value: shortDateTime(race.startsAt, timezone) },
      ]} />
      <div className="lsr-stack" style={{ marginTop: 16 }}>
        {group.blocks.map((b) => <BlockPanel key={b.key} block={b} title={`${blockTypeLabel(b.type)} ${group.kind === 'ROUND' ? 'раунда' : 'этапа'}`} openLabel={b.type === 'PRACTICE' ? 'Открыть практику →' : 'Открыть гонку →'} />)}
        <Panel title={`Параметры ${group.kind === 'ROUND' ? 'раунда' : 'этапа'}`} sub={`Сохранённые условия блока «${race.title}»`}>
          <AsyncView resource={conditions} compact isEmpty={(d) => !d.stages?.length} empty={<span className="lsr-mutedline">Условия не сохранены в плане события.</span>}>
            {(data) => {
              const s = conditionsSummary(data.stages![0]);
              return <MetaGrid><Meta label="Трасса">{s.track}</Meta><Meta label="Конфигурация">{s.layout}</Meta><Meta label="Погода">{s.weather}</Meta><Meta label="Температура">{s.temperature}</Meta><Meta label="Машины">{s.cars}</Meta><Meta label="Отличия от общих">{s.overrides.length ? s.overrides.join(', ') : 'Нет'}</Meta></MetaGrid>;
            }}
          </AsyncView>
        </Panel>
      </div>
    </>
  );
}

/** Standings: the primary (event-level) result of the server, plus stage results. No client-side aggregation. */
export function StandingsTab({ active }: { active: boolean }) {
  const { summary, eventId, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const groups = groupProgram(summary.program).filter((g) => g.kind === 'STAGE');
  const done = groups.filter((g) => g.state === 'done' || g.state === 'done-with-errors').length;
  return (
    <div className="lsr-stack">
      <InfoTiles items={[{ label: 'Завершено этапов', value: `${done} / ${groups.length}` }, { label: 'Текущий этап', value: (currentGroup(groups, summary.currentStage?.key)?.index ?? -1) + 1 || '—' }, { label: 'Результатов', value: summary.counts.results }, { label: 'Итоговый результат', value: summary.primaryResultId ? 'Есть' : 'Нет', small: true }]} />
      <Panel title="Общий зачёт" sub="Основной результат события, рассчитанный сервером">
        {summary.primaryResultId ? <ResultRevisions eventId={eventId} resultId={summary.primaryResultId} active={active} />
          : <Notice tone="neutral">У события нет основного результата: сервер не формирует общий зачёт для этого сценария.</Notice>}
      </Panel>
      <Panel title="Результаты по этапам" body={false}>
        <div className="lsr-rows">
          {groups.map((g) => {
            const race = g.blocks.find((b) => b.type === 'RACE') ?? g.blocks.at(-1)!;
            return (
              <div className="lsr-row-item" key={g.key}>
                <div><b>{g.title}</b><small className="lsr-hstack" style={{ gap: 7 }}>{shortDateTime(race.startsAt, timezone)} <StatusBadge status={race.displayStatus} small /></small></div>
                <TextLink onClick={() => nav.race(race.key, 'results')}>Гонка и сплиты →</TextLink>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
