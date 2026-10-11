import { getCatalogImageUrl } from '../../shared/api';
import { hasPlatformPermission, organizerIdsFor } from '../../shared/access';
import { slugify } from '../../shared/format';
import type { AccessOrganizer, AdminAccess, CatalogItem, CatalogKind, CatalogUsage } from '../../shared/types';
import type { Tone } from '../../ui/v16';

export type CatalogOwnerValue = 'platform' | 'official' | `organizer:${string}`;
export type CatalogForm = {
  code: string;
  title: string;
  owner: CatalogOwnerValue;
  description: string;
  tags: string[];
  metadata: string;
  status: CatalogItem['status'];
  carBrandCode: string;
  officialDlcCode: string;
};
export type CarBrand = { code: string; title: string; region: 'european' | 'american' | 'asian' };
export type OfficialDlc = { code: string; title: string; storeUrl: string };
export type ContentUploadSession = {
  id: string;
  status: 'uploaded' | 'confirmed';
  assetKind: string;
  fileName: string;
  sizeBytes: string;
  checksumSha256: string;
  assetId: string | null;
  expiresAt: string;
};
export type CatalogPage<T> = { items: T[]; nextAfterId: string | null };
/** `GET /admin/catalog/items/{id}`: the client reads versions and dependency usages; the usage shape differs from `CatalogItem.usages`. */
export type CatalogDetails = Partial<Omit<CatalogItem, 'usages'>> & {
  versions?: { id: string; checksumSha256: string | null; createdAt: string }[];
  usages?: unknown[];
};
export type DependencyUsage = { ownerType: string; ownerId: string; versionId: string };

export type KindKey = Exclude<CatalogKind, 'mod'>;
export type KindDef = { kind: KindKey; label: string; one: string; upload: 'image' | 'archive' | 'none' };
/** Tab order of the v16 mockup (`CAT_TABS`). */
export const KINDS: KindDef[] = [
  { kind: 'car', label: 'Машины', one: 'Машина', upload: 'archive' },
  { kind: 'track', label: 'Трассы', one: 'Трасса', upload: 'archive' },
  { kind: 'skin', label: 'Скины', one: 'Скин', upload: 'archive' },
  { kind: 'photo', label: 'Фото', one: 'Фото', upload: 'image' },
  { kind: 'plugin', label: 'Плагины', one: 'Плагин', upload: 'archive' },
  { kind: 'car_set', label: 'Сеты машин', one: 'Сет машин', upload: 'none' },
  { kind: 'weather_preset', label: 'Погода', one: 'Пресет погоды', upload: 'none' },
];
export const kindDef = (value: string | null | undefined): KindDef => KINDS.find((item) => item.kind === value) ?? KINDS[0];
export const catalogListPath = (kind: string) => `/media-catalog?kind=${kind}`;

export const GAME_TAGS = ['ac', 'acc', 'iracing'] as const;
export const GAME_LABELS: Record<string, string> = { ac: 'AC', acc: 'ACC', iracing: 'iRacing' };
const GAME_TITLES: Record<string, string> = { assetto_corsa: 'Assetto Corsa', assetto_corsa_competizione: 'Assetto Corsa Competizione', iracing: 'iRacing' };
export const GAME_CODE_BY_TAG: Record<string, string> = { ac: 'assetto_corsa', acc: 'assetto_corsa_competizione', iracing: 'iracing' };

export function emptyForm(kind: CatalogKind, owner: CatalogOwnerValue): CatalogForm {
  return { code: '', title: '', owner, description: '', tags: [], metadata: JSON.stringify(defaultMetadata(kind), null, 2), status: 'active', carBrandCode: '', officialDlcCode: '' };
}
export function formFromItem(item: CatalogItem): CatalogForm {
  return {
    code: item.code,
    title: item.title,
    owner: ownerFromItem(item),
    description: item.description ?? '',
    tags: normalizeCatalogFormTags(item.tags, item.kind),
    metadata: JSON.stringify(item.metadata ?? {}, null, 2),
    status: item.status,
    carBrandCode: item.carBrandCode ?? '',
    officialDlcCode: item.officialDlc?.code ?? item.officialDlcCode ?? '',
  };
}
function defaultMetadata(kind: CatalogKind) {
  if (kind === 'weather_preset') return { graphics: '3_clear', ambientTemperature: 20, roadTemperature: 28, ambientVariation: 2, roadVariation: 2, windSpeed: 0 };
  if (kind === 'car_set') return { carIds: [] };
  return {};
}

