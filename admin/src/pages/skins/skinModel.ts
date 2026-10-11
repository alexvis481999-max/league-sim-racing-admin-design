import JSZip from 'jszip';
import { getApiBaseUrl } from '../../shared/api';
import type { AccessOrganizer } from '../../shared/types';
import type { Tone } from '../../ui/v16';

type SkinUser = { id: string; firstName: string | null; lastName: string | null; steamName: string };
export type Skin = {
  active: boolean; metadataVersion?: number; deletedAt?: string | null; moderation?: { blocked: boolean; reason: string }; allowedActions?: { edit: boolean; moderate: boolean; download: boolean };
  id: number; gameCode: string; carCode: string; displayName: string; folderName: string;
  previewUrl: string | null; previewBucket: string | null; previewObjectKey: string | null;
  archiveUrl: string | null; archiveBucket: string | null; archiveObjectKey: string | null; archiveChecksumSha256: string | null;
  archiveSizeBytes: string | null; ownerType: 'official' | 'platform' | 'organizer' | 'user'; ownerId: string | null;
  visibility: 'official' | 'public' | 'private'; isActive: boolean; createdByUserId: string | null; version: number; tags: string[];
  createdByUser?: SkinUser | null;
  ownerUser?: SkinUser | null;
  createdAt: string | null; updatedAt: string | null;
};
export type SkinRevision = { metadataVersion: number; version: string; displayName: string; carCode: string; tags: string[]; active: boolean; changedAt: string | null; actorId: string | null; archiveUrl: string | null };
export type SkinDetailsData = Skin & { history?: SkinRevision[] };
export type SkinCar = { id?: string | number; code: string; title: string };
export type SkinsPage = { items: Skin[]; nextAfterId: string | null };
export type SkinOwnerValue = 'official' | 'platform' | `organizer:${string}` | `user:${string}`;

export const SKIN_GAMES = [
  { value: 'assetto_corsa', label: 'AC' },
  { value: 'assetto_corsa_competizione', label: 'ACC' },
  { value: 'iracing', label: 'iRacing' },
];
export const SKIN_OWNER_TYPES = [
  { value: '', label: 'Все владельцы' }, { value: 'official', label: 'Официальные' }, { value: 'platform', label: 'Платформа' }, { value: 'organizer', label: 'Организаторы' }, { value: 'user', label: 'Игроки' },
];
export const gameLabel = (code: string) => SKIN_GAMES.find((game) => game.value === code)?.label ?? code;
export const visibilityLabel = (skin: Pick<Skin, 'visibility'>) => (skin.visibility === 'private' ? 'Только владельцу' : skin.visibility === 'official' ? 'Официальный' : 'Для всех');

export function skinCreatorName(skin: Pick<Skin, 'createdByUser' | 'createdByUserId'>): string {
  const user = skin.createdByUser;
  if (!user) return skin.createdByUserId ? `ID ${skin.createdByUserId}` : '';
  return `${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.steamName} · ID ${user.id}`;
}
export function skinOwnerLabel(skin: Pick<Skin, 'ownerType' | 'ownerId' | 'ownerUser'>, organizers: AccessOrganizer[]): string {
  if (skin.ownerType === 'official') return 'Официальный';
  if (skin.ownerType === 'platform') return 'Платформа';
  if (skin.ownerType === 'user') return skin.ownerUser ? `${[skin.ownerUser.firstName, skin.ownerUser.lastName].filter(Boolean).join(' ') || skin.ownerUser.steamName} · ID ${skin.ownerUser.id}` : `Пилот · ID ${skin.ownerId ?? '—'}`;
  const organizer = organizers.find((item) => String(item.id) === String(skin.ownerId));
  return organizer ? organizer.name : `Организатор #${skin.ownerId ?? '—'}`;
}
export function ownerPayload(owner: SkinOwnerValue): { ownerType: Skin['ownerType']; ownerId: string | null } {
  const separator = owner.indexOf(':');
  if (separator < 0) return { ownerType: owner as Skin['ownerType'], ownerId: null };
  return { ownerType: owner.slice(0, separator) as Skin['ownerType'], ownerId: owner.slice(separator + 1) || null };
}

/** Server state of a skin: removal by the owner and moderation are shown before availability. */
export function skinState(skin: Pick<Skin, 'active' | 'deletedAt' | 'moderation'>): { code: string; label: string; tone: Tone; title?: string }[] {
  const states: { code: string; label: string; tone: Tone; title?: string }[] = [];
  if (skin.deletedAt) states.push({ code: 'DELETED', label: 'Удалён владельцем', tone: 'scheduled' });
  else states.push(skin.active ? { code: 'ACTIVE', label: 'Активен', tone: 'done' } : { code: 'DISABLED', label: 'Отключён', tone: 'scheduled' });
  if (skin.moderation?.blocked) states.push({ code: 'BLOCKED', label: 'Заблокирован', tone: 'failed', title: skin.moderation.reason });
  return states;
}

export function versionedPreviewUrl(skin: Pick<Skin, 'previewUrl' | 'version' | 'updatedAt'>): string | null {
  if (!skin.previewUrl) return null;
  const url = new URL(skin.previewUrl, skin.previewUrl.startsWith('/') ? getApiBaseUrl() : window.location.origin);
  url.searchParams.set('v', `${skin.version || 1}-${skin.updatedAt ? Date.parse(skin.updatedAt) : 0}`);
  return url.toString();
}

export function uniqueTags(tags: readonly string[]) {
  return Array.from(new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)));
}

/** Title for the new skin form: `ui_skin.json` (skinname/name), otherwise the skin folder or the file name. */
export async function readSkinArchiveTitle(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  for (const name of names.filter((item) => /(^|\/)ui_skin\.json$/i.test(item))) {
    try {
      const parsed = JSON.parse(await zip.files[name].async('text')) as Record<string, unknown>;
      const title = String(parsed.skinname ?? parsed.name ?? '').trim();
      if (title) return title;
    } catch { /* Try another ui_skin.json. */ }
  }
  const folder = names.map((name) => name.replace(/\\/g, '/').match(/(?:^|\/)skins\/([^/]+)\//i)?.[1]).find(Boolean);
  return String(folder ?? file.name.replace(/\.zip$/i, '')).replace(/[_-]+/g, ' ').trim();
}

export function skinListPath(params: { carCode?: string; ownerType?: string; ownerId?: string; afterId?: string | null; limit: number; q?: string; gameCode?: string }) {
  const query = new URLSearchParams();
  if (params.carCode) query.set('carCode', params.carCode);
  if (params.ownerType) query.set('ownerType', params.ownerType);
  if (params.ownerId) query.set('ownerId', params.ownerId);
  if (params.afterId) query.set('afterId', params.afterId);
  query.set('limit', String(params.limit));
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.gameCode) query.set('gameCode', params.gameCode);
  return `/skins/admin?${query}`;
}
export const errorMessage = (value: unknown, fallback: string) => (value instanceof Error ? value.message : fallback);
export const skinPath = (id: number | string) => `/media-catalog/skin/${encodeURIComponent(String(id))}`;
