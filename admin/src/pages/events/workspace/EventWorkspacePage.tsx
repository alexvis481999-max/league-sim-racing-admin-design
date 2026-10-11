import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, Tabs, usePageChrome } from '../../../ui/v16';
import { useWorkspaceData, type WorkspaceSummary } from '../current/workspace-data';
import { WorkspaceSection } from '../current/WorkspaceSections';
import { AppearanceTab } from './common/AppearanceTab';
import { WorkspaceConduct } from '../current/WorkspaceConduct';
import { WorkspaceContext, useWorkspace, useWorkspaceNav, type Section } from './context';
import { EventHeader } from './EventShell';
import { useEventCommands } from './useEventCommands';
import { WeeklyOverview } from './weekly/WeeklyOverview';
import { WeeksList } from './weekly/WeeksList';
import { WeekPage } from './weekly/WeekPage';
import { WeekSettings } from './weekly/WeekSettings';
import { RacePage } from './race/RacePage';
import { SettingsTab } from './common/SettingsTab';
import { ParticipantsTab } from './common/Participants';
import { ResultsTab } from './common/ResultsTab';
import { ServersTab } from './common/ServersTab';
import { JournalTab } from './common/JournalTab';

type TabConfig = { key: Section; label: string };
const weeklyTabs: TabConfig[] = [
  { key: 'overview', label: 'Общая информация' }, { key: 'weeks', label: 'Недели' }, { key: 'participants', label: 'Участники' }, { key: 'results', label: 'Результаты' },
  { key: 'servers', label: 'Серверы и подключения' }, { key: 'journal', label: 'Журнал' }, { key: 'appearance', label: 'Внешний вид' }, { key: 'settings', label: 'Настройки' },
];
const genericTabs: TabConfig[] = [
  { key: 'overview', label: 'Общая информация' }, { key: 'program', label: 'Программа' }, { key: 'participants', label: 'Участники' }, { key: 'results', label: 'Результаты' },
  { key: 'servers', label: 'Серверы и подключения' }, { key: 'journal', label: 'Журнал' }, { key: 'appearance', label: 'Внешний вид' }, { key: 'settings', label: 'Настройки' },
];
export function tabsFor(scenario: string): TabConfig[] {
  return scenario === 'weekly' ? weeklyTabs : genericTabs;
}
/** Maps section values of links from the previous admin (execution, history, materials). */
function resolveSection(raw: string | null, tabs: TabConfig[]): Section {
  const legacy: Record<string, Section> = { execution: tabs.some((t) => t.key === 'weeks') ? 'weeks' : 'program', history: 'journal', materials: 'appearance' };
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
  const stage = nav.params.get('stage');
  const week = nav.params.get('week');
  if (stage) return <RacePage key={stage} blockKey={stage} />;
  if (week) return nav.params.get('view') === 'settings' ? <WeekSettings key={week} weekKey={week} /> : <WeekPage key={week} weekKey={week} />;
  return <EventTabs commands={commands} refreshError={refreshError} />;
}

function EventTabs({ commands, refreshError }: { commands: ReturnType<typeof useEventCommands>; refreshError: string }) {
  const nav = useWorkspaceNav();
  const ctx = useWorkspace();
  const { summary, eventId } = ctx;
  const tabs = tabsFor(summary.event.scenarioCode);
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
  const header = (() => {
    const shell = <EventHeader editLabel={editLabel} onEdit={() => nav.section('settings')} primary={weekly && section === 'overview' ? <Button variant="primary" onClick={() => nav.section('weeks')}>Все недели →</Button> : undefined}
      commands={{ error: commands.error || refreshError, pending: commands.pending, busy: commands.busy, retry: () => commands.pending && void commands.execute(commands.pending.path, commands.pending.body, commands.pending.method), dismissError: () => commands.setError('') }} />;
    if (section === 'weeks') return <PageHeader title="Недели серии" description="Полный список недель. Выберите нужную: её гонки и настройки откроются отдельно." actions={<Button onClick={() => nav.section('overview')}>← К событию</Button>} />;
    if (section === 'settings' || section === 'appearance') return null;
    return shell;
  })();
  const tabsNode = <Tabs label="Разделы события" items={tabs} value={section} onChange={(key) => nav.section(key)} />;
  const legacy = (key: string, active: boolean) => <WorkspaceSection section={key} eventId={eventId} active={active} summary={summary} busy={ctx.blocked} execute={ctx.execute} />;
  const panes: Partial<Record<Section, (active: boolean) => ReactNode>> = {
    overview: () => (weekly ? <WeeklyOverview /> : legacy('execution', false)),
    weeks: () => <WeeksList />,
    program: (active) => <WorkspaceConduct section="execution" eventId={eventId} active={active} summary={summary} busy={ctx.blocked} execute={ctx.execute} />,
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

