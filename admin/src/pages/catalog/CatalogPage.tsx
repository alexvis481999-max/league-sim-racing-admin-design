import { CatalogPresetFields } from '../../shared/catalog/CatalogPresetFields';
import { FilterButtons } from '../../shared/ui';
import {useRealtimeRefresh} from '../../shared/realtime';
import { organizerIdsFor, hasPlatformPermission } from '../../shared/access';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Skeleton,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiDownload, apiFetch, apiUploadFormData, getCatalogImageUrl, jsonBody, patchJsonBody } from '../../shared/api';
import { useAsyncState } from '../../shared/asyncState';
import { formatBytes, formatDate, slugify } from '../../shared/format';
import type { AccessOrganizer, AdminAccess, CatalogItem, CatalogKind, CatalogSourceType, CatalogStatus, ContentAsset } from '../../shared/types';
import { CreateAction, FieldGrid, FormCell, Page, RefreshAction, SearchField, Section, StatusAlert } from '../../shared/ui';
import { ArchiveDropZone, type UploadPhase } from '../../shared/ArchiveDropZone';
import { TagEditor } from '../../shared/TagEditor';
import { CatalogKindView } from './CatalogKindViews';
import { catalogActorLabel } from './catalogActor';
import { CarSkinsSection, SkinsPage } from '../skins/SkinsPage';
import { CatalogDependencies } from './CatalogDependencies';
import { TrackLayoutFields } from './TrackLayoutFields';

type CatalogOwnerValue = 'platform' | 'official' | `organizer:${string}`;

type CatalogForm = {
  code: string;
  title: string;
  owner: CatalogOwnerValue;
  description: string;
  tags: string[];
  metadata: string;
  status: CatalogStatus;
  carBrandCode: string;
  officialDlcCode: string;
};

type CarBrand = { code: string; title: string; region: 'european' | 'american' | 'asian' };
type OfficialDlc = { code: string; title: string; storeUrl: string };
type ContentUploadSession = {
  id: string;
  status: 'uploaded' | 'confirmed';
  assetKind: string;
  fileName: string;
  sizeBytes: string;
  checksumSha256: string;
  assetId: string | null;
  expiresAt: string;
};

const gameTagOptions = ['ac', 'acc', 'iracing'];
const acWeatherGraphicsOptions = [
  '2_light_fog',
  '2_mid_clear',
  '3_clear',
  '4_mid_clear',
  '5_light_clouds',
  '5_heavy_clouds',
  '6_overcast',
  '7_fog',
];
const tabs: Array<{ kind: CatalogKind; label: string; upload: 'image' | 'archive' | 'none' }> = [
  { kind: 'photo', label: 'Фото', upload: 'image' },
  { kind: 'car', label: 'Машины', upload: 'archive' },
  { kind: 'track', label: 'Трассы', upload: 'archive' },
  { kind: 'plugin', label: 'Плагины', upload: 'archive' },
  { kind: 'skin', label: 'Скины', upload: 'archive' },
  { kind: 'car_set', label: 'Сеты машин', upload: 'none' },
  { kind: 'weather_preset', label: 'Погода', upload: 'none' },
];

function emptyForm(kind: CatalogKind, owner: CatalogOwnerValue): CatalogForm {
  return {
    code: '',
    title: '',
    owner,
    description: '',
    tags: [],
    metadata: JSON.stringify(defaultMetadata(kind), null, 2),
    status: 'active',
    carBrandCode: '',
    officialDlcCode: '',
  };
}

function defaultMetadata(kind: CatalogKind) {
  if (kind === 'weather_preset') {
    return {
      graphics: '3_clear',
      ambientTemperature: 20,
      roadTemperature: 28,
      ambientVariation: 2,
      roadVariation: 2,
      windSpeed: 0,
    };
  }
  if (kind === 'car_set') return { carIds: [] };
  return {};
}

