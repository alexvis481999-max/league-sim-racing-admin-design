import type { GameConfig } from '../../features/standalone/GameFields';
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
