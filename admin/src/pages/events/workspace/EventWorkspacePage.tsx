import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, Tabs, usePageChrome } from '../../../ui/v16';
import { useWorkspaceData, type WorkspaceSummary } from './data';
import { AppearanceTab } from './common/AppearanceTab';
import { WorkspaceContext, useWorkspace, useWorkspaceNav, type Section } from './context';
import { EventHeader } from './EventShell';
import { useEventCommands } from './useEventCommands';
import { WeeklyOverview } from './weekly/WeeklyOverview';
import { WeeksList } from './weekly/WeeksList';
import { WeekPage } from './weekly/WeekPage';
import { WeekSettings } from './weekly/WeekSettings';
import { ChampionshipOverview, GroupPage, StandingsTab } from './championship/Championship';
import { BracketTab, LeaderboardTab, PracticeOverview, SingleRaceOverview, TimeAttackOverview, TournamentOverview } from './formats/Formats';
import { GenericOverview, ProgramTable } from './common/program-table';
import { RacePage } from './race/RacePage';
import { SettingsTab } from './common/SettingsTab';
import { ParticipantsTab } from './common/Participants';
import { ResultsTab } from './common/ResultsTab';
import { ServersTab } from './common/ServersTab';
import { JournalTab } from './common/JournalTab';

type TabConfig = { key: Section; label: string };
const tail: TabConfig[] = [{ key: 'servers', label: 'Серверы' }, { key: 'journal', label: 'Журнал' }, { key: 'appearance', label: 'Внешний вид' }, { key: 'settings', label: 'Настройки' }];
const overview: TabConfig = { key: 'overview', label: 'Общая информация' };
const participants: TabConfig = { key: 'participants', label: 'Участники' };
const results: TabConfig = { key: 'results', label: 'Результаты' };
/** Tabs per scenario. Mockup tabs come first; features of the previous admin follow in the same visual system. */
export function tabsFor(scenario: string, resultsCount = 1): TabConfig[] {
  switch (scenario) {
    case 'weekly': return [overview, { key: 'weeks', label: 'Недели' }, participants, results, ...tail];
    case 'championship': return [overview, { key: 'stages', label: 'Этапы' }, { key: 'standings', label: 'Зачёт' }, participants, results, ...tail];
    case 'circuit_single_race': return [overview, participants, results, ...tail];
    case 'practice': return [overview, { key: 'servers', label: 'Сессии и подключения' }, participants, ...(resultsCount > 0 ? [results] : []), ...tail.filter((t) => t.key !== 'servers')];
    case 'time_attack': return [overview, { key: 'leaderboard', label: 'Рекорды и попытки' }, participants, results, ...tail];
    case 'double_elimination_tournament': return [overview, { key: 'program', label: 'Турнирная сетка' }, participants, results, ...tail];
    default: return [overview, { key: 'program', label: 'Программа' }, participants, results, ...tail];
  }
}
/** Maps section values of links from the previous admin (execution, history, materials). */
function resolveSection(raw: string | null, tabs: TabConfig[]): Section {
  const legacy: Record<string, Section> = { execution: tabs.some((t) => t.key === 'weeks') ? 'weeks' : tabs.some((t) => t.key === 'stages') ? 'stages' : tabs.some((t) => t.key === 'program') ? 'program' : 'overview', history: 'journal', materials: 'appearance' };
  const value = (raw && legacy[raw]) || raw;
  return (tabs.some((t) => t.key === value) ? value : 'overview') as Section;
}

export function EventWorkspacePage() {
  const { eventId = '' } = useParams();
  return <Workspace key={eventId} eventId={eventId} />;
}

function Workspace({ eventId }: { eventId: string }) {
  const resource = useWorkspaceData<WorkspaceSummary>(`/admin/events/${eventId}/workspace`);
  const commands = useEventCommands(eventId, () => resource.load());
  const summary = resource.data?.eventId === eventId ? resource.data : null;
  if (!summary) return <WorkspaceLoading error={resource.error} status={resource.status} retry={() => void resource.load()} />;
  return (
    <WorkspaceContext.Provider value={{ eventId, summary, reload: resource.load, execute: commands.execute, blocked: commands.blocked, timezone: summary.event.timezone }}>
      <WorkspaceRoutes commands={commands} refreshError={resource.error} />
    </WorkspaceContext.Provider>
  );
}

function WorkspaceLoading({ error, status, retry }: { error: string; status: number | null; retry: () => void }) {
  const navigate = useNavigate();
  usePageChrome({ variant: 'event', back: { label: 'Назад', to: '/events' }, crumbs: [{ label: 'События', to: '/events' }, { label: 'Событие' }] });
  if (error) {
    if (status === 404) return <EmptyState title="Событие не найдено" action={<Button onClick={() => navigate('/events')}>← К событиям</Button>}>Возможно, оно удалено или ссылка устарела.</EmptyState>;
    return <ErrorState error={error} status={status} onRetry={retry} />;
  }
  return (
    <div className="lsr-stack" role="status" aria-label="Загрузка события">
      <Skeleton width="45%" height={34} /><Skeleton width="65%" height={18} /><Skeleton height={44} style={{ marginTop: 10 }} />
      <div className="lsr-cols-overview"><Skeleton height={260} /><Skeleton height={260} /></div>
    </div>
  );
}