export function CatalogPage({ access }: { access: AdminAccess }) {
  const initialQuery = new URLSearchParams(window.location.search);
  const [tabIndex, setTabIndex] = useState(() => Math.max(0, tabs.findIndex((tab) => tab.kind === initialQuery.get('kind'))));
  const active = tabs[tabIndex] ?? tabs[0];
  const [items, setItems] = useState<CatalogItem[]>([]);
  const generation=useRef(0),[nextAfterId,setNextAfterId]=useState<string|null>(null);
  const [listLoading,setListLoading]=useState(true),[listError,setListError]=useState('');
  const [organizers, setOrganizers] = useState<AccessOrganizer[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>(gameTagOptions);
  const [carBrands, setCarBrands] = useState<CarBrand[]>([]);
  const [officialDlcs, setOfficialDlcs] = useState<OfficialDlc[]>([]);
  const [state, run] = useAsyncState<unknown>();
  const [saveState, runSave, setSaveState] = useAsyncState<CatalogItem>();
  const [search, setSearch] = useState(() => initialQuery.get('search') ?? '');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<CatalogStatus | 'all'>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<CatalogForm>(() => emptyForm(active.kind, defaultOwner(access)));
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [preparedUpload, setPreparedUpload] = useState<ContentUploadSession | null>(null);

  const hasPlatformCatalogAccess = hasPlatformPermission(access, 'catalog.manage.all');
  const ownerOptions = useMemo(() => buildOwnerOptions(hasPlatformCatalogAccess ? organizers : organizers.filter(item => organizerIdsFor(access, 'catalog.manage.scoped').includes(item.id)), hasPlatformCatalogAccess), [organizers, hasPlatformCatalogAccess, access.grants]);
  const organizerById = useMemo(() => new Map(organizers.map((organizer) => [organizer.id, organizer])), [organizers]);
  const selectedGameTags = gameTagsFromTags(form.tags);
  const installsToShared = form.tags.includes('ac') && (active.kind === 'car' || active.kind === 'track');
  const isPhoto = active.kind === 'photo';
  const isCar = active.kind === 'car';
  const isTrack = active.kind === 'track';
  const isWeather = active.kind === 'weather_preset';
  const isCarSet = active.kind === 'car_set';
  const isSkin = active.kind === 'skin';
  const isPlugin = active.kind === 'plugin';
  const archiveRequired = active.upload === 'archive' && form.owner !== 'official';
  const archiveMissing = archiveRequired && !preparedUpload && !editing?.archiveAssetId;
  const newFileReady = !file || uploadPhase === 'uploaded';
  const hasOwner = active.kind !== 'weather_preset' && active.kind !== 'car_set';
  const hasDescription = false;
  const hasManualMetadata = !isPhoto && !isCar && !isTrack && !isWeather && !isCarSet && !isPlugin;
  const preservesExistingMetadata = isCar || isTrack || isPlugin;
  const supportsOfficialDlc = (isCar || isTrack) && form.owner === 'official' && selectedGameTags.includes('ac');

  const load = useCallback(async (searchOverride = search, after?:string, silent=false) => {
    if(isSkin)return;
    const revision=++generation.current;
    if(!silent){setListLoading(true);if(!after)setItems([]);}setListError('');
    const query = new URLSearchParams({ kind: active.kind,limit:'40' });
    if(after)query.set('afterId',after);
    if (isSkin && statusFilter !== 'all') query.set('status', statusFilter);
    if (searchOverride.trim()) query.set('search', searchOverride.trim());
    if (tagFilter.length) query.set('tags', tagFilter.join(','));
    try{const data=await apiFetch<{items:CatalogItem[];nextAfterId:string|null}>(`/admin/catalog/items?${query}`);
      if(revision===generation.current){setItems(old=>after?[...old,...data.items]:data.items);setNextAfterId(data.nextAfterId);}
    }catch(e){if(revision===generation.current)setListError(String(e));}
    finally{if(revision===generation.current)setListLoading(false);}
  }, [active.kind, isSkin, run, search, statusFilter, tagFilter]);

  useRealtimeRefresh(['catalog','skins'],()=>load(search,undefined,true),!isSkin);
  async function loadTags() {
    const query = new URLSearchParams({ kind: active.kind });
    const data = await apiFetch<string[]>(`/admin/catalog/tags?${query.toString()}`);
    setTagOptions(normalizeTagOptions([...(Array.isArray(data) ? data : []), ...gameTagOptions]));
  }

  useEffect(() => {
    void apiFetch<AccessOrganizer[]>('/admin/access/organizers').then(setOrganizers).catch(() => setOrganizers([]));
    void apiFetch<CarBrand[]>('/admin/catalog/car-brands').then(setCarBrands).catch(() => setCarBrands([]));
    void apiFetch<OfficialDlc[]>('/admin/catalog/official-dlcs').then(setOfficialDlcs).catch(() => setOfficialDlcs([]));
  }, []);

  useEffect(() => {
    if (isSkin) return;
    void load();
    void loadTags();
    return()=>{generation.current++;};
  }, [active.kind, statusFilter, tagFilter, isSkin, load]);

  function openCreate() {
    const owner = ownerOptions[0]?.value ?? defaultOwner(access);
    setEditing(null);
    setFile(null);
    setProgress(null);
    setUploadPhase('idle');
    setPreparedUpload(null);
    setSaveState({ loading: false, error: null, data: null, done: false });
    setForm(emptyForm(active.kind, owner));
    setOpen(true);
  }

  const openEdit = useCallback((item: CatalogItem) => {
    setEditing(item);
    setFile(null);
    setProgress(null);
    setUploadPhase('idle');
    setPreparedUpload(null);
    setSaveState({ loading: false, error: null, data: null, done: false });
    setForm({
      code: item.code,
      title: item.title,
      owner: ownerFromItem(item),
      description: item.description ?? '',
      tags: normalizeCatalogFormTags(item.tags, item.kind),
      metadata: JSON.stringify(item.metadata ?? {}, null, 2),
      status: item.status,
      carBrandCode: item.carBrandCode ?? '',
      officialDlcCode: item.officialDlc?.code ?? '',
    });
    setOpen(true);
  }, [setSaveState]);

  async function selectFile(next: File | null) {
    if (preparedUpload) {
      await apiFetch(`/admin/content-upload-sessions/${preparedUpload.id}`, { method: 'DELETE' }).catch(() => undefined);
    }
    setPreparedUpload(null);
    setFile(next);
    setProgress(null);
    setSaveState({ loading: false, error: null, data: null, done: false });
    if (!next) { setUploadPhase('idle'); return; }
    if (!editing) {
      const title = next.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      setForm((current) => ({ ...current, title: current.title || title, code: current.code || deriveCode(next.name) }));
    }
    const body = new FormData();
    body.set('file', next);
    body.set('assetKind', active.upload === 'image' ? 'image' : 'archive');
    body.set('ownerType', form.owner.startsWith('organizer:') ? 'organizer' : 'platform');
    if (form.owner.startsWith('organizer:')) body.set('ownerId', form.owner.slice(10));
    setUploadPhase('uploading');
    setProgress(0);
    try {
      const session = await apiUploadFormData<ContentUploadSession>('/admin/content-upload-sessions', body, ({ percent }) => setProgress(percent));
      setPreparedUpload(session);
      setUploadPhase('uploaded');
    } catch (error) {
      setUploadPhase('error');
      setSaveState({ loading: false, error: error instanceof Error ? error.message : String(error), data: null, done: false });
    }
  }

  async function closeEditor() {
    if (saveState.loading) return;
    if (preparedUpload) await apiFetch(`/admin/content-upload-sessions/${preparedUpload.id}`, { method: 'DELETE' }).catch(() => undefined);
    setPreparedUpload(null); setFile(null); setUploadPhase('idle'); setProgress(null); setOpen(false);
  }

  function setTitle(title: string) {
    setForm((current) => ({
      ...current,
      title,
      code: editing ? current.code : current.code || deriveCode(title),
    }));
  }

  async function save(targetStatus?: CatalogStatus) {
    if (isCar && !form.carBrandCode) {
      setSaveState({ loading: false, error: 'Выбери марку машины', data: null, done: false });
      return;
    }
    if (isPhoto && !file && !editing?.primaryImageAssetId) {
      setSaveState({ loading: false, error: 'Выбери изображение', data: null, done: false });
      return;
    }
    if (archiveMissing) {
      setSaveState({ loading: false, error: 'Для неофициального контента обязательно выберите ZIP-архив. Без него элемент нельзя использовать в событиях.', data: null, done: false });
      return;
    }
    if (!selectedGameTags.length) {
      setSaveState({ loading: false, error: 'Добавь тег игры: ac, acc или iracing', data: null, done: false });
      return;
    }
    if (!isPhoto && selectedGameTags.length !== 1) {
      setSaveState({ loading: false, error: 'Для этой категории нужна ровно одна игра: ac, acc или iracing', data: null, done: false });
      return;
    }
    let metadata: Record<string, unknown> = preservesExistingMetadata ? (editing?.metadata ?? {}) : {};
    if (isTrack) metadata = parseMetadata(form.metadata);
    if (isTrack && Array.isArray(metadata.layouts) && metadata.layouts.some(layout => layout.pitboxes !== undefined && (!Number.isSafeInteger(layout.pitboxes) || layout.pitboxes < 1))) {
      setSaveState({ loading: false, error: 'Количество мест конфигурации должно быть целым числом больше нуля', data: null, done: false });
      return;
    }
    if (isWeather) metadata = weatherMetadataFromForm(form.metadata);
    if (isCarSet) metadata = carSetMetadataFromForm(form.metadata);
    if (hasManualMetadata) {
      try {
        metadata = parseMetadata(form.metadata);
      } catch (error) {
        setSaveState({ loading: false, error: error instanceof Error ? error.message : String(error), data: null, done: false });
        return;
      }
    }
    const owner = ownerToPayload(form.owner);
    const description = hasDescription ? form.description.trim() || null : null;
    const status = targetStatus ?? form.status;
    let confirmedAsset: ContentAsset | null = null;
    if (preparedUpload) {
      try {
        const confirmation = await apiFetch<{ session: ContentUploadSession; asset: ContentAsset }>(
          `/admin/content-upload-sessions/${preparedUpload.id}/confirm`,
          { method: 'POST' },
        );
        confirmedAsset = confirmation.asset;
      } catch (error) {
        setSaveState({ loading: false, error: error instanceof Error ? error.message : String(error), data: null, done: false });
        return;
      }
    }
    const updatePayload = {
      kind: active.kind,
      code: catalogCodeForSave(form.code, form.title, editing?.code),
      title: form.title.trim(),
      description,
      carBrandCode: isCar ? form.carBrandCode : null,
      sourceType: owner.sourceType === 'official' ? 'official' : 'mod',
      officialDlcCode: supportsOfficialDlc ? form.officialDlcCode || null : null,
      ownerType: owner.submittedByOrganizerId ? 'organizer' : 'platform', ownerId: owner.submittedByOrganizerId,
      gameCode: ({ ac: 'assetto_corsa', acc: 'assetto_corsa_competizione', iracing: 'iracing' } as Record<string, string>)[selectedGameTags[0]] ?? selectedGameTags[0],
      tags: form.tags,
      metadata,
      archiveAssetId: active.upload === 'archive' && confirmedAsset ? confirmedAsset.id : editing?.archiveAssetId ?? null,
      primaryImageAssetId: active.upload === 'image' && confirmedAsset ? confirmedAsset.id : editing?.primaryImageAssetId ?? null,
      status,
    };
    try {
      const saved = await runSave(async () => {
        if (!editing) return apiFetch<CatalogItem>('/admin/catalog/items', jsonBody(updatePayload));
        let item = editing;
        if (updatePayload.archiveAssetId !== editing.archiveAssetId || JSON.stringify(metadata) !== JSON.stringify(editing.metadata) || updatePayload.officialDlcCode !== (editing.officialDlcCode ?? null)) {
          item = await apiFetch<CatalogItem>(`/admin/catalog/items/${item.id}/versions`, jsonBody({ expectedVersion: item.revision, archiveAssetId: updatePayload.archiveAssetId, metadata, officialDlcCode: updatePayload.officialDlcCode }));
          setEditing(item);
        }
        item = await apiFetch<CatalogItem>(`/admin/catalog/items/${item.id}`, patchJsonBody({ expectedVersion: item.revision, patch: { title: updatePayload.title, description, carBrandCode: updatePayload.carBrandCode, tags: form.tags, primaryImageAssetId: updatePayload.primaryImageAssetId, status } }));
        return item;
      });
      if (!saved) {
        if (confirmedAsset) await apiFetch(`/admin/content-assets/${confirmedAsset.id}`, { method: 'DELETE' }).catch(() => undefined);
        return;
      }
      setPreparedUpload(null);
      setFile(null);
      setUploadPhase('idle');
      setOpen(false);
      await load();
      await loadTags();
    } finally {
      setProgress(null);
    }
  }

  async function installShared(item: CatalogItem) {
    try {
      const updated = await run(() => apiFetch<CatalogItem>(`/admin/catalog/items/${item.id}/install-shared`, jsonBody({}))) as CatalogItem | undefined;
      if (updated && editing?.id === updated.id) setEditing(updated);
      await load();
    } catch {
      // useAsyncState keeps the actionable daemon error visible in the editor.
    }
  }

  async function uploadTougeZones(item: CatalogItem, layoutCode: string, file: File) {
    const body = new FormData();
    body.set('file', file);
    body.set('assetKind', 'touge_zones'); body.set('ownerType', item.ownerType ?? 'platform'); if (item.ownerId) body.set('ownerId', item.ownerId);
    const updated = await run(async () => {
      const session = await apiUploadFormData<ContentUploadSession>('/admin/content-upload-sessions', body);
      const { asset } = await apiFetch<{ asset: ContentAsset }>(`/admin/content-upload-sessions/${session.id}/confirm`, { method: 'POST' });
      return apiFetch<CatalogItem>(`/admin/catalog/items/${item.id}/layouts/${encodeURIComponent(layoutCode || 'default')}/touge-zones`, jsonBody({ expectedVersion: item.revision, assetId: asset.id }));
    }) as CatalogItem | undefined;
    if (updated) {
      if (editing?.id === updated.id) setEditing(updated);
      await load();
      await loadTags();
    }
  }

  async function downloadTougeZones(item: CatalogItem, layoutCode: string) {
    await run(async () => {
      const info = await apiFetch<{ url: string; fileName: string }>(`/admin/catalog/items/${item.id}/layouts/${encodeURIComponent(layoutCode || 'default')}/touge-zones`);
      const response = await fetch(info.url); if (!response.ok) throw new Error('Не удалось скачать файл зон');
      const download = { blob: await response.blob(), fileName: info.fileName };
      const url = URL.createObjectURL(download.blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = download.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      return true;
    });
  }

  async function uploadPrimaryImage(item: CatalogItem, imageFile: File) {
    const body = new FormData();
    body.set('file', imageFile);
    body.set('assetKind', 'image');
    body.set('ownerType', item.ownerType ?? 'platform');
    if (item.ownerId) body.set('ownerId', item.ownerId);
    setProgress(0);
    let confirmedAsset: ContentAsset | null = null;
    try {
      const session = await apiUploadFormData<ContentUploadSession>(
        '/admin/content-upload-sessions',
        body,
        ({ percent }) => setProgress(percent),
      );
      const confirmation = await apiFetch<{ session: ContentUploadSession; asset: ContentAsset }>(
        `/admin/content-upload-sessions/${session.id}/confirm`,
        { method: 'POST' },
      );
      confirmedAsset = confirmation.asset;
      const updated = await runSave(() => apiFetch<CatalogItem>(
        `/admin/catalog/items/${item.id}`,
        patchJsonBody({
          expectedVersion: item.revision, patch: { primaryImageAssetId: confirmedAsset!.id },
        }),
      ));
      if (!updated) {
        await apiFetch(`/admin/content-assets/${confirmedAsset.id}`, { method: 'DELETE' }).catch(() => undefined);
        return;
      }
      if (updated) {
        setEditing(updated);
        await load();
        await loadTags();
      }
    } finally {
      setProgress(null);
    }
  }

  async function deletePrimaryImage(item: CatalogItem) {
    const updated = await runSave(() => apiFetch<CatalogItem>(
      `/admin/catalog/items/${item.id}`,
      patchJsonBody({
        expectedVersion: item.revision, patch: { primaryImageAssetId: null },
      }),
    ));
    if (updated) {
      setEditing(updated);
      await load();
      await loadTags();
    }
  }

  async function toggleUse(item: CatalogItem) {
    if (item.kind !== 'skin') return;
    const nextStatus: CatalogStatus = item.status === 'active' ? 'disabled' : 'active';
    const updated = await run(() => apiFetch<CatalogItem>(`/admin/catalog/items/${item.id}`, patchJsonBody({ status: nextStatus, sourceType: item.sourceType, submittedByOrganizerId: item.submittedByOrganizerId }))) as CatalogItem | undefined;
    if (updated && editing?.id === updated.id) {
      setEditing(updated);
      setForm((current) => ({ ...current, status: updated.status }));
    }
    await load();
  }

  async function deleteItem(item: CatalogItem) {
    if (!window.confirm(`Убрать «${item.title}» из нового выбора? Сохранённые версии событий останутся доступны.`)) return;
    try {
      await run(() => apiFetch(`/admin/catalog/items/${item.id}`, { ...jsonBody({ expectedVersion: item.revision }), method: 'DELETE' }));
      if (editing?.id === item.id) {
        setOpen(false);
        setEditing(null);
      }
      await load();
      await loadTags();
    } catch {
      // useAsyncState leaves backend usage/storage errors visible in the editor.
    }
  }

  const useAction = editing?.status === 'active' || form.status === 'active' ? 'Сделать недоступным' : 'Сделать доступным';
  const useTarget: CatalogStatus = editing?.status === 'active' || form.status === 'active' ? 'disabled' : 'active';

  const catalogTabs = (
    <Section>
      <Tabs
        value={tabIndex}
        onChange={(_, value: number) => {
          setTabIndex(value);
          const nextKind = tabs[value]?.kind;
          if (nextKind) {
            const url = new URL(window.location.href);
            url.searchParams.set('kind', nextKind);
            window.history.replaceState(window.history.state, '', url);
          }
        }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {tabs.map((tab) => <Tab key={tab.kind} label={tab.label} />)}
      </Tabs>
    </Section>
  );

  if (isSkin) {
    return (
      <Page title="Каталог" subtitle="Скины, машины, трассы и остальные игровые материалы в одном месте.">
        {catalogTabs}
        <Section>
          <SkinsPage embedded access={access} />
        </Section>
      </Page>
    );
  }

  return (
    <Page title="Каталог" subtitle="Скины, машины, трассы и остальные игровые материалы в одном месте.">
      {catalogTabs}

      <Section
        actions={(
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ width: '100%' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <CatalogSearchBox
                value={search}
                onCommit={(nextSearch) => {
                  setSearch(nextSearch);
                }}
              />
              {isSkin ? (
                <FilterButtons label="Доступность" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'Все' }, { value: 'active', label: 'Доступные' }, { value: 'disabled', label: 'Недоступные' }]} />
              ) : null}
            </Stack>
            <Stack direction="row" spacing={1}>
            <RefreshAction onClick={() => { void load(); void loadTags(); }} loading={listLoading} />
              <CreateAction onClick={openCreate} />
            </Stack>
          </Stack>
        )}
      >
        <Stack spacing={1.5}>
          <FilterButtons
            label="Игра"
            value={tagFilter.find(isGameTag) ?? ''}
            onChange={(game) => setTagFilter((current) => [...current.filter((tag) => !isGameTag(tag)), ...(game ? [game] : [])])}
            options={[{ value: '', label: 'Все игры' }, { value: 'ac', label: 'AC' }, { value: 'acc', label: 'ACC' }, { value: 'iracing', label: 'iRacing' }]}
          />
          <FilterTagChips
            options={tagOptions.filter((tag) => !isGameTag(tag))}
            selected={tagFilter.filter((tag) => !isGameTag(tag))}
            onToggle={(tag) => setTagFilter((current) => toggleFilterTag(current, tag))}
            onClear={() => setTagFilter((current) => current.filter(isGameTag))}
          />
          <StatusAlert state={state} />
          {listError&&<Alert severity="error">{listError}</Alert>}
          {listLoading?<Stack gap={2}>{Array.from({length:6},(_,i)=><Skeleton key={i} variant="rounded" height={active.kind==='photo'?150:72}/>)}</Stack>:<CatalogKindView
            kind={active.kind}
            items={items}
            organizerById={organizerById}
            showOwner={hasOwner}
            onEdit={openEdit}
          />}
          {nextAfterId&&<Button disabled={listLoading} onClick={()=>void load(search,nextAfterId)}>Показать ещё</Button>}
        </Stack>
      </Section>

      <Dialog open={open} onClose={() => { void closeEditor(); }} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>{editing ? `Редактировать: ${editing.title}` : `Добавить: ${active.label}`}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
          <FormControlLabel control={<Checkbox checked={form.status === 'active'} onChange={(_, value) => setForm(current => ({ ...current, status: value ? 'active' : 'disabled' }))} />} label='Доступен для нового выбора' />
          {active.upload !== 'none' ? (
            <ArchiveDropZone
              file={file}
              phase={uploadPhase}
              progress={progress}
              accept={active.upload === 'archive' ? '.zip,application/zip' : 'image/*'}
              label={active.upload === 'archive' ? 'Перетащите ZIP-архив сюда' : 'Перетащите изображение сюда'}
              hint={editing ? 'оставьте пустым, чтобы сохранить текущий файл' : 'или выберите файл'}
              buttonLabel={active.upload === 'archive' ? 'Выбрать архив' : 'Выбрать изображение'}
              selectedButtonLabel={active.upload === 'archive' ? 'Выбрать другой архив' : 'Выбрать другое изображение'}
              onSelect={(next) => { void selectFile(next); }}
              disabled={saveState.loading || uploadPhase === 'uploading'}
            />
          ) : null}
          {uploadPhase === 'error' && saveState.error ? (
            <Alert severity="error">{saveState.error}</Alert>
          ) : null}
          {uploadPhase !== 'error' && saveState.error ? <Alert severity="error">{saveState.error}</Alert> : null}
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}

          <FieldGrid>
            <FormCell><TextField fullWidth label="Название" value={form.title} onChange={(event) => setTitle(event.target.value)} /></FormCell>
            {isCar ? <FormCell><FormControl fullWidth size="small" required><InputLabel>Марка</InputLabel><Select label="Марка" value={form.carBrandCode} onChange={(event) => setForm((current) => ({ ...current, carBrandCode: event.target.value }))}>{(['european','american','asian'] as const).flatMap((region) => [<ListSubheader key={`${region}-header`}>{region === 'european' ? 'Европейские' : region === 'american' ? 'Американские' : 'Азиатские'}</ListSubheader>, ...carBrands.filter((brand) => brand.region === region).map((brand) => <MenuItem key={brand.code} value={brand.code}>{brand.title}</MenuItem>)])}</Select></FormControl></FormCell> : null}
            {hasOwner ? (
              <FormCell>
                <FormControl fullWidth size="small">
                  <InputLabel>Владелец</InputLabel>
                  <Select disabled={!!editing || !!preparedUpload || uploadPhase === 'uploading'} label="Владелец" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value as CatalogOwnerValue })}>
                    {ownerOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </FormCell>
            ) : null}
            {isWeather || isCarSet ? (
              <FormCell>
                <WeatherGameSelect
                  value={selectedGameTags[0] ?? ''}
                  onChange={(gameTag) => setForm((current) => ({ ...current, tags: normalizeCatalogFormTags([gameTag], active.kind) }))}
                />
              </FormCell>
            ) : (
              <FormCell wide>
                <TagEditor
                  options={tagOptions}
                  value={form.tags}
                  onChange={(value) => setForm({ ...form, tags: normalizeCatalogFormTags(value, active.kind) })}
                  label="Теги"
                  placeholder="Выберите игру и дополнительные теги"
                />
              </FormCell>
            )}
            {isWeather && selectedGameTags.length ? (
              <FormCell wide>
                <WeatherPresetFields
                  metadata={form.metadata}
                  onChange={(metadata) => setForm((current) => ({ ...current, metadata: JSON.stringify(metadata, null, 2) }))}
                />
              </FormCell>
            ) : null}
            {isCarSet && selectedGameTags.length ? (
              <FormCell wide>
                <CarSetCarsField
                  gameTag={selectedGameTags[0]}
                  metadata={form.metadata}
                  onChange={(metadata) => setForm((current) => ({ ...current, metadata: JSON.stringify(metadata, null, 2) }))}
                />
              </FormCell>
            ) : null}
            {supportsOfficialDlc ? (
              <FormCell>
                <FormControl fullWidth size="small">
                  <InputLabel>Дополнение Assetto Corsa</InputLabel>
                  <Select
                    label="Дополнение Assetto Corsa"
                    value={form.officialDlcCode}
                    onChange={(event) => setForm((current) => ({ ...current, officialDlcCode: event.target.value }))}
                  >
                    <MenuItem value="">Базовая игра</MenuItem>
                    {officialDlcs.map((dlc) => <MenuItem key={dlc.code} value={dlc.code}>{dlc.title}</MenuItem>)}
                  </Select>
                </FormControl>
              </FormCell>
            ) : null}
            {hasDescription ? <FormCell wide><TextField fullWidth multiline minRows={2} label="Описание" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormCell> : null}
            {isTrack ? <FormCell wide><TrackLayoutFields metadata={form.metadata} onChange={metadata => setForm(current => ({ ...current, metadata }))} /></FormCell> : null}
            {hasManualMetadata ? <FormCell wide><TextField fullWidth multiline minRows={8} label="Metadata JSON" value={form.metadata} onChange={(event) => setForm({ ...form, metadata: event.target.value })} /></FormCell> : null}
          </FieldGrid>
          {editing ? (
            <CatalogItemDetails
              item={editing}
              onInstallShared={installShared}
              onUploadPrimaryImage={uploadPrimaryImage}
              onDeletePrimaryImage={deletePrimaryImage}
              onUploadTougeZones={uploadTougeZones}
              onDownloadTougeZones={downloadTougeZones}
            />
          ) : null}
          {installsToShared && active.upload === 'archive' ? (
            <Alert severity="info">
              После сохранения контент с тегом ac будет автоматически установлен на игровой сервер.
            </Alert>
          ) : null}
          {archiveMissing ? (
            <Alert severity="warning">
              Сначала загрузите ZIP-архив. Сохранение станет доступно после подтверждения загрузки.
            </Alert>
          ) : null}
          <StatusAlert state={saveState} operation />
        </DialogContent>
        <DialogActions>
          {editing?.primaryImageAsset ? <Button href={catalogItemImageUrl(editing)} target="_blank" rel="noreferrer">Просмотр</Button> : null}
          {editing?.archiveAsset?.publicUrl ? <Button href={editing.archiveAsset.publicUrl} target="_blank" rel="noreferrer">ZIP</Button> : null}
          {editing ? <Button color="error" onClick={() => void deleteItem(editing)} disabled={saveState.loading}>Удалить</Button> : null}
          <Button onClick={() => { void closeEditor(); }} disabled={saveState.loading}>Отмена</Button>
          {isSkin ? <Button onClick={() => void save(useTarget)} disabled={saveState.loading || !form.title.trim()}>{useAction}</Button> : null}
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={saveState.loading || !newFileReady || !form.title.trim() || (isPhoto && !preparedUpload && !editing?.primaryImageAssetId) || archiveMissing}
          >
            {saveState.loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

    </Page>
  );
}

