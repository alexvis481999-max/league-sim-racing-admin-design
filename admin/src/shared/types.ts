import type { ReactNode } from 'react';

export type AnyRecord = Record<string, unknown>;

export type AdminAccess = {
  userId: string;
  user?: {
    id: string;
    steamId: string;
    steamName: string;
    steamAvatar: string | null;
    avatar: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  grants: Array<{ id: string; roleCode: string; scopeType: 'platform' | 'organizer' | 'event'; scopeId: string | null;
    validFrom: string | null; validTo: string | null; constraints: { allowedEventRuntimeTypes?: string[];
      allowedTougeSubtypes?: string[]; allowedTougeDuelEntryModes?: string[]; mustEndWithinHours?: number } | null; permissions: string[] }>;
  panelAccess: boolean;
};

export type EventCard = {
  eventId: number;
  accessOrganizerId: string;
  title: string;
  eventType: string;
  disciplineCode: string;
  scenarioCode: string;
  status: string;
  publicState: string;
  startsAt: string | null;
  endsAt: string | null;
  lifecycleKind?: string;
};

export type EventBlockServiceState = {
  desiredState: 'running' | 'stopped' | 'maintenance';
  observedState: 'offline' | 'starting' | 'online' | 'stopping' | 'restarting' | 'degraded';
  configRevision: number;
  appliedConfigRevision: number;
  restartRequired: boolean;
  activeRuntimeSessionRefId: string | null;
  restartAttempt: number;
  nextRestartAt: string | null;
  lastHealthyAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
};

export type EventBlock = AnyRecord & {
  id: string;
  blockType: string;
  blockTitle: string;
  status: string;
  serviceState: EventBlockServiceState | null;
};

export type EventDetails = EventCard & {
    description: string | null;
  registrationMode: string;
  timezone: string;
  scenarioConfigSnapshot?: AnyRecord;
  scenarioPlanSnapshot?: AnyRecord | null;
  blocks?: EventBlock[];
};

export type ContentEntry = {
  id: string;
  contentType: string;
  slug: string;
  status: string;
  visibility: string;
  locale: string;
  currentRevisionId: string | null;
  coverAssetId: string | null;
  primaryAssetId: string | null;
  eventId: number | null;
  accessOrganizerId: string | null;
  disciplineCode: string | null;
  gameCode: string | null;
  contentCode: string | null;
  publicationKind: 'news' | 'announcement' | 'result' | 'update' | 'promo' | null;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  scheduledRevisionId: string | null;
  currentTitle?: string | null;
  currentSummary?: string | null;
};

export type PublicationPlacementCode = 'home.feed' | 'home.hero' | 'home.promo' | 'touge.feed' | 'touge.featured_news';
export type PublicationAction = { role: 'primary' | 'secondary'; label: string; url: string; newTab: boolean };
export type ContentRevisionPlacement = {
  id: string;
  contentRevisionId: string;
  placementCode: PublicationPlacementCode;
  enabled: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  titleOverride: string | null;
  summaryOverride: string | null;
  eyebrowOverride: string | null;
  imageAssetId: string | null;
  actions: PublicationAction[];
  presentation: AnyRecord;
};
export type PublicationDetails = {
  version?: number;
  allowedActions?: { edit: boolean; publish: boolean; delete: boolean };
  entry: ContentEntry;
  revision: ContentRevision;
  placements: ContentRevisionPlacement[];
  currentPlacements?: ContentRevisionPlacement[];
};

export type ContentRevision = {
  id: string;
  contentEntryId: string;
  changeSetId: string;
  title: string;
  summary: string;
  body: string;
  metadata: AnyRecord;
  createdAt: string;
};

export type ContentAsset = {
  id: string;
  storageProvider: 'beget_s3';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  assetKind: string;
  publicUrl: string;
  objectKey: string;
  createdAt: string;
};

export type AccessOrganizer = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  settings: AnyRecord | null;
  active: boolean;
  version?: string;
};

export type CatalogKind = 'car' | 'track' | 'plugin' | 'mod' | 'skin' | 'weather_preset' | 'car_set' | 'photo';
export type CatalogSourceType = 'vanilla' | 'official' | 'platform' | 'community';
export type CatalogStatus = 'active' | 'disabled' | 'archived';
export type CatalogUsageType = 'championship' | 'event' | 'news' | 'page' | 'other';
export type CatalogStorageStatus = 'not_applicable' | 'missing' | 'present' | 'failed';
export type CatalogSharedStatus = 'not_applicable' | 'missing' | 'present' | 'failed';
export type CatalogInstallStatus = 'not_applicable' | 'pending' | 'installed' | 'uploaded' | 'failed';

export type CatalogActor = {
  firstName?: string | null;
  lastName?: string | null;
  id: string | number;
  steamName: string;
  steamAvatar: string | null;
};

export type CatalogUsage = {
  id: string;
  usageType: CatalogUsageType;
  targetId: string | null;
  targetTitle: string;
  placement: string | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | number;
  updatedByUserId: string | number | null;
};

export type CatalogItem = {
  revision?: number;
  currentVersionId?: string;
  ownerType?: 'platform' | 'organizer';
  ownerId?: string | null;
  gameCode?: string;
  officialDlcCode?: string | null;
  id: string;
  kind: CatalogKind;
  code: string;
  slug: string;
  contentCode: string | null;
  title: string;
  currentTitle: string;
  description: string | null;
  carBrandCode?: string | null;
  sourceType: CatalogSourceType;
  officialDlc?: { code: string; title: string; storeUrl: string } | null;
  submittedByOrganizerId: string | null;
  tags: string[];
  usages: CatalogUsage[];
  metadata: AnyRecord;
  archiveAssetId: string | null;
  primaryImageAssetId: string | null;
  status: CatalogStatus;
  storageStatus: CatalogStorageStatus;
  sharedStatus: CatalogSharedStatus;
  installStatus: CatalogInstallStatus;
  installError: string | null;
  installedAt: string | null;
  archiveAsset?: ContentAsset | null;
  primaryImageAsset?: ContentAsset | null;
  graphics?: string | null;
  ambientTemperature?: number | null;
  roadTemperature?: number | null;
  windSpeed?: number | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | number;
  updatedByUserId: string | number | null;
  createdBy?: CatalogActor | null;
  updatedBy?: CatalogActor | null;
};

export type GameCatalogItem = CatalogItem;

export type WeatherPreset = CatalogItem & {
  code: string;
  title: string;
  graphics: string | null;
  ambientTemperature: number | null;
  roadTemperature: number | null;
  windSpeed: number | null;
};

export type EventCreateCatalog = {
  cars: GameCatalogItem[];
  carSets: GameCatalogItem[];
  tracks: GameCatalogItem[];
  plugins: GameCatalogItem[];
  weatherPresets: WeatherPreset[];
};

export type ModuleDefinition = {
  code: string;
  label: string;
  group: 'racing' | 'content' | 'community' | 'system';
  path: string;
  /** v16 navigation glyph. */
  glyph: string;
  permissions: string[];
  element: ReactNode;
};
