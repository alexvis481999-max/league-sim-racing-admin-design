import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../shared/api';
import type { AccessGrantRecord, AccessRole, OrganizerRecord, OrganizerSettings } from '../../shared/access-types';
import type { Tone } from '../../ui/v16';

export const defaultSettings: OrganizerSettings = { maxEvents: null, maxRaceEvents: null, maxConcurrentEvents: null, maxConcurrentRaces: null, quotaEnforcementMode: 'block', allowedEventRuntimeTypes: [], allowedTougeSubtypes: [], allowedTougeDuelEntryModes: [], theme: null, websiteUrl: null, discordUrl: null };
export type OrganizerDraft = Pick<OrganizerRecord, 'code' | 'name' | 'description' | 'active' | 'settings'> & { id?: string; version?: string; presentationOnly?: boolean };
export type GrantDraft = Omit<AccessGrantRecord, 'id' | 'version' | 'revokedAt' | 'status'> & { id?: string; version?: string };
export const quotaFields = [
  ['maxEvents', 'Всего событий', 'events'], ['maxRaceEvents', 'Всего гонок', 'raceEvents'],
  ['maxConcurrentEvents', 'Одновременно событий', 'activeEvents'], ['maxConcurrentRaces', 'Одновременно гонок', 'activeRaces'],
] as const;
export const typeOptions = [{ value: 'single', label: 'Разовая гонка' }, { value: 'championship', label: 'Чемпионат' }, { value: 'weekly', label: 'Викли' }, { value: 'practice', label: 'Практика' }, { value: 'time_attack', label: 'Тайм-аттак' }, { value: 'touge', label: 'Тоге' }];
export const subtypeOptions = [{ value: 'time_attack', label: 'Тайм-аттак' }, { value: 'duel', label: 'Дуэль' }, { value: 'tournament', label: 'Турнир' }];
export const entryOptions = [{ value: 'manual', label: 'Ручные дуэли' }, { value: 'matchmaking', label: 'Матчмейкинг' }];
export const eventTypeName = (value: string) => typeOptions.find(option => option.value === value)?.label ?? value;
export const quotaModeName = (mode: OrganizerSettings['quotaEnforcementMode']) => mode === 'warn' ? 'Предупреждать' : 'Блокировать';
/** `null` limit means "no limit", never "0 allowed". */
export const limitLabel = (value: number | null) => value === null ? 'Без ограничения' : String(value);

export type AccessUser = { userId: string; steamId?: string; presentation: { displayName: string; avatarUrl?: string } };
export type GrantChange = { id: string; actorId: string; at: string; before: AccessGrantRecord | null; after: AccessGrantRecord };
export const scopeNames = { platform: 'Вся платформа', organizer: 'Организатор', event: 'Событие' };
export const statusNames = { active: 'Действует', scheduled: 'Запланирован', expired: 'Истёк', revoked: 'Отозван' };
export const statusTones: Record<string, Tone> = { active: 'done', scheduled: 'live', expired: 'scheduled', revoked: 'failed' };
/** Server status wins; old projections without `status` fall back to `revokedAt`, never to calendar time. */
export const grantStatus = (row: AccessGrantRecord) => row.status ?? (row.revokedAt ? 'revoked' : 'active');

const errors: Record<string, string> = { last_platform_owner: 'Нельзя убрать последнего действующего бессрочного владельца платформы.', version_conflict: 'Запись уже изменена. Закройте форму, обновите список и откройте её заново.', version_required: 'Не получена версия записи. Обновите список.', grant_revoked: 'Отозванный доступ нельзя редактировать. Выдайте новый.', access_denied: 'Недостаточно прав для этого действия.', organizer_code_exists: 'Этот код организатора уже занят.' };
export function errorMessage(error: unknown) {
  if (error instanceof ApiError) { try { return errors[JSON.parse(error.bodyText ?? '{}').error?.code] ?? error.message; } catch { return error.message; } }
  return error instanceof Error ? error.message : 'Не удалось выполнить операцию';
}
export const errorStatus = (error: unknown) => error instanceof ApiError ? error.status : null;

export function scopeLabel(row: Pick<AccessGrantRecord, 'scopeType' | 'scopeId'>, organizers: OrganizerRecord[]) {
  return row.scopeType === 'platform' ? scopeNames.platform : row.scopeType === 'organizer' ? organizers.find(item => item.id === row.scopeId)?.name ?? 'Организатор #' + row.scopeId : 'Событие #' + row.scopeId;
}
export const roleTitle = (code: string, roles: AccessRole[]) => roles.find(item => item.code === code)?.title ?? code;

/**
 * Serialised commands of one screen: a single command at a time, `Idempotency-Key` reused for the same unconfirmed
 * request (path, method, body, version), `If-Match` from the displayed record version.
 */
export function useCommands() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const lock = useRef(false), alive = useRef(true), keys = useRef(new Map<string, string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const command = (path: string, method: string, body: unknown, version?: string): RequestInit => {
    const fingerprint = JSON.stringify([path, method, body, version]);
    const id = keys.current.get(fingerprint) ?? crypto.randomUUID(); keys.current.set(fingerprint, id);
    return { method, headers: { 'Idempotency-Key': id, ...(version ? { 'If-Match': version } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { if (alive.current) setError(errorMessage(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return { busy, error, notice, setError, setNotice, command, run, confirmed: () => keys.current.clear(), alive };
}