/* ---------- owners ---------- */
export function defaultOwner(access: AdminAccess): CatalogOwnerValue {
  if (hasPlatformPermission(access, 'catalog.manage.all')) return 'platform';
  const scoped = organizerIdsFor(access, 'catalog.manage.scoped')[0];
  return scoped ? `organizer:${scoped}` : 'platform';
}
export function buildOwnerOptions(access: AdminAccess, organizers: AccessOrganizer[]) {
  const platform = hasPlatformPermission(access, 'catalog.manage.all');
  const allowed = platform ? organizers : organizers.filter((item) => organizerIdsFor(access, 'catalog.manage.scoped').includes(item.id));
  const options: Array<{ value: CatalogOwnerValue; label: string }> = [];
  if (platform) options.push({ value: 'platform', label: 'Платформа' }, { value: 'official', label: 'Официальный контент' });
  for (const organizer of allowed.filter(isCatalogOwnerOrganizer)) options.push({ value: `organizer:${organizer.id}`, label: `${organizer.name} (${organizer.code})` });
  return options;
}
function isCatalogOwnerOrganizer(organizer: AccessOrganizer) {
  const code = organizer.code.toLowerCase();
  const name = organizer.name.toLowerCase();
  return !(code.startsWith('e2e') || code.includes('_e2e') || name.startsWith('ac e2e'));
}
export function ownerFromItem(item: CatalogItem): CatalogOwnerValue {
  if (item.ownerType === 'platform' && item.sourceType !== 'official') return 'platform';
  if (item.sourceType === 'official' || item.sourceType === 'vanilla') return 'official';
  return item.submittedByOrganizerId ? `organizer:${item.submittedByOrganizerId}` : 'platform';
}
export function ownerLabel(item: CatalogItem, organizerById: Map<string, AccessOrganizer>) {
  if (item.sourceType === 'official' || item.sourceType === 'vanilla') return 'Официальный';
  if (item.sourceType === 'platform') return 'Платформа';
  return item.submittedByOrganizerId ? (organizerById.get(item.submittedByOrganizerId)?.name ?? `Организатор #${item.submittedByOrganizerId}`) : 'Организатор';
}
export function gameTitle(item: CatalogItem) {
  if (item.gameCode) return GAME_TITLES[item.gameCode] ?? item.gameCode;
  const tag = item.tags.find(isGameTag);
  return tag ? GAME_TITLES[GAME_CODE_BY_TAG[tag]] : null;
}

/* ---------- tags ---------- */
function normalizeTags(value: readonly string[]) {
  return Array.from(new Set(value.map((tag) => String(tag ?? '').trim().toLowerCase()).filter(Boolean)));
}
export function normalizeVisibleTags(value: readonly string[]) {
  return normalizeTags(value).filter((tag) => !tag.startsWith('game:'));
}
export function normalizeTagOptions(value: readonly string[]) {
  return normalizeVisibleTags(value).sort();
}
export function normalizeCatalogFormTags(value: readonly string[], kind: CatalogKind) {
  const normalized = normalizeVisibleTags(value);
  if (kind === 'photo') return normalized;
  const gameTags = normalized.filter(isGameTag);
  if (gameTags.length <= 1) return normalized;
  const last = gameTags[gameTags.length - 1];
  return normalized.filter((tag) => !isGameTag(tag) || tag === last);
}
export const gameTagsFromTags = (tags: readonly string[]) => tags.filter(isGameTag);
export const isGameTag = (tag: string) => tag === 'ac' || tag === 'acc' || tag === 'iracing';
export function toggleFilterTag(current: string[], tag: string) {
  const [normalized] = normalizeVisibleTags([tag]);
  if (!normalized) return current;
  if (current.includes(normalized)) return current.filter((item) => item !== normalized);
  return normalizeVisibleTags([...current, normalized]);
}

/* ---------- codes & metadata ---------- */
export function deriveCode(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || slugify(fileName);
}
export function catalogCodeForSave(code: string, title: string, fallback?: string) {
  const normalized = deriveCode(code.trim() || title.trim()).slice(0, 159);
  if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,159}$/.test(normalized)) return normalized;
  return fallback;
}
export function parseMetadata(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Metadata должен быть JSON object');
  return parsed as Record<string, unknown>;
}
export function carSetMetadataFromForm(value: string): Record<string, unknown> {
  const parsed = parseMetadata(value);
  const raw = parsed.carIds;
  if (raw !== undefined && (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string'))) throw new Error('Класс содержит некорректные идентификаторы машин');
  return { ...parsed, carIds: Array.from(new Set((raw as string[] | undefined) ?? [])) };
}

/* ---------- images ---------- */
/** The image URL is derived from the asset ID; the asset ID itself is what the card stores. */
export function catalogItemImageUrl(item: CatalogItem): string | null {
  if (!item.primaryImageAsset && !item.primaryImageAssetId) return null;
  return getCatalogImageUrl(item.id, item.primaryImageAssetId ?? item.primaryImageAsset?.id, item.primaryImageAsset?.publicUrl ?? '') || null;
}

/* ---------- track layouts & touge zones ---------- */
export type TrackLayoutInfo = {
  code: string;
  title: string;
  isDefault: boolean;
  pitboxes: number | null;
  tougeZones: { status?: string; checksumSha256?: string; updatedAt?: string | null; error?: string | null } | null;
};
export function getTrackLayouts(item: Pick<CatalogItem, 'metadata'>): TrackLayoutInfo[] {
  const raw = item.metadata?.layouts;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): TrackLayoutInfo[] => {
    if (!entry || typeof entry !== 'object') return [];
    const layout = entry as Record<string, unknown>;
    const code = typeof layout.code === 'string' ? layout.code.trim() : '';
    const title = typeof layout.title === 'string' ? layout.title.trim() : '';
    if (!code && !title) return [];
    const zones = layout.tougeZones && typeof layout.tougeZones === 'object' && !Array.isArray(layout.tougeZones) ? layout.tougeZones as Record<string, unknown> : null;
    return [{
      code: code || 'default',
      title: title || code,
      isDefault: layout.isDefault === true,
      pitboxes: typeof layout.pitboxes === 'number' ? layout.pitboxes : null,
      tougeZones: zones ? {
        status: typeof zones.status === 'string' ? zones.status : undefined,
        checksumSha256: typeof zones.checksumSha256 === 'string' ? zones.checksumSha256 : undefined,
        updatedAt: typeof zones.updatedAt === 'string' ? zones.updatedAt : null,
        error: typeof zones.error === 'string' ? zones.error : null,
      } : null,
    }];
  });
}
export function tougeZonesLabel(status: string | undefined) {
  if (status === 'uploading') return 'Загрузка…';
  if (status === 'present' || status === 'uploaded') return 'Загружено';
  if (status === 'error') return 'Ошибка загрузки';
  if (status === 'invalid') return 'Ошибка разметки';
  return 'Не загружено';
}
export function tougeZonesTone(status: string | undefined): Tone {
  if (status === 'present' || status === 'uploaded') return 'done';
  if (status === 'uploading') return 'live';
  if (status === 'invalid' || status === 'error') return 'failed';
  return 'scheduled';
}

