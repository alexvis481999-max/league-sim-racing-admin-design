import { useCallback, useRef } from 'react';
import { ApiError, apiFetch, getContentAssetUrl } from '../../shared/api';
import { slugify } from '../../shared/format';
import type { AccessOrganizer, ContentRevisionPlacement, PublicationDetails, PublicationPlacementCode } from '../../shared/types';
import { recordTone, type Tone } from '../../ui/v16';
import { normalizeContentAppearance, type ContentSurfaceKind } from './contentAppearance';
import { emptyForm, type PlacementForm, type PublicationForm } from './publicationForm';

export type PlacementDefinition = {
  code: PublicationPlacementCode; label: string; group: string; short: string; surface: ContentSurfaceKind; supportsActions: boolean;
};

export const placementDefinitions: PlacementDefinition[] = [
  { code: 'home.feed', label: 'Новостная лента', group: 'Главная страница', short: 'Главная · лента', surface: 'card', supportsActions: false },
  { code: 'home.hero', label: 'Большой слайдер', group: 'Главная страница', short: 'Главная · большой слайдер', surface: 'slider', supportsActions: true },
  { code: 'home.promo', label: 'Дополнительный слайдер', group: 'Главная страница', short: 'Главная · доп. слайдер', surface: 'slider', supportsActions: true },
  { code: 'touge.feed', label: 'Новостная лента', group: 'Touge', short: 'Touge · лента', surface: 'card', supportsActions: false },
  { code: 'touge.featured_news', label: 'Главный блок новостей', group: 'Touge', short: 'Touge · главный блок', surface: 'slider', supportsActions: true },
];
export const placementDefinition = (code: string) => placementDefinitions.find((item) => item.code === code);
export const placementTitle = (code: string) => { const d = placementDefinition(code); return d ? `${d.group} · ${d.label}` : code; };

export const kindOptions = [
  { value: 'news', label: 'Новость' }, { value: 'announcement', label: 'Анонс' }, { value: 'result', label: 'Результаты' },
  { value: 'update', label: 'Обновление' }, { value: 'promo', label: 'Промо' },
];
export const kindLabel = (kind: string | null | undefined) => kindOptions.find((item) => item.value === kind)?.label ?? kind ?? '—';
export const publicationKindLabel = (kind: string) => kindOptions.find((item) => item.value === kind)?.label ?? 'Публикация';

const statusLabels: Record<string, string> = { draft: 'Черновик', review: 'На проверке', scheduled: 'Запланирована', published: 'Опубликована', archived: 'Архив' };
const statusTones: Record<string, Tone> = { published: 'done', scheduled: 'live', review: 'current', draft: 'scheduled', archived: 'scheduled' };
export const isLive = (item: PublicationDetails | null | undefined) => !!item && ['published', 'scheduled'].includes(item.entry.status);
/** Status text follows the entry lifecycle; a newer revision on top of a published entry is shown explicitly. */
export function publicationStatus(item: PublicationDetails) {
  const code = item.entry.status;
  const label = code === 'published' && item.entry.currentRevisionId && item.entry.currentRevisionId !== item.revision.id
    ? 'Опубликована · есть черновик' : statusLabels[code] ?? code;
  return { status: { code, label }, tone: recordTone(code, statusTones) };
}

export function organizerName(id: string | null | undefined, organizers: AccessOrganizer[]) {
  if (!id) return 'League Sim Racing';
  return organizers.find((item) => item.id === id)?.name ?? `Организатор #${id}`;
}

export function livePlacements(item: PublicationDetails) { return item.currentPlacements ?? item.placements; }

export function publicationToForm(item: PublicationDetails): PublicationForm {
  const result = emptyForm(item.entry.accessOrganizerId ?? '');
  result.publicationKind = item.entry.publicationKind ?? 'news'; result.title = item.revision.title;
  result.summary = item.revision.summary; result.body = item.revision.body; result.coverAssetId = item.entry.coverAssetId ?? '';
  const placementStart = item.placements.find((placement) => placement.startsAt)?.startsAt;
  const placementEnd = item.placements.find((placement) => placement.endsAt)?.endsAt;
  result.coverUrl = item.entry.coverAssetId ? getContentAssetUrl(item.entry.coverAssetId) : '';
  result.timingMode = placementEnd ? 'period' : item.entry.status === 'scheduled' || placementStart ? 'scheduled' : 'now';
  result.publishStartsAt = result.timingMode === 'now' ? '' : toDateTimeLocal(item.entry.scheduledPublishAt ?? placementStart);
  result.publishEndsAt = toDateTimeLocal(placementEnd);
  for (const placement of item.placements) {
    if (placement.placementCode in result.placements) result.placements[placement.placementCode] = placementToForm(placement);
  }
  return result;
}

export function placementToForm(placement: ContentRevisionPlacement): PlacementForm {
  const customized = Boolean(placement.titleOverride || placement.summaryOverride || placement.eyebrowOverride || placement.imageAssetId || placement.actions.length || Object.keys(placement.presentation).length);
  return { enabled: placement.enabled, customized, sortOrder: String(placement.sortOrder), titleOverride: placement.titleOverride ?? '', summaryOverride: placement.summaryOverride ?? '', eyebrowOverride: placement.eyebrowOverride ?? '', imageAssetId: placement.imageAssetId ?? '', imageUrl: placement.imageAssetId ? getContentAssetUrl(placement.imageAssetId) : '', imageTitle: '', actions: [...placement.actions], appearance: normalizeContentAppearance(placement.presentation) };
}

export function placementPreviewImage(code: PublicationPlacementCode, placementImage: string, coverImage: string) {
  if (placementImage) return placementImage;
  if (coverImage) return coverImage;
  const fallback = code.startsWith('touge.') ? '/assets/lsr-hero.png' : '/assets/lsr-porsche-hero.png';
  const siteUrl = String(import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');
  return `${siteUrl}${fallback}`;
}

export function contentSlug(value: string, fallback: string) { const slug = slugify(value).replace(/^-+|-+$/g, ''); return /^[a-z0-9][a-z0-9-]{1,158}$/.test(slug) ? slug.slice(0, 158) : fallback; }
export function toDateTimeLocal(value?: string | null) { if (!value) return ''; const date = new Date(value); if (!Number.isFinite(date.getTime())) return ''; return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }

export type LoadError = { message: string; status: number | null };
export const toLoadError = (error: unknown): LoadError => ({
  message: error instanceof ApiError && error.status === 403 ? 'Недостаточно прав для просмотра публикаций.' : error instanceof Error ? error.message : String(error),
  status: error instanceof ApiError ? error.status : null,
});

/**
 * Publication commands carry an Idempotency-Key. An unconfirmed command (network failure or 5xx) is retried
 * with the same key and body; a confirmed answer (2xx or 4xx) releases the key.
 */
export function usePublicationCommands() {
  const keys = useRef(new Map<string, string>());
  return useCallback(async <T,>(path: string, body: unknown, method = 'POST'): Promise<T> => {
    const payload = JSON.stringify(body);
    const signature = `${method} ${path} ${payload}`;
    const key = keys.current.get(signature) ?? crypto.randomUUID();
    keys.current.set(signature, key);
    try {
      const result = await apiFetch<T>(path, { method, body: payload, headers: { 'Idempotency-Key': key } });
      keys.current.delete(signature);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) keys.current.delete(signature);
      throw error;
    }
  }, []);
}

export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
