import type { DisplayStatus, StatusGroup } from '../../../../../shared/event-status';
import { localDateKey } from '../../../ui/v16';

/** One block of WorkspaceSummary.program as returned by event-workspace.service.ts (summary). */
export type ProgramBlock = {
  key: string; title: string; type: string;
  group?: StatusGroup; displayStatus?: DisplayStatus;
  startsAt: string; endsAt: string | null; startedAt?: string | null; finishedAt?: string | null;
  track: string | null; cars: string[];
};
export type ProgramGroup = {
  key: string; title: string; kind: string | null; index: number;
  blocks: ProgramBlock[];
  firstStartsAt: string | null; lastStartsAt: string | null; lastEndsAt: string | null;
  tracks: string[]; total: number; completed: number; live: number; failed: number; uncertain: number; closed: number;
  state: GroupState;
};
export type GroupState = 'live' | 'done' | 'done-with-errors' | 'scheduled' | 'uncertain';

const FINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED']);
const WAITING = new Set(['SCHEDULED', 'WAITING']);
export const isFinal = (b: ProgramBlock) => !!b.displayStatus && FINAL.has(b.displayStatus.code);
export const isWaiting = (b: ProgramBlock) => !b.displayStatus || WAITING.has(b.displayStatus.code);
/** Started according to server status (not according to the calendar). */
export const isLive = (b: ProgramBlock) => !!b.displayStatus && !FINAL.has(b.displayStatus.code) && !WAITING.has(b.displayStatus.code);
export const isUncertain = (b: ProgramBlock) => b.displayStatus?.freshness === 'UNCERTAIN';

const byStart = (a: ProgramBlock, b: ProgramBlock) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.key.localeCompare(b.key);
const groupNumber = (key: string) => Number(/(\d+)$/.exec(key)?.[1] ?? NaN);

/**
 * Explicit aggregation of a week/stage: the API has no summary status for a group.
 * live — at least one block started and is not final; done — every block final; otherwise scheduled.
 */
function groupState(blocks: ProgramBlock[]): GroupState {
  if (blocks.some(isUncertain)) return 'uncertain';
  if (blocks.some(isLive)) return 'live';
  if (blocks.length && blocks.every(isFinal)) return blocks.some((b) => b.displayStatus?.code === 'FAILED') ? 'done-with-errors' : 'done';
  return 'scheduled';
}
export const groupStateLabel: Record<GroupState, string> = { live: 'Идёт', done: 'Завершена', 'done-with-errors': 'Завершена с ошибками', scheduled: 'По плану', uncertain: 'Состояние уточняется' };
/** Russian grammatical gender follows the group kind (неделя / этап / раунд). */
export function groupStateText(state: GroupState, kind: string | null) {
  if (kind === 'WEEK' || kind === null) return groupStateLabel[state];
  return ({ live: 'Идёт', done: 'Завершён', 'done-with-errors': 'Завершён с ошибками', scheduled: 'По плану', uncertain: 'Состояние уточняется' } as Record<GroupState, string>)[state];
}
export const groupStateTone: Record<GroupState, 'live' | 'done' | 'failed' | 'scheduled' | 'current'> = { live: 'live', done: 'done', 'done-with-errors': 'done', scheduled: 'scheduled', uncertain: 'current' };

/** Groups by the server group.key; blocks without a group stay in their own bucket instead of being merged into a week. */
export function groupProgram(program: ProgramBlock[] | undefined, ungroupedTitle = 'Без группы'): ProgramGroup[] {
  const buckets = new Map<string, { group: StatusGroup; blocks: ProgramBlock[] }>();
  for (const block of program ?? []) {
    const key = block.group?.key ?? '__none';
    const bucket = buckets.get(key) ?? { group: block.group ?? null, blocks: [] };
    bucket.blocks.push(block);
    buckets.set(key, bucket);
  }
  const groups = [...buckets.entries()].map(([key, { group, blocks }]) => {
    const sorted = [...blocks].sort(byStart);
    const tracks = [...new Set(sorted.map((b) => b.track).filter((t): t is string => !!t))];
    return {
      key, title: group?.title ?? ungroupedTitle, kind: group?.kind ?? null, index: 0, blocks: sorted,
      firstStartsAt: sorted[0]?.startsAt ?? null, lastStartsAt: sorted.at(-1)?.startsAt ?? null,
      lastEndsAt: sorted.map((b) => b.endsAt ?? b.startsAt).sort().at(-1) ?? null,
      tracks, total: sorted.length,
      completed: sorted.filter((b) => b.displayStatus?.code === 'COMPLETED').length,
      live: sorted.filter(isLive).length,
      failed: sorted.filter((b) => b.displayStatus?.code === 'FAILED').length,
      uncertain: sorted.filter(isUncertain).length,
      closed: sorted.filter(isFinal).length,
      state: groupState(sorted),
    };
  });
  // Numbered server keys (week-3, stage-2) keep their numeric order; others follow the first start.
  groups.sort((a, b) => {
    const na = groupNumber(a.key), nb = groupNumber(b.key);
    if (a.key === '__none' || b.key === '__none') return a.key === '__none' ? 1 : -1;
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return Date.parse(a.firstStartsAt ?? '') - Date.parse(b.firstStartsAt ?? '');
  });
  return groups.map((g, i) => ({ ...g, index: i }));
}

/** The group containing the server's current stage, otherwise the first group that is not finished. */
export function currentGroup(groups: ProgramGroup[], currentStageKey: string | null | undefined) {
  return groups.find((g) => g.blocks.some((b) => b.key === currentStageKey)) ?? groups.find((g) => g.state !== 'done' && g.state !== 'done-with-errors') ?? groups.at(-1) ?? null;
}

export type DayGroup = { key: string; firstStartsAt: string; blocks: ProgramBlock[] };
/** Calendar days of the event time zone (never the UTC date of the ISO string). */
export function blocksByDay(blocks: ProgramBlock[], timeZone: string): DayGroup[] {
  const days = new Map<string, ProgramBlock[]>();
  for (const block of [...blocks].sort(byStart)) {
    const key = localDateKey(block.startsAt, timeZone);
    days.set(key, [...(days.get(key) ?? []), block]);
  }
  return [...days.entries()].map(([key, list]) => ({ key, firstStartsAt: list[0].startsAt, blocks: list }));
}

export function blockNumberInGroup(group: ProgramGroup | null, key: string) {
  return group ? group.blocks.findIndex((b) => b.key === key) + 1 : 0;
}
