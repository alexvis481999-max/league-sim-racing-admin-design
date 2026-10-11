import {CatalogTagBadges} from '../../shared/CatalogTagBadges';
import { FilterButtons, ListToolbar, SearchField } from '../../shared/ui';
import {useRealtimeRefresh} from '../../shared/realtime';
import { SkinDetailsDialog } from './SkinDetailsDialog';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PaletteIcon from '@mui/icons-material/Palette';
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography, Skeleton,
} from '@mui/material';
import JSZip from 'jszip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiUploadFormData, getApiBaseUrl, patchJsonBody } from '../../shared/api';
import { ArchiveDropZone, type UploadPhase } from '../../shared/ArchiveDropZone';
import { formatDate as formatSharedDate } from '../../shared/format';
import { TagEditor } from '../../shared/TagEditor';
import type { AccessOrganizer, AdminAccess } from '../../shared/types';
import { hasPlatformPermission, organizerIdsFor } from '../../shared/access';

export type Skin = {
  active: boolean; metadataVersion?: number; deletedAt?: string | null; moderation?: { blocked: boolean; reason: string }; allowedActions?: { edit: boolean; moderate: boolean; download: boolean };
  id: number; gameCode: string; carCode: string; displayName: string; folderName: string;
  previewUrl: string | null; previewBucket: string | null; previewObjectKey: string | null;
  archiveUrl: string | null; archiveBucket: string | null; archiveObjectKey: string | null; archiveChecksumSha256: string | null;
  archiveSizeBytes: string | null; ownerType: 'official' | 'platform' | 'organizer' | 'user'; ownerId: string | null;
  visibility: 'official' | 'public' | 'private'; isActive: boolean; createdByUserId: string | null; version: number; tags: string[];
  createdByUser?: { id: string; firstName: string | null; lastName: string | null; steamName: string } | null;
  ownerUser?: { id: string; firstName: string | null; lastName: string | null; steamName: string } | null;
  createdAt: string | null; updatedAt: string | null;
};
type Car = { id: string | number; code: string; title: string };
type SkinsPageResponse = { items: Skin[]; nextAfterId: string | null };
type SkinOwnerValue = 'official' | 'platform' | `organizer:${string}` | `user:${string}`;
type SkinForm = { carCode: string; displayName: string; visibility: 'public' | 'private'; owner: SkinOwnerValue; tags: string[] };
type OwnerUser = { id: number | string; steamName: string; firstName?: string | null; lastName?: string | null };
const SKINS_PER_PAGE = 40;
const DEFAULT_TAGS = ['ac'];
const SKIN_GAMES = [
  { value: 'assetto_corsa', label: 'AC' },
  { value: 'assetto_corsa_competizione', label: 'ACC' },
  { value: 'iracing', label: 'iRacing' },
];

