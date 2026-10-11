import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiUploadFormData, jsonBody, patchJsonBody } from '../../shared/api';
import { ArchiveDropZone, type UploadPhase } from '../../shared/ArchiveDropZone';
import { CatalogPresetFields } from '../../shared/catalog/CatalogPresetFields';
import { TagEditor } from '../../shared/TagEditor';
import type { AccessOrganizer, AdminAccess, CatalogItem, CatalogStatus, ContentAsset } from '../../shared/types';
import { Button, Dialog, Field, Fields, Notice, PageHeader, Panel, SelectField, TextArea, TextField, usePageChrome } from '../../ui/v16';
import { CarSkinsSection } from '../skins/SkinsPage';
import { CatalogDependencies } from './CatalogDependencies';
import { CatalogFilesPanel, TrackLayoutsPanel } from './CatalogItemPanels';
import { fetchAllCars, type LoadError } from './catalogData';
import { TrackLayoutFields } from './TrackLayoutFields';
import {
  GAME_CODE_BY_TAG, buildOwnerOptions, carSetMetadataFromForm, catalogCodeForSave, catalogItemImageUrl, catalogListPath, defaultOwner, deriveCode, emptyForm, errorText,
  formFromItem, gameTagsFromTags, normalizeCatalogFormTags, parseMetadata, statusText,
  type CarBrand, type CatalogDetails, type CatalogForm, type CatalogOwnerValue, type ContentUploadSession, type KindDef, type OfficialDlc,
} from './catalogModel';
import { useCommandSender } from './commandKeys';

type Props = {
  access: AdminAccess;
  def: KindDef;
  /** null — a new card. */
  item: CatalogItem | null;
  details?: { data: CatalogDetails | null; error: LoadError | null; loading: boolean };
  organizers: AccessOrganizer[];
  carBrands: CarBrand[];
  officialDlcs: OfficialDlc[];
  tagOptions: string[];
  onItemChange: (item: CatalogItem) => void;
  onTagsChanged: () => void;
  onLeave: () => void;
};

const REGIONS = [['european', 'Европейские'], ['american', 'Американские'], ['asian', 'Азиатские']] as const;