function WeatherPresetFields({metadata,onChange}:{metadata:string;onChange:(v:Record<string,unknown>)=>void}) {
 return <CatalogPresetFields kind="weather_preset" metadata={JSON.parse(metadata)} cars={[]} onChange={onChange}/>;
}

function WeatherGameSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>Игра</InputLabel>
      <Select label="Игра" value={value} onChange={(event) => onChange(event.target.value)}>
        <MenuItem value="ac">Assetto Corsa</MenuItem>
        <MenuItem value="acc">Assetto Corsa Competizione</MenuItem>
        <MenuItem value="iracing">iRacing</MenuItem>
      </Select>
    </FormControl>
  );
}

function CarSetCarsField({gameTag,metadata,onChange}:{gameTag:string;metadata:string;onChange:(metadata:Record<string,unknown>)=>void}) {
 const [cars,setCars]=useState<CatalogItem[]>([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;void apiFetch<CatalogItem[]>(`/admin/catalog/items?kind=car&tags=${encodeURIComponent(gameTag)}`).then(items=>{if(active)setCars(items);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;};},[gameTag]);
 return <Stack gap={1}>{error&&<Alert severity="error">{error}</Alert>}<CatalogPresetFields kind="car_set" metadata={carSetMetadataFromForm(metadata)} cars={cars} onChange={onChange}/></Stack>;
}

function CatalogItemDetails({
  item,
  onInstallShared,
  onUploadPrimaryImage,
  onDeletePrimaryImage,
  onUploadTougeZones,
  onDownloadTougeZones,
}: {
  item: CatalogItem;
  onInstallShared: (item: CatalogItem) => void;
  onUploadPrimaryImage: (item: CatalogItem, file: File) => void;
  onDeletePrimaryImage: (item: CatalogItem) => void;
  onUploadTougeZones: (item: CatalogItem, layoutCode: string, file: File) => Promise<void>;
  onDownloadTougeZones: (item: CatalogItem, layoutCode: string) => Promise<void>;
}) {
  const canRetryShared = (item.kind === 'car' || item.kind === 'track') && item.tags.includes('ac') && item.storageStatus === 'present' && item.sharedStatus !== 'present' && item.sharedStatus !== 'not_applicable';
  const canEditImage = item.kind === 'car' || item.kind === 'track';
  return (
    <Box sx={{ mt: 0.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Файлы и технические данные</Typography>
        <CatalogDependencies id={item.id} revision={item.revision} />
        <FieldGrid>
          <DetailCell label="ID" value={item.code} />
          <DetailCell label="Добавил" value={catalogActorLabel(item)} />
          <DetailCell label="Обновлено" value={formatDate(item.updatedAt)} />
          <FormCell>
            <Stack spacing={0.75}>
              <Typography variant="caption" color="text.secondary">Хранилище</Typography>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                <StatusChip value={item.storageStatus} />
                {item.archiveAsset ? <Chip size="small" variant="outlined" label={`${item.archiveAsset.fileName} · ${formatBytes(Number(item.archiveAsset.sizeBytes))}`} /> : null}
                {item.primaryImageAsset ? <Chip size="small" variant="outlined" label={`${item.primaryImageAsset.fileName} · ${formatBytes(Number(item.primaryImageAsset.sizeBytes))}`} /> : null}
              </Stack>
            </Stack>
          </FormCell>
          <FormCell>
            <Stack spacing={0.75}>
              <Typography variant="caption" color="text.secondary">Игровой сервер</Typography>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                <StatusChip value={item.sharedStatus} />
                <StatusChip value={item.installStatus} />
                {canRetryShared ? <Button size="small" onClick={() => onInstallShared(item)}>Установить</Button> : null}
              </Stack>
              {item.sharedStatus === 'not_applicable' && item.archiveAssetId ? <Typography variant="caption" color="text.secondary">Установка на игровой сервер подключается в разделе 08.</Typography> : null}{item.installError ? <Typography variant="caption" color="error">{item.installError}</Typography> : null}
            </Stack>
          </FormCell>
          {canEditImage ? (
            <FormCell wide>
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">Фото карточки</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: 1.25, alignItems: 'center' }}>
                  <Box
                    component="img"
                    src={catalogItemImageUrl(item)}
                    alt={item.title}
                    sx={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}
                  />
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Button size="small" variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                      {item.primaryImageAsset ? 'Заменить фото' : 'Добавить фото'}
                      <input
                        hidden
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => {
                          const nextFile = event.target.files?.[0] ?? null;
                          event.target.value = '';
                          if (nextFile) onUploadPrimaryImage(item, nextFile);
                        }}
                      />
                    </Button>
                    {item.primaryImageAsset ? (
                      <Button size="small" color="error" onClick={() => onDeletePrimaryImage(item)}>Удалить фото</Button>
                    ) : null}
                  </Stack>
                </Box>
              </Stack>
            </FormCell>
          ) : null}
          {item.kind === 'track' ? (
            <FormCell wide>
              <TrackLayoutsDetails
                item={item}
                onUploadTougeZones={onUploadTougeZones}
                onDownloadTougeZones={onDownloadTougeZones}
              />
            </FormCell>
          ) : null}
          {item.kind === 'car' ? (
            <FormCell wide>
              <CarSkinsSection carCode={item.code} carName={item.title} />
            </FormCell>
          ) : null}
        </FieldGrid>
      </Stack>
    </Box>
  );
}

function catalogItemImageUrl(item: CatalogItem): string {
  if (item.primaryImageAsset) {
    return getCatalogImageUrl(item.id, item.primaryImageAssetId ?? item.primaryImageAsset.id, item.primaryImageAsset.publicUrl);
  }
  if (item.kind === 'car' || item.kind === 'track') return '/assets/lsr-logo-placeholder.svg';
  return '/assets/catalog-photo-placeholder.svg';
}

function TrackLayoutsDetails({
  item,
  onUploadTougeZones,
  onDownloadTougeZones,
}: {
  item: CatalogItem;
  onUploadTougeZones: (item: CatalogItem, layoutCode: string, file: File) => Promise<void>;
  onDownloadTougeZones: (item: CatalogItem, layoutCode: string) => Promise<void>;
}) {
  const layouts = getTrackLayouts(item);
  const [uploadByLayout, setUploadByLayout] = useState<Record<string, TougeZonesUploadState>>({});

  async function handleUpload(layoutCode: string, file: File) {
    setUploadByLayout((current) => ({
      ...current,
      [layoutCode]: { phase: 'uploading', fileName: file.name },
    }));
    try {
      await onUploadTougeZones(item, layoutCode, file);
      setUploadByLayout((current) => ({
        ...current,
        [layoutCode]: { phase: 'uploaded', fileName: file.name },
      }));
    } catch (error) {
      setUploadByLayout((current) => ({
        ...current,
        [layoutCode]: {
          phase: 'error',
          fileName: file.name,
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  }

  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" color="text.secondary">Конфиги трассы</Typography>
      {layouts.length ? (
        <Stack spacing={0.75}>
          {layouts.map((layout) => {
            const upload = uploadByLayout[layout.code];
            const status: string | undefined = upload?.phase ?? layout.tougeZones?.status;
            const error = upload?.phase === 'error' ? upload.error : layout.tougeZones?.error;
            const isUploading = upload?.phase === 'uploading';
            return (
            <Paper key={layout.code} variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                  <Chip
                    size="small"
                    variant={layout.isDefault ? 'filled' : 'outlined'}
                    label={layout.title}
                  />
                  <Chip
                    size="small"
                    color={tougeZonesColor(status)}
                    variant={isTougeZonesUploaded(status) ? 'filled' : 'outlined'}
                    label={tougeZonesLabel(status)}
                  />
                  {layout.tougeZones?.checksumSha256 ? (
                    <Typography variant="caption" color="text.secondary">{layout.tougeZones.checksumSha256.slice(0, 10)}</Typography>
                  ) : null}
                </Stack>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  {layout.tougeZones?.status === 'present' ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={() => void onDownloadTougeZones(item, layout.code)}
                    >
                      Скачать конфиг
                    </Button>
                  ) : null}
                  <Button size="small" variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={isUploading}>
                    {isUploading ? 'Загрузка…' : layout.tougeZones?.status === 'present' || upload?.phase === 'uploaded' ? 'Заменить разметку' : 'Загрузить разметку'}
                    <input
                      hidden
                      type="file"
                      accept="application/json,.json"
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] ?? null;
                        event.target.value = '';
                        if (nextFile) void handleUpload(layout.code, nextFile);
                      }}
                    />
                  </Button>
                </Stack>
              </Stack>
              {upload?.fileName ? (
                <Typography variant="caption" color="text.secondary">{upload.fileName}</Typography>
              ) : null}
              {error ? (
                <Typography variant="caption" color="error" sx={{ display: 'block' }}>{error}</Typography>
              ) : null}
            </Paper>
            );
          })}
        </Stack>
      ) : <Typography variant="body2" color="text.secondary">Конфиги не найдены</Typography>}
    </Stack>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <FormCell>
      <Stack spacing={0.25}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 650, overflowWrap: 'anywhere' }}>{value || '-'}</Typography>
      </Stack>
    </FormCell>
  );
}

