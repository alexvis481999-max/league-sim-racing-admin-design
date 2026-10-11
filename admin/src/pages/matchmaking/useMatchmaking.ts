import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '../../shared/api';
import { subscribeAdminRefresh } from '../../shared/realtime';
import { command } from '../../features/standalone/GameFields';
import { initialConfig, RACES_PAGE_SIZE, type Config, type Live, type MatchmakingAnalyticsData, type Queue, type RacesPage } from './matchmaking-model';

export type Failure = { message: string; status: number | null };
const failure = (e: unknown): Failure => ({
  message: e instanceof ApiError && e.status === 403 ? 'Недостаточно прав для просмотра матчмейкинга.' : e instanceof Error ? e.message : String(e),
  status: e instanceof ApiError ? e.status : null,
});
type Command = { path: string; body: unknown; method: string; key: string };

/**
 * Data and commands of the Assetto Corsa touge queue.
 * Writes carry the numeric queue `version` and an Idempotency-Key; an unconfirmed command (network/5xx) is retried with the same key and body.
 */
export function useMatchmaking(page: number) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | Failure>('loading');
  const [queue, setQueue] = useState<Queue | null>(null);
  const [config, setConfig] = useState<Config>(initialConfig);
  /** Form baseline before the first save, when the queue does not exist yet. */
  const [draftBaseline, setDraftBaseline] = useState<Config>(initialConfig);
  const [setupError, setSetupError] = useState('');
  const [live, setLive] = useState<Live | null>(null);
  const [races, setRaces] = useState<RacesPage | null>(null);
  const [analytics, setAnalytics] = useState<MatchmakingAnalyticsData | null>(null);
  const [readError, setReadError] = useState<Failure | null>(null);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [commandError, setCommandError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Command | null>(null);
  const pendingRef = useRef<Command | null>(null);
  const inFlight = useRef(false);
  const latestQueue = useRef<Queue | null>(null);
  useLayoutEffect(() => {
    latestQueue.current = queue;
  }, [queue]);

  const loadQueue = useCallback(async (isActive: () => boolean = () => true) => {
    setLoadState('loading');
    try {
      const list = await apiFetch<{ items: Queue[] }>('/admin/matchmaking');
      const organizers = list.items.length ? [] : await apiFetch<{ id: string; name: string }[]>('/admin/access/organizers');
      if (!isActive()) return;
      const found = list.items.find((q) => q.config.gameCode === 'assetto_corsa') ?? null;
      const defaultOrganizer = organizers.find((o) => o.name.trim().toLowerCase() === 'league sim racing');
      const base = found?.config ?? { ...initialConfig(), organizerId: defaultOrganizer?.id ?? '' };
      setQueue(found);
      setConfig(base);
      setDraftBaseline(base);
      setSetupError(!found && !defaultOrganizer ? 'Организатор League Sim Racing не найден. Добавьте его в разделе организаторов.' : '');
      setLoadState('ready');
    } catch (e) {
      if (isActive()) setLoadState(failure(e));
    }
  }, []);
  useEffect(() => {
    let active = true;
    void loadQueue(() => active);
    return () => {
      active = false;
    };
  }, [loadQueue]);

  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (!queue?.id) return;
    let active = true,
      revision = 0;
    const load = async () => {
      const request = ++revision;
      try {
        const [l, r, a] = await Promise.all([
          apiFetch<Live>(`/admin/matchmaking/${queue.id}/live`),
          apiFetch<RacesPage>(`/admin/matchmaking/${queue.id}/races?page=${page}&pageSize=${RACES_PAGE_SIZE}`),
          apiFetch<MatchmakingAnalyticsData>(`/admin/matchmaking/${queue.id}/analytics`),
        ]);
        if (!active || request !== revision) return;
        const fresh = await apiFetch<Queue>(`/admin/matchmaking/${queue.id}/config`);
        if (!active || request !== revision) return;
        setRemoteChanged(fresh.version !== (latestQueue.current?.version ?? fresh.version));
        setLive(l);
        setRaces(r);
        setAnalytics(a);
        setReadError(null);
      } catch (e) {
        if (active && request === revision) setReadError(failure(e));
      }
    };
    void load();
    const unsubscribe = subscribeAdminRefresh(['matchmaking', 'runtime', 'results', 'rating'], load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queue?.id, queue?.version, page, refreshTick]);

  async function run(next: Command) {
    if (inFlight.current) return;
    pendingRef.current ??= next;
    const cmd = pendingRef.current;
    setPending(cmd);
    inFlight.current = true;
    setBusy(true);
    setCommandError('');
    try {
      const saved = await command<Queue>(cmd.path, cmd.body, cmd.key, cmd.method);
      pendingRef.current = null;
      setPending(null);
      setQueue(saved);
      if (!/\/(enable|disable)$/.test(cmd.path)) setConfig(saved.config);
      setRemoteChanged(false);
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        pendingRef.current = null;
        setPending(null);
        if (e.status === 409) setRemoteChanged(true);
      }
      setCommandError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const send = (path: string, body: unknown, method = 'POST') => run({ path, body, method, key: crypto.randomUUID() });
  const retryPending = () => {
    if (pending) void run(pending);
  };

  async function reloadConfig() {
    if (!queue || busy || pending) return;
    setBusy(true);
    try {
      const fresh = await apiFetch<Queue>(`/admin/matchmaking/${queue.id}/config`);
      setQueue(fresh);
      setConfig(fresh.config);
      setRemoteChanged(false);
      setCommandError('');
    } catch (e) {
      setCommandError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const dirty = loadState === 'ready' && JSON.stringify(config) !== JSON.stringify(queue?.config ?? draftBaseline);
  return {
    loadState,
    reload: () => void loadQueue(),
    queue,
    config,
    setConfig,
    dirty,
    setupError,
    live,
    races,
    analytics,
    readError,
    refresh: () => setRefreshTick((n) => n + 1),
    remoteChanged,
    commandError,
    busy,
    pending: !!pending,
    send,
    retryPending,
    reloadConfig,
  };
}
export type MatchmakingState = ReturnType<typeof useMatchmaking>;