/** Create / edit page of one catalogue card. File → temporary upload session → confirm → asset ID → card save. */
export function CatalogEditor({ access, def, item, details, organizers, carBrands, officialDlcs, tagOptions, onItemChange, onTagsChanged, onLeave }: Props) {
  const editing = item;
  const kind = def.kind;
  const send = useCommandSender();
  const ownerOptions = useMemo(() => buildOwnerOptions(access, organizers), [access, organizers]);
  const organizerById = useMemo(() => new Map(organizers.map((organizer) => [organizer.id, organizer])), [organizers]);
  const [form, setForm] = useState<CatalogForm>(() => (item ? formFromItem(item) : emptyForm(kind, defaultOwner(access))));
  /** Where the code of a new card comes from: the title until a file is chosen, then the file name; a manual edit wins. */
  const [codeSource, setCodeSource] = useState<'title' | 'file' | 'manual'>(item ? 'manual' : 'title');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [preparedUpload, setPreparedUpload] = useState<ContentUploadSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const prepared = useRef<ContentUploadSession | null>(null);
  useEffect(() => { prepared.current = preparedUpload; }, [preparedUpload]);

  // A new card's owner follows the first permitted option once organizers are known.
  useEffect(() => {
    if (!editing && ownerOptions.length && !ownerOptions.some((option) => option.value === form.owner)) setForm((current) => ({ ...current, owner: ownerOptions[0].value }));
  }, [ownerOptions, editing, form.owner]);
  // Leaving the page without saving cancels the temporary upload; the file is never attached without confirmation.
  useEffect(() => () => {
    if (prepared.current) void apiFetch(`/admin/content-upload-sessions/${prepared.current.id}`, { method: 'DELETE' }).catch(() => undefined);
  }, []);

  const selectedGameTags = gameTagsFromTags(form.tags);
  const isPhoto = kind === 'photo', isCar = kind === 'car', isTrack = kind === 'track', isWeather = kind === 'weather_preset', isCarSet = kind === 'car_set', isPlugin = kind === 'plugin';
  const installsToShared = form.tags.includes('ac') && (isCar || isTrack);
  const archiveRequired = def.upload === 'archive' && form.owner !== 'official';
  const archiveMissing = archiveRequired && !preparedUpload && !editing?.archiveAssetId;
  const newFileReady = !file || uploadPhase === 'uploaded';
  const hasOwner = !isWeather && !isCarSet;
  const hasManualMetadata = !isPhoto && !isCar && !isTrack && !isWeather && !isCarSet && !isPlugin;
  const preservesExistingMetadata = isCar || isTrack || isPlugin;
  const supportsOfficialDlc = (isCar || isTrack) && form.owner === 'official' && selectedGameTags.includes('ac');
  const imageMissing = isPhoto && !preparedUpload && !editing?.primaryImageAssetId;
  const listPath = catalogListPath(kind);

  usePageChrome({
    crumbs: [{ label: 'Игровой каталог', to: listPath }, { label: def.label, to: listPath }, { label: editing ? editing.title : 'Новый материал' }],
    back: { label: 'К списку', to: listPath },
  });

  async function selectFile(next: File | null) {
    if (preparedUpload) await apiFetch(`/admin/content-upload-sessions/${preparedUpload.id}`, { method: 'DELETE' }).catch(() => undefined);
    setPreparedUpload(null);
    setFile(next);
    setProgress(null);
    setError(null);
    if (!next) { setUploadPhase('idle'); return; }
    if (!editing) {
      const title = next.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      setForm((current) => ({ ...current, title: current.title || title, code: codeSource === 'manual' && current.code ? current.code : deriveCode(next.name) }));
      if (codeSource !== 'manual') setCodeSource('file');
    }
    const body = new FormData();
    body.set('file', next);
    body.set('assetKind', def.upload === 'image' ? 'image' : 'archive');
    body.set('ownerType', form.owner.startsWith('organizer:') ? 'organizer' : 'platform');
    if (form.owner.startsWith('organizer:')) body.set('ownerId', form.owner.slice(10));
    setUploadPhase('uploading');
    setProgress(0);
    try {
      const session = await apiUploadFormData<ContentUploadSession>('/admin/content-upload-sessions', body, ({ percent }) => setProgress(percent));
      setPreparedUpload(session);
      setUploadPhase('uploaded');
    } catch (caught) {
      setUploadPhase('error');
      setError(errorText(caught));
    }
  }

  async function leave() {
    if (saving) return;
    if (preparedUpload) await apiFetch(`/admin/content-upload-sessions/${preparedUpload.id}`, { method: 'DELETE' }).catch(() => undefined);
    prepared.current = null;
    setPreparedUpload(null);
    onLeave();
  }

  function setTitle(title: string) {
    setForm((current) => ({ ...current, title, code: !editing && codeSource === 'title' ? deriveCode(title) : current.code }));
  }

  function validate(): string | null {
    if (isCar && !form.carBrandCode) return 'Выбери марку машины';
    if (isPhoto && !file && !editing?.primaryImageAssetId) return 'Выбери изображение';
    if (archiveMissing) return 'Для неофициального контента обязательно выберите ZIP-архив. Без него элемент нельзя использовать в событиях.';
    if (!selectedGameTags.length) return 'Добавь тег игры: ac, acc или iracing';
    if (!isPhoto && selectedGameTags.length !== 1) return 'Для этой категории нужна ровно одна игра: ac, acc или iracing';
    return null;
  }

  async function save() {
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    let metadata: Record<string, unknown> = preservesExistingMetadata ? (editing?.metadata ?? {}) : {};
    try {
      if (isTrack) metadata = parseMetadata(form.metadata);
      if (isWeather) metadata = parseMetadata(form.metadata);
      if (isCarSet) metadata = carSetMetadataFromForm(form.metadata);
      if (hasManualMetadata) metadata = parseMetadata(form.metadata);
    } catch (caught) {
      setError(errorText(caught));
      return;
    }
    if (isTrack && Array.isArray(metadata.layouts) && metadata.layouts.some((layout) => layout.pitboxes !== undefined && (!Number.isSafeInteger(layout.pitboxes) || layout.pitboxes < 1))) {
      setError('Количество мест конфигурации должно быть целым числом больше нуля');
      return;
    }
    const owner = form.owner;
    const sourceType = owner === 'official' ? 'official' : 'mod';
    const ownerId = owner.startsWith('organizer:') ? owner.slice(10) : null;
    const status = form.status;
    setSaving(true);
    setError(null);
    let confirmedAsset: ContentAsset | null = null;
    let attached = false;
    try {
      if (preparedUpload) {
        const confirmation = await send<{ session: ContentUploadSession; asset: ContentAsset }>(`/admin/content-upload-sessions/${preparedUpload.id}/confirm`, { method: 'POST' });
        confirmedAsset = confirmation.asset;
      }
      const payload = {
        kind,
        code: catalogCodeForSave(form.code, form.title, editing?.code),
        title: form.title.trim(),
        description: null,
        carBrandCode: isCar ? form.carBrandCode : null,
        sourceType,
        officialDlcCode: supportsOfficialDlc ? form.officialDlcCode || null : null,
        ownerType: ownerId ? 'organizer' : 'platform',
        ownerId,
        gameCode: GAME_CODE_BY_TAG[selectedGameTags[0]] ?? selectedGameTags[0],
        tags: form.tags,
        metadata,
        archiveAssetId: def.upload === 'archive' && confirmedAsset ? confirmedAsset.id : editing?.archiveAssetId ?? null,
        primaryImageAssetId: def.upload === 'image' && confirmedAsset ? confirmedAsset.id : editing?.primaryImageAssetId ?? null,
        status,
      };
      if (!editing) {
        await send<CatalogItem>('/admin/catalog/items', jsonBody(payload));
        attached = true;
      } else {
        let current = editing;
        if (payload.archiveAssetId !== editing.archiveAssetId || JSON.stringify(metadata) !== JSON.stringify(editing.metadata) || payload.officialDlcCode !== (editing.officialDlcCode ?? null)) {
          current = await send<CatalogItem>(`/admin/catalog/items/${current.id}/versions`, jsonBody({ expectedVersion: current.revision, archiveAssetId: payload.archiveAssetId, metadata, officialDlcCode: payload.officialDlcCode }));
          attached = true;
          onItemChange(current);
        }
        current = await send<CatalogItem>(`/admin/catalog/items/${current.id}`, patchJsonBody({ expectedVersion: current.revision, patch: { title: payload.title, description: null, carBrandCode: payload.carBrandCode, tags: form.tags, primaryImageAssetId: payload.primaryImageAssetId, status } }));
        attached = true;
        onItemChange(current);
      }
      prepared.current = null;
      setPreparedUpload(null);
      setFile(null);
      setUploadPhase('idle');
      onTagsChanged();
      onLeave();
    } catch (caught) {
      // A confirmed asset that no card references is released; once a version references it, it stays.
      if (confirmedAsset && !attached) await apiFetch(`/admin/content-assets/${confirmedAsset.id}`, { method: 'DELETE' }).catch(() => undefined);
      if (confirmedAsset) { prepared.current = null; setPreparedUpload(null); setFile(null); setUploadPhase('idle'); }
      setError(errorText(caught));
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function command(task: () => Promise<CatalogItem | void>) {
    setCommandBusy(true);
    setCommandError(null);
    try {
      const updated = await task();
      if (updated) onItemChange(updated);
    } catch (caught) {
      setCommandError(errorText(caught));
      throw caught;
    } finally {
      setCommandBusy(false);
    }
  }

  const installShared = () => command(() => send<CatalogItem>(`/admin/catalog/items/${editing!.id}/install-shared`, jsonBody({}))).catch(() => undefined);

  async function uploadTougeZones(layoutCode: string, zonesFile: File) {
    const target = editing!;
    const body = new FormData();
    body.set('file', zonesFile);
    body.set('assetKind', 'touge_zones');
    body.set('ownerType', target.ownerType ?? 'platform');
    if (target.ownerId) body.set('ownerId', target.ownerId);
    await command(async () => {
      const session = await apiUploadFormData<ContentUploadSession>('/admin/content-upload-sessions', body);
      const { asset } = await send<{ asset: ContentAsset }>(`/admin/content-upload-sessions/${session.id}/confirm`, { method: 'POST' });
      return send<CatalogItem>(`/admin/catalog/items/${target.id}/layouts/${encodeURIComponent(layoutCode || 'default')}/touge-zones`, jsonBody({ expectedVersion: target.revision, assetId: asset.id }));
    });
  }

  async function downloadTougeZones(layoutCode: string) {
    const target = editing!;
    await command(async () => {
      const info = await apiFetch<{ url: string; fileName: string }>(`/admin/catalog/items/${target.id}/layouts/${encodeURIComponent(layoutCode || 'default')}/touge-zones`);
      const response = await fetch(info.url);
      if (!response.ok) throw new Error('Не удалось скачать файл зон');
      const url = URL.createObjectURL(await response.blob());
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = info.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    }).catch(() => undefined);
  }

  async function uploadPrimaryImage(imageFile: File) {
    const target = editing!;
    const body = new FormData();
    body.set('file', imageFile);
    body.set('assetKind', 'image');
    body.set('ownerType', target.ownerType ?? 'platform');
    if (target.ownerId) body.set('ownerId', target.ownerId);
    let confirmed: ContentAsset | null = null;
    await command(async () => {
      const session = await apiUploadFormData<ContentUploadSession>('/admin/content-upload-sessions', body);
      confirmed = (await send<{ session: ContentUploadSession; asset: ContentAsset }>(`/admin/content-upload-sessions/${session.id}/confirm`, { method: 'POST' })).asset;
      return send<CatalogItem>(`/admin/catalog/items/${target.id}`, patchJsonBody({ expectedVersion: target.revision, patch: { primaryImageAssetId: confirmed.id } }));
    }).then(onTagsChanged).catch(async () => {
      if (confirmed) await apiFetch(`/admin/content-assets/${(confirmed as ContentAsset).id}`, { method: 'DELETE' }).catch(() => undefined);
    });
  }

  const deletePrimaryImage = () => command(() => send<CatalogItem>(`/admin/catalog/items/${editing!.id}`, patchJsonBody({ expectedVersion: editing!.revision, patch: { primaryImageAssetId: null } }))).catch(() => undefined);

  async function deleteItem() {
    const target = editing!;
    setConfirmDelete(false);
    try {
      await command(async () => { await send(`/admin/catalog/items/${target.id}`, { ...jsonBody({ expectedVersion: target.revision }), method: 'DELETE' }); });
      onTagsChanged();
      onLeave();
    } catch {
      // The backend usage/storage conflict stays visible on the page.
    }
  }

  const statusOptions = [{ value: 'active', label: 'Доступно для нового выбора' }, { value: 'disabled', label: 'Выключено' }, ...(form.status === 'archived' ? [{ value: 'archived', label: statusText('archived') }] : [])];
  const image = editing ? catalogItemImageUrl(editing) : null;
  const disabledSave = saving || !newFileReady || !form.title.trim() || imageMissing || archiveMissing;

  const formPanel = (
    <Panel title={editing ? 'Карточка материала' : 'Основное'} shadow className="lsr-cat-record">
      <div className="lsr-cat-form">
        <Notice>{editing ? 'Зависимости и установка на сервер отображаются отдельно от метаданных каталога.' : 'Файл прикрепляется к карточке только после подтверждения загрузки при сохранении.'}</Notice>
        {def.upload !== 'none' && (
          <Field label={def.upload === 'archive' ? 'ZIP-архив' : 'Изображение'} help={editing ? (def.upload === 'archive' ? 'Новый архив создаст новую версию материала.' : 'Новое изображение заменит текущее после сохранения.') : undefined}>
            <ArchiveDropZone
              file={file}
              phase={uploadPhase}
              progress={progress}
              accept={def.upload === 'archive' ? '.zip,application/zip' : 'image/*'}
              label={def.upload === 'archive' ? 'Перетащите ZIP-архив сюда' : 'Перетащите изображение сюда'}
              hint={editing ? 'оставьте пустым, чтобы сохранить текущий файл' : 'или выберите файл'}
              buttonLabel={def.upload === 'archive' ? 'Выбрать архив' : 'Выбрать изображение'}
              selectedButtonLabel={def.upload === 'archive' ? 'Выбрать другой архив' : 'Выбрать другое изображение'}
              onSelect={(next) => { void selectFile(next); }}
              disabled={saving || uploadPhase === 'uploading'}
            />
          </Field>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        {commandError && <Notice tone="danger">{commandError}</Notice>}
        <Fields>
          <TextField label="Название" value={form.title} onChange={(event) => setTitle(event.target.value)} />
          <TextField label="Код" value={form.code} disabled={!!editing} help={editing ? undefined : 'Латиница, цифры, «-» и «_». Заполняется из названия или имени файла.'} onChange={(event) => { setCodeSource('manual'); setForm((current) => ({ ...current, code: event.target.value })); }} />
          {hasOwner && (
            <SelectField label="Владелец" value={form.owner} disabled={!!editing || !!preparedUpload || uploadPhase === 'uploading'} options={ownerOptions.length ? ownerOptions : [{ value: form.owner, label: 'Нет доступных владельцев' }]} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value as CatalogOwnerValue }))} />
          )}
          <SelectField label="Доступность" value={form.status} options={statusOptions} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CatalogStatus }))} />
          {isCar && <BrandSelect value={form.carBrandCode} brands={carBrands} onChange={(carBrandCode) => setForm((current) => ({ ...current, carBrandCode }))} />}
          {(isWeather || isCarSet) && (
            <SelectField
              label="Игра"
              value={selectedGameTags[0] ?? ''}
              options={[{ value: '', label: 'Выберите игру' }, { value: 'ac', label: 'Assetto Corsa' }, { value: 'acc', label: 'Assetto Corsa Competizione' }, { value: 'iracing', label: 'iRacing' }]}
              onChange={(event) => setForm((current) => ({ ...current, tags: normalizeCatalogFormTags(event.target.value ? [event.target.value] : [], kind) }))}
            />
          )}
          {supportsOfficialDlc && (
            <SelectField label="Дополнение Assetto Corsa" value={form.officialDlcCode} options={[{ value: '', label: 'Базовая игра' }, ...officialDlcs.map((dlc) => ({ value: dlc.code, label: dlc.title }))]} onChange={(event) => setForm((current) => ({ ...current, officialDlcCode: event.target.value }))} />
          )}
          {!isWeather && !isCarSet && (
            <div className="lsr-cat-wide">
              <TagEditor options={tagOptions} value={form.tags} onChange={(value) => setForm((current) => ({ ...current, tags: normalizeCatalogFormTags(value, kind) }))} label="Теги" placeholder="Выберите игру и дополнительные теги" />
            </div>
          )}
          {isWeather && selectedGameTags.length > 0 && (
            <div className="lsr-cat-wide">
              <span className="lsr-field-label">Параметры погоды</span>
              <CatalogPresetFields kind="weather_preset" metadata={JSON.parse(form.metadata) as Record<string, unknown>} cars={[]} onChange={(metadata) => setForm((current) => ({ ...current, metadata: JSON.stringify(metadata, null, 2) }))} />
            </div>
          )}
          {isCarSet && selectedGameTags.length > 0 && (
            <div className="lsr-cat-wide">
              <CarSetCarsField gameTag={selectedGameTags[0]} metadata={form.metadata} onChange={(metadata) => setForm((current) => ({ ...current, metadata: JSON.stringify(metadata, null, 2) }))} />
            </div>
          )}
          {isTrack && <TrackLayoutFields metadata={form.metadata} onChange={(metadata) => setForm((current) => ({ ...current, metadata }))} />}
          {hasManualMetadata && <TextArea full label="Metadata JSON" rows={8} value={form.metadata} onChange={(event) => setForm((current) => ({ ...current, metadata: event.target.value }))} />}
        </Fields>
        {installsToShared && def.upload === 'archive' && <Notice>После сохранения контент с тегом ac будет автоматически установлен на игровой сервер.</Notice>}
        {archiveMissing && <Notice tone="warning">Сначала загрузите ZIP-архив. Сохранение станет доступно после подтверждения загрузки.</Notice>}
      </div>
      <div className="lsr-form-actions">
        <Button onClick={() => void leave()} disabled={saving}>Отменить</Button>
        <Button variant="primary" onClick={() => void save()} disabled={disabledSave}>{saving ? 'Сохранение…' : editing ? 'Сохранить изменения' : 'Сохранить'}</Button>
      </div>
    </Panel>
  );

  return (
    <>
      <PageHeader
        overline={editing ? `${def.one} · ${editing.code}` : 'Новый материал'}
        title={editing ? editing.title : `Добавить: ${def.label}`}
        description={editing ? `Игровой каталог · ${def.label}` : 'Машины, трассы, скины и игровые материалы'}
        actions={editing ? (
          <>
            {image && <a className="lsr-btn" href={image} target="_blank" rel="noreferrer">Просмотр</a>}
            {editing.archiveAsset?.publicUrl && <a className="lsr-btn" href={editing.archiveAsset.publicUrl} target="_blank" rel="noreferrer">ZIP</a>}
            <Button variant="danger-solid" onClick={() => setConfirmDelete(true)} disabled={saving || commandBusy}>Удалить</Button>
          </>
        ) : undefined}
      />
      {editing ? (
        <div className="lsr-cols-module">
          <div className="lsr-stack">
            {formPanel}
            {isTrack && <TrackLayoutsPanel item={editing} onUpload={uploadTougeZones} onDownload={downloadTougeZones} />}
            {isCar && <Panel title="Скины машины" shadow body={false}><CarSkinsSection carCode={editing.code} carName={editing.title} /></Panel>}
          </div>
          <div className="lsr-stack">
            <CatalogFilesPanel item={editing} hasFiles={def.upload !== 'none'} organizerById={organizerById} busy={commandBusy || saving} onInstallShared={() => void installShared()} onUploadImage={(next) => void uploadPrimaryImage(next)} onDeleteImage={() => void deletePrimaryImage()} />
            {details && <CatalogDependencies item={editing} details={details} />}
          </div>
        </div>
      ) : formPanel}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Убрать из нового выбора?"
        description={editing ? `«${editing.title}» больше нельзя будет выбрать в новых событиях. Сохранённые версии событий останутся доступны.` : undefined}
        actions={<><Button onClick={() => setConfirmDelete(false)}>Отмена</Button><Button variant="danger-solid" onClick={() => void deleteItem()}>Удалить материал</Button></>}
      />
    </>
  );
}

