import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ApiError, apiFetch } from '../../shared/api';
import { useRealtimeRefresh, useRealtimeStatus } from '../../shared/realtime';
import { hasAny } from '../../shared/format';
import type { AdminAccess } from '../../shared/types';
import type { AuditItem } from '../../shared/access-types';
import type { EventSummary } from '../events/current/event-api';
import type { Snapshot } from '../runtime/runtime-monitoring';
import type { Report } from '../officiating/officiating-model';
import type { Live, Queue } from '../matchmaking/matchmaking-model';
import { EmptyState, Kpis, LoadingBlock, Notice, PageHeader, Panel, TextLink, dateTime, shortDateTime, usePageChrome } from '../../ui/v16';

type Block<T> = { state: 'idle' | 'loading' | 'ready' | 'error' | 'forbidden'; data: T | null; error?: string };
const idle = { state: 'idle', data: null } as const;
/** Each dashboard block reads its own existing projection; a failure or a 403 stays inside that block. */
function useBlock<T>(enabled: boolean, read: () => Promise<T>, domains: string[]) {
  const [block, setBlock] = useState<Block<T>>(idle);
  const load = useCallback(async () => {
    if (!enabled) return;
    setBlock((old) => ({ ...old, state: old.data ? old.state : 'loading' }));
    try { setBlock({ state: 'ready', data: await read() }); }
    catch (e) { setBlock({ state: e instanceof ApiError && e.status === 403 ? 'forbidden' : 'error', data: null, error: e instanceof Error ? e.message : String(e) }); }
  }, [enabled]);
  useEffect(() => { void load(); }, [load]);
  useRealtimeRefresh(domains, () => load(), enabled);
  return block;
}

const FINAL = new Set(['STOPPED', 'CANCELLED', 'FAILED']);
const OPEN_PROTESTS = ['submitted', 'under_review', 'needs_info'];

