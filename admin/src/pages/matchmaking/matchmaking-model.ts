/** Matchmaking API shapes (ADMIN_API_MAP.md «Матчмейкинг») and pure helpers shared by the section views. */
import { defaultGame, type GameConfig } from '../../features/standalone/GameFields';
import type { WeatherConfig } from '../../features/standalone/WeatherFields';
import { displayMatchStatus } from '../../../../shared/presentation';
import type { Tone } from '../../ui/v16';

export type Pools = {
  version: 1;
  carIds: string[];
  carSetCode?: string;
  offerCount: 2 | 3 | 4 | 'all';
  readyTimeoutSeconds: number;
  minimumPilotLicense: 'D' | 'C' | 'B' | 'A';
  tiePolicy: 'double_loss' | 'omt';
  tracks: {
    key: string;
    title: string;
    code: string;
    layoutCode: string | null;
    enabled: boolean;
    weight: number;
    durationMinutes: number;
    carIds: string[];
    weatherKeys: string[];
  }[];
  weather: {
    key: string;
    title: string;
    enabled: boolean;
    weight: number;
    codes: string[];
    weather: WeatherConfig;
  }[];
};
export type PoolTrack = Pools['tracks'][number];
export type PoolWeather = Pools['weather'][number];

export type Condition = { key: string; title: string; trackTitle: string; weatherTitle: string; game: GameConfig };
export type Config = {
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
  rating: { mode: 'none' | 'result' | 'NONE' | 'RESULT'; pilotMultiplier?: number; safetyMultiplier?: number };
};
export type Queue = { id: string; version: number; enabled: boolean; config: Config; poolConversion?: { config: Config | null; issues: string[] } };

type Heat = { heatNumber: number; attemptNumber: number; leaderId: string; chaserId: string; winnerId: string | null; status: string; adjustedGapMs: number | null };
export type MatchResultDetail = { winnerId?: string | null; resolution?: string; roundsWon?: Record<string, number>; rounds?: { roundNumber: number; kind: string; winnerId: string | null; heats: Heat[] }[] };
export type Match = {
  id: string;
  status: string;
  failure: string | null;
  condition: Omit<Condition, 'game'> & { game?: GameConfig; pool?: { durationMinutes: number } };
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  runtimeSessionId?: string | null;
  runtimeStatus?: string | null;
  serverId?: string | null;
  runtimeFailure?: { code: string; message: string | null } | null;
  readyDeadlineAt?: string;
  players: { id: string; name: string; ready: boolean; selection?: { carId: string; skinId: string | null } | null }[];
  resultId: string | null;
  result: MatchResultDetail | null;
};
export type Ticket = { id: string; participantId: string; queuedAt: string; waitingSeconds: number };
export type Live = {
  readiness?: { code: string; label: string; action: string | null; availableConditions: number };
  queue: Ticket[];
  matches: Match[];
};
export type RacesPage = { items: Match[]; total: number };
export type ConditionStats = { key: string; title: string; matches: number; finished: number; share: number };
export type MatchmakingAnalyticsData = {
  matches?: number;
  finished?: number;
  failed?: number;
  cancelled?: number;
  uniquePilots?: number;
  tracks?: ConditionStats[];
  weather?: ConditionStats[];
  cars?: { key: string; title: string; selections: number; finished: number; wins: number; share: number; winRate: number | null }[];
};

export const RACES_PAGE_SIZE = 20;
export const disciplineOptions = [{ value: 'touge', label: 'Тоге' }];

export const newPools = (): Pools => ({
  version: 1,
  carIds: [],
  offerCount: 2,
  readyTimeoutSeconds: 120,
  minimumPilotLicense: 'D',
  tiePolicy: 'double_loss',
  tracks: [],
  weather: [],
});