function BrandSelect({ value, brands, onChange }: { value: string; brands: CarBrand[]; onChange: (value: string) => void }) {
  return (
    <Field label="Марка *" help={brands.length ? undefined : 'Справочник марок недоступен'}>
      <select className="lsr-cat-brand" aria-label="Марка" required value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Выберите марку</option>
        {REGIONS.map(([region, label]) => (
          <optgroup key={region} label={label}>
            {brands.filter((brand) => brand.region === region).map((brand) => <option key={brand.code} value={brand.code}>{brand.title}</option>)}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}

function CarSetCarsField({ gameTag, metadata, onChange }: { gameTag: string; metadata: string; onChange: (metadata: Record<string, unknown>) => void }) {
  const [cars, setCars] = useState<CatalogItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const signal = { cancelled: false };
    setLoading(true);
    setError('');
    fetchAllCars(gameTag, signal).then((items) => { if (!signal.cancelled) setCars(items); }).catch((caught) => { if (!signal.cancelled) setError(errorText(caught)); }).finally(() => { if (!signal.cancelled) setLoading(false); });
    return () => { signal.cancelled = true; };
  }, [gameTag]);
  let parsed: Record<string, unknown> = { carIds: [] };
  try { parsed = carSetMetadataFromForm(metadata); } catch (caught) { return <Notice tone="danger">{errorText(caught)}</Notice>; }
  return (
    <div className="lsr-stack is-tight">
      {error && <Notice tone="danger">{error}</Notice>}
      <CatalogPresetFields kind="car_set" metadata={parsed} cars={cars} disabled={loading} onChange={onChange} />
      <small className="lsr-help">{loading ? 'Загрузка машин игры…' : `Доступно машин: ${cars.length}. Выбрано: ${(parsed.carIds as string[]).length}.`}</small>
    </div>
  );
}