function StatusChip({ value }: { value: string }) {
  const color = value === 'present' || value === 'installed' || value === 'active'
    ? 'success'
    : value === 'failed' || value === 'missing'
      ? 'error'
      : value === 'pending'
        ? 'warning'
        : 'default';
  return <Chip size="small" color={color} variant="outlined" label={statusLabel(value)} />;
}

function statusLabel(value: string) {
  if (value === 'present') return 'загружено';
  if (value === 'missing') return 'нет';
  if (value === 'failed') return 'ошибка';
  if (value === 'installed') return 'установлено';
  if (value === 'uploaded') return 'загружено';
  if (value === 'pending') return 'ожидает';
  if (value === 'not_applicable') return 'не требуется';
  if (value === 'active') return 'доступен';
  if (value === 'disabled') return 'недоступен';
  return value;
}

type TrackLayoutInfo = {
  code: string;
  title: string;
  isDefault: boolean;
  tougeZones?: {
    status?: string;
    checksumSha256?: string;
    updatedAt?: string | null;
    error?: string | null;
  } | null;
};

type TougeZonesUploadState = {
  phase: 'uploading' | 'uploaded' | 'error';
  fileName: string;
  error?: string;
};

function getTrackLayouts(item: CatalogItem): TrackLayoutInfo[] {
  const rawLayouts = item.metadata?.layouts;
  if (!Array.isArray(rawLayouts)) return [];
  return rawLayouts
    .map((rawLayout): TrackLayoutInfo | null => {
      if (!rawLayout || typeof rawLayout !== 'object') return null;
      const layout = rawLayout as Record<string, unknown>;
      const code = typeof layout.code === 'string' ? layout.code.trim() : '';
      const title = typeof layout.title === 'string' ? layout.title.trim() : '';
      if (!code && !title) return null;
      return {
        code: code || 'default',
        title: title || code,
        isDefault: layout.isDefault === true,
        tougeZones: readTougeZonesInfo(layout.tougeZones),
      };
    })
    .filter((layout): layout is TrackLayoutInfo => Boolean(layout));
}