export function SkinsPage({ embedded = false, initialCarCode = '', access }: { embedded?: boolean; initialCarCode?: string; access?: AdminAccess }) {
  const [items, setItems] = useState<Skin[]>([]); const [cars, setCars] = useState<Car[]>([]); const [organizers, setOrganizers] = useState<AccessOrganizer[]>([]); const [tagOptions, setTagOptions] = useState<string[]>(DEFAULT_TAGS);
  const [ownerTypeFilter, setOwnerTypeFilter] = useState(''); const [page, setPage] = useState(0);
  const cursors=useRef<(string|null)[]>([null]),sequence=useRef(0);
  const [nextCursor,setNextCursor]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const [gameFilter, setGameFilter] = useState('');
  const [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false); const [selected, setSelected] = useState<Skin | null>(null);
  const [form, setForm] = useState<SkinForm>(() => emptySkinForm()); const [archive, setArchive] = useState<File | null>(null); const [archivePhase, setArchivePhase] = useState<UploadPhase>('idle'); const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const carByCode = useMemo(() => new Map(cars.map((car) => [car.code, car])), [cars]);

  const load = useCallback(async (silent=false) => {
    const revision=++sequence.current;if(!silent){setLoading(true);setItems([]);}setError('');
    try {const response=await listSkins(`/skins/admin?${new URLSearchParams({ ...(initialCarCode ? { carCode: initialCarCode } : {}), ...(ownerTypeFilter ? { ownerType: ownerTypeFilter } : {}), ...(page&&cursors.current[page]?{afterId:cursors.current[page]!}:{}), limit: String(SKINS_PER_PAGE) })}`, search, gameFilter);
      if(revision===sequence.current){setItems(response.items);setNextCursor(response.nextAfterId);}
    }catch(caught){if(revision===sequence.current)setError(errorMessage(caught,'Не удалось загрузить скины'));}
    finally{if(revision===sequence.current)setLoading(false);}
  }, [initialCarCode, ownerTypeFilter, page, search, gameFilter]);
  useRealtimeRefresh(['skins'],()=>load(true));
  useEffect(() => { void load();return()=>{sequence.current++;}; }, [load]);
  useEffect(() => { void Promise.all([
    apiFetch<Car[]>('/games/assetto_corsa/cars').then(setCars),
    apiFetch<AccessOrganizer[]>('/admin/access/organizers').then((rows) => setOrganizers(rows.filter((item) => item.active))),
    apiFetch<string[]>('/admin/catalog/tags').then((tags) => setTagOptions(uniqueTags(['ac','acc','iracing', ...tags]))),
  ]).catch(() => undefined); }, []);

  const platformOwner = !access || hasPlatformPermission(access, 'catalog.manage.all');
  const permittedOrganizers = platformOwner ? organizers : organizers.filter(o => organizerIdsFor(access!, 'catalog.manage.scoped').includes(o.id));
  const resetForm = () => { setForm({ ...emptySkinForm(), owner: platformOwner ? 'platform' : `organizer:${permittedOrganizers[0]?.id ?? ''}` }); setArchive(null); setArchivePhase('idle'); setProgress(null); setError(''); };
  const selectArchive = async (file: File | null) => {
    setArchive(file); setArchivePhase(file ? 'reading' : 'idle'); setProgress(null); setError(''); if (!file) return;
    try { const title = await readSkinArchiveTitle(file); setForm((current) => ({ ...current, displayName: title || current.displayName })); setArchivePhase('ready'); }
    catch (caught) { setArchivePhase('error'); setError(errorMessage(caught, 'Не удалось прочитать ZIP')); }
  };
  const upload = async () => {
    if (!archive || archivePhase !== 'ready' || !form.carCode || !form.displayName.trim()) { setError('Выберите архив, машину, название и владельца скина'); return; }
    setBusy(true); setError(''); setArchivePhase('uploading'); setProgress(0);
    try {
      const owner = ownerPayload(form.owner);
      const body = new FormData(); body.set('archive', archive); body.set('carCode', form.carCode); body.set('displayName', form.displayName.trim()); body.set('visibility', owner.ownerType === 'official' ? 'official' : form.visibility); body.set('tags', form.tags.join(',')); body.set('ownerType', owner.ownerType); if (owner.ownerId) body.set('ownerId', owner.ownerId);
      await apiUploadFormData<Skin>('/skins/admin', body, ({ percent }) => setProgress(percent)); setArchivePhase('uploaded'); await load(); setCreateOpen(false); resetForm();
    } catch (caught) { setArchivePhase('ready'); setError(errorMessage(caught, 'Не удалось добавить скин')); }
    finally { setBusy(false); setProgress(null); }
  };

  return <Stack spacing={2.5}>
    {!embedded && <Box><Typography variant="h4" fontWeight={800}>Скины</Typography><Typography color="text.secondary">Ливреи машин и их доступность</Typography></Box>}
    <ListToolbar>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
        <SearchField label="Название, машина или ID скина" value={query} onChange={setQuery} onCommit={value => { setSearch(value); setPage(0); }} sx={{ width: { xs: '100%', sm: 360 } }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setCreateOpen(true); }}>Добавить</Button>
      </Stack>
      <FilterButtons label="Игра" value={gameFilter} onChange={value => { setGameFilter(value); setPage(0); }} options={[{ value: '', label: 'Все игры' }, ...SKIN_GAMES]} />
      <FilterButtons label="Тип владельца" value={ownerTypeFilter} onChange={value => { setPage(0); setOwnerTypeFilter(value); }} options={[{ value: '', label: 'Все владельцы' }, { value: 'official', label: 'Official' }, { value: 'platform', label: 'Платформа' }, { value: 'organizer', label: 'Организаторы' }, { value: 'user', label: 'Игроки' }]} />
    </ListToolbar>
    {error && !createOpen ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
      {loading&&Array.from({length:8},(_,i)=><Box key={i}><Skeleton variant="rounded" sx={{aspectRatio:'16 / 9',height:'auto'}}/><Skeleton width="75%" height={32}/><Skeleton width="50%"/><Skeleton height={30}/></Box>)}
      {items.map((skin) => <Box role="button" tabIndex={0} key={skin.id} onClick={() => setSelected(skin)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(skin); } }} sx={{ minWidth: 0, p: 0, overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', color: 'text.primary', textAlign: 'left', cursor: 'pointer', opacity: skin.active ? 1 : .62, transition: 'transform 160ms ease, box-shadow 160ms ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 } }}>
        <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: 'action.hover', overflow: 'hidden' }}>{skin.previewUrl ? <Box component="img" src={versionedPreviewUrl(skin)} alt={skin.displayName} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', color: 'text.disabled' }}><PaletteIcon sx={{ fontSize: 44 }} /></Stack>}{skin.archiveUrl ? <Tooltip title="Скачать ZIP"><IconButton component="a" href={skin.archiveUrl} target="_blank" rel="noreferrer" aria-label={`Скачать ${skin.displayName}`} onClick={(event) => event.stopPropagation()} sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}><DownloadOutlinedIcon fontSize="small" /></IconButton></Tooltip> : null}<Chip size="small" label={skin.active ? 'Активен' : 'Отключён'} color={skin.active ? 'success' : 'default'} sx={{ position: 'absolute', bottom: 10, right: 10 }} /><CatalogTagBadges tags={skin.tags??[]}/><Chip size="small" label={`ID ${skin.id}`} sx={{ position: 'absolute', bottom: 10, left: 10, bgcolor: 'rgba(15,18,25,.82)', color: '#fff', fontWeight: 750 }} /></Box>
        <Stack spacing={1.1} sx={{ p: 1.75 }}><Box><Typography variant="subtitle1" fontWeight={750} noWrap>{skin.displayName}</Typography><Typography variant="body2" color="text.secondary" noWrap>{carByCode.get(skin.carCode)?.title || skin.carCode}</Typography><Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: .45 }}>Добавил: {skinCreatorName(skin) || '—'}</Typography></Box><Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap"><Chip size="small" label={SKIN_GAMES.find(game => game.value === skin.gameCode)?.label ?? skin.gameCode} variant="outlined" /><Chip size="small" label={skinOwnerLabel(skin, organizers)} variant="outlined" /><Chip size="small" label={skin.visibility === 'private' ? 'Приватный' : 'Для всех'} variant="outlined" /></Stack></Stack>
      </Box>)}
    </Box>
    <Stack direction="row" gap={2} alignItems="center"><Button disabled={loading||page===0} onClick={()=>setPage(p=>p-1)}>Назад</Button><Typography>Страница {page+1}</Typography><Button disabled={loading||!nextCursor} onClick={()=>{cursors.current[page+1]=nextCursor;setPage(p=>p+1);}}>Далее</Button></Stack>
    {!loading&&!error&&!items.length ? <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>Скинов по выбранным фильтрам нет.</Typography> : null}

    <Dialog open={createOpen} onClose={() => !busy && setCreateOpen(false)} fullWidth maxWidth="md"><DialogTitle>Добавить скин</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <ArchiveDropZone file={archive} phase={archivePhase} progress={progress} onSelect={(file) => void selectArchive(file)} disabled={busy} />
      <TextField label="Название" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} helperText="Заполняется из ui_skin.json, можно изменить" />
      <Autocomplete options={cars} value={cars.find((car) => car.code === form.carCode) ?? null} getOptionLabel={carLabel} onChange={(_, car) => setForm({ ...form, carCode: car?.code ?? '' })} renderInput={(params) => <TextField {...params} label="Машина" required />} />
      <SkinOwnerPicker value={form.owner} platform={platformOwner} organizers={permittedOrganizers} onChange={(owner) => setForm({ ...form, owner })} />
      <TagEditor options={uniqueTags(['ac','acc','iracing',...tagOptions])} value={form.tags} onChange={(tags) => setForm({ ...form, tags })} label="Теги" placeholder="Выберите тег или добавьте свой" />
      <FormControl><InputLabel>Доступ</InputLabel><Select label="Доступ" value={form.owner === 'official' ? 'public' : form.visibility} disabled={form.owner === 'official'} onChange={(event) => setForm({ ...form, visibility: event.target.value as SkinForm['visibility'] })}><MenuItem value="public">Для всех</MenuItem><MenuItem value="private">Только владельцу</MenuItem></Select></FormControl>
      <Typography variant="caption" color="text.secondary">Preview выбирается автоматически внутри архива.</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setCreateOpen(false)}>Отмена</Button><Button variant="contained" disabled={busy || archivePhase !== 'ready' || !archive || !form.carCode || !form.displayName.trim()} onClick={() => void upload()}>{busy ? 'Загружаем…' : 'Добавить'}</Button></DialogActions></Dialog>
    <SkinDetailsDialog skin={selected} onClose={() => setSelected(null)} onSaved={async (skin) => { setSelected(skin); await load(); }} onDeleted={async () => { setSelected(null); await load(); }} />
  </Stack>;
}

