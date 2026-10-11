import type { AdminAccess, AnyRecord } from './types';

export function uuid() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value: string) {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const converted = value.toLowerCase().split('').map((char) => map[char] ?? char).join('');
  return converted.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || `item-${Date.now()}`;
}

export function parseJsonObject(value: string, label: string): AnyRecord {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label}: нужен JSON object`);
  }
  return parsed as AnyRecord;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const parts = moscowDateTimeParts(date);
  const current = moscowDateTimeParts(new Date());
  const { day, month, year, hour: hours, minute: minutes } = parts;
  const sameYear = year === current.year;
  return `${day}.${month}${sameYear ? '' : `.${year}`} ${hours}:${minutes}`;
}

function moscowDateTimeParts(date: Date): Record<'day' | 'month' | 'year' | 'hour' | 'minute', string> {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<'day' | 'month' | 'year' | 'hour' | 'minute', string>;
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function hasAny(access: AdminAccess | null, permissions: string[]) {
  if (!access) return false;
  return access.grants.some(grant => permissions.some(permission => grant.permissions.includes(permission)));
}
