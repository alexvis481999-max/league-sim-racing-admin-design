import './runtime.v16.css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { displayRuntimeStatus } from '../../../../shared/presentation';
import { realtime, useRealtimeStatus } from '../../shared/realtime';
import { OwnerGameJournal } from '../../features/standalone/OwnerGameJournal';
import { apiFetch, ApiError } from '../../shared/api';
import {
  Button, EmptyState, ErrorState, Kpis, Tabs, LoadingBlock, Notice, PageHeader, Panel, PillButtons, SearchInput, StatusBadge, Table, TextLink, Toolbar,
  clickableRow, recordTone, shortDateTime, usePageChrome, type Tone,
} from '../../ui/v16';
import { activeSession, processFor, sessionTitle, plannedPeak, type Snapshot, type Session } from './runtime-monitoring';

type Slot = Snapshot['slots'][number];
type Process = NonNullable<Snapshot['metrics']>['servers'][number];
type Tab = 'slots' | 'sessions' | 'queue' | 'reserve' | 'health';
const FINISHED = ['STOPPED', 'CANCELLED', 'FAILED'];

export function RuntimePage() {
  const [q] = useSearchParams();
  const practiceId = q.get('practiceServerId'), matchmakingId = q.get('matchmakingId'), matchId = q.get('matchId');
  const path = practiceId ? `/admin/practice-servers/${practiceId}/game-chat` : matchmakingId && matchId ? `/admin/matchmaking/${matchmakingId}/matches/${matchId}/game-chat` : null;
  if (path) return <JournalChrome practiceId={practiceId} matchId={matchId}><OwnerGameJournal path={path} /></JournalChrome>;
  return <RuntimeMonitoring />;
}

function JournalChrome({ practiceId, matchId, children }: { practiceId: string | null; matchId: string | null; children: ReactNode }) {
  usePageChrome(practiceId
    ? { back: { label: 'К серверу', to: `/practice-servers/${practiceId}` }, crumbs: [{ label: 'Серверы практики', to: '/practice-servers' }, { label: `Сервер №${practiceId}`, to: `/practice-servers/${practiceId}` }, { label: 'Журнал игры' }] }
    : { back: { label: 'Назад' }, crumbs: [{ label: 'Матчмейкинг', to: '/matchmaking' }, { label: `Матч №${matchId}` }, { label: 'Журнал игры' }] });
  return <div className="lsr-runtime">{children}</div>;
}

/* ---------- labels and tones: UI rules over daemon codes ---------- */
const slotLabels: Record<string, string> = { ALLOCATED: 'Занят', AVAILABLE: 'Свободен', COOLDOWN: 'Пауза перед запуском' };
const slotTones: Record<string, Tone> = { ALLOCATED: 'live', AVAILABLE: 'done', COOLDOWN: 'current', RESERVED: 'live', FAILED: 'failed', UNAVAILABLE: 'failed', UNKNOWN: 'current', OFFLINE: 'failed' };
const slotLabel = (state: string) => slotLabels[state] ?? displayRuntimeStatus(state);
const reservationLabels: Record<string, string> = { SCHEDULED: 'Запланирован', ACTIVE: 'Действует', COMPLETED: 'Завершён', RELEASED: 'Освобождён', CANCELLED: 'Отменён' };
const reservationTones: Record<string, Tone> = { SCHEDULED: 'scheduled', ACTIVE: 'live', COMPLETED: 'done' };
const sessionTones: Record<string, Tone> = { RUNNING: 'live', STARTING: 'live', PREPARING: 'live', REQUESTED: 'live', WAITING_CAPACITY: 'current', STOPPED: 'done', COMPLETED: 'done', FAILED: 'failed', CANCELLED: 'scheduled' };
const ownerLabels: Record<string, string> = { EVENT: 'Событие', PRACTICE_SERVER: 'Практика', MATCHMAKING: 'Матчмейкинг' };
const ownerLink: Record<string, (id: string) => string> = { EVENT: (id) => `/events/${id}`, PRACTICE_SERVER: (id) => `/practice-servers/${id}` };

