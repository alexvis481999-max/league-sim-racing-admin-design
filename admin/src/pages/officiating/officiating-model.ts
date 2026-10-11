import type { Tone } from '../../ui/v16';

export type Report = {
  replayUploadId?: string; id: string; status: string; reason: string; submittedById: string; accusedId: string | null; incidentLocation: string; videoUrl: string | null;
  createdAt?: string;
  context: { eventId?: string; source: { id: string }; participantIds: string[] };
  comments?: { id: string; authorId: string; body: string; createdAt: string }[];
};
export type ReportHistory = { at: string; reason: string; to: string }[];
export type Decision = {
  id: string; status: string; version: string; reason: string; source: { id: string };
  effect: { type: string; participantId?: string; target?: { type: string; splitIndex?: number; occurrence?: number }; milliseconds?: number; participantIds?: string[]; winnerId?: string | null };
  supersedesDecisionId: string | null;
};
export type Rules = { rulesVersion: string; resultId: string; rules: { ruleCode: string; title: string; description: string; values: number[] }[] };
export type PageData<T> = { items: T[]; nextAfterId: string | null };
export type MatchOwner = { matchmakingId: string; matchId: string };

export const reportStatuses = ['submitted', 'under_review', 'needs_info', 'resolved', 'rejected', 'withdrawn', 'duplicate'] as const;
/** Moderation transitions offered for an open protest card (POST …/status). */
export const reportTransitions = ['under_review', 'needs_info', 'resolved', 'rejected', 'duplicate'] as const;
export const labels: Record<string, string> = {
  submitted: 'Отправлено', under_review: 'На рассмотрении', needs_info: 'Нужны сведения', resolved: 'Рассмотрено', rejected: 'Отклонено', withdrawn: 'Отозвано', duplicate: 'Дубликат',
  draft: 'Черновик', approved: 'Ожидает вынесения', applied: 'Вынесено', cancelled: 'Отменено', superseded: 'Заменено',
};
export const reportTones: Record<string, Tone> = { submitted: 'current', under_review: 'live', needs_info: 'current', resolved: 'done', rejected: 'failed' };
export const decisionTones: Record<string, Tone> = { submitted: 'current', approved: 'current', applied: 'done', cancelled: 'failed' };
/** Effect type of a stored decision → rule code of the penalty catalogue (used to reopen a draft in the form). */
export const effectRule: Record<string, string> = { NOTE: 'note', WARNING: 'warning', ADD_TIME_PENALTY: 'time_penalty', DISQUALIFY: 'disqualification', SET_MATCH_OUTCOME: 'match_outcome' };
const effectLabels: Record<string, string> = { NOTE: 'Замечание', WARNING: 'Предупреждение', ADD_TIME_PENALTY: 'Штраф времени', DISQUALIFY: 'Дисквалификация', SET_MATCH_OUTCOME: 'Исход матча' };

/** Display label of a stored effect: catalogue title when the rules are loaded, otherwise a fixed label, otherwise the server code. */
export function effectLabel(effect: Decision['effect'], rules: Rules | null) {
  const title = rules?.rules.find((r) => r.ruleCode === effectRule[effect.type])?.title ?? effectLabels[effect.type] ?? effect.type;
  return effect.milliseconds != null ? `${title} +${effect.milliseconds / 1000} с` : title;
}
export function targetLabel(target: Decision['effect']['target']) {
  if (!target) return '—';
  if (target.type === 'RESULT') return 'Результат целиком';
  return `Сплит ${target.splitIndex ?? '—'} · заезд ${target.occurrence ?? '—'}`;
}

/** Protest source id: `race:[resultId, split, occurrence]` or `res:[resultId, "matchmaking"?, matchId?]`. */
export function parseSource(id: string): { resultId: string; split?: string; occurrence?: string; matchId?: string } | null {
  try {
    const parts = JSON.parse(id.slice(id.startsWith('race:') ? 5 : 4)) as unknown[];
    if (!Array.isArray(parts) || parts[0] == null) return null;
    if (id.startsWith('race:')) return { resultId: String(parts[0]), split: String(parts[1]), occurrence: String(parts[2]) };
    return { resultId: String(parts[0]), ...(parts[1] === 'matchmaking' ? { matchId: String(parts[2]) } : {}) };
  } catch {
    return null;
  }
}
export function sourceLabel(id: string) {
  const s = parseSource(id);
  if (!s) return id;
  if (s.matchId) return `Матч №${s.matchId} · результат ${s.resultId}`;
  return s.split ? `Результат ${s.resultId} · сплит ${s.split} · заезд ${s.occurrence}` : `Результат ${s.resultId}`;
}

export const safeLink = (value: string | null) => {
  try {
    const u = new URL(value ?? '');
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
};
