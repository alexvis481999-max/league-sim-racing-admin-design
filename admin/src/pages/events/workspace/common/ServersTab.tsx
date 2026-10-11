import { useState } from 'react';
import type { DisplayStatus } from '../../../../../../shared/event-status';
import { AsyncView, Button, EmptyState, LoadMore, Panel, PillButtons, StatusBadge, Table, TextLink, recordTone, shortDateTime, type Tone } from '../../../../ui/v16';
import { useWorkspaceData } from '../../current/workspace-data';
import { workspacePath, type PageData } from '../../current/workspace-ui';
import { useWorkspace, useWorkspaceNav } from '../context';

type Session = { id: string; serverId: string | null; displayStatus: DisplayStatus; requestedAt: string; startedAt: string | null; stoppedAt: string | null; connectedPlayers: number | null; connectionLostAt: string | null; recoveryDeadlineAt: string | null; stopCause: string | null };
type Reservation = { id: string; stageTitle: string | null; blockKey?: string; startsAt: string; estimatedEndsAt: string; serverCount: number; status: string };
type RuntimePage = PageData<Session> & { reservations: Reservation[] };
type Presence = { id: string; sessionId: string; participantId: string | null; name: string | null; kind: string; occurredAt: string; reason: string | null };
type View = 'sessions' | 'reservations' | 'presence';
const reservationLabels: Record<string, string> = { SCHEDULED: 'Запланирован', ACTIVE: 'Действует', COMPLETED: 'Завершён', RELEASED: 'Освобождён', CANCELLED: 'Отменён' };
const reservationTones: Record<string, Tone> = { SCHEDULED: 'scheduled', ACTIVE: 'live', COMPLETED: 'done' };
const presenceLabels: Record<string, string> = { CONNECTED: 'Подключился', DISCONNECTED: 'Отключился', REJECTED: 'Вход отклонён' };

/**
 * Runtime sessions, planned capacity and connections of the event. A reservation is future capacity, a session is an actual run;
 * lost connection means the state is unconfirmed, not that the server stopped.
 */