function sessionStatus(session: Session) {
  return session.displayStatus?.label ?? (session.connectionLostAt ? 'Уточнение состояния' : displayRuntimeStatus(session.status));
}
function SessionBadge({ session }: { session: Session }) {
  const tone: Tone = session.connectionLostAt || session.displayStatus?.freshness === 'UNCERTAIN' ? 'current' : session.failure ? 'failed' : recordTone(session.displayStatus?.code ?? session.status, sessionTones, recordTone(session.status, sessionTones));
  return <StatusBadge variant="badge" status={{ code: session.status, label: sessionStatus(session) }} tone={tone} title={session.displayStatus?.reason?.message} />;
}
function processText(process: Process | undefined) {
  if (!process) return null;
  return `${process.status === 'running' ? 'Запущен' : process.status === 'idle' ? 'Не запущен' : 'Состояние не подтверждено'}${process.pid != null ? ` · PID ${process.pid}` : ''}`;
}
/** Occupied slot without a confirmed running process, lost connection or failed slot: needs a look, not proof of a crash. */
function needsCheck(data: Snapshot, slot: Slot) {
  const session = activeSession(data, slot), process = processFor(data, slot);
  return slotTones[slot.state] === 'failed' || !!session?.connectionLostAt || (slot.state === 'ALLOCATED' && process?.status !== 'running');
}
const percent = (value?: number) => (value === undefined ? '—' : value.toFixed(1) + '%');
const bytes = (value?: number) => (value === undefined ? '—' : value >= 1073741824 ? (value / 1073741824).toFixed(1) + ' ГБ' : Math.round(value / 1048576) + ' МБ');
function uptime(seconds?: number) { if (seconds === undefined) return '—'; const hours = Math.floor(seconds / 3600); return (hours >= 24 ? Math.floor(hours / 24) + ' д ' : '') + hours % 24 + ' ч ' + Math.floor(seconds % 3600 / 60) + ' мин'; }

function RuntimeMonitoring() {
  const generation = useRef(0);
  const connected = useRealtimeStatus();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Snapshot | null>(null), [error, setError] = useState<{ message: string; status: number | null } | null>(null), [busy, setBusy] = useState(false);
  const eventId = params.get('eventId'), sessionId = params.get('sessionId'), slotId = params.get('slot');
  const tab = ((['slots', 'sessions', 'queue', 'reserve', 'health'] as const).find((t) => t === params.get('tab')) ?? (sessionId ? 'sessions' : 'slots')) as Tab;
  const setParam = (key: string, value: string | null) => setParams((old) => { const next = new URLSearchParams(old); if (value) next.set(key, value); else next.delete(key); return next; });
  async function load() {
    const request = ++generation.current;
    setBusy(true);
    try {
      const next = await apiFetch<Snapshot>('/admin/runtime/ac/daemon');
      if (request !== generation.current) return;
      setData(next); setError(null);
    } catch (e) {
      if (request !== generation.current) return;
      setError({ message: e instanceof ApiError && e.status === 403 ? 'Недостаточно прав для просмотра игровых серверов.' : e instanceof Error ? e.message : 'Не удалось получить состояние серверов', status: e instanceof ApiError ? e.status : null });
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    const unsubscribe = realtime.subscribe('admin:runtime', (message) => {
      if (message.type === 'runtime.snapshot') {
        generation.current++;
        setBusy(false);
        setData((previous) => (!previous || Date.parse((message.payload as Snapshot).checkedAt) >= Date.parse(previous.checkedAt) ? (message.payload as Snapshot) : previous));
        setError(null);
      }
    });
    return () => { generation.current++; unsubscribe(); };
  }, []);

  const slot = slotId && data ? data.slots.find((s) => s.serverId === slotId) ?? null : null;
  usePageChrome(slotId
    ? { back: { label: 'К серверам', to: '/runtime' }, crumbs: [{ label: 'Игровые серверы', to: '/runtime' }, { label: slotId }] }
    : eventId ? { back: { label: 'К событию', to: `/events/${encodeURIComponent(eventId)}?section=execution&view=servers` }, crumbs: [{ label: 'Событие', to: `/events/${encodeURIComponent(eventId)}` }, { label: 'Игровые серверы' }] }
    : { crumbs: [{ label: 'Игровые серверы' }] });

  const status = (
    <>
      {data && error && <ErrorState error={error.message} status={error.status} onRetry={() => void load()} compact />}
      {!connected && <Notice tone="neutral">Подключаем обновление состояния… Пока данные обновляются кнопкой «Обновить».</Notice>}
      {data?.stale && <Notice tone="warning">Связь уточняется. Отсутствие ответа не означает остановку гонки; занятые серверы сохраняются за текущими заездами.</Notice>}
    </>
  );
  const refresh = <Button disabled={busy} onClick={() => void load()}>↻ Обновить</Button>;
  if (slotId) {
    return (
      <div className="lsr-runtime">
        <PageHeader overline="Игровой сервер" title={slot ? slot.serverId : slotId} description={slot?.serverCode && slot.serverCode !== slot.serverId ? `Код демона: ${slot.serverCode}` : undefined} actions={refresh} />
        <div className="lsr-stack">
          {status}
          {!data ? (error ? <ErrorState error={error.message} status={error.status} onRetry={() => void load()} /> : <Panel><LoadingBlock /></Panel>)
            : !slot ? <EmptyState title="Сервер не найден в снимке" action={<Button to="/runtime">К серверам</Button>}>Слот {slotId} отсутствует в последнем снимке демона.</EmptyState>
            : <SlotDetail data={data} slot={slot} />}
        </div>
      </div>
    );
  }
  return (
    <div className="lsr-runtime">
      <PageHeader overline="Администрирование" title="Игровые серверы" description="Состояние демона, слотов, сессий и будущей нагрузки" actions={refresh}>
        {data && <Freshness data={data} />}
      </PageHeader>
      {!data ? (
        <div className="lsr-stack">{error ? <ErrorState error={error.message} status={error.status} onRetry={() => void load()} /> : <Panel><LoadingBlock label="Загружаем состояние" /></Panel>}{!connected && <Notice tone="neutral">Подключаем обновление состояния…</Notice>}</div>
      ) : (
        <>
          <OverviewKpis data={data} />
          <TabsBar tab={tab} data={data} onChange={(next) => setParam('tab', next === 'slots' ? null : next)} />
          <div className="lsr-stack">
            {status}
            {tab === 'slots' && <SlotsPanel data={data} onOpen={(s) => navigate(`/runtime?slot=${encodeURIComponent(s.serverId)}`)} />}
            {tab === 'sessions' && <SessionsPanel data={data} selected={sessionId} />}
            {tab === 'queue' && <QueuePanel data={data} />}
            {tab === 'reserve' && <ReservePanel data={data} />}
            {tab === 'health' && <DaemonPanel data={data} />}
          </div>
        </>
      )}
    </div>
  );
}

