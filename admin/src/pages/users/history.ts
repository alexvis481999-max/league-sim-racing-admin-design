import type { ReactNode } from 'react';
import { dateTime, type Tone } from '../../ui/v16';

/** Pure helpers of the pilot history tables: field access, display values and status labels/tones. */
export type HistoryRow = Record<string, unknown>;
export const field = (row: HistoryRow, path: string): unknown => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as HistoryRow)[key] : undefined, row);
export const display = (value: unknown): string => value === null || value === undefined || value === '' ? '—' : typeof value === 'object' ? '—' : String(value);
/** Display-only date in the viewer zone; `null`/invalid → «—». */
export const date = (value: unknown) => typeof value === 'string' ? dateTime(value) : '—';
const labels: Record<string, string> = { ACCEPTED: 'Принят', PENDING: 'Ожидает', REJECTED: 'Отклонён', WITHDRAWN: 'Снялся', REMOVED: 'Удалён', QUEUED: 'В очереди', MATCHED: 'Матч найден', LEFT: 'Вышел', COMPLETED: 'Завершено', FAILED: 'Ошибка', CANCELLED: 'Отменено', READY_CHECK: 'Проверка готовности', STARTING: 'Запуск', RUNNING: 'Идёт', FINISHED: 'Завершено', CLASSIFIED: 'Финиш', DNF: 'Не финишировал', DSQ: 'Дисквалификация', DISCONNECTED: 'Отключился', CONNECTED: 'Подключился', active: 'Активно', scheduled: 'Запланировано', revoked: 'Отозвано', expired: 'Истекло', platform: 'Платформа', organizer: 'Организатор', event: 'Событие', submitted: 'Подана', under_review: 'Рассматривается', needs_info: 'Нужны сведения', resolved: 'Решена', rejected: 'Отклонена', withdrawn: 'Отозвана', duplicate: 'Повторная', public_chat_mute: 'Мут общего чата', global_chat_mute: 'Мут всех чатов', event_ban: 'Запрет участия в событии', organizer_ban: 'Запрет у организатора', matchmaking_ban: 'Запрет матчмейкинга', competition_ban: 'Запрет соревнований', available: 'Доступен', inactive: 'Неактивен', blocked: 'Заблокирован', deleted: 'Удалён', user: 'Сайт', admin: 'Админка', APPLIED: 'Начисление', REVERSED: 'Отмена начисления', CORRECTION: 'Коррекция', read: 'Прочитано', unread: 'Не прочитано' };
export const status = (value: unknown) => labels[String(value)] ?? display(value);
export const tones: Record<string, Tone> = {
  ACCEPTED: 'done', COMPLETED: 'done', FINISHED: 'done', CLASSIFIED: 'done', resolved: 'done', available: 'done', APPLIED: 'done', read: 'done',
  QUEUED: 'live', MATCHED: 'live', RUNNING: 'live', STARTING: 'live', CONNECTED: 'live', submitted: 'live', under_review: 'live', active: 'live',
  PENDING: 'current', scheduled: 'current', READY_CHECK: 'current', needs_info: 'current', CORRECTION: 'current', unread: 'current',
  REJECTED: 'failed', FAILED: 'failed', DNF: 'failed', DSQ: 'failed', rejected: 'failed', blocked: 'failed', REVERSED: 'failed',
};
export type Column = { title: string; key?: string; render?(row: HistoryRow): ReactNode; className?: string };
