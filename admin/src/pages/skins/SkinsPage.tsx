import { Autocomplete, TextField as MuiTextField } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, apiFetch, apiUploadFormData } from '../../shared/api';
import { hasPlatformPermission, organizerIdsFor } from '../../shared/access';
import { ArchiveDropZone, type UploadPhase } from '../../shared/ArchiveDropZone';
import { useRealtimeRefresh } from '../../shared/realtime';
import { TagEditor } from '../../shared/TagEditor';
import type { AccessOrganizer, AdminAccess } from '../../shared/types';
import { useDebouncedValue } from '../../shared/ui';
import {
  Button, EmptyState, ErrorState, Field, Fields, Notice, PageHeader, Panel, SearchInput, SelectField, SelectInput, Skeleton, StatusBadge, Table, TableFoot, TextField,
  clickableRow, shortDateTime, usePageChrome,
} from '../../ui/v16';
import { ChipFilter, InlineTags, Thumb } from '../catalog/catalogUi';
import {
  SKIN_GAMES, SKIN_OWNER_TYPES, errorMessage, gameLabel, ownerPayload, readSkinArchiveTitle, skinCreatorName, skinListPath, skinOwnerLabel, skinState, uniqueTags,
  skinPath, versionedPreviewUrl, visibilityLabel, type Skin, type SkinCar, type SkinOwnerValue, type SkinsPage as SkinsPageData,
} from './skinModel';
import '../catalog/catalog.v16.css';
import './skins.v16.css';

export type { Skin } from './skinModel';
const SKINS_PER_PAGE = 40;
const DEFAULT_TAGS = ['ac'];
type LoadError = { message: string; status: number | null };
const loadError = (caught: unknown, fallback: string): LoadError => ({ message: errorMessage(caught, fallback), status: caught instanceof ApiError ? caught.status : null });


