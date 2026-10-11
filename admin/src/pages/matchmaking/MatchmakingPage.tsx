import {MatchRecords} from './MatchRecords';
import {type MatchResultDetail} from './MatchDetails';
import {
  EditorSections,
  useUnsavedChanges,
} from '../../features/standalone/EditorSections';
import { FieldGroup } from '../../features/event-authoring/Fields';
import { FixedTablePagination } from '../../shared/table';
import { MatchmakingAnalytics, type MatchmakingAnalyticsData } from './MatchmakingAnalytics';
import './MatchmakingPage.css';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

import { poolErrors } from './pool-validation';
import { displayDateTime } from '../../../../shared/presentation';
import { subscribeAdminRefresh } from '../../shared/realtime';
import { PoolFields, newPools, type Pools } from './PoolFields';
import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import {
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { apiFetch, ApiError } from '../../shared/api';
import type { AdminAccess } from '../../shared/types';
import { hasAny } from '../../shared/format';
import { Page, Section } from '../../shared/ui';
import {
  GameFields,
  defaultGame,
  command,
  type GameConfig,
} from '../../features/standalone/GameFields';
type Condition = {
  key: string;
  title: string;
  trackTitle: string;
  weatherTitle: string;
  game: GameConfig;
};
type Config = {
  pools?: Pools;
  organizerId: string;
  title: string;
  description: string | null;
  coverImageId: string | null;
  gameCode: 'assetto_corsa';
  disciplineCode: 'touge';
  timezone: string;
  blockDurationMinutes: number;
  game: GameConfig;
  conditions: Condition[];
  duel: { winsTo: number; maximumOmtRounds: number; runtimeTimeLimitMinutes: number };
  rating: {
    mode: 'none' | 'result' | 'NONE' | 'RESULT';
    pilotMultiplier?: number;
    safetyMultiplier?: number;
  };
};
type Queue = {
  id: string;
  version: number;
  enabled: boolean;
  config: Config;
  poolConversion?: { config: Config | null; issues: string[] };
};
export type Match = {
  id: string;
  status: string;
  failure: string | null;
  condition: Condition & { pool?: { durationMinutes: number } };
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string | null;
  runtimeSessionId?: string | null;
  runtimeStatus?: string | null;
  serverId?: string | null;
  runtimeFailure?: { code: string; message: string | null } | null;
  readyDeadlineAt?: string;
  players: {
    id: string;
    name: string;
    ready: boolean;
    selection?: { carId: string; skinId: string | null } | null;
  }[];
  resultId: string | null;
  result: MatchResultDetail | null;
};
const initial = (): Config => ({
  organizerId: '',
  title: 'Тоге',
  description: null,
  coverImageId: null,
  gameCode: 'assetto_corsa',
  disciplineCode: 'touge',
  timezone: 'Europe/Moscow',
  blockDurationMinutes: 6,
  pools: newPools(),
  game: {
    ...defaultGame(),
    simulation: { ...defaultGame().simulation, allowedTyresOut: -1 },
    assists: { ...defaultGame().assists, autoClutchAllowed: true, tyreBlanketsAllowed: true },
  },
  conditions: [],
  duel: { winsTo: 1, maximumOmtRounds: 0, runtimeTimeLimitMinutes: 6 },
  rating: { mode: 'none' },
});
export function MatchmakingPage({ access }: { access: AdminAccess }) {

  const [remoteChanged, setRemoteChanged] = useState(false);
  const latestQueue = useRef<Queue | null>(null);
  const initialConfig = useRef(initial());
  const [queue, setQueue] = useState<Queue | null>(null),
    [config, setConfig] = useState<Config>(initial),
    [tab, setTab] = useState(1),
    [settingsSection, setSettingsSection] = useState('cars'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [hasPending, setHasPending] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState<{
      readiness: {
        code: string;
        label: string;
        action: string | null;
        availableConditions: number;
      };
      queue: { id: string; participantId: string; queuedAt: string; waitingSeconds: number }[];
      matches: Match[];
    } | null>(null),
    [races, setRaces] = useState<Match[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [analytics, setAnalytics] = useState<MatchmakingAnalyticsData | null>(null);
  const pending = useRef<{ path: string; body: unknown; method: string; key: string } | null>(null),
    inFlight = useRef(false);
  useLayoutEffect(() => {
    latestQueue.current = queue;
  }, [queue]);
  const canWrite = hasAny(access, ['matchmaking.manage.all']);
  useEffect(() => {
    let active = true;
    apiFetch<{ items: Queue[] }>('/admin/matchmaking')
      .then(async (v) => {
        const organizers = v.items.length ? [] : await apiFetch<{id:string;name:string}[]>('/admin/access/organizers');
        const defaultOrganizer = organizers.find(o=>o.name.trim().toLowerCase()==='league sim racing');
        if (active) {
          const q = v.items.find((q) => q.config.gameCode === 'assetto_corsa') ?? null;
          setQueue(q);
          initialConfig.current = q?.config ?? {...initial(),organizerId:defaultOrganizer?.id??''};
          setConfig(initialConfig.current);
          if(!q&&!defaultOrganizer)setError('Организатор League Sim Racing не найден. Добавьте его в разделе организаторов.');
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!queue?.id) return;
    let active = true,
      revision = 0;
    const load = async () => {
      const request = ++revision;
      try {
        const [l, r, a] = await Promise.all([
          apiFetch<typeof live>(`/admin/matchmaking/${queue.id}/live`),
          apiFetch<{ items: Match[]; total: number }>(
            `/admin/matchmaking/${queue.id}/races?page=${page}&pageSize=20`,
          ),
          apiFetch<MatchmakingAnalyticsData>(`/admin/matchmaking/${queue.id}/analytics`),
        ]);
        if (active && request === revision) {
          const fresh = await apiFetch<Queue>(`/admin/matchmaking/${queue.id}/config`);
          if (!active || request !== revision) return;
          setRemoteChanged(fresh.version !== (latestQueue.current?.version ?? fresh.version));
          setLive(l);
          setRaces(r.items);
          setTotal(r.total);
          setPage((current) => Math.min(current, Math.max(1, Math.ceil(r.total / 20))));
          setAnalytics(a);
        }
      } catch (e) {
        if (active) setError(String(e));
      }
    };
    void load();
    const unsubscribe = subscribeAdminRefresh(
      ['matchmaking', 'runtime', 'results', 'rating'],
      load,
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queue?.id, queue?.version, page]);
  async function send(path: string, body: unknown, method = 'POST') {
    if (inFlight.current) return;
    pending.current ??= { path, body, method, key: crypto.randomUUID() };
    setHasPending(true);
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const p = pending.current,
        q = await command<Queue>(p.path, p.body, p.key, p.method);
      pending.current = null;
      setHasPending(false);
      setQueue(q);
      if (!/\/(enable|disable)$/.test(p.path)) setConfig(q.config);
      setRemoteChanged(false);
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        pending.current = null;
        setHasPending(false);
        if (e.status === 409 && queue) {
          setRemoteChanged(true);
        }
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const locked = busy || hasPending || !canWrite,
    patch = (v: Partial<Config>) => setConfig((c) => ({ ...c, ...v }));
  const dirty = loaded && JSON.stringify(config) !== JSON.stringify(queue?.config ?? initialConfig.current);
  useUnsavedChanges(dirty);
  const validation = poolErrors(config.pools);
  if (!config.title.trim() || !config.organizerId)
    validation.unshift('Не задан организатор League Sim Racing.');
  async function reloadConfig() {
    if (!queue || busy || hasPending) return;
    setBusy(true);
    try {
      const fresh = await apiFetch<Queue>(`/admin/matchmaking/${queue.id}/config`);
      setQueue(fresh);
      setConfig(fresh.config);
      setRemoteChanged(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const rows = (items: Match[]) => <MatchRecords items={items} queueId={queue?.id} />;
  return (
    <Page title="Матчмейкинг">
      {remoteChanged && (
        <Alert severity="warning">
          Настройки очереди изменены. Правки формы сохранены; загрузка актуальных настроек заменит
          их.{' '}
          <Button disabled={busy || hasPending} onClick={() => void reloadConfig()}>
            Загрузить актуальные настройки
          </Button>
        </Alert>
      )}
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
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
      <Typography>
        Assetto Corsa · Тоге ·{' '}
        {!loaded
          ? 'Загрузка'
          : !queue
            ? 'Не настроен'
            : queue.enabled
              ? 'Поиск включён'
              : 'Отключён'}
      </Typography>
      {queue && (
        <Button
          variant="contained"
          color={queue.enabled ? 'success' : 'inherit'}
          startIcon={<PowerSettingsNewIcon/>}
          aria-label={queue.enabled ? 'Выключить поиск' : 'Включить поиск'}
          aria-pressed={queue.enabled}
          sx={{ flexShrink: 0, minWidth: 190 }}
          disabled={locked || remoteChanged}
          onClick={() =>
            void send(`/admin/matchmaking/${queue.id}/${queue.enabled ? 'disable' : 'enable'}`, {
              version: queue.version,
            })
          }
        >
          {queue.enabled ? 'Матчмейкинг включён' : 'Матчмейкинг выключен'}
        </Button>
      )}
      </Stack>
      {loaded && !queue && (
        <Alert severity="warning">
          Сохраните условия подбора: трассы с зонами, машины, погоду и плагин. Затем включите поиск.
        </Alert>
      )}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        {[[1, 'Live'], [2, 'Журнал сессий'], [3, 'Аналитика'], [0, 'Настройки']].map(([value, label]) => (
          <Tab key={value} value={value} label={label} />
        ))}
      </Tabs>
      {tab === 0 && loaded && (
        <div className="matchmaking-settings"><EditorSections
          inlineActions
          sections={Object.entries({
            cars: 'Машины',
            tracks: 'Трассы',
            weather: 'Погода',
            rules: 'Правила',
            server: 'Условия сервера',
          })}
          value={settingsSection}
          onChange={setSettingsSection}
          dirty={dirty}
          actions={
            <Button
              variant="contained"
              disabled={locked || remoteChanged || validation.length > 0}
              onClick={() =>
                void send(
                  queue ? `/admin/matchmaking/${queue.id}/config` : '/admin/matchmaking',
                  {
                    config: {
                      ...config,
                      game: {
                        ...config.game,
                        simulation: {...config.game.simulation, allowedTyresOut: -1},
                        assists: {
                          ...config.game.assists,
                          autoClutchAllowed: config.game.assists.autoClutchAllowed ?? true,
                          tyreBlanketsAllowed: config.game.assists.tyreBlanketsAllowed ?? true,
                        },
                      },
                      conditions: [],
                    },
                    ...(queue ? { version: queue.version } : {}),
                  },
                  queue ? 'PUT' : 'POST',
                )
              }
            >
              Сохранить настройки
            </Button>
          }
        >
          <Stack
            role="tabpanel"
            id="editor-panel-rules"
            aria-labelledby="editor-tab-rules"
            sx={{ display: settingsSection === 'rules' ? 'flex' : 'none' }}
          >
            <FieldGroup title="Правила матча и рейтинг">
              {' '}
              <TextField
                type="number"
                label="Побед до победы в матче"
                value={config.duel.winsTo}
                disabled={locked}
                onChange={(e) =>
                  patch({ duel: { ...config.duel, winsTo: Number(e.target.value) } })
                }
              />
              <TextField
                type="number"
                label="Дополнительные раунды OMT"
                value={config.pools?.tiePolicy === 'double_loss' ? 0 : config.duel.maximumOmtRounds}
                disabled={locked || config.pools?.tiePolicy === 'double_loss'}
                onChange={(e) =>
                  patch({ duel: { ...config.duel, maximumOmtRounds: Number(e.target.value) } })
                }
              />
              <FormControlLabel
                label="Рейтинговый режим"
                control={
                  <Checkbox
                    checked={!['NONE', 'none'].includes(config.rating.mode)}
                    disabled={locked}
                    onChange={(e) =>
                      patch({
                        rating: e.target.checked
                          ? { mode: 'result', pilotMultiplier: 1, safetyMultiplier: 1 }
                          : { mode: 'none' },
                      })
                    }
                  />
                }
              />
              {!['NONE', 'none'].includes(config.rating.mode) && (
                <TextField
                  type="number"
                  label="Множитель рейтинга"
                  disabled={locked}
                  value={config.rating.pilotMultiplier}
                  onChange={(e) =>
                    patch({ rating: { ...config.rating, pilotMultiplier: Number(e.target.value) } })
                  }
                />
              )}
            </FieldGroup>
          </Stack>
          {config.pools ? (
            <>
              <Stack
                sx={{
                  display: ['cars', 'tracks', 'weather', 'rules'].includes(settingsSection)
                    ? 'flex'
                    : 'none',
                }}
              >
                <Stack spacing={2}>
                  <PoolFields
                    section={settingsSection}
                    value={config.pools}
                    onChange={(pools) =>
                      patch({
                        pools,
                        duel: {
                          ...config.duel,
                          maximumOmtRounds:
                            pools.tiePolicy === 'double_loss'
                              ? 0
                              : Math.max(1, config.duel.maximumOmtRounds),
                        },
                      })
                    }
                    disabled={locked}
                  />
                </Stack>
              </Stack>
              <Stack
                role="tabpanel"
                id="editor-panel-server"
                aria-labelledby="editor-tab-server"
                sx={{ display: settingsSection === 'server' ? 'flex' : 'none' }}
              >
                <Stack spacing={2}>
                  <GameFields
                    organizerId={config.organizerId}
                    onlyRules
                    disableTrackLimits
                    value={config.game}
                    onChange={(game) => patch({ game })}
                    disabled={locked}
                    allowRandomWeather={false}
                  />
                </Stack>
              </Stack>
            </>
          ) : (
            <Stack spacing={2}>
              <Alert severity="warning">
                Сохранена прежняя модель: {config.conditions.length} сочетаний. Переход к пулам
                требует проверки весов и правил. Текущие пары сохранят свои условия.
              </Alert>
              {queue?.poolConversion?.issues.map((issue, index) => (
                <Alert key={index} severity="info">
                  {issue}
                </Alert>
              ))}
              {queue?.poolConversion?.config && (
                <Button disabled={locked} onClick={() => setConfig(queue.poolConversion!.config!)}>
                  Принять предложенное преобразование для редактирования
                </Button>
              )}
              <Button
                disabled={locked}
                onClick={() =>
                  patch({
                    pools: newPools(),
                    conditions: [],
                    game: config.conditions[0]?.game ?? config.game,
                  })
                }
              >
                Настроить пулы вручную
              </Button>
            </Stack>
          )}
          {validation.length > 0 && <Alert severity="warning"><ul style={{margin:0,paddingLeft:18}}>{validation.map(message=><li key={message}>{message}</li>)}</ul></Alert>}
        </EditorSections></div>
      )}
      {tab === 1 && (
        <>
          <Section title={`В очереди: ${live?.queue.length ?? '—'}`}>
            {live?.queue.length ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Пилот</TableCell>
                      <TableCell>Начало поиска</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {live.queue.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <Button component="a" href={`/users?userId=${ticket.participantId}`}>
                            Пилот №{ticket.participantId}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {displayDateTime(ticket.queuedAt)}
                          <Typography variant="body2">
                            {ticket.waitingSeconds} сек. ожидания
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">Очередь пуста.</Typography>
            )}
          </Section>
          {rows(live?.matches ?? [])}
        </>
      )}
      {tab === 2 && (
        <>
          {rows(races)}
          <FixedTablePagination
            count={total}
            page={page - 1}
            rowsPerPage={20}
            onPageChange={(next) => setPage(next + 1)}
          />
        </>
      )}
      {tab === 3 && <MatchmakingAnalytics data={analytics}/>}
    </Page>
  );
}

export const disciplineOptions = [{ value: 'touge', label: 'Тоге' }];