function readTougeZonesInfo(value: unknown): TrackLayoutInfo['tougeZones'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    status: typeof record.status === 'string' ? record.status : undefined,
    checksumSha256: typeof record.checksumSha256 === 'string' ? record.checksumSha256 : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    error: typeof record.error === 'string' ? record.error : null,
  };
}

function tougeZonesLabel(status: string | undefined) {
  if (status === 'uploading') return 'Загрузка…';
  if (status === 'present' || status === 'uploaded') return 'Загружено';
  if (status === 'error') return 'Ошибка загрузки';
  if (status === 'invalid') return 'Ошибка разметки';
  return 'Не загружено';
}

function isTougeZonesUploaded(status: string | undefined) {
  return status === 'present' || status === 'uploaded';
}

function tougeZonesColor(status: string | undefined): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'present' || status === 'uploaded') return 'success';
  if (status === 'uploading') return 'warning';
  if (status === 'invalid' || status === 'error') return 'error';
  return 'default';
}

function catalogOwnerLabel(item: CatalogItem, organizerById: Map<string, AccessOrganizer>) {
  if (item.sourceType === 'platform') return 'Platform';
  if (item.sourceType === 'official' || item.sourceType === 'vanilla') return 'Official';
  return item.submittedByOrganizerId ? (organizerById.get(item.submittedByOrganizerId)?.name ?? item.submittedByOrganizerId) : 'Организатор';
}