function WorkspaceRoutes({ commands, refreshError }: { commands: ReturnType<typeof useEventCommands>; refreshError: string }) {
  const nav = useWorkspaceNav();
  const { summary } = useWorkspace();
  const stage = nav.params.get('stage');
  const week = nav.params.get('week');
  if (stage) return <RacePage key={stage} blockKey={stage} />;
  if (week) {
    const kind = summary.program?.find((b) => b.group?.key === week)?.group?.kind;
    if (kind && kind !== 'WEEK') return <GroupPage key={week} groupKey={week} />;
    return nav.params.get('view') === 'settings' ? <WeekSettings key={week} weekKey={week} /> : <WeekPage key={week} weekKey={week} />;
  }
  return <EventTabs commands={commands} refreshError={refreshError} />;
}

function EventTabs({ commands, refreshError }: { commands: ReturnType<typeof useEventCommands>; refreshError: string }) {
  const nav = useWorkspaceNav();
  const ctx = useWorkspace();
  const { summary, eventId } = ctx;
  const tabs = tabsFor(summary.event.scenarioCode, summary.counts.results);
  const section = resolveSection(nav.params.get('section'), tabs);
  const [visited, setVisited] = useState(new Set([section]));
  useEffect(() => setVisited((old) => (old.has(section) ? old : new Set([...old, section]))), [section]);
  const tabLabel = tabs.find((t) => t.key === section)?.label ?? '';
  usePageChrome({
    variant: 'event',
    back: { label: 'Назад', to: section === 'overview' ? '/events' : `/events/${eventId}` },
    crumbs: section === 'overview' ? [{ label: 'События', to: '/events' }, { label: summary.event.title }] : [{ label: summary.event.title, to: `/events/${eventId}` }, { label: section === 'weeks' ? 'Недели / этапы' : tabLabel }],
  });
  const weekly = summary.event.scenarioCode === 'weekly';
  const editLabel = weekly ? 'Редактировать серию' : summary.event.scenarioCode === 'championship' ? 'Редактировать чемпионат' : 'Редактировать событие';
  const scenario = summary.event.scenarioCode;
  const primaryAction = scenario === 'weekly' ? <Button variant="primary" onClick={() => nav.section('weeks')}>Все недели →</Button>
    : scenario === 'championship' ? <Button variant="primary" onClick={() => nav.section('stages')}>Все этапы →</Button>
    : scenario === 'double_elimination_tournament' ? <Button variant="primary" onClick={() => nav.section('program')}>Турнирная сетка →</Button>
    : scenario === 'time_attack' ? <Button variant="primary" onClick={() => nav.section('leaderboard')}>Рекорды и попытки →</Button> : undefined;
  const header = (() => {
    const shell = <EventHeader editLabel={editLabel} onEdit={() => nav.section('settings')} primary={section === 'overview' ? primaryAction : undefined}
      commands={{ error: commands.error || refreshError, pending: commands.pending, busy: commands.busy, retry: () => commands.pending && void commands.execute(commands.pending.path, commands.pending.body, commands.pending.method), dismissError: () => commands.setError('') }} />;
    const back = <Button onClick={() => nav.section('overview')}>← К событию</Button>;
    if (section === 'weeks') return <PageHeader title="Недели серии" description="Полный список недель. Выберите нужную: её гонки и настройки откроются отдельно." actions={back} />;
    if (section === 'stages') return <PageHeader title="Этапы чемпионата" description="Все этапы с практикой и гонкой. Откройте этап, чтобы увидеть его блоки и условия." actions={back} />;
    if (section === 'standings') return <PageHeader title="Зачёт чемпионата" description="Сводные очки рассчитывает сервер отдельным результатом события; это не повтор таблицы гонки." actions={<Button onClick={() => nav.section('overview')}>← К чемпионату</Button>} />;
    if (section === 'leaderboard') return <PageHeader title={`${summary.event.title} · рекорды и попытки`} description="Рейтинг лучших засчитанных попыток. Историю попыток не смешиваем с лучшим результатом пилота." actions={back} />;
    if (section === 'program' && scenario === 'double_elimination_tournament') return <PageHeader title="Турнирная сетка" description="Основная и нижняя сетки, раунды и пары. Структура определяется сервером." actions={back} />;
    if (section === 'settings' || section === 'appearance') return null;
    return shell;
  })();
  const tabsNode = <Tabs label="Разделы события" items={tabs} value={section} onChange={(key) => nav.section(key)} />;
  const panes: Partial<Record<Section, (active: boolean) => ReactNode>> = {
    overview: () => (weekly ? <WeeklyOverview /> : scenario === 'championship' ? <ChampionshipOverview /> : scenario === 'circuit_single_race' ? <SingleRaceOverview /> : scenario === 'practice' ? <PracticeOverview /> : scenario === 'time_attack' ? <TimeAttackOverview /> : scenario === 'double_elimination_tournament' ? <TournamentOverview /> : <GenericOverview />),
    weeks: () => <WeeksList />,
    stages: () => <WeeksList kind="STAGE" />,
    standings: (active) => <StandingsTab active={active} />,
    leaderboard: (active) => <LeaderboardTab active={active} />,
    program: (active) => (scenario === 'double_elimination_tournament' ? <BracketTab active={active} /> : <ProgramTable />),
    participants: (active) => <ParticipantsTab active={active} />,
    results: (active) => <ResultsTab active={active} />,
    servers: (active) => <ServersTab active={active} />,
    journal: (active) => <JournalTab active={active} />,
    appearance: (active) => <AppearanceTab active={active} tabs={tabsNode} />,
    settings: (active) => <SettingsTab active={active} tabs={tabsNode} />,
  };
  return (
    <>
      {header}
      {header && tabsNode}
      {tabs.filter((t) => visited.has(t.key) || t.key === section).map((t) => (
        <div key={t.key} hidden={t.key !== section}>{panes[t.key]?.(t.key === section)}</div>
      ))}
    </>
  );
}

