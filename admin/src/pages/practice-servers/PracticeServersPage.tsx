import './PracticeServersPage.css';
import { ServerCard, ServerPower, ServerLive, ServerHistory } from './PracticeServerViews';
import type { Config, Server, Cycle } from './practice-types';
export type { Config } from './practice-types';
export { practiceServerStatus } from './practice-types';
import { PracticeServerEditor } from './PracticeServerEditor';
import { FilterButtons } from '../../shared/ui';
import { FixedTablePagination } from '../../shared/table';
import { Page, CreateAction, BackAction, ListToolbar } from '../../shared/ui';
import { subscribeAdminRefresh } from '../../shared/realtime';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Tabs, Tab, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../shared/api';
import { hasAny } from '../../shared/format';
import type { AdminAccess } from '../../shared/types';
import { command, defaultGame } from '../../features/standalone/GameFields';
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
export function PracticeServersPage({ access }: { access: AdminAccess }) {
  const location = useLocation(),
    navigate = useNavigate(),
    editId = location.pathname.match(/^\/practice-servers\/(\d+)(?:\/edit)?$/)?.[1],
    tab = location.pathname.endsWith('/edit') ? 'settings' : new URLSearchParams(location.search).get('tab') === 'sessions' ? 'sessions' : 'live',
    create = location.pathname.endsWith('/new');
  const [items, setItems] = useState<Server[]>([]),
    [loaded, setLoaded] = useState(false),
    [sessionPage, setSessionPage] = useState(1),
    [editing, setEditing] = useState<Server | null>(null),
    [config, setConfig] = useState<Config>(initial),
    [baseline, setBaseline] = useState<Config>(initial),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [hasPending, setHasPending] = useState(false),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [status, setStatus] = useState(''),
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
  const load = useCallback(async () => {
    const request = ++generation.current;
    if (create) return;
    if (editId) {
      const server = await apiFetch<Server>(`/admin/practice-servers/${editId}`);
      if (request !== generation.current) return;
      setEditing(server);
      if (configSource.current?.id !== server.id) {
        setConfig(server.config); setBaseline(server.config); setConflict(false);
        configSource.current = {id: server.id, version: server.configVersion};
      } else if (configSource.current.version !== server.configVersion) setConflict(true);
      return;
    }
    const v = await apiFetch<{ items: Server[]; total: number }>(
      `/admin/practice-servers?page=${page}&pageSize=20${status ? '&status=' + status : ''}`,
    );
    if (request !== generation.current) return;
    configSource.current = null;
    setItems(v.items);
    setLoaded(true);
    setTotal(v.total);
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(v.total / 20))));
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
          if (active) setError(String(e));
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
  useEffect(() => { setSessionPage(1); setHistory(null); }, [editId]);
  useEffect(() => {
    if (!editId || tab !== 'sessions') return;
    let active = true, revision = 0;
    setHistory(null);
    const refresh = async () => {
      const request = ++revision;
      try {
        const v = await apiFetch<{ items: Cycle[]; total: number }>(`/admin/practice-servers/${editId}/sessions?page=${sessionPage}&pageSize=20`);
        if (active && request === revision) setHistory({ id: editId, ...v, page: sessionPage });
      } catch (e) { if (active && request === revision) setError(String(e)); }
    };
    void refresh();
    const unsubscribe = subscribeAdminRefresh(['practice', 'runtime'], refresh);
    return () => { active = false; unsubscribe(); };
  }, [editId, tab, sessionPage]);
  const changeView = (path: string) => {
    if ((create || tab === 'settings') && JSON.stringify(config) !== JSON.stringify(baseline) && !window.confirm('Выйти без сохранения изменений?')) return;
    if (tab === 'settings') setConfig(baseline);
    navigate(path);
  };
  const canCreate = hasAny(access, ['practice.manage.all', 'practice.manage.scoped']),
    locked = busy || hasPending;
  return (
    <Page
      back={(create || editId) && <BackAction label={editId&&tab==='settings'?'К серверу':'Все серверы'} onClick={() => changeView(editId&&tab==='settings'?`/practice-servers/${editId}`:'/practice-servers')}/>}
      title={
        create
          ? 'Создание сервера практики'
          : editId
            ? editing?.config.title ?? 'Сервер практики'
            : 'Тренировочные серверы'
      }
      actions={
        !create && !editId ? (
          <CreateAction
            label="Создать сервер"
            disabled={!canCreate || locked}
            onClick={() => navigate('/practice-servers/new')}
          />
        ) : undefined
      }
    >
      {error && <Alert severity="error">{error}</Alert>}
      {hasPending && (
        <Button
          disabled={busy}
          onClick={() => {
            const p = pending.current!;
            void send(p.path, p.body, p.method);
          }}
        >
          Повторить неподтверждённую команду
        </Button>
      )}
      {editId && <>
        <div className="practice-workspace-heading">
          {editing && <ServerPower server={editing} locked={locked} onCommand={action => void send(`/admin/practice-servers/${editId}/${action}`)} />}
        </div>
        <Tabs value={tab} onChange={(_, next) => changeView(`/practice-servers/${editId}${next === 'settings' ? '/edit' : next === 'sessions' ? '?tab=sessions' : ''}`)} variant="scrollable" scrollButtons="auto" aria-label="Разделы сервера">
          <Tab value="live" label="Лайв" /><Tab value="sessions" label="Журнал сессий" /><Tab value="settings" label="Настройки" />
        </Tabs>
      </>}
      {create || (editId && tab === 'settings') ? (
        <>
          {conflict && (
            <Alert severity="warning">
              Настройки изменены другим администратором. Ваши правки сохранены в форме.
              <Button
                disabled={locked}
                onClick={() => {
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
                }}
              >
                Загрузить актуальные настройки
              </Button>
            </Alert>
          )}
          {editId && !editing ? (
            <Typography>Загрузка настроек…</Typography>
          ) : (
            <div className="practice-settings"><PracticeServerEditor
              config={config}
              onChange={setConfig}
              editing={!!editId}
              dirty={JSON.stringify(config) !== JSON.stringify(baseline)}
              disabled={
                locked ||
                conflict ||
                (!create && !editing?.allowedActions.configure) ||
                (create && !canCreate)
              }
              onSave={() =>
                void send(
                  create ? '/admin/practice-servers' : `/admin/practice-servers/${editId}/config`,
                  { config, ...(editing ? { version: configSource.current?.version ?? editing.configVersion } : {}) },
                  create ? 'POST' : 'PUT',
                )
              }
            /></div>
          )}
        </>
      ) : editId ? (
        !editing ? <Typography>Загрузка сервера…</Typography> : tab === 'sessions' ? <ServerHistory history={history?.id === editId ? history : null} page={sessionPage} onPage={setSessionPage} /> : <ServerLive server={editing} locked={locked} onCommand={action => void send(`/admin/practice-servers/${editId}/${action}`)} />
      ) : (
        <>
          <ListToolbar><FilterButtons
            label="Состояние"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Все' },
              { value: 'ACTIVE', label: 'Активные' },
              { value: 'PAUSED', label: 'На паузе' },
              { value: 'STOPPED', label: 'Остановленные' },
              { value: 'FAILED', label: 'С ошибкой' },
            ]}
          /></ListToolbar>
          {!loaded && <Typography color="text.secondary">Загрузка серверов…</Typography>}
          {loaded && !items.length && <Typography color="text.secondary">{status ? 'Нет серверов с таким состоянием.' : 'Серверов пока нет. Создайте первый тренировочный сервер.'}</Typography>}
          <div className="practice-list">{items.map(server => <ServerCard key={server.id} server={server} locked={locked} onCommand={action => void send(`/admin/practice-servers/${server.id}/${action}`)} />)}</div>
          <FixedTablePagination
            count={total}
            page={page - 1}
            rowsPerPage={20}
            onPageChange={(next) => setPage(next + 1)}
          />

        </>
      )}
    </Page>
  );
}