function TagPickerChips({ options, selected, onAdd }: { options: string[]; selected: string[]; onAdd: (tag: string) => void }) {
  const selectedSet = new Set(selected);
  const visible = options.filter((tag) => !selectedSet.has(tag)).slice(0, 24);
  if (!visible.length) return null;
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {visible.map((tag) => (
        <Button key={tag} size="small" variant="outlined" onClick={() => onAdd(tag)} sx={{ minHeight: 24, py: 0.25 }}>
          {tag}
        </Button>
      ))}
    </Stack>
  );
}

function CatalogSearchBox({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    const next = draft.trim();
    if (next !== value) onCommit(next);
  }

  return (
    <SearchField
      value={draft}
      onChange={setDraft}
      onCommit={commit}
      fullWidth={false}
      sx={{ width: { xs: '100%', sm: 280 } }}
    />
  );
}

function FilterTagChips({ options, selected, onToggle, onClear }: { options: string[]; selected: string[]; onToggle: (tag: string) => void; onClear: () => void }) {
  if (!options.length && !selected.length) return null;
  const selectedSet = new Set(selected);
  const available = options.filter((tag) => !selectedSet.has(tag));

  return (
    <Stack spacing={0.75}>
      {selected.length ? (
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
          {selected.map((tag) => (
            <Chip key={tag} label={tag} color="primary" onClick={() => onToggle(tag)} onDelete={() => onToggle(tag)} />
          ))}
          <Button size="small" onClick={onClear}>Сбросить теги</Button>
        </Stack>
      ) : null}
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        {available.map((tag) => (
          <Chip key={tag} label={tag} variant="outlined" onClick={() => onToggle(tag)} />
        ))}
      </Stack>
    </Stack>
  );
}

