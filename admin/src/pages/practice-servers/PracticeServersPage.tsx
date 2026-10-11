import './practice.v16.css';
import { ConfirmCommand, PAGE_SIZE, Pager, PracticeTable, ServerHistory, ServerLive, ServerSide, ServerStatus } from './PracticeServerViews';
import type { Config, Server, Cycle, PracticeAction } from './practice-types';
export type { Config } from './practice-types';
export { practiceServerStatus } from './practice-types';
import { disciplineLabel, gameLabel, practiceServerStatus as statusOf } from './practice-types';
import { PracticeServerEditor } from './PracticeServerEditor';
import { useOrganizerNames, usePracticeCatalog } from './practice-catalog';
import { subscribeAdminRefresh } from '../../shared/realtime';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../shared/api';
import { hasAny } from '../../shared/format';
import type { AdminAccess } from '../../shared/types';
import { command, defaultGame } from '../../features/standalone/GameFields';
import {
  Button, EmptyState, ErrorState, PillButtons, Kpis, clock, LoadingBlock, Notice, PageHeader, Panel, Skeleton, Table, Tabs, TextLink, Toolbar, usePageChrome,
} from '../../ui/v16';

type Failure = { message: string; status: number | null };
type Counts = { all: number; ACTIVE: number; PAUSED: number; FAILED: number };
const failure = (e: unknown): Failure => ({ message: e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : null });
const statusFilters = [
  { value: '', label: 'Все' },
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'PAUSED', label: 'На паузе' },
  { value: 'STOPPED', label: 'Остановленные' },
  { value: 'FAILED', label: 'С ошибкой' },
] as const;
type StatusFilter = (typeof statusFilters)[number]['value'];

const initial = (): Config => ({
  organizerId: '',
  title: 'Тренировка',
  description: null,
  coverImageId: null,
  timezone: 'Europe/Moscow',
  gameCode: 'assetto_corsa',
  disciplineCode: 'touge',
  sessionDurationMinutes: 60,
  extraDelaySeconds: 0,
  game: defaultGame(),
  practice: { durationMinutes: 60, maxParticipants: 16 },
});
const listPath = (page: number, status: string) => `/admin/practice-servers?page=${page}&pageSize=${PAGE_SIZE}${status ? '&status=' + status : ''}`;

