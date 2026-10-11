import { UserProfilePage } from './UserProfilePage';
import {Link} from 'react-router-dom';
import { FixedTablePagination, openableRow } from '../../shared/table';
import { ListToolbar, SearchField, useDebouncedValue } from '../../shared/ui';
import { Page } from '../../shared/ui';
import {useRealtimeRefresh} from '../../shared/realtime';
import { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Button, Stack, TextField, Typography, MenuItem, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { apiFetch } from '../../shared/api';
type User = { userId: string; steamId: string; firstName: string | null; lastName: string | null; shortName: string | null; country: string; discord: string | null; youtube: string | null; avatar: string | null; complete: boolean; missingFields: string[]; version: string; presentation: { displayName: string; avatarUrl: string }; actions: { edit: boolean; uploadAvatar: boolean; deleteAvatar: boolean } };
type UserPage = { items: User[]; pagination: { page: number; totalPages: number; total: number } };
const fields = ['firstName', 'lastName', 'shortName', 'country', 'discord', 'youtube'] as const;
const labels = ['Имя', 'Фамилия', 'Три буквы', 'Страна', 'Discord', 'YouTube'];
const formOf = (user: User) => Object.fromEntries(fields.map(key => [key, user[key] === 'unknown' ? '' : user[key] ?? ''])) as Record<typeof fields[number], string>;
export function CurrentUsersPage() {
  const [q, setQ] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1), [data, setData] = useState<UserPage | null>(null), [error, setError] = useState(''), [selected, setSelected] = useState<string | null>(() => new URLSearchParams(window.location.search).get('userId')), [reload, setReload] = useState(0);
  const debounced = useDebouncedValue(q.trim());
  useEffect(() => { setSearch(debounced); setPage(1); }, [debounced]);
  useRealtimeRefresh(['profiles'],()=>setReload(v=>v+1));
  useEffect(() => { let live = true; setError(''); apiFetch<UserPage>(`/admin/users?q=${encodeURIComponent(search)}&page=${page}&pageSize=20`).then(value => { if (live) { setData(value); setPage(current => Math.min(current, Math.max(1, value.pagination.totalPages))); } }).catch(error => { if (live) setError(error.message); }); return () => { live = false; }; }, [search, page, reload]);
  function selectUser(id: string | null) { setSelected(id); const url = new URL(window.location.href); if (id) url.searchParams.set('userId', id); else { url.searchParams.delete('userId'); url.searchParams.delete('tab'); } window.history.replaceState({}, '', url); }
  if (selected) return <><EventReturn/><UserProfilePage key={selected} id={selected} back={() => { selectUser(null); setReload(value => value + 1); }} editor={(close,dirty)=><UserEditor id={selected} back={close} onDirty={dirty}/>} /></>;
  return <Page title="Пользователи"><ListToolbar><SearchField label="Поиск пользователей" placeholder="Имя, SteamID, ID или Discord" value={q} onChange={value => setQ(value.slice(0, 200))} onCommit={value => { setSearch(value); setPage(1); }} /></ListToolbar>
    {error && <Alert severity="error">{error}</Alert>}{data ? <><Typography variant="body2" color="text.secondary">Найдено: {data.pagination.total}</Typography>
    <TableContainer><Table aria-label="Пользователи" size="small"><TableHead><TableRow><TableCell>Пилот</TableCell><TableCell>SteamID</TableCell><TableCell>Страна</TableCell><TableCell>Профиль</TableCell><TableCell align="right">Действия</TableCell></TableRow></TableHead><TableBody>
      {data.items.map(user => <TableRow key={user.userId} hover {...openableRow(()=>selectUser(user.userId))}>
        <TableCell><Stack direction="row" alignItems="center" gap={1.5} sx={{ py: 1 }}><Avatar src={user.presentation.avatarUrl} sx={{ width: 36, height: 36 }} /><Stack><Button sx={{ p: 0, justifyContent: 'flex-start', textAlign: 'left', minHeight: 0 }} onClick={() => selectUser(user.userId)}>{user.presentation.displayName}</Button><Typography variant="caption" color="text.secondary">ID {user.userId}{user.shortName ? ' · ' + user.shortName : ''}</Typography></Stack></Stack></TableCell>
        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{user.steamId}</TableCell><TableCell>{user.country === 'unknown' ? '—' : user.country}</TableCell><TableCell><Chip size="small" variant="outlined" color={user.complete ? 'success' : 'default'} label={user.complete ? 'Заполнен' : 'Не заполнен'} /></TableCell><TableCell align="right"><Button onClick={() => selectUser(user.userId)}>Открыть</Button></TableCell>
      </TableRow>)}
      {!data.items.length && <TableRow><TableCell colSpan={5} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>Пользователи не найдены.</TableCell></TableRow>}
    </TableBody></Table></TableContainer>
    <FixedTablePagination count={data.pagination.total} page={page - 1} rowsPerPage={20} onPageChange={next => setPage(next + 1)} /></> : !error && <Typography>Загружаем пользователей…</Typography>}</Page>;
}
function UserEditor({ id, back, onDirty }: { id: string; back(): void; onDirty?(dirty:boolean):void }) {
  const [user, setUser] = useState<User | null>(null), [form, setForm] = useState<ReturnType<typeof formOf> | null>(null), [countries, setCountries] = useState<{code:string;name:string}[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  useEffect(() => { onDirty?.(Boolean(user && form && fields.some(key => form[key] !== formOf(user)[key]))); }, [user, form, onDirty]);
  const live = useRef(false), lock = useRef(false);
  const [remoteChanged, setRemoteChanged] = useState(false);
  useRealtimeRefresh(['profiles'], async () => {
    if (lock.current || !user) return;
    try {
      const fresh = await apiFetch<User>(`/admin/users/${id}`);
      if (live.current && !lock.current) setRemoteChanged(fresh.version !== user.version);
    } catch (e) { if (live.current) setError(e instanceof Error ? e.message : String(e)); }
  });
  async function load() { setError(''); try { const [value, options] = await Promise.all([apiFetch<User>(`/admin/users/${id}`), apiFetch<typeof countries>('/site/countries', {}, 'none')]); if (live.current) { setUser(value); setForm(formOf(value)); setRemoteChanged(false); setCountries(options); setSaved(false); } } catch (error) { if (live.current) setError(error instanceof Error ? error.message : 'Не удалось загрузить профиль.'); } }
  useEffect(() => { live.current = true; void load(); return () => { live.current = false; }; }, [id]);
  async function mutate(init: RequestInit, avatar = false) {
    if (!user || lock.current || !live.current) return;
    lock.current = true; setBusy(true); setError(''); setSaved(false);
    try { const value = await apiFetch<User>(`/admin/users/${id}${avatar ? '/avatar' : ''}`, { ...init, headers: { 'If-Match': user.version } }); if (live.current) { setUser(value); setRemoteChanged(false); if (!avatar) setForm(formOf(value)); setSaved(true); } }
    catch (error) { if (live.current) setError(error instanceof Error ? error.message : 'Не удалось сохранить профиль.'); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  }
  function save() { if (!user || !form) return; const before = formOf(user), patch = Object.fromEntries(fields.filter(key => form[key] !== before[key]).map(key => [key, form[key]])); if (Object.keys(patch).length) void mutate({ method: 'PATCH', body: JSON.stringify(patch) }); }
  return <Page title="Редактирование профиля">{remoteChanged && <Alert severity="warning">Профиль изменён. Ваши правки сохранены в форме. <Button disabled={busy} onClick={() => void load()}>Заменить форму актуальным профилем</Button></Alert>}<Button onClick={back} disabled={busy}>Закрыть</Button>{error && <Alert severity="error">{error}<Button onClick={() => void load()} disabled={busy}>Загрузить актуальный профиль</Button></Alert>}{saved && <Alert severity="success">Сохранено.</Alert>}{user && form ? <>
    <Typography variant="h5">{user.presentation.displayName}</Typography><Typography>ID: {user.userId} · SteamID: {user.steamId}</Typography><Typography>{user.complete ? 'Профиль заполнен' : `Не заполнено: ${user.missingFields.join(', ')}`}</Typography>
    <form onSubmit={event => { event.preventDefault(); save(); }}><fieldset disabled={busy || remoteChanged || !user.actions.edit} style={{ border: 0 }}><Stack spacing={2}>{fields.map((key, index) => key === 'country' ? <TextField key={key} select label="Страна" value={form.country} onChange={event => setForm({ ...form, country: event.target.value })}><MenuItem value="" disabled>Выберите страну</MenuItem>{countries.map(country => <MenuItem key={country.code} value={country.code}>{country.name}</MenuItem>)}</TextField> : <TextField key={key} label={labels[index]} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} inputProps={{ maxLength: key === 'shortName' ? 3 : key === 'youtube' ? 200 : key === 'discord' ? 160 : 80 }} />)}<Button type="submit">Сохранить профиль</Button></Stack></fieldset></form>
    <Avatar src={user.presentation.avatarUrl} sx={{ width: 96, height: 96 }} />
    <label>Аватар JPEG/PNG, до 5 МБ <input aria-label="Аватар" type="file" accept="image/png,image/jpeg" disabled={busy || !user.actions.uploadAvatar} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 5 * 1024 * 1024) { setError('Максимальный размер — 5 МБ.'); return; } const body = new FormData(); body.append('file', file); void mutate({ method: 'POST', body }, true); }} /></label>
    {user.actions.deleteAvatar && <Button disabled={busy} onClick={() => void mutate({ method: 'DELETE' }, true)}>Удалить аватар</Button>}
  </> : !error && <Typography>Загружаем профиль…</Typography>}</Page>;
}

function EventReturn(){const id=new URLSearchParams(window.location.search).get("eventId");return id?<Button component={Link} to={`/events/${encodeURIComponent(id)}?section=participants`}>Вернуться к событию</Button>:null;}