export function DashboardPage({ access }: { access: AdminAccess }) {
  usePageChrome({ crumbs: [{ label: 'Админка' }, { label: 'Обзор платформы' }] });
  const connected = useRealtimeStatus();
  const can = {
    events: hasAny(access, ['events.read.all', 'events.read.scoped', 'events.read.own']),
    runtime: hasAny(access, ['events.override.all', 'monitoring.read']),
    reports: hasAny(access, ['reports.read.all', 'reports.audit.all', 'reports.decide.all']),
    matchmaking: hasAny(access, ['matchmaking.read.all', 'matchmaking.manage.all']),
    audit: hasAny(access, ['audit.read.all']),
    access: hasAny(access, ['access.manage.all', 'organizers.write.all', 'organizers.read.scoped']),
  };
  const events = useBlock(can.events, async () => {
    const [running, failed] = await Promise.all([
      apiFetch<{ items: EventSummary[]; nextAfterId: string | null }>('/admin/events?view=list&limit=20&status=RUNNING'),
      apiFetch<{ items: EventSummary[]; nextAfterId: string | null }>('/admin/events?view=list&limit=20&status=FAILED'),
    ]);
    return { running, failed };
  }, ['events']);
  const runtime = useBlock(can.runtime, () => apiFetch<Snapshot>('/admin/runtime/ac/daemon'), ['runtime']);
  const reports = useBlock(can.reports, async () => {
    const pages = await Promise.all(OPEN_PROTESTS.map((status) => apiFetch<{ items: Report[]; nextAfterId: string | null }>(`/admin/officiating/protests?limit=30&status=${status}`)));
    return OPEN_PROTESTS.map((status, i) => ({ status, ...pages[i] }));
  }, ['reports']);
  const matchmaking = useBlock(can.matchmaking, async () => {
    const list = await apiFetch<{ items: Queue[] }>('/admin/matchmaking');
    const queue = list.items.find((q) => q.enabled) ?? list.items[0] ?? null;
    const live = queue ? await apiFetch<Live>(`/admin/matchmaking/${queue.id}/live`) : null;
    return { queue, live };
  }, ['matchmaking']);
  const audit = useBlock(can.audit, () => apiFetch<{ items: AuditItem[]; nextCursor: string | null }>('/admin/audit?limit=4'), ['audit']);

  const plus = (n: number, more: boolean) => (more ? `${n}+` : String(n));
  const value = (block: Block<unknown>, render: () => ReactNode) => (block.state === 'ready' ? render() : block.state === 'loading' || block.state === 'idle' ? '…' : block.state === 'forbidden' ? 'Нет прав' : 'Ошибка');
  const snap = runtime.data;
  const busy = snap ? snap.slots.filter((s) => s.currentRuntimeSessionId || s.state === 'ALLOCATED' || s.state === 'BUSY').length : 0;
  const lost = snap ? snap.sessions.filter((s) => !FINAL.has(s.status) && (s.connectionLostAt || s.failure)) : [];
  const openReports = reports.data?.flatMap((p) => p.items) ?? [];
  const needsInfo = reports.data?.find((p) => p.status === 'needs_info')?.items.length ?? 0;
  const kpis = [
    ...(can.events ? [{ label: 'События сейчас', value: value(events, () => plus(events.data!.running.items.length, !!events.data!.running.nextAfterId)), foot: 'Серверный статус «идёт»', problem: false }] : []),
    ...(can.runtime ? [{ label: 'Занято игровых серверов', value: value(runtime, () => `${busy} / ${snap!.slots.length}`), foot: snap ? (lost.length ? `${lost.length} без связи или со сбоем` : snap.stale ? 'Снимок устарел' : 'Снимок актуален') : undefined, problem: !!lost.length || !!snap?.stale }] : []),
    ...(can.reports ? [{ label: 'Протесты в работе', value: value(reports, () => plus(openReports.length, !!reports.data?.some((p) => p.nextAfterId))), foot: needsInfo ? `${needsInfo} ожидают информации` : undefined, problem: false }] : []),
    ...(can.matchmaking ? [{ label: 'Игроки в очереди', value: value(matchmaking, () => (matchmaking.data?.live ? matchmaking.data.live.queue.length : '—')), foot: matchmaking.data?.queue ? (matchmaking.data.queue.enabled ? 'Матчмейкинг включён' : 'Матчмейкинг выключен') : matchmaking.state === 'ready' ? 'Очередь не настроена' : undefined, problem: false }] : []),
  ];
  const attention: { title: string; detail: string; to: string }[] = [
    ...(snap?.stale ? [{ title: 'Снимок игрового демона устарел', detail: `Проверено ${shortDateTime(snap.checkedAt)} · данные могут не отражать текущее состояние`, to: '/runtime?tab=daemon' }] : []),
    ...lost.map((s) => ({ title: `Сессия №${s.id}: ${s.failure ? 'сбой сервера' : 'нет связи'}`, detail: `${s.serverId ?? 'сервер не назначен'}${s.connectionLostAt ? ` · связь потеряна ${shortDateTime(s.connectionLostAt)}` : ''}`, to: `/runtime?sessionId=${s.id}` })),
    ...(events.data?.failed.items ?? []).map((e) => ({ title: `${e.title}: ${e.displayStatus.label}`, detail: e.displayStatus.reason?.message ?? 'Событие завершилось ошибкой', to: `/events/${e.id}` })),
    ...openReports.filter((r) => r.status === 'submitted').slice(0, 3).map((r) => ({ title: `Протест №${r.id} ожидает рассмотрения`, detail: r.incidentLocation || r.reason, to: "/officiating" })),
  ];
  const quick = [
    can.runtime && { title: 'Игровые серверы', detail: 'Слоты, сессии и резервы', to: '/runtime' },
    can.matchmaking && { title: 'Матчмейкинг', detail: 'Очередь, текущие матчи и конфигурация', to: '/matchmaking' },
    can.access && { title: 'Организаторы и доступы', detail: 'Роли, области и ограничения', to: '/access' },
    can.events && { title: 'События', detail: 'Список всех типов и создание', to: '/events' },
  ].filter(Boolean) as { title: string; detail: string; to: string }[];

  return (
    <>
      <PageHeader overline="Администрирование" title="Обзор платформы" description="Текущее состояние, отклонения и быстрые переходы" />
      {kpis.length > 0 && <Kpis items={kpis} />}
      <div className="lsr-cols-equal" style={{ marginBottom: 16 }}>
        <Panel title="Требует внимания" body={false}>
          {[events, runtime, reports].some((b) => b.state === 'loading') && !attention.length ? <div className="lsr-panel-body"><LoadingBlock rows={3} /></div>
            : attention.length ? (
              <div className="lsr-rows">{attention.slice(0, 6).map((a, i) => <div className="lsr-row-item" key={i}><div style={{ minWidth: 0 }}><b>{a.title}</b><small>{a.detail}</small></div><TextLink to={a.to} size="sm">Открыть →</TextLink></div>)}</div>
            ) : <EmptyState compact>Отклонений по доступным разделам нет.</EmptyState>}
        </Panel>
        <Panel title="Оперативная работа" body={false}>
          <div className="lsr-rows">{quick.map((q) => <div className="lsr-row-item" key={q.to}><div><b>{q.title}</b><small>{q.detail}</small></div><TextLink to={q.to} size="sm">Перейти →</TextLink></div>)}</div>
        </Panel>
      </div>
      <div className="lsr-cols-2">
        {can.audit ? (
          <Panel title="Активность за последнее время" body={false} actions={<TextLink to="/audit" size="sm">Журнал действий →</TextLink>}>
            {audit.state === 'ready' ? (audit.data!.items.length ? (
              <div className="lsr-rows">{audit.data!.items.map((a) => <div className="lsr-row-item" key={a.id}><div><b>{a.action}</b><small>{dateTime(a.at)} · {a.target.type} {a.target.id}{a.reason ? ` · ${a.reason}` : ''}</small></div><TextLink to={a.eventId ? `/events/${a.eventId}?section=journal&source=audit` : '/audit'} size="sm">Открыть →</TextLink></div>)}</div>
            ) : <EmptyState compact>Действий пока нет.</EmptyState>)
              : audit.state === 'forbidden' ? <EmptyState compact title="Недостаточно прав">Журнал действий недоступен.</EmptyState>
              : audit.state === 'error' ? <div className="lsr-panel-body"><Notice tone="danger">{audit.error}</Notice></div>
              : <div className="lsr-panel-body"><LoadingBlock rows={4} /></div>}
          </Panel>
        ) : <Panel title="Активность"><div className="lsr-mutedline">Журнал действий доступен только с правом аудита.</div></Panel>}
        <Panel title="Система и данные">
          <div className="lsr-stack is-tight">
            <div className="lsr-row-item" style={{ padding: '0 0 10px' }}><div><b>Обновления в реальном времени</b><small>{connected ? 'Подключены: экраны перечитывают данные по изменениям' : 'Нет связи: данные обновятся после переподключения'}</small></div><span className={`lsr-badge ${connected ? 'is-done' : 'is-current'}`}>{connected ? 'На связи' : 'Нет связи'}</span></div>
            {can.runtime && <div className="lsr-row-item" style={{ padding: '10px 0' }}><div><b>Игровой демон</b><small>{snap ? `${snap.daemonId} · проверено ${shortDateTime(snap.checkedAt)}` : runtime.state === 'error' ? runtime.error : runtime.state === 'forbidden' ? 'Недостаточно прав' : 'Загрузка…'}</small></div>{snap && <span className={`lsr-badge ${snap.stale ? 'is-current' : 'is-done'}`}>{snap.stale ? 'Устарел' : 'Актуален'}</span>}</div>}
            {[events, runtime, reports, matchmaking].some((b) => b.state === 'error') && <Notice tone="warning">Часть блоков не загрузилась; числа в них не показываются.</Notice>}
          </div>
        </Panel>
      </div>
    </>
  );
}
