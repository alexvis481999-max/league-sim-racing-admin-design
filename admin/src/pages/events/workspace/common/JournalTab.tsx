import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../shared/api';
import { useRealtimeRefresh } from '../../../../shared/realtime';
import { AsyncView, Button, EmptyState, ErrorState, LoadMore, Panel, PillButtons, Table, TextField, TextLink, Timeline, shortDateTime, Fields } from '../../../../ui/v16';
import { useWorkspaceData } from '../data';
import { workspacePath, type PageData } from '../data';
import { AuditPage } from '../../../audit/AuditPage';
import { ChatsPage } from '../../../chats/ChatsPage';
import { OfficiatingPage } from '../../../officiating/OfficiatingPage';
import { useWorkspace, useWorkspaceNav } from '../context';

type Source = 'states' | 'audit' | 'runtime' | 'game' | 'reports' | 'chat' | 'notifications';
const sources: { value: Source; label: string }[] = [
  { value: 'states', label: 'Состояния' }, { value: 'audit', label: 'Действия' }, { value: 'runtime', label: 'Серверы' }, { value: 'game', label: 'Игровой чат' },
  { value: 'reports', label: 'Судейство' }, { value: 'chat', label: 'Чат' }, { value: 'notifications', label: 'Уведомления' },
];

export function JournalTab({ active }: { active: boolean }) {
  const { eventId } = useWorkspace();
  const nav = useWorkspaceNav();
  const source = (sources.some((s) => s.value === nav.params.get('source')) ? nav.params.get('source') : 'states') as Source;
  const [visited, setVisited] = useState(new Set([source]));
  useEffect(() => setVisited((old) => (old.has(source) ? old : new Set([...old, source]))), [source]);
  return (
    <div className="lsr-stack">
      <PillButtons label="Источник журнала" size="lg" value={source} onChange={(v) => nav.setParam('source', v === 'states' ? null : v)} options={sources} />
      {sources.filter((s) => visited.has(s.value)).map((s) => (
        <div key={s.value} hidden={s.value !== source}>
          {s.value === 'states' && <StateHistory active={active && source === 'states'} />}
          {s.value === 'audit' && <Panel title="Действия администраторов"><AuditPage eventId={eventId} active={active && source === 'audit'} /></Panel>}
          {s.value === 'runtime' && <RuntimeHistory active={active && source === 'runtime'} />}
          {s.value === 'game' && <GameChatLog path={`/admin/events/${eventId}/game-chat`} active={active && source === 'game'} filters />}
          {s.value === 'reports' && <Panel title="Протесты и судейские решения"><OfficiatingPage initialEventId={eventId} visible={active && source === 'reports'} /></Panel>}
          {s.value === 'chat' && <Panel title="Чат события"><ChatsPage eventId={eventId} active={active && source === 'chat'} /></Panel>}
          {s.value === 'notifications' && <Notifications active={active && source === 'notifications'} />}
        </div>
      ))}
    </div>
  );
}

const states: Record<string, string> = { DRAFT: 'Черновик', PUBLISHED: 'Опубликовано', RUNNING: 'Началось', COMPLETED: 'Завершено', CANCELLED: 'Отменено', FAILED: 'Не состоялось' };
function StateHistory({ active }: { active: boolean }) {
  const { eventId, timezone } = useWorkspace();
  const r = useWorkspaceData<PageData<{ id: string; fromStatus: string | null; toStatus: string; reason: string; effectiveAt: string; observedAt: string }>>(workspacePath(eventId, 'history'), active);
  return (
    <Panel title="Переходы состояния события">
      <AsyncView resource={r} isEmpty={(d) => !d.items.length} empty={<div className="lsr-mutedline">Переходов пока нет.</div>}>
        {(data) => (
          <>
            <Timeline items={data.items.map((x) => ({ title: `${x.fromStatus ? (states[x.fromStatus] ?? x.fromStatus) + ' → ' : ''}${states[x.toStatus] ?? x.toStatus}`, detail: x.reason + (x.observedAt !== x.effectiveAt ? ` · зафиксировано ${shortDateTime(x.observedAt, timezone)}` : ''), at: shortDateTime(x.effectiveAt, timezone) }))} />
            <LoadMore hasMore={!!data.nextAfterId} busy={r.busy} onClick={() => void r.load(data.nextAfterId!)} />
          </>
        )}
      </AsyncView>
    </Panel>
  );
}