export const initialConfig = (): Config => ({
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

/** Body of PUT /config and POST /admin/matchmaking: pools replace the legacy conditions; tyres out stays unlimited. */
export function configForSave(config: Config): Config {
  return {
    ...config,
    game: {
      ...config.game,
      simulation: { ...config.game.simulation, allowedTyresOut: -1 },
      assists: {
        ...config.game.assists,
        autoClutchAllowed: config.game.assists.autoClutchAllowed ?? true,
        tyreBlanketsAllowed: config.game.assists.tyreBlanketsAllowed ?? true,
      },
    },
    conditions: [],
  };
}

export const ratingEnabled = (config: Config) => !['NONE', 'none'].includes(config.rating.mode);

export function selectionProbability(weight: number, weights: number[]) {
  const total = weights.reduce((sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0), 0);
  return total && Number.isFinite(weight) && weight > 0 ? Math.round((weight / total) * 1000) / 10 : 0;
}
export const trackProbability = (pools: Pools, track: PoolTrack) =>
  track.enabled ? selectionProbability(track.weight, pools.tracks.filter((t) => t.enabled).map((t) => t.weight)) : 0;
export function weatherProbability(pools: Pools, track: PoolTrack, key: string) {
  const allowed = pools.weather.filter((w) => w.enabled && track.weatherKeys.includes(w.key));
  return selectionProbability(allowed.find((w) => w.key === key)?.weight ?? 0, allowed.map((w) => w.weight));
}
/** A track subpool is short when it cannot offer the configured number of cars. */
export const subpoolShort = (pools: Pools, track: PoolTrack) =>
  !track.carIds.length || (pools.offerCount !== 'all' && track.carIds.length < pools.offerCount);

/** Changing the global pool also removes dangling references, visibly leaving invalid short subpools for correction. */
export function changeCommonCars(value: Pools, carIds: string[], carSetCode?: string): Pools {
  return { ...value, carIds, carSetCode, tracks: value.tracks.map((t) => ({ ...t, carIds: t.carIds.filter((id) => carIds.includes(id)) })) };
}

/* ---------- match presentation ---------- */
export const matchStatusLabel = (match: Match) =>
  match.status === 'FAILED' && !match.startedAt ? 'Ошибка запуска' : match.runtimeStatus === 'WAITING_CAPACITY' ? 'Ожидает сервер' : displayMatchStatus(match.status);
const matchTones: Record<string, Tone> = { RUNNING: 'live', STARTING: 'live', READY_CHECK: 'current', FINISHED: 'done', FAILED: 'failed', CANCELLED: 'scheduled' };
export const matchTone = (match: Match): Tone => (match.runtimeStatus === 'WAITING_CAPACITY' ? 'current' : matchTones[match.status] ?? 'scheduled');
export const playerName = (match: Match, id: string | null | undefined) => match.players.find((p) => p.id === id)?.name ?? '—';
export const matchWinner = (match: Match) => match.players.find((p) => p.id === match.result?.winnerId)?.name;
export const matchPlayers = (match: Match) => match.players.map((p) => p.name).join(' vs ') || '—';
/** Rounds score only when the official result carries rounds for both pilots. */
export const matchScore = (match: Match) =>
  match.result?.rounds?.length && match.players.length === 2 && match.players.every((p) => typeof match.result?.roundsWon?.[p.id] === 'number')
    ? match.players.map((p) => match.result!.roundsWon![p.id]).join(' : ')
    : null;
export function matchOutcome(match: Match) {
  const winner = matchWinner(match), score = matchScore(match);
  if (winner) return `Победа: ${winner}${score ? ` · ${score}` : ''}`;
  return match.result ? 'Без победителя' : 'Результата нет';
}
export const conditionLine = (match: Match) =>
  [match.condition.trackTitle, match.condition.weatherTitle, match.condition.pool ? `${match.condition.pool.durationMinutes} мин` : null].filter(Boolean).join(' · ');
export const heatStatusLabels: Record<string, string> = { COMPLETED: 'Без победителя', NOT_RUN: 'Не проводился', FAILED: 'Ошибка', CANCELLED: 'Отменён', DISQUALIFIED: 'Дисквалификация' };

/** 138 → 2:18 (waiting time of a queue ticket). */
export function waitClock(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function durationText(match: Match) {
  if (!match.startedAt || !match.finishedAt) return null;
  const seconds = Math.max(0, Math.round((Date.parse(match.finishedAt) - Date.parse(match.startedAt)) / 1000));
  return `${Math.floor(seconds / 60)} мин ${seconds % 60} с`;
}
