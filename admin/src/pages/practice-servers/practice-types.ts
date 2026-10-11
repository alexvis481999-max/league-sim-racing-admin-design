import type { GameConfig } from '../../features/standalone/GameFields';
import type { Tone } from '../../ui/v16';
import { displayRuntimeStatus } from '../../../../shared/presentation';
export type Config = {
  organizerId: string;
  title: string;
  description: string | null;
  coverImageId: string | null;
  timezone: string;
  gameCode: string;
  disciplineCode: string;
  sessionDurationMinutes: number;
  extraDelaySeconds: number;
  game: GameConfig;
  practice: { durationMinutes: number; maxParticipants: number };
};
export type Cycle = {
  executionId: string;
  state: string;
  runtimeSessionId: string | null;
  resourceState: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  connectionLostAt?: string | null;
  failure: { code: string } | null;
};
export type Server = {
  id: string;
  config: Config;
  configVersion: number;
  status: string;
  currentCycle: Cycle | null;
  lastCycle: Cycle | null;
  nextEligibleAt: string | null;
  allowedActions: Record<string, boolean>;
};
export type PracticeAction = 'start' | 'pause' | 'stop' | 'restart';

export function practiceServerStatus(s: Pick<Server, 'status' | 'currentCycle'>) {
  if (s.currentCycle?.resourceState === 'STOPPING')
    return { label: 'Останавливается', color: 'warning' };
  if (s.currentCycle?.resourceState === 'UNKNOWN')
    return { label: 'Связь уточняется', color: 'warning' };
  if (s.currentCycle?.failure) return { label: 'Ошибка цикла', color: 'error' };
  if (s.currentCycle?.resourceState === 'RUNNING')
    return { label: 'Сервер работает', color: 'success' };
  if (s.status === 'FAILED') return { label: 'Ошибка сервера', color: 'error' };
  return {
    label:
      s.status === 'STOPPED'
        ? 'Остановлен'
        : s.status === 'PAUSED'
          ? 'На паузе'
          : 'Ожидание запуска',
    color: 'default',
  };
}

/** Badge colour of the observed server state (UI rule over practiceServerStatus). */
export function practiceTone(s: Pick<Server, 'status' | 'currentCycle'>): Tone {
  const { color } = practiceServerStatus(s);
  if (color === 'success') return 'done';
  if (color === 'warning') return 'current';
  if (color === 'error') return 'failed';
  return s.status === 'PAUSED' ? 'current' : s.status === 'ACTIVE' ? 'live' : 'scheduled';
}

/** The server keeps cycling or still finishes the current cycle: the power command is "stop", otherwise "start". */
export function isPowered(s: Pick<Server, 'status' | 'currentCycle'>) {
  return s.status === 'ACTIVE' || (!!s.currentCycle && s.status !== 'STOPPED');
}

const cycleLabels: Record<string, string> = { CANCELLED: 'Отменён', REQUESTED: 'Запрошен', WAITING_CAPACITY: 'Ожидает сервер' };
export const cycleStateLabel = (code: string) => cycleLabels[code] ?? displayRuntimeStatus(code);
const cycleTones: Record<string, Tone> = { RUNNING: 'live', STARTING: 'live', PREPARING: 'live', REQUESTED: 'live', COMPLETED: 'done', FINISHED: 'done', FAILED: 'failed', UNKNOWN: 'current', STOPPING: 'current', WAITING_CAPACITY: 'current' };
export const cycleTone = (c: Cycle): Tone => (c.failure ? 'failed' : cycleTones[c.state] ?? 'scheduled');

export const disciplineLabel = (code: string) => ({ touge: 'Тоге', circuit: 'Кольцевые гонки' } as Record<string, string>)[code] ?? code;
export const gameLabel = (code: string) => (code === 'assetto_corsa' ? 'Assetto Corsa' : code);
export const autostartLabel = (status: string) => (status === 'ACTIVE' ? 'Включён' : status === 'PAUSED' ? 'На паузе' : 'Выключен');