export function CarSkinsSection({ carCode }: { carCode: string; carName: string }) {
  const [items, setItems] = useState<Skin[]>([]); const [selected, setSelected] = useState<Skin | null>(null); const [error, setError] = useState('');
  const load = useCallback(() => listSkins(`/skins/admin?${new URLSearchParams({ carCode, page: '1', limit: '100' })}`).then((response) => setItems(response.items)).catch((caught) => setError(errorMessage(caught, 'Не удалось загрузить скины машины'))), [carCode]);
  useRealtimeRefresh(['skins'],()=>load());
  useEffect(() => { void load(); }, [load]);
  return <Stack spacing={1.25}><Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1}><Typography variant="subtitle2" sx={{ fontWeight: 750 }}>Скины машины</Typography><Typography variant="caption" color="text.secondary">{items.length}</Typography></Stack>{error ? <Alert severity="error">{error}</Alert> : null}{items.length ? <Table size="small"><TableHead><TableRow><TableCell>ID</TableCell><TableCell>Название</TableCell><TableCell>Добавил</TableCell><TableCell>Владелец</TableCell><TableCell>Доступ</TableCell><TableCell>Состояние</TableCell></TableRow></TableHead><TableBody>{items.map((skin) => <TableRow key={skin.id} hover onClick={() => setSelected(skin)} sx={{ cursor: 'pointer' }}><TableCell>{skin.id}</TableCell><TableCell><Typography variant="body2" fontWeight={700}>{skin.displayName}</Typography><Typography variant="caption" color="text.secondary">{skin.folderName}</Typography></TableCell><TableCell>{skinCreatorName(skin) || '—'}</TableCell><TableCell>{skinOwnerLabel(skin, [])}</TableCell><TableCell>{skin.visibility === 'private' ? 'Приватный' : 'Для всех'}</TableCell><TableCell>{skin.active ? 'Активен' : 'Отключён'}</TableCell></TableRow>)}</TableBody></Table> : <Typography variant="body2" color="text.secondary">Для этой машины скинов пока нет.</Typography>}<SkinDetailsDialog skin={selected} onClose={() => setSelected(null)} onSaved={async (skin) => { setSelected(skin); await load(); }} onDeleted={async () => { setSelected(null); await load(); }} /></Stack>;
}

