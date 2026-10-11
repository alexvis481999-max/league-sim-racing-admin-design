import { apiFetch } from '../../../shared/api';
import type {EventDisplayStatus,DisplayStatus,StatusGroup} from '../../../../../shared/event-status';
export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
export type Settings = { [key: string]: Value };
export type Action = { code: string; enabled: boolean; reason: { code: string; message: string } | null };
export type EventSummary = { displayStatus:EventDisplayStatus; observedAt:string; displaySchedule: import('../../../../../shared/public-event').DisplaySchedule|null; scenarioTitle?:string; organizerId: string; timezone: string; gameCode: string; disciplineCode: string; presentation?: { coverUrl: string | null; subtitle: string | null; cardAppearance?: Record<string, unknown> | null } | null; id: string; title: string; status: string; scenarioCode: string; version: string; startsAt: string; endsAt: string; description: string | null; actions: Action[] };
export type Workspace = { eventId: string; version: string; event: EventSummary; settings: Settings | null; actions: Action[]; editableFields: string[];
  state: { displayStatus:EventDisplayStatus; stopState: string; blocks: { progress:import('../../../../../shared/event-status').ProgressView[]; plannedStartsAt:string;estimatedEndsAt:string|null;startedAt:string|null;finishedAt:string|null; displayStatus:DisplayStatus;group:StatusGroup; key: string; title: string; status: string; scheduledStartsAt?: string; startsAt?: string; sessions: { id: string; status: string;displayStatus:DisplayStatus }[] }[] };
  registrations: { displayStatus:DisplayStatus; key: string; status: string; config: { mode: string; closesAt: string; withdrawalClosesAt: string }; actions: Action[]; entries: { id: string; participantId: string; displayName?: string; status: string; actions: Action[] }[] }[];
  results: { displayStatus:DisplayStatus; id: string; key: string; status: string; revisionNumber: number; payload: Value }[] };
export const command = <T,>(path: string, body: unknown, key: string, method = 'POST') => apiFetch<T>(path, { method, body: JSON.stringify(body), headers: { 'Idempotency-Key': key } });