const runtimeLabels: Record<string, string> = { WAITING: 'Ожидание мощности', STARTED: 'Запуск подтверждён', PHASE_CHANGED: 'Смена фазы', STOPPED: 'Остановка подтверждена', FAILED: 'Сбой', OUTPUT: 'Получен результат', PARTICIPANTS_PRESENT: 'Состав обновлён', CONNECTION_LOST: 'Потеря связи', CONNECTION_RESTORED: 'Связь восстановлена' };
function RuntimeHistory({ active }: { active: boolean }) {
  const { eventId, timezone } = useWorkspace();
  const r = useWorkspaceData<PageData<{ id: string; sessionId: string; type: string; occurredAt: string; reason: string | null; phase: string | null; acknowledged: boolean }>>(workspacePath(eventId, 'runtime-history'), active);
  return (
    <Panel title="История исполнения серверов" body={false}>
      <AsyncView resource={r} isEmpty={(d) => !d.items.length} empty={<EmptyState compact>Фактов исполнения нет.</EmptyState>}>
        {(data) => (
          <>
            <Table label="История исполнения">
              <thead><tr><th>Время</th><th>Событие</th><th>Сессия</th><th>Фаза</th><th>Причина</th><th>Обработка</th></tr></thead>
              <tbody>
                {data.items.map((x) => (
                  <tr key={x.id} className={x.type === 'FAILED' || x.type === 'CONNECTION_LOST' ? 'is-alert' : ''}>
                    <td className="lsr-num">{shortDateTime(x.occurredAt, timezone)}</td>
                    <td className="lsr-primary">{runtimeLabels[x.type] ?? 'Событие сервера'}</td>
                    <td><TextLink size="sm" to={`/runtime?sessionId=${x.sessionId}&eventId=${eventId}`}>№{x.sessionId} ↗</TextLink></td>
                    <td>{x.phase ?? '—'}</td>
                    <td className="lsr-sub">{x.reason ?? '—'}</td>
                    <td>{x.acknowledged ? 'Обработано' : <span style={{ color: 'var(--lsr-amber)' }}>Ожидает обработки</span>}</td>
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

function Notifications({ active }: { active: boolean }) {
  const { eventId, timezone } = useWorkspace();
  const r = useWorkspaceData<PageData<{ id: string; recipientId: string; title: string; body: string; status: string; createdAt: string; readAt: string | null; dismissedAt: string | null }>>(workspacePath(eventId, 'notifications'), active);
  return (
    <Panel title="Уведомления" sub="Сохранённые уведомления во входящих. Отдельного подтверждения доставки нет." body={false}>
      <AsyncView resource={r} isEmpty={(d) => !d.items.length} empty={<EmptyState compact>Связанных уведомлений нет.</EmptyState>}>
        {(data) => (
          <>
            <Table label="Уведомления">
              <thead><tr><th>Уведомление</th><th>Получатель</th><th>Создано</th><th>Состояние</th></tr></thead>
              <tbody>
                {data.items.map((x) => (
                  <tr key={x.id}>
                    <td><div className="lsr-primary">{x.title}</div><div className="lsr-minor">{x.body}</div></td>
                    <td><TextLink size="sm" to={`/users?userId=${x.recipientId}&eventId=${eventId}`}>{x.recipientId}</TextLink></td>
                    <td className="lsr-num">{shortDateTime(x.createdAt, timezone)}</td>
                    <td>{x.dismissedAt ? `Скрыто ${shortDateTime(x.dismissedAt, timezone)}` : x.readAt ? `Прочитано ${shortDateTime(x.readAt, timezone)}` : 'Не прочитано'}</td>
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

type GameMessage = { id: string; occurredAt: string; receivedAt?: string; sessionId: string; runId?: string; driverGuid: string; driverName: string; message: string };
/** Game server chat log (events, practice servers, matchmaking matches). Site chat is a separate source. */
export function GameChatLog({ path, active = true, filters = false, title = 'Игровой чат серверов' }: { path: string; active?: boolean; filters?: boolean; title?: string }) {
  const [items, setItems] = useState<GameMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(''), [run, setRun] = useState('');
  async function load(after?: string) {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: '50' });
      if (after) q.set('afterId', after);
      if (session.trim()) q.set('runtimeSessionId', session.trim());
      if (run.trim()) q.set('runId', run.trim());
      const page = await apiFetch<{ items: GameMessage[]; nextCursor: string | null }>(`${path}?${q}`);
      setItems((old) => (after ? [...old, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить журнал');
    } finally {
      setLoading(false);
    }
  }
  useRealtimeRefresh(['runtime'], () => load(), active);
  useEffect(() => { setItems([]); setCursor(null); if (active) void load(); }, [path, active]);
  return (
    <Panel title={title} sub="Сообщения, полученные с игровых серверов. Чат сайта ведётся отдельно.">
      <div className="lsr-stack">
        {filters && (
          <div className="lsr-hstack" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}><Fields><TextField label="ID сессии" value={session} onChange={(e) => setSession(e.target.value)} /><TextField label="ID запуска" value={run} onChange={(e) => setRun(e.target.value)} /></Fields></div>
            <Button onClick={() => void load()}>Показать</Button>
          </div>
        )}
        {error && <ErrorState error={error} onRetry={() => void load()} />}
        {!error && !loading && !items.length && <div className="lsr-mutedline">Сообщений пока нет.</div>}
        {!!items.length && (
          <div className="lsr-log" role="log">
            {items.map((m) => `[${shortDateTime(m.occurredAt)}] ${m.driverName || m.driverGuid} (${m.driverGuid}) · сессия ${m.sessionId}: ${m.message}`).join('\n')}
          </div>
        )}
        <LoadMore hasMore={!!cursor} busy={loading} onClick={() => void load(cursor!)} label="Ранее" />
      </div>
    </Panel>
  );
}