/* ---------- statuses ---------- */
const STATUS_LABELS: Record<string, string> = {
  active: 'Активен', disabled: 'Неактивен', archived: 'В архиве',
  present: 'Загружено', missing: 'Нет файла', failed: 'Ошибка', installed: 'Установлено', uploaded: 'Загружено', pending: 'Ожидает', not_applicable: 'Не требуется',
};
const STATUS_TONES: Record<string, Tone> = { active: 'done', present: 'done', installed: 'done', uploaded: 'done', pending: 'current', missing: 'failed', failed: 'failed', disabled: 'scheduled', archived: 'scheduled', not_applicable: 'scheduled' };
export const statusText = (value: string) => STATUS_LABELS[value] ?? value;
export const statusTone = (value: string): Tone => STATUS_TONES[value] ?? 'scheduled';
export const statusLike = (value: string) => ({ code: value, label: statusText(value) });

/** Problems that must stay visible in the list next to the availability badge. */
export function itemProblem(item: CatalogItem): { label: string; title?: string } | null {
  if (item.installStatus === 'failed' || item.sharedStatus === 'failed') return { label: 'Ошибка установки', title: item.installError ?? undefined };
  if (item.storageStatus === 'missing' && item.sourceType !== 'official' && item.sourceType !== 'vanilla') return { label: 'Нет файла' };
  if (item.storageStatus === 'failed') return { label: 'Ошибка файла' };
  return null;
}

export function usageLabel(type: CatalogUsage['usageType']) {
  return ({ championship: 'Чемпионат', event: 'Событие', news: 'Новость', page: 'Страница', other: 'Другое' } as Record<string, string>)[type] ?? 'Другое';
}

/** Second line of the list row: kind-specific facts that the card already carries. */
export function itemInfo(item: CatalogItem, brandByCode: Map<string, CarBrand>): string {
  const game = gameTitle(item);
  const parts: (string | null | undefined)[] = [];
  if (item.kind === 'car') parts.push(item.carBrandCode ? brandByCode.get(item.carBrandCode)?.title ?? item.carBrandCode : null, game, item.officialDlc?.title);
  else if (item.kind === 'track') {
    const layouts = getTrackLayouts(item);
    parts.push(layouts.length ? `Конфигурации: ${layouts.map((l) => l.title).join(', ')}` : null, game, item.officialDlc?.title);
  } else if (item.kind === 'car_set') {
    const ids = Array.isArray(item.metadata?.carIds) ? item.metadata.carIds.length : 0;
    parts.push(`${ids} ${plural(ids, 'машина', 'машины', 'машин')}`, game);
  } else if (item.kind === 'weather_preset') {
    const m = item.metadata ?? {};
    const value = (key: 'graphics' | 'ambientTemperature' | 'roadTemperature' | 'windSpeed') => item[key] ?? (m[key] as string | number | undefined) ?? null;
    parts.push(value('graphics') != null ? String(value('graphics')) : null,
      value('ambientTemperature') != null ? `воздух ${value('ambientTemperature')}°C` : null,
      value('roadTemperature') != null ? `трасса ${value('roadTemperature')}°C` : null,
      value('windSpeed') != null ? `ветер ${value('windSpeed')}` : null);
  } else if (item.kind === 'photo') parts.push(item.primaryImageAsset ? item.primaryImageAsset.fileName : null);
  else parts.push(game);
  return parts.filter(Boolean).join(' · ');
}
export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
