import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { AdminAccess } from '../../shared/types';
import { useUnsavedChanges } from '../../features/standalone/EditorSections';
import { hasAny } from '../../shared/format';
import { Button, ErrorState, Kpis, LoadingBlock, Notice, PageHeader, Panel, TableFoot, Tabs, usePageChrome } from '../../ui/v16';
import { MatchRecords, QueueTable } from './MatchRecords';
import { MatchPage } from './MatchPage';
import { MatchmakingAnalytics } from './MatchmakingAnalytics';
import { MatchmakingSettings } from './MatchmakingSettings';
import { usePoolCatalog, type CatalogItem } from './pool-catalog';
import { useMatchmaking, type MatchmakingState } from './useMatchmaking';
import { RACES_PAGE_SIZE, waitClock, type Match } from './matchmaking-model';
import './matchmaking.v16.css';

type Tab = 'queue' | 'matches' | 'analytics' | 'settings';
const tabs: { key: Tab; label: string }[] = [
  { key: 'queue', label: 'Очередь' },
  { key: 'matches', label: 'Матчи' },
  { key: 'analytics', label: 'Аналитика' },
  { key: 'settings', label: 'Настройки' },
];

/** Matchmaking section: overview with tabs at /matchmaking, match card at /matchmaking/matches/:id. */
export function MatchmakingPage({ access }: { access: AdminAccess }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const matchId = /^\/matchmaking\/matches\/([^/]+)/.exec(location.pathname)?.[1] ?? null;
  const tab = (tabs.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'queue') as Tab;
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1);
  const mm = useMatchmaking(page);
  useUnsavedChanges(mm.dirty);
  const { catalog } = usePoolCatalog();
  const canWrite = hasAny(access, ['matchmaking.manage.all']);

  const setQuery = (next: Record<string, string | null>) =>
    setParams((old) => {
      const updated = new URLSearchParams(old);
      for (const [key, value] of Object.entries(next)) if (value) updated.set(key, value); else updated.delete(key);
      return updated;
    }, { replace: true });

  if (matchId) {
    const id = decodeURIComponent(matchId);
    const match = mm.live?.matches.find((m) => m.id === id) ?? mm.races?.items.find((m) => m.id === id) ?? null;
    const loadFailure = typeof mm.loadState === 'object' ? mm.loadState : null;
    return (
      <MatchPage
        matchId={id}
        match={match}
        loading={mm.loadState === 'loading' || (!!mm.queue && !mm.races)}
        error={loadFailure ?? mm.readError}
        onRetry={loadFailure ? mm.reload : mm.refresh}
        page={page}
        queueId={mm.queue?.id}
        timeZone={mm.queue?.config.timezone}
        cars={catalog.cars}
      />
    );
  }
  return (
    <MatchmakingOverview
      mm={mm}
      tab={tab}
      page={page}
      canWrite={canWrite}
      cars={catalog.cars}
      onTab={(key) => setQuery({ tab: key === 'queue' ? null : key, page: null })}
      onPage={(next) => setQuery({ page: next > 1 ? String(next) : null })}
      onOpen={(match, fromJournal) => navigate(`/matchmaking/matches/${encodeURIComponent(match.id)}${fromJournal && page > 1 ? `?page=${page}` : ''}`)}
    />
  );
}