function Detail({ label, value }: { label: string; value: string }) { return <><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value}</Typography></>; }
function emptySkinForm(): SkinForm { return { carCode: '', displayName: '', visibility: 'public', owner: 'platform', tags: DEFAULT_TAGS }; }
function skinFormFromSkin(skin: Skin): SkinForm { return { carCode: skin.carCode, displayName: skin.displayName, visibility: skin.visibility === 'private' ? 'private' : 'public', owner: ownerFromSkin(skin), tags: ['ac', ...extraSkinTags(skin.tags ?? [])] }; }
function skinFormsEqual(left: SkinForm, right: SkinForm): boolean { return left.carCode === right.carCode && left.displayName.trim() === right.displayName.trim() && left.visibility === right.visibility && left.owner === right.owner && left.tags.join('\u0000') === right.tags.join('\u0000'); }
function skinCreatorName(skin: Pick<Skin, 'createdByUser'|'createdByUserId'>): string { const user = skin.createdByUser; if (!user) return skin.createdByUserId?`ID ${skin.createdByUserId}`:''; return `${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.steamName} · ID ${user.id}`; }
function carLabel(car: Car) { return `${car.title || car.code} · ${car.code}`; }
function uniqueTags(tags: readonly string[]) { return Array.from(new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))); }
function extraSkinTags(tags: readonly string[]) { return uniqueTags(tags).filter((tag) => !['ac', 'platform', 'official', 'organizer', 'user'].includes(tag)); }
type OwnerOption = { value: SkinOwnerValue; label: string; group: string; user?: OwnerUser };
function SkinOwnerPicker({ value, organizers, platform = true, onChange }: { value: SkinOwnerValue; organizers: AccessOrganizer[]; platform?: boolean; onChange: (value: SkinOwnerValue) => void }) {
  const options: OwnerOption[] = [...(platform ? [{ value: 'official' as const, label: 'Official', group: 'Платформа' }, { value: 'platform' as const, label: 'Платформа', group: 'Платформа' }] : []), ...organizers.map(o => ({ value: `organizer:${o.id}` as SkinOwnerValue, label: o.name, group: 'Организаторы' }))];
  return <Autocomplete options={options} value={options.find(o => o.value === value) ?? null} getOptionLabel={o => o.label} onChange={(_, o) => { if (o) onChange(o.value); }} renderInput={params => <TextField {...params} label="Владелец" required />} />;
}
function ownerFromSkin(skin: Pick<Skin, 'ownerType' | 'ownerId'>): SkinOwnerValue { return skin.ownerType === 'official' || skin.ownerType === 'platform' ? skin.ownerType : `${skin.ownerType}:${skin.ownerId ?? ''}` as SkinOwnerValue; }
function ownerPayload(owner: SkinOwnerValue): { ownerType: Skin['ownerType']; ownerId: string | null } { const separator = owner.indexOf(':'); if (separator < 0) return { ownerType: owner as Skin['ownerType'], ownerId: null }; return { ownerType: owner.slice(0, separator) as Skin['ownerType'], ownerId: owner.slice(separator + 1) || null }; }
function skinOwnerLabel(skin: Pick<Skin, 'ownerType' | 'ownerId' | 'ownerUser'>, organizers: AccessOrganizer[]): string {
  if (skin.ownerType === 'official') return 'Official';
  if (skin.ownerType === 'platform') return 'Платформа';
  if (skin.ownerType === 'user') return skin.ownerUser ? ownerUserLabel(skin.ownerUser) : `ID ${skin.ownerId ?? '—'} · Пилот`;
  const organizer = organizers.find((item) => String(item.id) === String(skin.ownerId));
  return organizer ? `${organizer.name} (${organizer.code})` : `Организатор #${skin.ownerId ?? '—'}`;
}
function ownerUserName(user: OwnerUser): string { return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.steamName || `Игрок #${user.id}`; }
function ownerUserLabel(user: OwnerUser): string { return `ID ${user.id} · ${ownerUserName(user)}`; }
function mergeUsers(left: OwnerUser[], right: OwnerUser[]): OwnerUser[] { return Array.from(new Map([...left, ...right].map((user) => [String(user.id), user])).values()); }
async function readSkinArchiveTitle(file: File): Promise<string> { const zip = await JSZip.loadAsync(await file.arrayBuffer()); const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir); for (const name of names.filter((item) => /(^|\/)ui_skin\.json$/i.test(item))) { try { const parsed = JSON.parse(await zip.files[name].async('text')) as Record<string, unknown>; const title = String(parsed.skinname ?? parsed.name ?? '').trim(); if (title) return title; } catch { /* Try another ui_skin.json. */ } } const folder = names.map((name) => name.replace(/\\/g, '/').match(/(?:^|\/)skins\/([^/]+)\//i)?.[1]).find(Boolean); return String(folder ?? file.name.replace(/\.zip$/i, '')).replace(/[_-]+/g, ' ').trim(); }
function versionedPreviewUrl(skin: Pick<Skin, 'previewUrl' | 'version' | 'updatedAt'>): string { if (!skin.previewUrl) return ''; const url = new URL(skin.previewUrl, skin.previewUrl.startsWith('/') ? getApiBaseUrl() : window.location.origin); url.searchParams.set('v', `${skin.version || 1}-${skin.updatedAt ? Date.parse(skin.updatedAt) : 0}`); return url.toString(); }
function errorMessage(value: unknown, fallback: string) { return value instanceof Error ? value.message : fallback; }

async function listSkins(path: string, search = '', gameCode = ''): Promise<SkinsPageResponse> {
  const parsed = new URL(path, 'http://local');parsed.searchParams.delete('page');
  if(search.trim())parsed.searchParams.set('q',search.trim());if(gameCode)parsed.searchParams.set('gameCode',gameCode);
  return apiFetch(`${parsed.pathname}?${parsed.searchParams}`);
}
