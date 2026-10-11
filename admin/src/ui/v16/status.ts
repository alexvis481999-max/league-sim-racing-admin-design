/** Badge colour is a UI rule over server status codes; the server label is always the visible text. */
export type Tone = 'live' | 'done' | 'failed' | 'scheduled' | 'current';
export type StatusLike = { code: string; label: string; freshness?: 'CURRENT' | 'UNCERTAIN'; reason?: { code: string; message: string } | null };

const blockTones: Record<string, Tone> = {
  COMPLETED: 'done', FINISHED: 'done', READY: 'done', ACCEPTED: 'done',
  RUNNING: 'live', OPEN: 'live', PRACTICE: 'live', QUALIFYING: 'live', QUALIFICATION: 'live', RACE: 'live', RACE_1: 'live', RACE_2: 'live', DUEL: 'live',
  PREPARING: 'live', STARTING: 'live', REQUESTED: 'live', PROCESSING: 'live', FINISHING: 'live',
  FAILED: 'failed', UNAVAILABLE: 'failed', REJECTED: 'failed', DISQUALIFIED: 'failed',
  UNKNOWN: 'current', WAITING_CAPACITY: 'current', PENDING_REVIEW: 'current',
  SCHEDULED: 'scheduled', PENDING: 'scheduled', WAITING: 'scheduled', STOPPED: 'scheduled', CLOSED: 'scheduled', SKIPPED: 'scheduled', CANCELLED: 'scheduled', NOT_RUN: 'scheduled', BYE: 'scheduled', TIED: 'scheduled', WITHDRAWN: 'scheduled', REMOVED: 'scheduled', EXPIRED: 'scheduled',
};
/** Stage, race, session, registration and result projections (viewer badges in v16). */
export function blockTone(status: StatusLike | null | undefined): Tone {
  if (!status) return 'scheduled';
  if (status.freshness === 'UNCERTAIN') return 'current';
  return blockTones[status.code] ?? 'scheduled';
}

const eventTones: Record<string, Tone> = {
  RUNNING: 'live', FINISHING: 'live', OPEN: 'live',
  SCHEDULED: 'scheduled', PUBLISHED: 'scheduled', WAITING: 'scheduled',
  COMPLETED: 'done',
  DRAFT: 'current', UNKNOWN: 'current',
  FAILED: 'failed', CANCELLED: 'failed',
};
/** Event-level status in lists (v16 event index pills). */
export function eventTone(status: StatusLike | null | undefined): Tone {
  if (!status) return 'scheduled';
  if (status.freshness === 'UNCERTAIN') return 'current';
  return eventTones[status.code] ?? 'scheduled';
}

/** Generic module records: success / info / warning / error / neutral. */
export function recordTone(code: string | null | undefined, map: Record<string, Tone>, fallback: Tone = 'scheduled'): Tone {
  return (code && map[code]) || fallback;
}