export function ServersTab({ active }: { active: boolean }) {
  const { summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const view = (['sessions', 'reservations', 'presence'].includes(nav.params.get('view') ?? '') ? nav.params.get('view') : 'sessions') as View;
  const [group, setGroup] = useState<'uncertain' | 'active' | 'finished'>(summary.activity.runtime.uncertain ? 'uncertain' : summary.activity.runtime.active ? 'active' : 'finished');
  return (
    <div className="lsr-stack">
      <PillButtons label="Раздел" size="lg" value={view} onChange={(v) => nav.setParam('view', v === 'sessions' ? null : v)}
        options={[{ value: 'sessions', label: 'Запуски серверов' }, { value: 'reservations', label: 'Плановый резерв' }, { value: 'presence', label: 'Подключения пилотов' }]} />
      {view === 'sessions' && <Sessions active={active} group={group} setGroup={setGroup} />}
      {view === 'reservations' && <Reservations active={active} />}
      {view === 'presence' && <PresenceTable active={active} />}
    </div>
  );
}

function Sessions({ active, group, setGroup }: { active: boolean; group: 'uncertain' | 'active' | 'finished'; setGroup: (g: 'uncertain' | 'active' | 'finished') => void }) {
  const { eventId, summary, timezone } = useWorkspace();
  const r = useWorkspaceData<RuntimePage>(workspacePath(eventId, 'runtime') + `?stateGroup=${group}`, active);
  return (
    <Panel title="Запуски серверов" sub={`Активных ${summary.activity.runtime.active} · без связи ${summary.activity.runtime.uncertain}`} body={false}
      actions={<PillButtons label="Группа запусков" value={group} onChange={setGroup} options={[{ value: 'uncertain', label: 'Нет связи' }, { value: 'active', label: 'Незавершённые' }, { value: 'finished', label: 'Завершённые' }]} />}>
      <AsyncView resource={r} isEmpty={(d) => !d.items.length} empty={<EmptyState compact>В этой группе запусков нет.</EmptyState>}>
        {(data) => (
          <>
            <Table label="Запуски">
              <thead><tr><th>Сессия</th><th>Состояние</th><th>Сервер</th><th>Онлайн</th><th>Запрошено</th><th>Начало</th><th>Остановка</th></tr></thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className={s.connectionLostAt ? 'is-alert' : ''}>
                    <td><TextLink to={`/runtime?sessionId=${s.id}&eventId=${eventId}`}>№{s.id} ↗</TextLink>{s.stopCause && <div className="lsr-minor">{s.stopCause}</div>}{s.connectionLostAt && <div className="lsr-minor" style={{ color: '#865b25' }}>Связь потеряна {shortDateTime(s.connectionLostAt, timezone)}, проверка до {shortDateTime(s.recoveryDeadlineAt, timezone)}</div>}</td>
                    <td><StatusBadge status={s.displayStatus} small /></td>
                    <td>{s.serverId ?? 'Не назначен'}</td>
                    <td className="lsr-num">{s.connectedPlayers ?? <span className="lsr-sub" title="Нет подтверждённых данных">—</span>}</td>
                    <td className="lsr-num">{shortDateTime(s.requestedAt, timezone)}</td>
                    <td className="lsr-num">{shortDateTime(s.startedAt, timezone)}</td>
                    <td className="lsr-num">{shortDateTime(s.stoppedAt, timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <LoadMore hasMore={!!data.nextAfterId} busy={r.busy} onClick={() => void r.load(data.nextAfterId!)} />
          </>
        )}
      </AsyncView>
    </Panel>
  );
}

function Reservations({ active }: { active: boolean }) {
  const { eventId, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const r = useWorkspaceData<RuntimePage>(workspacePath(eventId, 'runtime') + '?stateGroup=active', active);
  return (
    <Panel title="Плановый резерв серверов" sub="Сохранённые резервы менеджера серверов на окна гонок. Назначение конкретного сервера видно в запусках." body={false}>
      <AsyncView resource={r} isEmpty={(d) => !d.reservations.length} empty={<EmptyState compact>Сохранённых резервов нет.</EmptyState>}>
        {(data) => (
          <Table label="Резервы">
            <thead><tr><th>Этап / гонка</th><th>Серверов</th><th>Окно резерва</th><th>Состояние</th></tr></thead>
            <tbody>
              {data.reservations.map((x) => (
                <tr key={x.id}>
                  <td>{x.blockKey ? <TextLink onClick={() => nav.race(x.blockKey!)}>{x.stageTitle ?? x.blockKey}</TextLink> : x.stageTitle ?? 'Название не сохранено'}<div className="lsr-minor">Резерв №{x.id}</div></td>
                  <td className="lsr-num lsr-primary">{x.serverCount}</td>
                  <td className="lsr-num">{shortDateTime(x.startsAt, timezone)} — {shortDateTime(x.estimatedEndsAt, timezone)}<div className="lsr-minor">окончание — плановое</div></td>
                  <td><StatusBadge status={{ code: x.status, label: reservationLabels[x.status] ?? x.status }} tone={recordTone(x.status, reservationTones)} small /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </AsyncView>
    </Panel>
  );
}

function PresenceTable({ active }: { active: boolean }) {
  const { eventId, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const participant = nav.params.get('participantId');
  const r = useWorkspaceData<PageData<Presence>>(workspacePath(eventId, 'presence') + (participant ? `?participantId=${encodeURIComponent(participant)}` : ''), active);
  return (
    <Panel title={`Подключения пилотов${participant ? ' · выбранный пилот' : ''}`} sub="Фактические входы и выходы с игровых серверов события" body={false}
      actions={participant ? <Button size="sm" onClick={() => nav.setParam('participantId', null)}>Все пилоты</Button> : undefined}>
      <AsyncView resource={r} isEmpty={(d) => !d.items.length} empty={<EmptyState compact>Подключения не зафиксированы.</EmptyState>}>
        {(data) => (
          <>
            <Table label="Подключения">
              <thead><tr><th>Время</th><th>Пилот</th><th>Событие</th><th>Сессия</th><th>Причина</th></tr></thead>
              <tbody>
                {data.items.map((x) => (
                  <tr key={x.id}>
                    <td className="lsr-num">{shortDateTime(x.occurredAt, timezone)}</td>
                    <td className="lsr-primary">{x.name ?? x.participantId ?? 'Неизвестный участник'}</td>
                    <td>{presenceLabels[x.kind] ?? x.kind}</td>
                    <td><TextLink size="sm" to={`/runtime?sessionId=${x.sessionId}&eventId=${eventId}`}>№{x.sessionId} ↗</TextLink></td>
                    <td className="lsr-sub">{x.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <LoadMore hasMore={!!data.nextAfterId} busy={r.busy} onClick={() => void r.load(data.nextAfterId!)} />
          </>
        )}
      </AsyncView>
    </Panel>
  );
}