function Freshness({ data }: { data: Snapshot }) {
  return (
    <div className="lsr-runtime-fresh">
      <StatusBadge variant="badge" status={{ code: data.status, label: data.stale ? 'Сведения устарели' : 'Связь установлена' }} tone={data.stale ? 'current' : 'done'} />
      <span>Демон {data.daemonId} · снимок {data.receivedAt ? shortDateTime(data.receivedAt) : 'не получен'} · проверено {shortDateTime(data.checkedAt)}</span>
    </div>
  );
}

function TabsBar({ tab, data, onChange }: { tab: Tab; data: Snapshot; onChange(tab: Tab): void }) {
  const current = data.sessions.filter((s) => !FINISHED.includes(s.status)).length;
  return (
    <Tabs<Tab> variant="module" label="Разделы игровых серверов" value={tab} onChange={onChange} items={[
      { key: 'slots', label: 'Слоты' }, { key: 'sessions', label: 'Сессии', count: current || null }, { key: 'queue', label: 'Очередь запуска', count: data.queue.length || null },
      { key: 'reserve', label: 'Будущая нагрузка' }, { key: 'health', label: 'Демон' },
    ]} />
  );
}

function OverviewKpis({ data }: { data: Snapshot }) {
  const check = data.slots.filter((s) => needsCheck(data, s)).length;
  return (
    <Kpis items={[
      { label: 'Всего слотов', value: data.slots.length },
      { label: 'Занято', value: data.slots.filter((s) => s.state === 'ALLOCATED').length, foot: `В очереди ${data.queue.length}` },
      { label: 'Свободно', value: data.slots.filter((s) => s.state === 'AVAILABLE').length },
      { label: 'Нужна проверка', value: check, foot: check ? 'Нет подтверждения процесса или связи' : 'Расхождений нет', problem: check > 0 },
    ]} />
  );
}