function toggleFilterTag(current: string[], tag: string) {
  const [normalized] = normalizeVisibleTags([tag]);
  if (!normalized) return current;
  if (current.includes(normalized)) return current.filter((item) => item !== normalized);
  return normalizeVisibleTags([...current, normalized]);
}

function defaultOwner(access: AdminAccess): CatalogOwnerValue {
  if (hasPlatformPermission(access, 'catalog.manage.all')) return 'platform';
  return organizerIdsFor(access, 'catalog.manage.scoped')[0] ? `organizer:${organizerIdsFor(access, 'catalog.manage.scoped')[0]}` : 'platform';
}

function buildOwnerOptions(organizers: AccessOrganizer[], hasPlatformCatalogAccess: boolean) {
  const options: Array<{ value: CatalogOwnerValue; label: string }> = [];
  if (hasPlatformCatalogAccess) {
    options.push({ value: 'platform', label: 'Platform' });
    options.push({ value: 'official', label: 'Official' });
  }
  for (const organizer of organizers.filter(isCatalogOwnerOrganizer)) {
    options.push({ value: `organizer:${organizer.id}`, label: `${organizer.name} (${organizer.code})` });
  }
  return options;
}

function ownerFromItem(item: CatalogItem): CatalogOwnerValue {
  if (item.ownerType === 'platform' && item.sourceType !== 'official') return 'platform';
  if (item.sourceType === 'official' || item.sourceType === 'vanilla') return 'official';
  return item.submittedByOrganizerId ? `organizer:${item.submittedByOrganizerId}` : 'platform';
}

