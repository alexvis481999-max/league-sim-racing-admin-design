import type { PublicationAction, PublicationPlacementCode } from '../../shared/types';
import {
  cloneContentAppearance,
  defaultContentAppearance,
  type ContentAppearanceConfig,
} from './contentAppearance';

export type PlacementForm = {
  enabled: boolean;
  customized: boolean;
  sortOrder: string;
  titleOverride: string;
  summaryOverride: string;
  eyebrowOverride: string;
  imageAssetId: string;
  imageUrl: string;
  imageTitle: string;
  actions: PublicationAction[];
  appearance: ContentAppearanceConfig;
};

export type PublicationForm = {
  accessOrganizerId: string;
  publicationKind: string;
  title: string;
  summary: string;
  body: string;
  coverAssetId: string;
  coverUrl: string;
  coverTitle: string;
  timingMode: 'now' | 'scheduled' | 'period';
  publishStartsAt: string;
  publishEndsAt: string;
  placements: Record<PublicationPlacementCode, PlacementForm>;
};

export type PublicationSaveMode = 'draft' | 'publish';

export type PublicationValidation = {
  fieldErrors: Partial<Record<'title' | 'summary' | 'body' | 'scheduledPublishAt' | 'sliderEndsAt' | 'placements' | 'actions', string>>;
  blockers: string[];
  valid: boolean;
};

export const placementCodes: PublicationPlacementCode[] = [
  'home.feed',
  'home.hero',
  'home.promo',
  'touge.feed',
  'touge.featured_news',
];

const sliderPlacementCodes = new Set<PublicationPlacementCode>([
  'home.hero',
  'home.promo',
  'touge.featured_news',
]);

export function emptyPlacement(): PlacementForm {
  return {
    enabled: false,
    customized: false,
    sortOrder: '0',
    titleOverride: '',
    summaryOverride: '',
    eyebrowOverride: '',
    imageAssetId: '',
    imageUrl: '',
    imageTitle: '',
    actions: [],
    appearance: cloneContentAppearance(defaultContentAppearance),
  };
}

export function emptyForm(accessOrganizerId = ''): PublicationForm {
  return {
    accessOrganizerId,
    publicationKind: 'news',
    title: '',
    summary: '',
    body: '',
    coverAssetId: '',
    coverUrl: '',
    coverTitle: '',
    timingMode: 'now',
    publishStartsAt: '',
    publishEndsAt: '',
    placements: Object.fromEntries(placementCodes.map((code) => [code, emptyPlacement()])) as Record<PublicationPlacementCode, PlacementForm>,
  };
}

export function placementPayload(code: PublicationPlacementCode, placement: PlacementForm, startsAt: string, endsAt: string) {
  const actions = placement.customized ? placement.actions.filter((action) => action.label.trim() && action.url.trim()) : [];
  return {
    placementCode: code,
    enabled: true,
    sortOrder: Number(placement.sortOrder) || 0,
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    titleOverride: placement.customized ? placement.titleOverride.trim() || null : null,
    summaryOverride: placement.customized ? placement.summaryOverride.trim() || null : null,
    eyebrowOverride: placement.customized ? placement.eyebrowOverride.trim() || null : null,
    imageAssetId: placement.customized ? placement.imageAssetId || null : null,
    actions,
    presentation: placement.customized ? placement.appearance : {},
  };
}

export function isSliderPlacement(code: PublicationPlacementCode) {
  return sliderPlacementCodes.has(code);
}

export function validatePublication(form: PublicationForm, mode: PublicationSaveMode): PublicationValidation {
  const fieldErrors: PublicationValidation['fieldErrors'] = {};

  if (!form.title.trim()) fieldErrors.title = 'Укажите заголовок';
  else if (form.title.trim().length > 220) fieldErrors.title = 'Заголовок не должен превышать 220 символов';
  if (mode === 'draft') {
    const blockers = Object.values(fieldErrors).filter((message): message is string => Boolean(message));
    return { fieldErrors, blockers, valid: blockers.length === 0 };
  }
  if (!form.summary.trim()) fieldErrors.summary = 'Добавьте краткое описание';
  if (form.publicationKind !== 'promo' && !form.body.trim()) fieldErrors.body = 'Добавьте основной текст публикации';

  const enabledPlacements = placementCodes.filter((code) => form.placements[code].enabled);
  if (!enabledPlacements.length) fieldErrors.placements = 'Выберите хотя бы одно место размещения';

  const hasIncompleteAction = enabledPlacements.some((code) => form.placements[code].customized
    && form.placements[code].actions.some((action) => Boolean(action.label.trim()) !== Boolean(action.url.trim())));
  if (hasIncompleteAction) fieldErrors.actions = 'У каждой добавленной кнопки должны быть заполнены и текст, и ссылка';

  if (form.timingMode !== 'now') {
    if (!form.publishStartsAt) fieldErrors.scheduledPublishAt = 'Укажите дату начала публикации';
    else if (!Number.isFinite(new Date(form.publishStartsAt).getTime())) fieldErrors.scheduledPublishAt = 'Укажите корректную дату начала';
    else if (form.timingMode === 'scheduled' && new Date(form.publishStartsAt).getTime() <= Date.now()) fieldErrors.scheduledPublishAt = 'Дата отложенной публикации должна быть в будущем';
  }

  if (form.timingMode === 'period') {
    if (!form.publishEndsAt) fieldErrors.sliderEndsAt = 'Укажите дату окончания публикации';
    else if (!Number.isFinite(new Date(form.publishEndsAt).getTime())) fieldErrors.sliderEndsAt = 'Укажите корректную дату окончания';
    else if (form.publishStartsAt && new Date(form.publishEndsAt).getTime() <= new Date(form.publishStartsAt).getTime()) fieldErrors.sliderEndsAt = 'Дата окончания должна быть позже даты начала';
  }

  const blockers = Object.values(fieldErrors).filter((message): message is string => Boolean(message));
  return { fieldErrors, blockers, valid: blockers.length === 0 };
}
