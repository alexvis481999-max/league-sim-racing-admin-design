import type { ReactNode } from 'react';
import { Button, Dialog, EmptyState, ErrorState, LoadingBlock, Meta, MetaGrid, Notice, Panel, StatusBadge, Table, TableFoot, TextLink, clock, dateTime, shortDateTime } from '../../ui/v16';
import { carTitle, organizerName, trackTitle, type PracticeCatalog } from './practice-catalog';
import {
  autostartLabel, cycleStateLabel, cycleTone, disciplineLabel, gameLabel, isPowered, practiceServerStatus, practiceTone,
  type Cycle, type PracticeAction, type Server,
} from './practice-types';

export const PAGE_SIZE = 20;
const unavailable = 'Команда недоступна: сервер не разрешает её в текущем состоянии или у вас нет прав.';

export function ServerStatus({ server }: { server: Server }) {
  const status = practiceServerStatus(server);
  return <StatusBadge variant="badge" status={{ code: server.status, label: status.label }} tone={practiceTone(server)} />;
}

/** Start/stop of the whole service. Stop asks for confirmation in the page (`onCommand('stop')` opens the dialog). */
export function PowerButton({ server, locked, onCommand, size }: { server: Server; locked: boolean; onCommand(action: PracticeAction): void; size?: 'sm' }) {
  const stopping = server.currentCycle?.resourceState === 'STOPPING';
  const on = isPowered(server);
  const action = on ? 'stop' : 'start';
  const allowed = !!server.allowedActions[action];
  return (
    <Button size={size} variant={on ? 'danger' : 'soft'} aria-label={on ? 'Остановить сервер' : 'Запустить сервер'} title={!allowed ? unavailable : undefined}
      disabled={locked || stopping || !allowed} onClick={() => onCommand(action)}>
      {stopping ? 'Останавливается…' : on ? '⏹ Остановить' : '▶ Запустить'}
    </Button>
  );
}

function currentCycleText(server: Server) {
  const cycle = server.currentCycle;
  if (!cycle) return server.status === 'ACTIVE' ? 'Ожидание запуска' : 'Нет активной сессии';
  if (!cycle.startedAt) return 'Запускается';
  return `${clock(cycle.startedAt, server.config.timezone)}–${plannedEnd(server, cycle)}`;
}
/** Planned end for display only: start + configured cycle duration. */
function plannedEnd(server: Server, cycle: Cycle) {
  if (!cycle.startedAt) return '—';
  return clock(new Date(Date.parse(cycle.startedAt) + server.config.sessionDurationMinutes * 60_000).toISOString(), server.config.timezone);
}