function MatchmakingOverview({ mm, tab, page, canWrite, cars, onTab, onPage, onOpen }: {
  mm: MatchmakingState;
  tab: Tab;
  page: number;
  canWrite: boolean;
  cars: CatalogItem[];
  onTab(tab: Tab): void;
  onPage(page: number): void;
  onOpen(match: Match, fromJournal: boolean): void;
}) {
  usePageChrome({ crumbs: [{ label: 'Матчмейкинг' }] });
  const { queue, live, races, analytics, readError } = mm;
  const timeZone = queue?.config.timezone;
  const loaded = mm.loadState === 'ready';
  const loadFailure = typeof mm.loadState === 'object' ? mm.loadState : null;
  const locked = mm.busy || mm.pending || !canWrite;
  const longestWait = live?.queue.length ? Math.max(...live.queue.map((t) => t.waitingSeconds)) : null;
  const pages = races ? Math.max(1, Math.ceil(races.total / RACES_PAGE_SIZE)) : 1;
  useEffect(() => {
    if (races && page > pages) onPage(pages);
  }, [races, page, pages, onPage]);
  const header = (
    <PageHeader
      overline="Администрирование"
      title="Матчмейкинг"
      description="Очередь, матчи и конфигурация подбора"
      actions={queue ? (
        <Button
          variant={queue.enabled ? 'default' : 'primary'}
          aria-label={queue.enabled ? 'Выключить поиск' : 'Включить поиск'}
          aria-pressed={queue.enabled}
          title={canWrite ? undefined : 'Недостаточно прав для управления очередью'}
          disabled={locked || mm.remoteChanged}
          onClick={() => void mm.send(`/admin/matchmaking/${queue.id}/${queue.enabled ? 'disable' : 'enable'}`, { version: queue.version })}
        >
          {queue.enabled ? 'Выключить поиск' : 'Включить поиск'}
        </Button>
      ) : undefined}
    />
  );
  if (loadFailure) return <>{header}<ErrorState error={loadFailure.message} status={loadFailure.status} onRetry={mm.reload} /></>;

  const stateLabel = !loaded ? 'Загрузка…' : !queue ? 'Не настроен' : queue.enabled ? 'Поиск включён' : 'Поиск выключен';
  const liveValue = (value: number | undefined) => (!queue ? '—' : live ? value : '…');
  /** Loading, missing queue and read errors are separate states; stale data stays visible during a background refresh. */
  const needsLive = (content: () => ReactNode) => {
    if (loaded && queue && live) return content();
    return (
      <div className="lsr-panel-body">
        {!loaded ? <LoadingBlock />
          : !queue ? <Notice tone="neutral">Очередь ещё не настроена. Данные появятся после сохранения конфигурации и включения поиска.</Notice>
          : readError ? <ErrorState error={readError.message} status={readError.status} onRetry={mm.refresh} compact />
          : <LoadingBlock />}
      </div>
    );
  };

  return (
    <>
      {header}
      <div className="lsr-stack is-tight lsr-mm-notices">
        {mm.remoteChanged && (
          <Notice tone="warning" actions={<Button size="sm" disabled={mm.busy || mm.pending} onClick={() => void mm.reloadConfig()}>Загрузить актуальные настройки</Button>}>
            Настройки очереди изменены. Правки формы сохранены; загрузка актуальных настроек заменит их.
          </Notice>
        )}
        {mm.commandError && <Notice tone="danger">{mm.commandError}</Notice>}
        {mm.pending && (
          <Notice tone="warning" actions={<Button size="sm" disabled={mm.busy} onClick={mm.retryPending}>Повторить неподтверждённую команду</Button>}>
            Сервер не подтвердил последнюю команду. Повтор отправит её с тем же ключом и телом.
          </Notice>
        )}
        {mm.setupError && <Notice tone="danger">{mm.setupError}</Notice>}
        {loaded && !queue && <Notice tone="warning">Сохраните условия подбора: трассы, машины, погоду и правила. Затем включите поиск.</Notice>}
        {readError && live && <ErrorState error={readError.message} status={readError.status} onRetry={mm.refresh} />}
      </div>
      <Kpis items={[
        { label: 'Состояние', value: stateLabel, foot: 'Assetto Corsa · Тоге' },
        { label: 'В очереди', value: liveValue(live?.queue.length) },
        { label: 'Активных матчей', value: liveValue(live?.matches.length) },
        { label: 'Ожидание', value: longestWait === null ? '—' : waitClock(longestWait), foot: 'Дольше всех в текущей очереди' },
      ]} />
      <Tabs variant="module" label="Разделы матчмейкинга" items={tabs} value={tab} onChange={onTab} />
      {tab === 'queue' && (
        <Panel shadow title="Участники в очереди" body={false}>
          {needsLive(() => <QueueTable tickets={live!.queue} timeZone={timeZone} enabled={!!queue?.enabled} />)}
        </Panel>
      )}
      {tab === 'matches' && (
        <div className="lsr-stack">
          <Panel shadow title="Активные матчи" sub="Подбор, готовность и идущие заезды." body={false}>
            {needsLive(() => <MatchRecords items={live!.matches} timeZone={timeZone} label="Активные матчи" empty="Сейчас нет активных матчей." onOpen={(m) => onOpen(m, false)} />)}
          </Panel>
          <Panel shadow title="Журнал матчей" sub={races ? `Всего ${races.total}` : undefined} body={false}>
            {needsLive(() => races ? (
              <>
                <MatchRecords items={races.items} timeZone={timeZone} label="Журнал матчей" empty="Матчей пока нет." onOpen={(m) => onOpen(m, true)} />
                {races.total > RACES_PAGE_SIZE && (
                  <TableFoot>
                    <span>Страница {page} из {pages} · {(page - 1) * RACES_PAGE_SIZE + 1}–{Math.min(page * RACES_PAGE_SIZE, races.total)} из {races.total}</span>
                    <span className="lsr-hstack">
                      <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Назад</Button>
                      <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Вперёд ›</Button>
                    </span>
                  </TableFoot>
                )}
              </>
            ) : <div className="lsr-panel-body"><LoadingBlock /></div>)}
          </Panel>
        </div>
      )}
      {tab === 'analytics' && (loaded && queue && analytics ? <div className="lsr-mm-analytics"><MatchmakingAnalytics data={analytics} cars={cars} /></div> : <Panel shadow body={false}>{needsLive(() => <div className="lsr-panel-body"><LoadingBlock label="Загрузка аналитики" /></div>)}</Panel>)}
      {tab === 'settings' && (loaded ? <MatchmakingSettings mm={mm} canWrite={canWrite} /> : <LoadingBlock />)}
    </>
  );
}