function useSkinReferences() {
  const [cars, setCars] = useState<SkinCar[]>([]);
  const [organizers, setOrganizers] = useState<AccessOrganizer[]>([]);
  const [tags, setTags] = useState<string[]>(['ac', 'acc', 'iracing']);
  useEffect(() => {
    let live = true;
    void apiFetch<SkinCar[]>('/games/assetto_corsa/cars').then((rows) => { if (live && Array.isArray(rows)) setCars(rows); }).catch(() => undefined);
    void apiFetch<AccessOrganizer[]>('/admin/access/organizers').then((rows) => { if (live && Array.isArray(rows)) setOrganizers(rows.filter((item) => item.active)); }).catch(() => undefined);
    void apiFetch<string[]>('/admin/catalog/tags').then((rows) => { if (live && Array.isArray(rows)) setTags(uniqueTags(['ac', 'acc', 'iracing', ...rows])); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return { cars, organizers, tags };
}

/** Skins tab of the catalogue: `GET /skins/admin` with search, game and owner type; cursor pages. */
export function SkinsList({ search, onSearch, onCreate }: { search: string; onSearch: (value: string) => void; onCreate: () => void }) {
  const navigate = useNavigate();
  const { cars, organizers } = useSkinReferences();
  const [query, setQuery] = useState(search);
  const debounced = useDebouncedValue(query.trim());
  const [gameFilter, setGameFilter] = useState('');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState('');
  const [items, setItems] = useState<Skin[]>([]);
  const [nextAfterId, setNextAfterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const sequence = useRef(0);
  const carTitle = (code: string) => cars.find((car) => car.code === code)?.title || code;

  useEffect(() => { setQuery(search); }, [search]);
  const latest = useRef({ search, onSearch });
  useEffect(() => { latest.current = { search, onSearch }; });
  // Only a new debounced draft commits the search; an external change of `search` must not be overwritten by a stale draft.
  useEffect(() => { if (debounced !== latest.current.search) latest.current.onSearch(debounced); }, [debounced]);

  const load = useCallback(async (after?: string | null, silent = false) => {
    const revision = ++sequence.current;
    if (!silent) { setLoading(true); if (!after) setItems([]); }
    try {
      const response = await apiFetch<SkinsPageData>(skinListPath({ ownerType: ownerTypeFilter, afterId: after, limit: SKINS_PER_PAGE, q: search, gameCode: gameFilter }));
      if (revision !== sequence.current) return;
      setItems((old) => (after ? [...old, ...response.items] : response.items));
      setNextAfterId(response.nextAfterId);
      setError(null);
    } catch (caught) {
      if (revision === sequence.current) setError(loadError(caught, 'Не удалось загрузить скины'));
    } finally {
      if (revision === sequence.current) setLoading(false);
    }
  }, [ownerTypeFilter, search, gameFilter]);
  useEffect(() => { void load(); const counter = sequence; return () => { counter.current++; }; }, [load]);
  useRealtimeRefresh(['skins'], () => load(null, true));

  const filtered = !!search || !!gameFilter || !!ownerTypeFilter;
  return (
    <Panel title="Материалы · Скины" body={false} shadow>
      <div className="lsr-toolbar lsr-cat-toolbar">
        <SearchInput value={query} onChange={setQuery} onCommit={(value) => onSearch(value)} placeholder="Название, машина или ID скина" label="Поиск скинов" wide />
        <SelectInput value={ownerTypeFilter} onChange={setOwnerTypeFilter} options={SKIN_OWNER_TYPES} label="Тип владельца" />
        <ChipFilter label="Игра" value={gameFilter} onChange={setGameFilter} options={[{ value: '', label: 'Все игры' }, ...SKIN_GAMES]} />
      </div>
      {error && !loading && <div className="lsr-panel-body"><ErrorState error={error.message} status={error.status} onRetry={() => void load()} /></div>}
      {!error && !loading && !items.length && (
        <EmptyState title={filtered ? 'Скинов по выбранным фильтрам нет' : 'Скинов пока нет'} action={filtered ? undefined : <Button variant="primary" onClick={onCreate}>＋ Добавить скин</Button>}>
          {filtered ? 'Измените поиск, игру или владельца.' : 'Загрузите ZIP-архив ливреи.'}
        </EmptyState>
      )}
      {(loading || items.length > 0) && !(error && !items.length) && (
        <Table variant="module" label="Скины">
          <thead><tr><th>Название</th><th>Код / ID</th><th className="lsr-hide-sm">Владелец</th><th className="lsr-hide-md">Доступ</th><th className="lsr-hide-md">Добавил · обновлено</th><th>Статус</th></tr></thead>
          <tbody>
            {loading && !items.length && Array.from({ length: 6 }, (_, i) => (
              <tr key={i} aria-hidden="true"><td><Skeleton width="55%" height={14} /><Skeleton width="35%" height={11} style={{ marginTop: 6 }} /></td><td><Skeleton width={110} height={12} /></td><td className="lsr-hide-sm"><Skeleton width={90} height={12} /></td><td className="lsr-hide-md"><Skeleton width={80} height={12} /></td><td className="lsr-hide-md"><Skeleton width={120} height={12} /></td><td><Skeleton width={74} height={22} /></td></tr>
            ))}
            {items.map((skin) => (
              <tr key={skin.id} {...clickableRow(() => navigate(skinPath(skin.id), { state: { skin } }))} aria-label={`Открыть ${skin.displayName}`}>
                <td>
                  <div className="lsr-cat-name">
                    <Thumb src={versionedPreviewUrl(skin)} alt="" glyph="◩" />
                    <div style={{ minWidth: 0 }}>
                      <b>{skin.displayName}</b><InlineTags tags={[gameLabel(skin.gameCode), ...uniqueTags(skin.tags ?? []).filter((tag) => tag !== 'ac')]} />
                      <div className="lsr-cat-mute">{carTitle(skin.carCode)}</div>
                    </div>
                  </div>
                </td>
                <td><span className="lsr-cat-code">{skin.folderName}</span><div className="lsr-cat-mute">ID {skin.id}</div></td>
                <td className="lsr-hide-sm">{skinOwnerLabel(skin, organizers)}</td>
                <td className="lsr-hide-md">{visibilityLabel(skin)}</td>
                <td className="lsr-hide-md">{skinCreatorName(skin) || '—'}<div className="lsr-cat-mute">{shortDateTime(skin.updatedAt)}</div></td>
                <td><div className="lsr-cat-status">{skinState(skin).map((state) => <StatusBadge key={state.code} status={state} tone={state.tone} variant="badge" title={state.title} />)}</div></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {items.length > 0 && (
        <TableFoot>
          <span>Показано {items.length}{nextAfterId ? '+' : ''}</span>
          {nextAfterId && <Button size="sm" disabled={loading} onClick={() => void load(nextAfterId)}>{loading ? 'Загрузка…' : 'Показать ещё'}</Button>}
        </TableFoot>
      )}
    </Panel>
  );
}

type SkinForm = { carCode: string; displayName: string; visibility: 'public' | 'private'; owner: SkinOwnerValue; tags: string[] };

/** New skin: the ZIP is read locally for the title, then sent as one multipart `POST /skins/admin`. */
export function SkinCreatePage({ access, initialCarCode = '', onLeave }: { access?: AdminAccess; initialCarCode?: string; onLeave: () => void }) {
  const { cars, organizers, tags: tagOptions } = useSkinReferences();
  const platformOwner = !access || hasPlatformPermission(access, 'catalog.manage.all');
  const permittedOrganizers = useMemo(() => (platformOwner ? organizers : organizers.filter((o) => organizerIdsFor(access!, 'catalog.manage.scoped').includes(o.id))), [platformOwner, organizers, access]);
  const [form, setForm] = useState<SkinForm>({ carCode: initialCarCode, displayName: '', visibility: 'public', owner: 'platform', tags: DEFAULT_TAGS });
  const [archive, setArchive] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  usePageChrome({ crumbs: [{ label: 'Игровой каталог', to: '/media-catalog?kind=skin' }, { label: 'Скины', to: '/media-catalog?kind=skin' }, { label: 'Новый скин' }], back: { label: 'К списку', to: '/media-catalog?kind=skin' } });

  useEffect(() => {
    if (!platformOwner && form.owner === 'platform' && permittedOrganizers[0]) setForm((current) => ({ ...current, owner: `organizer:${permittedOrganizers[0].id}` }));
  }, [platformOwner, permittedOrganizers, form.owner]);

  async function selectArchive(file: File | null) {
    setArchive(file); setPhase(file ? 'reading' : 'idle'); setProgress(null); setError('');
    if (!file) return;
    try {
      const title = await readSkinArchiveTitle(file);
      setForm((current) => ({ ...current, displayName: title || current.displayName }));
      setPhase('ready');
    } catch (caught) {
      setPhase('error');
      setError(errorMessage(caught, 'Не удалось прочитать ZIP'));
    }
  }
  async function upload() {
    if (!archive || phase !== 'ready' || !form.carCode || !form.displayName.trim()) { setError('Выберите архив, машину, название и владельца скина'); return; }
    setBusy(true); setError(''); setPhase('uploading'); setProgress(0);
    try {
      const owner = ownerPayload(form.owner);
      const body = new FormData();
      body.set('archive', archive); body.set('carCode', form.carCode); body.set('displayName', form.displayName.trim());
      body.set('visibility', owner.ownerType === 'official' ? 'official' : form.visibility); body.set('tags', form.tags.join(','));
      body.set('ownerType', owner.ownerType); if (owner.ownerId) body.set('ownerId', owner.ownerId);
      await apiUploadFormData<Skin>('/skins/admin', body, ({ percent }) => setProgress(percent));
      setPhase('uploaded');
      onLeave();
    } catch (caught) {
      setPhase('ready');
      setError(errorMessage(caught, 'Не удалось добавить скин'));
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  const ownerOptions = [
    ...(platformOwner ? [{ value: 'official', label: 'Официальный' }, { value: 'platform', label: 'Платформа' }] : []),
    ...permittedOrganizers.map((o) => ({ value: `organizer:${o.id}`, label: o.name })),
  ];
  return (
    <>
      <PageHeader overline="Новый материал" title="Добавить скин" description="Ливрея машины из ZIP-архива" />
      <Panel title="Основное" shadow>
        <div className="lsr-cat-form">
          <Notice>Название заполняется из ui_skin.json, превью выбирается автоматически внутри архива. Скин появится в каталоге после загрузки.</Notice>
          <Field label="ZIP-архив"><ArchiveDropZone file={archive} phase={phase} progress={progress} onSelect={(file) => void selectArchive(file)} disabled={busy} /></Field>
          {error && <Notice tone="danger">{error}</Notice>}
          <Fields>
            <TextField label="Название" value={form.displayName} help="Заполняется из ui_skin.json, можно изменить" onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
            <div className="lsr-cat-mui">
              <Autocomplete sx={{ '& .MuiOutlinedInput-root': { minHeight: 40 } }} options={cars} value={cars.find((car) => car.code === form.carCode) ?? null} getOptionLabel={(car) => `${car.title || car.code} · ${car.code}`} onChange={(_, car) => setForm({ ...form, carCode: car?.code ?? '' })} renderInput={(params) => <MuiTextField {...params} label="Машина" required />} />
            </div>
            <SelectField label="Владелец" value={form.owner} options={ownerOptions.length ? ownerOptions : [{ value: form.owner, label: 'Нет доступных владельцев' }]} onChange={(event) => setForm({ ...form, owner: event.target.value as SkinOwnerValue })} />
            <SelectField label="Доступ" value={form.owner === 'official' ? 'public' : form.visibility} disabled={form.owner === 'official'} options={[{ value: 'public', label: 'Для всех' }, { value: 'private', label: 'Только владельцу' }]} onChange={(event) => setForm({ ...form, visibility: event.target.value as SkinForm['visibility'] })} />
            <div className="lsr-cat-wide"><TagEditor options={uniqueTags(['ac', 'acc', 'iracing', ...tagOptions])} value={form.tags} onChange={(tags) => setForm({ ...form, tags })} label="Теги" placeholder="Выберите тег или добавьте свой" /></div>
          </Fields>
        </div>
        <div className="lsr-form-actions">
          <Button disabled={busy} onClick={onLeave}>Отменить</Button>
          <Button variant="primary" disabled={busy || phase !== 'ready' || !archive || !form.carCode || !form.displayName.trim()} onClick={() => void upload()}>{busy ? 'Загружаем…' : 'Добавить скин'}</Button>
        </div>
      </Panel>
    </>
  );
}

/** Skins of one car inside the car card; a row opens the skin record and returns here. */
export function CarSkinsSection({ carCode }: { carCode: string; carName: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<Skin[]>([]);
  const [nextAfterId, setNextAfterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const load = useCallback(async (after?: string | null) => {
    setLoading(true);
    try {
      const response = await apiFetch<SkinsPageData>(skinListPath({ carCode, afterId: after, limit: 100 }));
      const rows = Array.isArray(response?.items) ? response.items : [];
      setItems((old) => (after ? [...old, ...rows] : rows));
      setNextAfterId(response?.nextAfterId ?? null);
      setError(null);
    } catch (caught) {
      setError(loadError(caught, 'Не удалось загрузить скины машины'));
    } finally {
      setLoading(false);
    }
  }, [carCode]);
  useRealtimeRefresh(['skins'], () => load());
  useEffect(() => { void load(); }, [load]);
  const from = location.pathname + location.search;
  return (
    <>
      {error && <div className="lsr-panel-body"><ErrorState compact error={error.message} status={error.status} onRetry={() => void load()} /></div>}
      {!error && !loading && !items.length && (
        <EmptyState compact title="Для этой машины скинов пока нет" action={<Button size="sm" variant="soft" to={`/media-catalog/new?kind=skin&carCode=${encodeURIComponent(carCode)}`}>＋ Добавить скин</Button>} />
      )}
      {loading && !items.length && !error && <div className="lsr-panel-body"><Skeleton height={14} width="60%" /><Skeleton height={14} width="40%" style={{ marginTop: 8 }} /></div>}
      {items.length > 0 && (
        <Table variant="module" label="Скины машины">
          <thead><tr><th>ID</th><th>Название</th><th className="lsr-hide-md">Добавил</th><th className="lsr-hide-sm">Владелец</th><th className="lsr-hide-md">Доступ</th><th>Состояние</th></tr></thead>
          <tbody>
            {items.map((skin) => (
              <tr key={skin.id} {...clickableRow(() => navigate(skinPath(skin.id), { state: { skin, from } }))} aria-label={`Открыть скин ${skin.displayName}`}>
                <td className="lsr-num">{skin.id}</td>
                <td><b>{skin.displayName}</b><div className="lsr-cat-mute">{skin.folderName}</div></td>
                <td className="lsr-hide-md">{skinCreatorName(skin) || '—'}</td>
                <td className="lsr-hide-sm">{skinOwnerLabel(skin, [])}</td>
                <td className="lsr-hide-md">{visibilityLabel(skin)}</td>
                <td><div className="lsr-cat-status">{skinState(skin).map((state) => <StatusBadge key={state.code} status={state} tone={state.tone} variant="badge" title={state.title} />)}</div></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {items.length > 0 && (
        <TableFoot>
          <span>Скинов: {items.length}{nextAfterId ? '+' : ''}</span>
          {nextAfterId ? <Button size="sm" disabled={loading} onClick={() => void load(nextAfterId)}>Показать ещё</Button> : <Button size="sm" variant="soft" to={`/media-catalog/new?kind=skin&carCode=${encodeURIComponent(carCode)}`}>＋ Добавить скин</Button>}
        </TableFoot>
      )}
    </>
  );
}