export function PracticeTable({ items, catalog, organizers, locked, onOpen, onCommand }: {
  items: Server[]; catalog: PracticeCatalog | null; organizers: Record<string, string>; locked: boolean; onOpen(server: Server): void; onCommand(server: Server, action: PracticeAction): void;
}) {
  return (
    <Table variant="module" label="Серверы практики">
      <thead><tr><th>Сервер</th><th>Состояние</th><th className="lsr-hide-sm">Трасса / конфигурация</th><th className="lsr-hide-md">Мест</th><th>Текущий цикл</th><th className="lsr-hide-md">Организатор</th><th aria-label="Действие" /></tr></thead>
      <tbody>
        {items.map((server) => (
          <tr key={server.id} className="is-clickable" tabIndex={-1} onClick={(event) => { if (!(event.target as HTMLElement).closest('button,a')) onOpen(server); }}>
            <td>
              <a className="lsr-practice-rowlink" href={`/practice-servers/${server.id}`} aria-label={`Открыть ${server.config.title}`} onClick={(event) => { event.preventDefault(); onOpen(server); }}>{server.config.title}</a>
              <div className="lsr-minor">№{server.id} · {disciplineLabel(server.config.disciplineCode)}</div>
            </td>
            <td><ServerStatus server={server} /></td>
            <td className="lsr-hide-sm">{trackTitle(catalog, server.config.game.track.code, server.config.game.track.layoutCode)}</td>
            <td className="lsr-hide-md lsr-num">{server.config.practice.maxParticipants}</td>
            <td className="lsr-num">{currentCycleText(server)}{server.currentCycle?.runtimeSessionId && <div className="lsr-minor">Сессия №{server.currentCycle.runtimeSessionId}</div>}</td>
            <td className="lsr-hide-md">{organizerName(organizers, server.config.organizerId)}</td>
            <td className="lsr-right"><PowerButton size="sm" server={server} locked={locked} onCommand={(action) => onCommand(server, action)} /></td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Pager({ page, total, onPage, busy }: { page: number; total: number; onPage(page: number): void; busy?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  const from = (page - 1) * PAGE_SIZE + 1, to = Math.min(total, page * PAGE_SIZE);
  return (
    <TableFoot>
      <span>{from}–{to} из {total}</span>
      <div className="lsr-pagination">
        <Button size="sm" disabled={busy || page <= 1} onClick={() => onPage(page - 1)} aria-label="Предыдущая страница">← Назад</Button>
        <span>Страница {page} из {pages}</span>
        <Button size="sm" disabled={busy || page >= pages} onClick={() => onPage(page + 1)} aria-label="Следующая страница">Вперёд →</Button>
      </div>
    </TableFoot>
  );
}


export function ServerLive({ server, catalog, locked, onCommand }: { server: Server; catalog: PracticeCatalog | null; locked: boolean; onCommand(action: PracticeAction): void }) {
  const cycle = server.currentCycle, c = server.config, tz = c.timezone;
  const weather = c.game.environment?.weather;
  const primary: PracticeAction = server.status === 'ACTIVE' ? 'pause' : 'start';
  const command = (action: PracticeAction, label: ReactNode, variant?: 'danger-solid' | 'default', aria?: string) => (
    <Button variant={variant} disabled={locked || !server.allowedActions[action]} title={!server.allowedActions[action] ? unavailable : undefined} aria-label={aria} onClick={() => onCommand(action)}>{label}</Button>
  );
  return (
    <Panel title="Текущая сессия">
      <div className="lsr-hstack"><ServerStatus server={server} /><b className="lsr-practice-track">{trackTitle(catalog, c.game.track.code, c.game.track.layoutCode)}</b></div>
      <div className="lsr-practice-divider" />
      <MetaGrid columns={2}>
        <Meta label="Игра">{gameLabel(c.gameCode)}</Meta>
        <Meta label="Погода">{weather ? (weather.mode === 'FIXED' || !weather.mode ? catalog?.weather[weather.presetCode] ?? weather.presetCode : 'Динамическая') : '—'}</Meta>
        <Meta label="Длительность">{c.sessionDurationMinutes} мин</Meta>
        <Meta label="Машины">{c.game.cars.allowedCarIds.length ? c.game.cars.allowedCarIds.map((id) => carTitle(catalog, id)).join(', ') : 'Не выбраны'}</Meta>
        <Meta label="Перезапуск после цикла">30 + {c.extraDelaySeconds} с</Meta>
        <Meta label="Автозапуск">{autostartLabel(server.status)}</Meta>
        <Meta label="Запуск цикла">{cycle ? (cycle.startedAt ? dateTime(cycle.startedAt, tz) : 'Ожидание запуска') : '—'}</Meta>
        <Meta label="Состояние процесса">{cycle ? cycleStateLabel(cycle.resourceState ?? cycle.state) : 'Нет активной сессии'}</Meta>
      </MetaGrid>
      {cycle?.connectionLostAt && <Notice tone="warning">Связь с сервером потеряна {shortDateTime(cycle.connectionLostAt, tz)}. Состояние уточняется — это не означает остановку.</Notice>}
      {cycle?.failure && <Notice tone="danger">Ошибка сессии: {cycle.failure.code}</Notice>}
      {!cycle && server.lastCycle?.failure && <Notice tone="warning">Последняя сессия завершилась ошибкой: {server.lastCycle.failure.code}</Notice>}
      {server.nextEligibleAt && <div className="lsr-mutedline">Следующий запуск не раньше {dateTime(server.nextEligibleAt, tz)}</div>}
      <div className="lsr-practice-divider" />
      <Notice>Изменения игровых настроек применяются только со следующего цикла.</Notice>
      <div className="lsr-practice-actions">
        {primary === 'pause' ? command('pause', 'Пауза после сессии') : command('start', '▶ Запустить сервер', 'default', 'Запустить сервер')}
      </div>
      <div className="lsr-practice-actions">
        {command('stop', '⏹ Принудительно остановить', 'danger-solid')}
        {command('restart', '↻ Перезапустить сервер')}
      </div>
      <Notice>Принудительная остановка разорвёт активные подключения. Перезапуск завершит текущую сессию. Требуется отдельное подтверждение.</Notice>
    </Panel>
  );
}

export function ServerSide({ server, catalog, organizers, canMonitor }: { server: Server; catalog: PracticeCatalog | null; organizers: Record<string, string>; canMonitor: boolean }) {
  const c = server.config, last = server.lastCycle;
  const rows: [ReactNode, ReactNode][] = [
    ['Мест на сервере', c.practice.maxParticipants],
    ['Дисциплина', disciplineLabel(c.disciplineCode)],
    ['Состояние Runtime', <ServerStatus server={server} />],
    ['Конфигурация', `${trackTitle(catalog, c.game.track.code, c.game.track.layoutCode)} · ${c.game.cars.allowedCarIds.length} маш.`],
    ['Организатор', organizerName(organizers, c.organizerId)],
    ['Сессия runtime', server.currentCycle?.runtimeSessionId ? `№${server.currentCycle.runtimeSessionId}` : '—'],
    ['Последний цикл', last ? `${cycleStateLabel(last.state)} · ${shortDateTime(last.finishedAt ?? last.startedAt, c.timezone)}` : '—'],
    ['Версия настроек', server.configVersion],
  ];
  return (
    <Panel title="Сервер и подключения" body={false} foot={<div className="lsr-hstack"><TextLink size="sm" to={`/service-journal?practiceServerId=${server.id}`}>Журнал игры →</TextLink>{canMonitor && <TextLink size="sm" to="/runtime">Игровые серверы →</TextLink>}</div>}>
      <div className="lsr-practice-rows">{rows.map(([label, value], i) => <div className="lsr-row-item" key={i}><b>{label}</b><span>{value}</span></div>)}</div>
    </Panel>
  );
}

export function ServerHistory({ history, page, onPage, timezone, error, onRetry }: { history: { items: Cycle[]; total: number } | null; page: number; onPage(page: number): void; timezone: string; error?: { message: string; status: number | null } | null; onRetry(): void }) {
  return (
    <Panel title="Прошедшие циклы" sub="Сессии сервера практики: от нового к старому" body={false}>
      {error && !history ? <div className="lsr-practice-pad"><ErrorState error={error.message} status={error.status} onRetry={onRetry} /></div>
        : !history ? <div className="lsr-practice-pad"><LoadingBlock rows={3} label="Загрузка сессий" /></div>
        : !history.total ? <EmptyState compact>Сессий пока нет. Они появятся после первого запуска сервера.</EmptyState>
        : <>
          <Table variant="module" label="Журнал сессий">
            <thead><tr><th>Цикл</th><th>Сессия</th><th>Начало</th><th>Окончание</th><th>Состояние</th><th>Ошибка</th></tr></thead>
            <tbody>{history.items.map((c) => (
              <tr key={c.executionId}>
                <td className="lsr-primary">№{c.executionId}</td>
                <td>{c.runtimeSessionId ? `№${c.runtimeSessionId}` : '—'}</td>
                <td className="lsr-num">{shortDateTime(c.startedAt, timezone)}</td>
                <td className="lsr-num">{shortDateTime(c.finishedAt, timezone)}</td>
                <td><StatusBadge variant="badge" status={{ code: c.state, label: cycleStateLabel(c.state) }} tone={cycleTone(c)} /></td>
                <td className={c.failure ? '' : 'lsr-sub'}>{c.failure?.code ?? '—'}</td>
              </tr>
            ))}</tbody>
          </Table>
          <Pager page={page} total={history.total} onPage={onPage} />
        </>}
    </Panel>
  );
}

const confirmTexts = {
  stop: { title: 'Принудительно остановить сервер?', body: 'Все текущие подключения будут отключены. Активная сессия будет прервана. Автозапуск новых циклов выключится.', ok: 'Принудительно остановить' },
  restart: { title: 'Перезапустить сервер?', body: 'Активная сессия будет завершена, игроки отключатся. Сервер запустит новый цикл с текущими настройками.', ok: 'Перезапустить' },
} as const;
export function ConfirmCommand({ request, busy, onCancel, onConfirm }: { request: { server: Server; action: 'stop' | 'restart' } | null; busy: boolean; onCancel(): void; onConfirm(): void }) {
  const text = request ? confirmTexts[request.action] : null;
  return (
    <Dialog open={!!request} onClose={() => !busy && onCancel()} title={text?.title ?? ''}
      actions={<><Button disabled={busy} onClick={onCancel}>Отмена</Button><Button variant={request?.action === 'stop' ? 'danger-solid' : 'primary'} disabled={busy} onClick={onConfirm}>{text?.ok}</Button></>}>
      {request && <div className="lsr-stack is-tight"><b>{request.server.config.title}</b><p className="lsr-practice-p">{text?.body}</p></div>}
    </Dialog>
  );
}