type SlotFilter = 'all' | 'busy' | 'free' | 'check';
function SlotsPanel({ data, onOpen }: { data: Snapshot; onOpen(slot: Slot): void }) {
  const [filter, setFilter] = useState<SlotFilter>('all');
  const [query, setQuery] = useState('');
  const reservations = data.reservations ?? [];
  const future = reservations.filter((r) => Date.parse(r.estimatedEndsAt) > Date.parse(data.checkedAt));
  const rows = useMemo(() => data.slots.filter((slot) => {
    const session = activeSession(data, slot);
    if (filter === 'busy' && slot.state !== 'ALLOCATED') return false;
    if (filter === 'free' && slot.state !== 'AVAILABLE') return false;
    if (filter === 'check' && !needsCheck(data, slot)) return false;
    const text = query.trim().toLowerCase();
    return !text || [slot.serverId, slot.serverCode, session?.id, session && sessionTitle(session)].some((v) => v && String(v).toLowerCase().includes(text));
  }), [data, filter, query]);
  return (
    <Panel title="Серверы сейчас" sub={`Занято ${data.slots.filter((s) => s.state === 'ALLOCATED').length} из ${data.slots.length} · В очереди ${data.queue.length} · Пиковый резерв по расписанию ${plannedPeak(future, data.checkedAt)} из ${data.slots.length}`} body={false}>
      <Toolbar>
        <SearchInput wide value={query} onChange={setQuery} placeholder="Сервер или сессия" label="Поиск сервера" />
        <PillButtons label="Состояние слотов" value={filter} onChange={setFilter}
          options={[{ value: 'all', label: 'Все' }, { value: 'busy', label: 'Заняты' }, { value: 'free', label: 'Свободны' }, { value: 'check', label: 'Нужна проверка' }]} />
      </Toolbar>
      {!data.slots.length ? <EmptyState compact>Серверы не настроены.</EmptyState> : !rows.length ? <EmptyState compact>Нет серверов по этому фильтру.</EmptyState> : (
        <Table variant="module" label="Серверы сейчас">
          <thead><tr><th>Слот</th><th>Состояние</th><th>Назначение</th><th className="lsr-hide-sm">Игроки</th><th className="lsr-hide-md">Старт</th><th className="lsr-hide-md">Окончание (план)</th><th>Процесс</th></tr></thead>
          <tbody>
            {rows.map((slot) => {
              const session = activeSession(data, slot), process = processFor(data, slot);
              return (
                <tr key={slot.serverId} {...clickableRow(() => onOpen(slot), needsCheck(data, slot) ? 'is-alert' : '')} aria-label={`Открыть ${slot.serverId}`}>
                  <td><b className="lsr-runtime-main">{slot.serverId}</b>{slot.serverCode && slot.serverCode !== slot.serverId && <div className="lsr-minor">{slot.serverCode}</div>}</td>
                  <td><StatusBadge variant="badge" status={{ code: slot.state, label: slotLabel(slot.state) }} tone={recordTone(slot.state, slotTones)} />{slot.state === 'COOLDOWN' && slot.availableAt && <div className="lsr-minor">Доступен {shortDateTime(slot.availableAt)}</div>}</td>
                  <td>{session ? <><div>{sessionTitle(session)} №{session.id}</div><div className="lsr-minor">{sessionStatus(session)}</div></> : <span className="lsr-sub">Нет назначенной сессии</span>}</td>
                  <td className="lsr-hide-sm lsr-num">{session?.connectedPlayers ?? '—'}</td>
                  <td className="lsr-hide-md lsr-num">{session ? (session.startedAt ? shortDateTime(session.startedAt) : 'Ожидает запуска') : '—'}</td>
                  <td className="lsr-hide-md lsr-num">{session ? (session.estimatedEndsAt ? shortDateTime(session.estimatedEndsAt) : 'Не задано') : '—'}</td>
                  <td>{process ? <>{processText(process)}{data.stale && <div className="lsr-minor lsr-runtime-warn">Последние полученные данные</div>}</> : <span className="lsr-sub">Нет телеметрии {slot.serverCode ?? slot.serverId}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

function SessionsPanel({ data, selected }: { data: Snapshot; selected: string | null }) {
  const history = data.sessions.filter((s) => FINISHED.includes(s.status)).sort((a, b) => Date.parse(b.stoppedAt ?? '') - Date.parse(a.stoppedAt ?? ''));
  const current = data.sessions.filter((s) => !FINISHED.includes(s.status));
  const [group, setGroup] = useState<'current' | 'history'>(selected && history.some((s) => s.id === selected) ? 'history' : 'current');
  const list = group === 'current' ? current : history;
  return (
    <Panel title={group === 'current' ? 'Текущие игровые сессии' : 'История запусков'} sub="Сессия — фактический запуск; занятый слот и процесс показаны во вкладке «Слоты»" body={false}
      actions={<PillButtons label="Группа сессий" value={group} onChange={setGroup} options={[{ value: 'current', label: `Текущие · ${current.length}` }, { value: 'history', label: `История · ${history.length}` }]} />}>
      {!list.length ? <EmptyState compact>{group === 'current' ? 'Активных сессий нет.' : 'Завершённых запусков в снимке нет.'}</EmptyState> : (
        <Table variant="module" label="Сессии">
          <thead><tr><th>Сессия</th><th>Слот</th><th className="lsr-hide-sm">Игроки</th><th className="lsr-hide-md">Начало</th><th className="lsr-hide-md">{group === 'current' ? 'Ожидаемое завершение' : 'Остановка'}</th><th>Статус</th><th className="lsr-hide-md">Подробности</th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className={[s.id === selected && 'is-selected', s.connectionLostAt && 'is-alert'].filter(Boolean).join(' ')} aria-current={s.id === selected ? 'true' : undefined}>
                <td><b className="lsr-runtime-main">{sessionTitle(s)} №{s.id}</b>{s.reservationId && <div className="lsr-minor">Резерв №{s.reservationId}</div>}</td>
                <td>{s.serverId ? <TextLink size="sm" to={`/runtime?slot=${encodeURIComponent(s.serverId)}`}>{s.serverId}</TextLink> : <span className="lsr-sub">Ожидает назначения</span>}</td>
                <td className="lsr-hide-sm lsr-num">{s.connectedPlayers ?? '—'}</td>
                <td className="lsr-hide-md lsr-num">{shortDateTime(s.startedAt)}</td>
                <td className="lsr-hide-md lsr-num">{shortDateTime(group === 'current' ? s.estimatedEndsAt : s.stoppedAt)}</td>
                <td><SessionBadge session={s} /></td>
                <td className="lsr-hide-md lsr-sub">{s.displayStatus?.reason?.message ?? s.failure?.code ?? (s.connectionLostAt ? `Связь потеряна ${shortDateTime(s.connectionLostAt)}` : '—')}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

function QueuePanel({ data }: { data: Snapshot }) {
  return (
    <Panel title="Ожидают распределения" sub="Запуски, которым ещё не назначен сервер" body={false}>
      {!data.queue.length ? <EmptyState compact>Ожидающих запусков нет.</EmptyState> : (
        <Table variant="module" label="Очередь запуска">
          <thead><tr><th>Сессия</th><th>В очереди с</th><th>Плановый старт</th><th>Основание</th></tr></thead>
          <tbody>{data.queue.map((x) => (
            <tr key={x.runtimeSessionId}>
              <td><b className="lsr-runtime-main">№{x.runtimeSessionId}</b></td>
              <td className="lsr-num">{shortDateTime(x.requestedAt)}</td>
              <td className="lsr-num">{x.plannedStartsAt ? shortDateTime(x.plannedStartsAt) : 'При освобождении сервера'}</td>
              <td>{x.reservationId ? `По резерву №${x.reservationId}` : 'Без резерва'}</td>
            </tr>
          ))}</tbody>
        </Table>
      )}
    </Panel>
  );
}

function ReservePanel({ data }: { data: Snapshot }) {
  const [limit, setLimit] = useState(20);
  const future = (data.reservations ?? []).filter((r) => Date.parse(r.estimatedEndsAt) > Date.parse(data.checkedAt));
  return (
    <Panel title="Будущие резервы" sub={`Пиковый резерв по расписанию: ${plannedPeak(future, data.checkedAt)} из ${data.slots.length} слотов`} body={false}>
      <p className="lsr-runtime-lede">Плановые резервы мощности, а не заранее назначенные физические серверы. Конкретный сервер назначается при запуске. Динамические запуски без резерва сюда не входят.</p>
      {!future.length ? <EmptyState compact>Будущих резервов нет.</EmptyState> : (
        <>
          <Table variant="module" label="Будущие резервы">
            <thead><tr><th>Время</th><th>Владелец</th><th>Слотов</th><th>Статус</th></tr></thead>
            <tbody>{future.slice(0, limit).map((r) => {
              const label = `${ownerLabels[r.owner.type] ?? 'Резерв'} №${r.owner.id}`, link = ownerLink[r.owner.type]?.(r.owner.id);
              const open = Date.parse(r.startsAt) <= Date.parse(data.checkedAt);
              return (
                <tr key={r.id}>
                  <td className="lsr-num">{shortDateTime(r.startsAt)} — {shortDateTime(r.estimatedEndsAt)}<div className="lsr-minor">окончание — плановое</div></td>
                  <td>{link ? <TextLink size="sm" to={link}>{label}</TextLink> : label}<div className="lsr-minor">Резерв №{r.id}</div></td>
                  <td className="lsr-num">{r.serverCount}</td>
                  <td><StatusBadge variant="badge" status={{ code: r.status, label: open && r.status === 'SCHEDULED' ? 'Окно резерва открыто' : reservationLabels[r.status] ?? r.status }} tone={open ? 'live' : recordTone(r.status, reservationTones)} /></td>
                </tr>
              );
            })}</tbody>
          </Table>
          {future.length > limit && <div className="lsr-tablefoot"><span>Показано {limit} из {future.length}</span><Button size="sm" onClick={() => setLimit((v) => v + 20)}>Ещё резервы</Button></div>}
        </>
      )}
    </Panel>
  );
}

function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="lsr-runtime-fact"><div>{label}</div><b>{children ?? '—'}</b></div>;
}
const pluginLabels: Record<string, string> = { CURRENT: 'Актуален', FAILED: 'Ошибка', UNKNOWN: 'Нет данных', NOT_CONFIGURED: 'Не настроен' };

function DaemonPanel({ data }: { data: Snapshot }) {
  const m = data.metrics;
  const running = data.slots.filter((slot) => processFor(data, slot)?.status === 'running').length;
  const total = m?.system.memoryTotalBytes;
  const used = total === undefined || !m ? undefined : total - m.system.memoryFreeBytes;
  return (
    <>
      <Kpis items={[
        { label: 'Демон', value: data.daemonId, foot: m?.process.pid ? `PID ${m.process.pid}` : 'Ожидается подключение' },
        { label: 'CPU процесса', value: percent(m?.process.cpuPercent), foot: m?.system.cpuCount ? `${m.system.cpuCount} ядер на машине` : undefined },
        { label: 'RAM процесса', value: bytes(m?.process.memoryRssBytes), foot: m?.process.memoryHeapUsedBytes !== undefined ? `Heap ${bytes(m.process.memoryHeapUsedBytes)}` : undefined },
        { label: 'Uptime', value: uptime(m?.uptimeSeconds) },
      ]} />
      <Panel title="Наблюдаемая система" sub={m ? undefined : 'Демон ещё не прислал метрики'}>
        <div className="lsr-runtime-facts">
          <Fact label="Платформа">{m ? [m.system.platform, m.system.arch].filter(Boolean).join(' / ') || '—' : '—'}</Fact>
          <Fact label="Состояние"><StatusBadge variant="badge" status={{ code: data.status, label: data.stale ? 'Сведения устарели' : 'Связь установлена' }} tone={data.stale ? 'current' : 'done'} /></Fact>
          <Fact label="Снимок телеметрии">{data.receivedAt ? shortDateTime(data.receivedAt) : 'Нет снимка'}</Fact>
          <Fact label="Проверено">{shortDateTime(data.checkedAt)}</Fact>
          <Fact label="Запущено процессов">{m ? `${running} из ${data.slots.length}` : '—'}</Fact>
          <Fact label="Плагин">{pluginLabels[m?.plugin?.status ?? 'UNKNOWN'] ?? 'Нет данных'}</Fact>
          <Fact label="CPU машины">{percent(m?.system.cpuPercent)}{m?.system.loadAverage?.[0] !== undefined ? ` · load ${m.system.loadAverage[0].toFixed(2)}` : ''}</Fact>
          <Fact label="RAM машины">{used === undefined ? '—' : `${bytes(used)} / ${bytes(total)}`}<span className="lsr-runtime-dim"> · свободно {bytes(m?.system.memoryFreeBytes)}</span></Fact>
        </div>
      </Panel>
    </>
  );
}

function SlotDetail({ data, slot }: { data: Snapshot; slot: Slot }) {
  const session = activeSession(data, slot), process = processFor(data, slot);
  const recent = data.sessions.filter((s) => s.serverId === slot.serverId && s.id !== session?.id);
  return (
    <>
      <Kpis items={[
        { label: 'Состояние слота', value: slotLabel(slot.state), foot: slot.state === 'COOLDOWN' && slot.availableAt ? `Доступен ${shortDateTime(slot.availableAt)}` : undefined },
        { label: 'Сервер', value: slot.serverCode ?? slot.serverId },
        { label: 'Процесс', value: process ? (process.status === 'running' ? 'Запущен' : process.status === 'idle' ? 'Не запущен' : 'Не подтверждён') : 'Нет данных', foot: process?.pid != null ? `PID ${process.pid}` : undefined, problem: slot.state === 'ALLOCATED' && process?.status !== 'running' },
        { label: 'Игроки', value: session?.connectedPlayers ?? '—' },
      ]} />
      <div className="lsr-cols-module">
        <Panel title="Текущая работа">
          {session ? (
            <div className="lsr-runtime-facts">
              <Fact label="Назначение">{sessionTitle(session)} №{session.id}</Fact>
              <Fact label="Статус"><SessionBadge session={session} /></Fact>
              <Fact label="Начало">{session.startedAt ? shortDateTime(session.startedAt) : 'Ожидает запуска'}</Fact>
              <Fact label="Плановое завершение">{session.estimatedEndsAt ? shortDateTime(session.estimatedEndsAt) : 'Не задано'}</Fact>
              <Fact label="Запуск (run)">{session.runtimeRunId ?? '—'}</Fact>
              <Fact label="Резерв">{session.reservationId ? `№${session.reservationId}` : 'Без резерва'}</Fact>
            </div>
          ) : <div className="lsr-mutedline">Сессия на этот слот не назначена.</div>}
          {session?.connectionLostAt && <Notice tone="warning">Связь потеряна {shortDateTime(session.connectionLostAt)}. Состояние уточняется — это не означает остановку.</Notice>}
          {slot.state === 'ALLOCATED' && process?.status !== 'running' && <Notice tone="warning">Слот занят, но демон не подтверждает работающий процесс. Занятость слота не доказывает, что процесс запущен.</Notice>}
          <div className="lsr-runtime-divider" />
          <Notice tone="neutral">Команды рестарта, снятия резерва и освобождения слота в API не предоставляются; управление идёт через владельца запуска (событие, сервер практики, матчмейкинг).</Notice>
          {!!recent.length && (
            <>
              <div className="lsr-runtime-divider" />
              <h3 className="lsr-runtime-h3">Другие сессии слота в снимке</h3>
              <Table variant="module" label="Другие сессии">
                <thead><tr><th>Сессия</th><th>Начало</th><th>Остановка</th><th>Статус</th></tr></thead>
                <tbody>{recent.map((s) => <tr key={s.id}><td>{sessionTitle(s)} №{s.id}</td><td className="lsr-num">{shortDateTime(s.startedAt)}</td><td className="lsr-num">{shortDateTime(s.stoppedAt)}</td><td><SessionBadge session={s} /></td></tr>)}</tbody>
              </Table>
            </>
          )}
        </Panel>
        <Panel title="Телеметрия и диагностика" body={false}>
          <div className="lsr-runtime-rows">
            <div className="lsr-row-item"><b>Демон</b><StatusBadge variant="badge" status={{ code: data.status, label: data.stale ? 'Сведения устарели' : 'На связи' }} tone={data.stale ? 'current' : 'done'} /></div>
            <div className="lsr-row-item"><b>Процесс</b><span>{processText(process) ?? `Нет телеметрии ${slot.serverCode ?? slot.serverId}`}</span></div>
            <div className="lsr-row-item"><b>Run процесса</b><span>{process?.runtimeRunId ?? '—'}</span></div>
            <div className="lsr-row-item"><b>Хост (демон)</b><span>{data.daemonId}</span></div>
            <div className="lsr-row-item"><b>Снимок</b><span>{data.receivedAt ? shortDateTime(data.receivedAt) : 'Нет снимка'}</span></div>
          </div>
          <div className="lsr-runtime-pad"><Notice tone="warning">CPU и память отдельного игрового сервера, а также живой журнал процесса в API не передаются.</Notice></div>
        </Panel>
      </div>
    </>
  );
}