function ownerToPayload(owner: CatalogOwnerValue): { sourceType: CatalogSourceType; submittedByOrganizerId: string | null } {
  if (owner === 'platform') return { sourceType: 'platform', submittedByOrganizerId: null };
  if (owner === 'official') return { sourceType: 'official', submittedByOrganizerId: null };
  return { sourceType: 'community', submittedByOrganizerId: owner.replace(/^organizer:/, '') };
}

function isCatalogOwnerOrganizer(organizer: AccessOrganizer) {
  const code = organizer.code.toLowerCase();
  const name = organizer.name.toLowerCase();
  if (code.startsWith('e2e') || code.includes('_e2e') || name.startsWith('ac e2e')) return false;
  return true;
}

function normalizeTags(value: readonly string[]) {
  return Array.from(new Set(value.map((tag) => String(tag ?? '').trim().toLowerCase()).filter(Boolean)));
}

function normalizeTagOptions(value: readonly string[]) {
  return normalizeVisibleTags(value).sort();
}

function normalizeCatalogFormTags(value: readonly string[], kind: CatalogKind) {
  const normalized = normalizeVisibleTags(value);
  if (kind === 'photo') return normalized;
  const gameTags = normalized.filter(isGameTag);
  if (gameTags.length <= 1) return normalized;
  const lastGameTag = gameTags[gameTags.length - 1];
  return normalized.filter((tag) => !isGameTag(tag) || tag === lastGameTag);
}

function gameTagsFromTags(tags: readonly string[]) {
  return tags.filter(isGameTag);
}

function normalizeVisibleTags(value: readonly string[]) {
  return normalizeTags(value).filter((tag) => !tag.startsWith('game:'));
}

function isGameTag(tag: string) {
  return tag === 'ac' || tag === 'acc' || tag === 'iracing';
}

function deriveCode(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || slugify(fileName);
}

function catalogCodeForSave(code: string, title: string, fallback?: string) {
  const seed = code.trim() || title.trim();
  const normalized = deriveCode(seed).slice(0, 159);
  if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,159}$/.test(normalized)) return normalized;
  return fallback;
}

function parseMetadata(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Metadata должен быть JSON object');
  return parsed as Record<string, unknown>;
}

function weatherMetadataFromForm(value:string):Record<string,unknown>{ return parseMetadata(value); }

function carSetMetadataFromForm(value: string): Record<string, unknown> {
  const parsed = parseMetadata(value);
  return { ...parsed, carIds: getCarSetCarIds(value) };
}

function getCarSetCarIds(value: string): string[] {
  const rawCarIds = parseMetadata(value).carIds;
  if (rawCarIds === undefined) return [];
  if (!Array.isArray(rawCarIds) || rawCarIds.some(id=>typeof id!=='string')) throw new Error('Класс содержит некорректные идентификаторы машин');
  return Array.from(new Set(rawCarIds));
}

import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
