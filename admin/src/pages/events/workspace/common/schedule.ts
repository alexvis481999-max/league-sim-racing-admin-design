import type { DisplayStatus, ProgressView, StatusGroup } from '../../../../../../shared/event-status';

/** Runtime session as returned inside schedule blocks (runtime record + displayStatus). Extra server fields are preserved. */
export type RuntimeSession = {
  id: string; status: string; displayStatus: DisplayStatus;
  serverId?: string | null; requestedAt?: string | null; startedAt?: string | null; stoppedAt?: string | null;
  connectedPlayers?: number | null; connectionLostAt?: string | null; recoveryDeadlineAt?: string | null; stopCause?: string | null;
  phase?: { code: string; observedAt: string; effectiveAt: string | null } | null; failure?: { code: string } | null;
  [key: string]: unknown;
};
/** Item of GET …/workspace/schedule (api-reference/workspace-schedule, "Точная проекция блока"). */
export type ScheduleBlock = {
  id: string; key: string; title: string; type: string; status: string; executionId: string | null;
  plannedStartsAt: string; estimatedEndsAt: string | null; startedAt: string | null; finishedAt: string | null;
  actualParticipantIds: string[]; displayStatus: DisplayStatus; group: StatusGroup;
  progress: ProgressView[]; resultIds: string[]; sessions: RuntimeSession[];
};
export type RegistrationWindow = { key: string; config: { mode?: string; capacity?: number | null; opensAt?: string | null; closesAt: string; withdrawalClosesAt?: string; blockKey?: string }; displayStatus: DisplayStatus };
export type ScheduleResponse = { items: ScheduleBlock[]; nextAfterId: string | null; registrations: RegistrationWindow[]; dependencies: unknown };

const phaseOrder: Record<string, number> = { REQUESTED: 1, PREPARING: 1, STARTING: 1, WAITING_CAPACITY: 1, PRACTICE: 2, QUALIFYING: 3, QUALIFICATION: 3, RACE: 4, RACE_1: 4, RACE_2: 4, RUNNING: 4, FINISHING: 5, PROCESSING: 5, FINISHED: 5, COMPLETED: 5 };
export type Step = { key: 'server' | 'practice' | 'qualifying' | 'race' | 'results'; label: string; state: 'done' | 'running' | 'failed' | 'pending' };

/**
 * Phase steps of a race block derived only from server statuses of the block and its split sessions
 * (never from the planned time). Phases absent from the stored settings can be hidden by the caller.
 */
export function raceSteps(block: ScheduleBlock): Step[] {
  const base: Step[] = [
    { key: 'server', label: 'Резервирование сервера', state: 'pending' },
    { key: 'practice', label: 'Практика', state: 'pending' },
    { key: 'qualifying', label: 'Квалификация', state: 'pending' },
    { key: 'race', label: 'Гонка', state: 'pending' },
    { key: 'results', label: 'Результаты', state: 'pending' },
  ];
  const code = block.displayStatus.code;
  if (code === 'COMPLETED') return base.map((s) => ({ ...s, state: 'done' }));
  const codes = [code, ...block.progress.map((p) => p.displayStatus?.code ?? p.status), ...block.sessions.map((s) => s.phase?.code ?? s.displayStatus.code)];
  const reached = Math.max(0, ...codes.map((c) => phaseOrder[c] ?? 0));
  if (!reached && !block.startedAt) return base;
  const failed = code === 'FAILED';
  return base.map((s, i) => {
    const position = i + 1;
    if (position < reached) return { ...s, state: 'done' };
    if (position === reached) return { ...s, state: failed ? 'failed' : 'running' };
    return s;
  });
}