export function PracticeServersPage({ access }: { access: AdminAccess }) {
  const location = useLocation(),
    navigate = useNavigate(),
    editId = location.pathname.match(/^\/practice-servers\/(\d+)(?:\/edit)?$/)?.[1],
    tab = location.pathname.endsWith('/edit') ? 'settings' : new URLSearchParams(location.search).get('tab') === 'sessions' ? 'sessions' : 'live',
    create = location.pathname.endsWith('/new');
  const [items, setItems] = useState<Server[]>([]),
    [loaded, setLoaded] = useState(false),
    [counts, setCounts] = useState<Counts | null>(null),
    [sessionPage, setSessionPage] = useState(1),
    [editing, setEditing] = useState<Server | null>(null),
    [config, setConfig] = useState<Config>(initial),
    [baseline, setBaseline] = useState<Config>(initial),
    [conflict, setConflict] = useState(false),
    [loadError, setLoadError] = useState<Failure | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [hasPending, setHasPending] = useState(false),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [status, setStatus] = useState<StatusFilter>(''),
    [confirm, setConfirm] = useState<{ server: Server; action: 'stop' | 'restart' } | null>(null),
    [historyError, setHistoryError] = useState<Failure | null>(null),
    [historyRevision, setHistoryRevision] = useState(0),
    [history, setHistory] = useState<{
      id: string;
      items: Cycle[];
      page: number;
      total: number;
    } | null>(null);
  const pending = useRef<{ path: string; body: unknown; method: string; key: string } | null>(null),
    inFlight = useRef(false),
    generation = useRef(0),
    configSource = useRef<{id: string; version: number} | null>(null);
  const catalog = usePracticeCatalog((editing?.config ?? config).gameCode || 'assetto_corsa');
  const organizers = useOrganizerNames();
  const load = useCallback(async () => {
    const request = ++generation.current;
    if (create) return;
    if (editId) {
      const server = await apiFetch<Server>(`/admin/practice-servers/${editId}`);
      if (request !== generation.current) return;
      setEditing(server);
      setLoadError(null);
      if (configSource.current?.id !== server.id) {
        setConfig(server.config); setBaseline(server.config); setConflict(false);
        configSource.current = {id: server.id, version: server.configVersion};
      } else if (configSource.current.version !== server.configVersion) setConflict(true);
      return;
    }
    const v = await apiFetch<{ items: Server[]; total: number }>(listPath(page, status));
    if (request !== generation.current) return;
    configSource.current = null;
    setItems(v.items);
    setLoaded(true);
    setLoadError(null);
    setTotal(v.total);
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(v.total / PAGE_SIZE))));
    // KPI totals: the list API filters by status and returns `total`; a complete unfiltered page is counted locally.
    if (!status && v.total <= v.items.length) {
      const by = (code: string) => v.items.filter((s) => s.status === code).length;
      setCounts({ all: v.total, ACTIVE: by('ACTIVE'), PAUSED: by('PAUSED'), FAILED: by('FAILED') });
    } else {
      const totals = await Promise.all(['', 'ACTIVE', 'PAUSED', 'FAILED'].map((code) => (code === status ? Promise.resolve(v.total) : apiFetch<{ total: number }>(listPath(1, code)).then((r) => r.total)))).catch(() => null);
      if (request !== generation.current) return;
      setCounts(totals ? { all: totals[0], ACTIVE: totals[1], PAUSED: totals[2], FAILED: totals[3] } : null);
    }
  }, [page, status, editId, create]);
  useEffect(() => {
    if (!create) return;
    const fresh = initial();
    setEditing(null); setConfig(fresh); setBaseline(fresh); setConflict(false);
    configSource.current = null;
  }, [create]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active)
        void load().catch((e) => {
          if (active) setLoadError(failure(e));
        });
    };
    refresh();
    const unsubscribe = subscribeAdminRefresh(['practice', 'runtime'], refresh);
    return () => {
      active = false;
      generation.current++;
      unsubscribe();
    };
  }, [load]);
  async function send(path: string, body: unknown = {}, method = 'POST') {
    if (inFlight.current) return;
    pending.current ??= { path, body, method, key: crypto.randomUUID() };
    setHasPending(true);
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const p = pending.current;
      const saved = await command<Server>(p.path, p.body, p.key, p.method);
      pending.current = null;
      setHasPending(false);
      if (p.method === 'PUT') {
        configSource.current = {id: saved.id, version: saved.configVersion};
        setEditing(saved); setConfig(saved.config); setBaseline(saved.config); setConflict(false);
      }
      if (create) navigate(`/practice-servers/${saved.id}`);
      else await load();
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        pending.current = null;
        setHasPending(false);
        if (e.status === 409 && editId) {
          setConflict(true);
        }
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  useEffect(() => { setSessionPage(1); setHistory(null); setLoadError(null); }, [editId]);
  useEffect(() => {
    if (!editId || tab !== 'sessions') return;
    let active = true, revision = 0;
    setHistory(null);
    setHistoryError(null);
    const refresh = async () => {
      const request = ++revision;
      try {
        const v = await apiFetch<{ items: Cycle[]; total: number }>(`/admin/practice-servers/${editId}/sessions?page=${sessionPage}&pageSize=${PAGE_SIZE}`);
        if (active && request === revision) { setHistory({ id: editId, ...v, page: sessionPage }); setHistoryError(null); }
      } catch (e) { if (active && request === revision) setHistoryError(failure(e)); }
    };
    void refresh();
    const unsubscribe = subscribeAdminRefresh(['practice', 'runtime'], refresh);
    return () => { active = false; unsubscribe(); };
  }, [editId, tab, sessionPage, historyRevision]);
  const dirty = JSON.stringify(config) !== JSON.stringify(baseline);
  const changeView = (path: string) => {
    if ((create || tab === 'settings') && dirty && !window.confirm('Выйти без сохранения изменений?')) return;
    if (tab === 'settings') setConfig(baseline);
    navigate(path);
  };
  const canCreate = hasAny(access, ['practice.manage.all', 'practice.manage.scoped']),
    canMonitor = hasAny(access, ['events.override.all', 'monitoring.read']),
    locked = busy || hasPending;
  const run = (server: Server, action: PracticeAction) => {
    if (action === 'stop' || action === 'restart') setConfirm({ server, action });
    else void send(`/admin/practice-servers/${server.id}/${action}`);
  };
  const confirmCommand = () => {
    if (!confirm) return;
    const { server, action } = confirm;
    setConfirm(null);
    void send(`/admin/practice-servers/${server.id}/${action}`);
  };
  const reloadSettings = () => {
    void apiFetch<Server>(`/admin/practice-servers/${editId}`)
      .then((v) => {
        configSource.current = {id: v.id, version: v.configVersion};
        setEditing(v);
        setConfig(v.config);
        setBaseline(v.config);
        setConflict(false);
        setError('');
      })
      .catch((e) => setError(String(e)));
  };

  const title = editing?.config.title ?? 'Сервер практики';
  usePageChrome(
    create
      ? { crumbs: [{ label: 'Серверы практики' }, { label: 'Создание сервера' }] }
      : editId
        ? tab === 'settings'
          ? { crumbs: [{ label: 'Серверы практики' }, { label: title }, { label: 'Настройки' }] }
          : { back: { label: 'К списку', to: '/practice-servers' }, crumbs: [{ label: 'Серверы практики', to: '/practice-servers' }, { label: title }] }
        : { crumbs: [{ label: 'Серверы практики' }] },
  );

  const notices = (
    <>
      {error && <Notice tone="danger">{error}</Notice>}
      {hasPending && (
        <Notice tone="warning" actions={<Button size="sm" disabled={busy} onClick={() => { const p = pending.current!; void send(p.path, p.body, p.method); }}>Повторить неподтверждённую команду</Button>}>
          {busy ? 'Команда отправляется…' : 'Результат последней команды не подтверждён. Повтор отправит ту же команду с тем же ключом.'}
        </Notice>
      )}
    </>
  );
  const dialog = <ConfirmCommand request={confirm} busy={locked} onCancel={() => setConfirm(null)} onConfirm={confirmCommand} />;
  const editor = (
    <PracticeServerEditor
      config={config}
      onChange={setConfig}
      editing={!!editId}
      dirty={dirty}
      disabled={locked || conflict || (!create && !editing?.allowedActions.configure) || (create && !canCreate)}
      onCancel={() => (create ? changeView('/practice-servers') : setConfig(baseline))}
      onSave={() =>
        void send(
          create ? '/admin/practice-servers' : `/admin/practice-servers/${editId}/config`,
          { config, ...(editing ? { version: configSource.current?.version ?? editing.configVersion } : {}) },
          create ? 'POST' : 'PUT',
        )
      }
    />
  );

  if (create) {
    return (
      <div className="lsr-practice">
        <TextLink size="sm" onClick={() => changeView('/practice-servers')}>← Серверы практики</TextLink>
        <PageHeader overline="Серверы практики" title="Создание сервера практики" description="Непрерывный тренировочный сервер: циклы запускаются один за другим, пока сервер включён." />
        <div className="lsr-stack">
          {notices}
          {!canCreate && <Notice tone="warning">Недостаточно прав для создания серверов практики.</Notice>}
          {editor}
        </div>
      </div>
    );
  }

  if (editId) {
    const server = editing?.id === editId ? editing : null;
    return (
      <div className="lsr-practice">
        <TextLink size="sm" onClick={() => changeView('/practice-servers')}>← Серверы практики</TextLink>
        <PageHeader
          overline={`Сервер практики · №${editId}`}
          title={server ? <span className="lsr-practice-title">{server.config.title}<ServerStatus server={server} /></span> : 'Сервер практики'}
          description={server ? [gameLabel(server.config.gameCode), disciplineLabel(server.config.disciplineCode), server.config.description].filter(Boolean).join(' · ') : undefined}
        />
        <Tabs variant="module" label="Разделы сервера" value={tab} onChange={(next) => changeView(`/practice-servers/${editId}${next === 'settings' ? '/edit' : next === 'sessions' ? '?tab=sessions' : ''}`)}
          items={[{ key: 'live', label: 'Лайв' }, { key: 'sessions', label: 'Журнал сессий' }, { key: 'settings', label: 'Настройки' }]} />
        <div className="lsr-stack">
          {notices}
          {!server ? (
            loadError ? <ErrorState error={loadError.status === 404 ? 'Сервер практики не найден.' : loadError.message} status={loadError.status} onRetry={() => void load().catch((e) => setLoadError(failure(e)))} />
              : <Panel><LoadingBlock label={tab === 'settings' ? 'Загрузка настроек' : 'Загрузка сервера'} /></Panel>
          ) : tab === 'settings' ? (
            <>
              {conflict && (
                <Notice tone="warning" actions={<Button size="sm" disabled={locked} onClick={reloadSettings}>Загрузить актуальные настройки</Button>}>
                  Настройки изменены другим администратором. Ваши правки сохранены в форме.
                </Notice>
              )}
              {!server.allowedActions.configure && <Notice tone="neutral">Изменение настроек этого сервера недоступно.</Notice>}
              {editor}
            </>
          ) : tab === 'sessions' ? (
            <ServerHistory history={history?.id === editId ? history : null} page={sessionPage} onPage={setSessionPage} timezone={server.config.timezone}
              error={historyError} onRetry={() => setHistoryRevision((n) => n + 1)} />
          ) : (
            <>
              <LiveKpis server={server} />
              <div className="lsr-cols-module">
                <ServerLive server={server} catalog={catalog} locked={locked} onCommand={(action) => run(server, action)} />
                <ServerSide server={server} catalog={catalog} organizers={organizers} canMonitor={canMonitor} />
              </div>
            </>
          )}
        </div>
        {dialog}
      </div>
    );
  }

  const kpiValue = (n: number | undefined) => (counts ? n : loaded ? '—' : '…');
  return (
    <div className="lsr-practice">
      <PageHeader
        overline="Администрирование"
        title="Серверы практики"
        description="Управление непрерывными тренировочными серверами"
        actions={canCreate ? <Button variant="primary" disabled={locked} onClick={() => navigate('/practice-servers/new')}>＋ Создать сервер</Button> : undefined}
      />
      <Kpis items={[
        { label: 'Серверов', value: kpiValue(counts?.all) },
        { label: 'Активные', value: kpiValue(counts?.ACTIVE) },
        { label: 'На паузе', value: kpiValue(counts?.PAUSED) },
        { label: 'С ошибкой', value: kpiValue(counts?.FAILED), foot: counts?.FAILED ? 'Требует внимания' : undefined, problem: !!counts?.FAILED },
      ]} />
      <div className="lsr-stack">
        {notices}
        <Panel title="Список серверов" body={false}>
          <Toolbar>
            <PillButtons label="Состояние" value={status} options={statusFilters} onChange={(value) => { setStatus(value); setPage(1); }} />
          </Toolbar>
          {loadError && !loaded ? (
            <div className="lsr-practice-pad"><ErrorState error={loadError.status === 403 ? 'Недостаточно прав для просмотра серверов практики.' : loadError.message} status={loadError.status} onRetry={() => void load().catch((e) => setLoadError(failure(e)))} /></div>
          ) : !loaded ? (
            <Table variant="module" label="Серверы практики">
              <tbody>{Array.from({ length: 4 }, (_, i) => <tr key={i}><td><Skeleton width="55%" /><Skeleton width="30%" height={11} style={{ marginTop: 6 }} /></td><td><Skeleton width={80} height={22} /></td><td><Skeleton width={120} /></td><td><Skeleton width={90} /></td></tr>)}</tbody>
            </Table>
          ) : !items.length ? (
            <EmptyState compact title={status ? 'Нет серверов с таким состоянием' : 'Серверов пока нет'}
              action={!status && canCreate ? <Button variant="primary" onClick={() => navigate('/practice-servers/new')}>＋ Создать сервер</Button> : undefined}>
              {status ? 'Выберите другой фильтр.' : 'Создайте первый тренировочный сервер.'}
            </EmptyState>
          ) : (
            <>
              {loadError && <div className="lsr-practice-pad"><ErrorState compact error={loadError.message} status={loadError.status} onRetry={() => void load().catch((e) => setLoadError(failure(e)))} /></div>}
              <PracticeTable items={items} catalog={catalog} organizers={organizers} locked={locked} onOpen={(server) => navigate(`/practice-servers/${server.id}`)} onCommand={run} />
              <Pager page={page} total={total} onPage={setPage} />
            </>
          )}
        </Panel>
        <div className="lsr-practice-footer">Открывайте сервер для лайва, журнала циклов и редактирования.</div>
      </div>
      {dialog}
    </div>
  );
}

function LiveKpis({ server }: { server: Server }) {
  const cycle = server.currentCycle, tz = server.config.timezone;
  const end = (start: string) => new Date(Date.parse(start) + server.config.sessionDurationMinutes * 60_000).toISOString();
  const current = !cycle ? 'Нет' : !cycle.startedAt ? 'Запуск' : `${clock(cycle.startedAt, tz)}–${clock(end(cycle.startedAt), tz)}`;
  const next = server.nextEligibleAt ? `Не раньше ${clock(server.nextEligibleAt, tz)}` : server.status === 'ACTIVE' ? 'По завершении' : server.status === 'PAUSED' ? 'На паузе' : 'Не запланирован';
  return (
    <Kpis items={[
      { label: 'Состояние', value: statusOf(server).label },
      { label: 'Текущий цикл', value: current, foot: cycle?.startedAt ? 'Окончание — плановое' : undefined },
      { label: 'Следующий цикл', value: next, foot: server.status === 'ACTIVE' ? `Пауза 30 + ${server.config.extraDelaySeconds} с` : undefined },
      { label: 'Мест', value: server.config.practice.maxParticipants, foot: cycle?.runtimeSessionId ? `Сессия №${cycle.runtimeSessionId}` : undefined },
    ]} />
  );
}
