import { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { apiFetch, ApiError, putJsonBody } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import { CreateAction, ListToolbar, Page, RefreshAction, SearchField, Section, useDebouncedValue } from '../../shared/ui';
import { FixedTablePagination, EmptyTableRow } from '../../shared/table';
import type { AdminAccess } from '../../shared/types';
import type { AccessGrantRecord, AccessRole, OrganizerRecord } from '../../shared/access-types';
import { defaultSettings, dateLabel, eventTypeName, GrantEditor, OrganizerEditor, quotaFields, scopeNames, statusNames, type GrantDraft, type OrganizerDraft } from './AccessForms';

type AccessUser = { userId: string; steamId?: string; presentation: { displayName: string; avatarUrl?: string } };
type UserPage = { items: AccessUser[]; pagination?: { total: number; totalPages: number } };
type GrantChange = { id: string; actorId: string; at: string; before: AccessGrantRecord | null; after: AccessGrantRecord };
const errors: Record<string, string> = { last_platform_owner: 'Нельзя убрать последнего действующего бессрочного владельца платформы.', version_conflict: 'Запись уже изменена. Закройте форму, обновите список и откройте её заново.', version_required: 'Не получена версия записи. Обновите список.', grant_revoked: 'Отозванный доступ нельзя редактировать. Выдайте новый.', access_denied: 'Недостаточно прав для этого действия.', organizer_code_exists: 'Этот код организатора уже занят.' };
function errorMessage(error: unknown) {
  if (error instanceof ApiError) { try { return errors[JSON.parse(error.bodyText ?? '{}').error?.code] ?? error.message; } catch { return error.message; } }
  return error instanceof Error ? error.message : 'Не удалось выполнить операцию';
}
const newGrant = (subjectId: string): GrantDraft => ({ subjectId, roleCode: '', scopeType: 'organizer', scopeId: null, validFrom: null, validTo: null, constraints: null });

export function AccessPage({ access }: { access: AdminAccess }) {
  const manage = access.grants.some(grant => grant.permissions.includes('access.manage.all'));
  const create = access.grants.some(grant => grant.permissions.includes('organizers.write.all'));
  const [roles, setRoles] = useState<AccessRole[]>([]), [organizers, setOrganizers] = useState<OrganizerRecord[]>([]);
  const [orgQuery, setOrgQuery] = useState(''), [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim());
  const [users, setUsers] = useState<AccessUser[]>([]), [page, setPage] = useState(0), [total, setTotal] = useState(0), [usersLoading, setUsersLoading] = useState(false);
  const [selected, setSelected] = useState<AccessUser | null>(null), [grants, setGrants] = useState<AccessGrantRecord[]>([]), [grantsLoading, setGrantsLoading] = useState(false);
  const [userTab, setUserTab] = useState(0), [org, setOrg] = useState<OrganizerDraft | null>(null), [grant, setGrant] = useState<GrantDraft | null>(null);
  const [history, setHistory] = useState<GrantChange[] | null>(null), [themeText, setThemeText] = useState('null'), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const lock = useRef(false), alive = useRef(true), grantRevision = useRef(0), selectedId = useRef<string | null>(null);
  const commands = useRef(new Map<string, string>());
  useEffect(() => { const userId = new URLSearchParams(window.location.search).get('userId'); if (!userId) return; let live = true; void apiFetch<AccessUser>('/admin/users/' + encodeURIComponent(userId)).then(user => { if (live) openUser(user); }).catch(error => { if (live) setError(errorMessage(error)); }); return () => { live = false; }; }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; grantRevision.current++; }; }, []);
  const command = (path: string, method: string, body: unknown, version?: string): RequestInit => {
    const fingerprint = JSON.stringify([path, method, body, version]);
    const id = commands.current.get(fingerprint) ?? crypto.randomUUID(); commands.current.set(fingerprint, id);
    return { method, headers: { 'Idempotency-Key': id, ...(version ? { 'If-Match': version } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { if (alive.current) setError(errorMessage(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  async function load() {
    const [catalog, rows] = await Promise.all([apiFetch<{ items: AccessRole[] }>('/admin/access/roles'), apiFetch<OrganizerRecord[]>('/admin/access/organizers?includeInactive=true')]);
    if (alive.current) { setRoles(catalog.items); setOrganizers(rows); }
  }
  async function loadGrants(id: string) {
    const revision = ++grantRevision.current; setGrantsLoading(true);
    try {
      const rows = await apiFetch<AccessGrantRecord[]>('/admin/access/grants?subjectId=' + encodeURIComponent(id));
      if (alive.current && revision === grantRevision.current && selectedId.current === id) setGrants(rows);
    } finally { if (alive.current && revision === grantRevision.current) setGrantsLoading(false); }
  }
  useEffect(() => { void load().catch(e => { if (alive.current) setError(errorMessage(e)); }); }, []);
  useEffect(() => {
    if (!manage) return;
    let current = true; setUsersLoading(true);
    void apiFetch<UserPage>(`/admin/users?q=${encodeURIComponent(search)}&page=${page + 1}&pageSize=20`).then(data => {
      if (!current) return;
      setUsers(data.items ?? []); setTotal(data.pagination?.total ?? data.items?.length ?? 0);
      if (data.pagination) setPage(value => Math.min(value, Math.max(0, data.pagination!.totalPages - 1)));
    }).catch(e => { if (current) setError(errorMessage(e)); }).finally(() => { if (current) setUsersLoading(false); });
    return () => { current = false; };
  }, [manage, search, page, reload]);
  useRealtimeRefresh(['security', 'access', 'profiles'], async () => {
    try { await load(); if (selectedId.current) await loadGrants(selectedId.current); setReload(value => value + 1); }
    catch (e) { if (alive.current) setError(errorMessage(e)); }
  });
  function openOrganizer(row?: OrganizerRecord) {
    setError(''); setThemeText(JSON.stringify(row?.settings.theme ?? null, null, 2));
    setOrg(row ? { ...row, presentationOnly: !row.actions.edit } : { code: '', name: '', description: null, active: true, settings: structuredClone(defaultSettings) });
  }
  function openUser(user: AccessUser) {
    selectedId.current = user.userId; setSelected(user); setUserTab(0); setGrants([]); setGrant(null); setPassword(''); setError(''); setNotice('');
    void loadGrants(user.userId).catch(e => { if (selectedId.current === user.userId) setError(errorMessage(e)); });
  }
  function closeUser() { if (busy) return; selectedId.current = null; grantRevision.current++; setSelected(null); setGrant(null); setPassword(''); }
  const saveOrg = () => run(async () => {
    if (!org) return;
    let theme: unknown; try { theme = JSON.parse(themeText); } catch { throw new Error('Оформление должно содержать корректный JSON.'); }
    if (theme !== null && (typeof theme !== 'object' || Array.isArray(theme))) throw new Error('Оформление должно быть объектом или null.');
    const path = org.id ? `/admin/access/organizers/${org.id}${org.presentationOnly ? '/presentation' : ''}` : '/admin/access/organizers';
    const payload = org.presentationOnly ? { name: org.name, description: org.description, theme, websiteUrl: org.settings.websiteUrl, discordUrl: org.settings.discordUrl } : { code: org.code, name: org.name, description: org.description, active: org.active, settings: { ...org.settings, theme } };
    await apiFetch(path, command(path, org.id ? 'PUT' : 'POST', payload, org.version)); commands.current.clear(); setOrg(null); await load(); setNotice('Организатор сохранён.');
  });
  const saveGrant = () => run(async () => {
    if (!grant) return;
    const { id, version, ...payload } = grant;
    const path = id ? `/admin/access/grants/${id}` : '/admin/access/grants';
    await apiFetch(path, command(path, id ? 'PUT' : 'POST', payload, version)); commands.current.clear(); setGrant(null); setUserTab(0); await loadGrants(payload.subjectId); setNotice('Доступ сохранён.');
  });
  const revoke = (row: AccessGrantRecord) => run(async () => {
    const path = `/admin/access/grants/${row.id}`;
    await apiFetch(path, command(path, 'DELETE', undefined, row.version)); commands.current.clear(); await loadGrants(row.subjectId); setNotice('Доступ отозван.');
  });
  const role = roles.find(item => item.code === grant?.roleCode);
  const grantValid = !!role && !!grant && role.scopeTypes.includes(grant.scopeType) && (grant.scopeType === 'platform' || /^[1-9]\d*$/.test(grant.scopeId ?? '')) && (grant.constraints?.mustEndWithinHours == null || Number.isSafeInteger(grant.constraints.mustEndWithinHours) && grant.constraints.mustEndWithinHours > 0) && (!grant.validFrom || !grant.validTo || Date.parse(grant.validFrom) <= Date.parse(grant.validTo));
  const organizerValid = !!org?.name.trim() && (org.presentationOnly || /^[a-z0-9_-]{2,64}$/i.test(org.code.trim()) && quotaFields.every(([key]) => org.settings[key] === null || Number.isSafeInteger(org.settings[key]) && org.settings[key]! > 0));
  const scopeLabel = (row: AccessGrantRecord) => row.scopeType === 'platform' ? scopeNames.platform : row.scopeType === 'organizer' ? organizers.find(item => item.id === row.scopeId)?.name ?? 'Организатор #' + row.scopeId : 'Событие #' + row.scopeId;
  const shownOrganizers = organizers.filter(row => orgQuery.toLocaleLowerCase('ru').split(/\s+/).every(term => [row.name, row.code, row.id].join(' ').toLocaleLowerCase('ru').includes(term)));
  return <Page title="Доступы и организаторы" actions={<RefreshAction loading={busy} onClick={() => void run(async () => { await load(); setReload(value => value + 1); if (selected) await loadGrants(selected.userId); })} />}>
    {error && !org && !selected && <Alert severity="error">{error}</Alert>}{notice && !selected && <Alert severity="success">{notice}</Alert>}
    <Section title="Организаторы" actions={create ? <CreateAction label="Добавить организатора" disabled={busy} onClick={() => openOrganizer()} /> : undefined}>
      <ListToolbar><SearchField label="Поиск организатора" placeholder="Название, код или ID" value={orgQuery} onChange={setOrgQuery} /></ListToolbar>
      <TableContainer><Table size="small" aria-label="Организаторы"><TableHead><TableRow><TableCell>Название</TableCell><TableCell>Может создавать</TableCell><TableCell>Квоты</TableCell><TableCell>Статус</TableCell><TableCell align="right">Действия</TableCell></TableRow></TableHead><TableBody>
        {shownOrganizers.map(row => <TableRow key={row.id} hover>
          <TableCell><Typography fontWeight={750}>{row.name}</Typography><Typography variant="caption" color="text.secondary">{row.code} · ID {row.id}</Typography></TableCell>
          <TableCell><Stack direction="row" useFlexGap flexWrap="wrap" gap={0.5}>{row.settings.allowedEventRuntimeTypes.length ? row.settings.allowedEventRuntimeTypes.map(type => <Chip key={type} size="small" variant="outlined" label={eventTypeName(type)} />) : <Typography variant="body2" color="text.secondary">Все типы</Typography>}</Stack></TableCell>
          <TableCell><Stack gap={0.5}>{quotaFields.filter(([key]) => row.settings[key] !== null).map(([key, label, usage]) => <Typography key={key} variant="caption">{label}: {row.usage ? row.usage[usage] + ' / ' : ''}{row.settings[key]}{row.remaining?.[key] != null ? ' · осталось ' + row.remaining[key] : ''}</Typography>)}{quotaFields.every(([key]) => row.settings[key] === null) && <Typography variant="body2" color="text.secondary">Без ограничений</Typography>}</Stack></TableCell>
          <TableCell><Chip size="small" variant="outlined" label={row.active ? 'Активен' : 'Выключен'} color={row.active ? 'success' : 'default'} /></TableCell>
          <TableCell align="right">{row.actions?.edit || row.actions?.editPresentation ? <Button disabled={busy} onClick={() => openOrganizer(row)}>{row.actions.edit ? 'Настроить' : 'Оформление'}</Button> : <Typography variant="caption" color="text.secondary">Только просмотр</Typography>}</TableCell>
        </TableRow>)}{!shownOrganizers.length && <EmptyTableRow colSpan={5} label="Организаторы не найдены." />}
      </TableBody></Table></TableContainer>
    </Section>
    {manage && <Section title="Доступы пользователей">
      <ListToolbar><SearchField label="Поиск пользователя" placeholder="Имя, SteamID или ID пользователя" value={query} onChange={value => { setQuery(value.slice(0, 200)); setPage(0); }} /></ListToolbar>
      {usersLoading && <Typography variant="body2" role="status" color="text.secondary">Загружаем пользователей…</Typography>}
      <TableContainer><Table size="small" aria-label="Доступы пользователей"><TableHead><TableRow><TableCell>Пользователь</TableCell><TableCell>SteamID</TableCell><TableCell align="right">Доступы</TableCell></TableRow></TableHead><TableBody>
        {users.map(user => <TableRow key={user.userId} hover><TableCell><Stack direction="row" gap={1.5} alignItems="center"><Avatar src={user.presentation.avatarUrl} sx={{ width: 32, height: 32 }} /><Box><Button sx={{ p: 0, justifyContent: 'flex-start' }} onClick={() => openUser(user)}>{user.presentation.displayName}</Button><Typography variant="caption" display="block" color="text.secondary">ID {user.userId}</Typography></Box></Stack></TableCell><TableCell>{user.steamId ?? '—'}</TableCell><TableCell align="right"><Button onClick={() => openUser(user)}>Роли и доступы</Button></TableCell></TableRow>)}
        {!usersLoading && !users.length && <EmptyTableRow colSpan={3} label="Пользователи не найдены." />}
      </TableBody></Table></TableContainer>
      <FixedTablePagination count={total} page={page} rowsPerPage={20} onPageChange={setPage} />
    </Section>}
    <Section title="Что разрешает каждая роль">
      <Typography variant="body2" color="text.secondary">Область определяет, где действуют права: на всей платформе, у организатора или в конкретном событии.</Typography>
      {roles.map(item => <Box key={item.code} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(230px, .75fr) minmax(0, 1.8fr)' }, gap: 2, py: 2, borderTop: 1, borderColor: 'divider' }}><Box><Typography fontWeight={750}>{item.title}</Typography><Typography variant="caption" color="text.secondary">{item.scopeTypes.map(type => scopeNames[type]).join(' · ')}</Typography></Box><Box><Typography variant="body2">{item.description}</Typography><Box component="details" sx={{ mt: 1 }}><Box component="summary" sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: 13 }}>Разрешения: {item.permissions.length}</Box><Stack direction="row" useFlexGap flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>{item.permissions.map(permission => <Chip key={permission} size="small" variant="outlined" label={permission} />)}</Stack></Box></Box></Box>)}
    </Section>
    <Dialog open={!!org} onClose={() => !busy && setOrg(null)} fullWidth maxWidth="md"><DialogTitle>{org?.presentationOnly ? 'Оформление организатора' : org?.id ? 'Настройки организатора' : 'Добавить организатора'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}{org && <OrganizerEditor value={org} onChange={setOrg} disabled={busy} />}
      <Box component="details"><Box component="summary" sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: 14 }}>Оформление</Box><TextField label="Оформление (JSON)" multiline minRows={3} value={themeText} disabled={busy} onChange={e => setThemeText(e.target.value)} sx={{ mt: 1 }} /></Box>
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setOrg(null)}>Закрыть</Button><Button variant="contained" disabled={busy || !organizerValid} onClick={() => void saveOrg()}>Сохранить</Button></DialogActions></Dialog>
    <Dialog open={!!selected} onClose={closeUser} fullWidth maxWidth="md"><DialogTitle>{selected?.presentation.displayName ?? 'Доступы пользователя'}<Typography variant="caption" display="block" color="text.secondary">ID {selected?.userId}</Typography></DialogTitle><DialogContent><Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
      <Tabs value={userTab} onChange={(_, tab: number) => { setUserTab(tab); if (tab === 1 && selected) setGrant(newGrant(selected.userId)); }}><Tab label="Роли" disabled={busy} /><Tab label="Добавить роль" disabled={busy} /><Tab label="Пароль" disabled={busy} /></Tabs>
      {userTab === 0 && <>{grantsLoading ? <Typography color="text.secondary">Загружаем доступы…</Typography> : grants.map(row => <Stack key={row.id} spacing={1} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}><Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between"><Box><Typography fontWeight={750}>{roles.find(item => item.code === row.roleCode)?.title ?? row.roleCode}</Typography><Typography variant="body2" color="text.secondary">{scopeLabel(row)}</Typography></Box><Chip size="small" label={statusNames[row.status ?? (row.revokedAt ? 'revoked' : 'active')]} variant="outlined" /></Stack><Typography variant="caption" color="text.secondary">{row.validFrom ? 'С ' + dateLabel(row.validFrom) : 'Без даты начала'} · {row.validTo ? 'До ' + dateLabel(row.validTo) + '' : 'Бессрочно'}</Typography><Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>{!row.revokedAt && <><Button disabled={busy} onClick={() => { const { revokedAt: _revoked, status: _status, ...draft } = row; setGrant(draft); setUserTab(1); }}>Изменить</Button><Button color="error" disabled={busy} onClick={() => void revoke(row)}>Отозвать</Button></>}<Button disabled={busy} onClick={() => void run(async () => setHistory(await apiFetch<GrantChange[]>(`/admin/access/grants/${row.id}/history`)))}>История</Button></Stack></Stack>)}{!grantsLoading && !grants.length && <Typography color="text.secondary">Ролей пока нет.</Typography>}</>}
      {userTab === 1 && grant && <><GrantEditor value={grant} onChange={setGrant} roles={roles} organizers={organizers} disabled={busy} /><Box><Button variant="contained" disabled={busy || !grantValid} onClick={() => void saveGrant()}>{grant.id ? 'Сохранить доступ' : 'Выдать роль'}</Button></Box></>}
      {userTab === 2 && <><Typography variant="body2" color="text.secondary">Изменение пароля завершит административные сессии пользователя.</Typography><TextField label="Новый пароль" type="password" autoComplete="new-password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /><Stack direction="row" useFlexGap flexWrap="wrap" gap={1}><Button variant="contained" disabled={busy || !password || !selected} onClick={() => void run(async () => { await apiFetch('/admin/auth/password', putJsonBody({ userId: selected!.userId, adminPassword: password })); setPassword(''); setNotice('Пароль изменён.'); })}>Установить пароль</Button><Button color="error" disabled={busy || !selected} onClick={() => void run(async () => { await apiFetch(`/admin/auth/password/${selected!.userId}`, { method: 'DELETE' }); setPassword(''); setNotice('Пароль удалён.'); })}>Удалить пароль</Button></Stack></>}
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={closeUser}>Закрыть</Button></DialogActions></Dialog>
    <Dialog open={history !== null} onClose={() => setHistory(null)} fullWidth maxWidth="md"><DialogTitle>История доступа</DialogTitle><DialogContent><Stack gap={2}>{history?.map(change => <Box key={change.id} sx={{ pb: 1.5, borderBottom: 1, borderColor: 'divider' }}><Typography variant="body2">{dateLabel(change.at)} · Пользователь {change.actorId}</Typography><Typography fontWeight={750}>{!change.before ? 'Доступ выдан' : change.after.revokedAt ? 'Доступ отозван' : 'Доступ изменён'}</Typography><Typography variant="body2" color="text.secondary">{roles.find(item => item.code === change.after.roleCode)?.title ?? change.after.roleCode} · {scopeLabel(change.after)}</Typography></Box>)}{!history?.length && <Typography color="text.secondary">История пуста.</Typography>}</Stack></DialogContent><DialogActions><Button onClick={() => setHistory(null)}>Закрыть</Button></DialogActions></Dialog>
  </Page>;
}
