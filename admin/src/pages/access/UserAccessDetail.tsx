import { useEffect, useRef, useState } from 'react';
import { apiFetch, putJsonBody } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import type { AccessGrantRecord, AccessRole, OrganizerRecord } from '../../shared/access-types';
import { Button, Dialog, EmptyState, ErrorState, FormGroup, LoadingBlock, Notice, Panel, PillButtons, RecordHead, RecordTopline, SaveBar, Skeleton, StatusBadge, Table, Tabs, TextField, Timeline, dateTime, usePageChrome } from '../../ui/v16';
import { GrantEditor } from './AccessForms';
import { errorMessage, errorStatus, eventTypeName, grantStatus, roleTitle, scopeLabel, statusNames, statusTones, useCommands, type AccessUser, type GrantChange, type GrantDraft } from './access-model';

type Tab = 'roles' | 'grant' | 'password';
type Filter = 'all' | 'active' | 'scheduled' | 'expired' | 'revoked';
const newGrant = (subjectId: string): GrantDraft => ({ subjectId, roleCode: '', scopeType: 'organizer', scopeId: null, validFrom: null, validTo: null, constraints: null });
const validity = (row: AccessGrantRecord) => `${row.validFrom ? 'с ' + dateTime(row.validFrom) : 'без даты начала'} · ${row.validTo ? 'до ' + dateTime(row.validTo) : 'бессрочно'}`;

/** Roles, grant editor and admin password of one user. Grants come only from `GET /admin/access/grants?subjectId=`. */
export function UserAccessDetail({ userId, known, roles, organizers, back }: { userId: string; known: AccessUser | null; roles: AccessRole[]; organizers: OrganizerRecord[]; back(): void }) {
  const [user, setUser] = useState<AccessUser | null>(known);
  const name = user?.presentation?.displayName ?? `Пользователь #${userId}`;
  usePageChrome({ crumbs: [{ label: 'Организаторы и доступы', to: '/access' }, { label: 'Доступы пользователей', to: '/access?tab=users' }, { label: name }] });
  const { busy, error, notice, setError, setNotice, command, run, confirmed, alive } = useCommands();
  const [tab, setTab] = useState<Tab>('roles'), [filter, setFilter] = useState<Filter>('all');
  const [grants, setGrants] = useState<AccessGrantRecord[] | null>(null), [grantsError, setGrantsError] = useState<{ message: string; status: number | null } | null>(null), [grantsLoading, setGrantsLoading] = useState(false);
  const [grant, setGrant] = useState<GrantDraft | null>(null), [history, setHistory] = useState<GrantChange[] | null>(null), [password, setPassword] = useState('');
  const revision = useRef(0);
  useEffect(() => {
    if (known) return;
    let live = true;
    void apiFetch<AccessUser>('/admin/users/' + encodeURIComponent(userId)).then(value => { if (live) setUser(value); }).catch(e => { if (live) setError(errorMessage(e)); });
    return () => { live = false; };
  }, [userId]);
  async function loadGrants() {
    const current = ++revision.current; setGrantsLoading(true);
    try {
      const rows = await apiFetch<AccessGrantRecord[]>('/admin/access/grants?subjectId=' + encodeURIComponent(userId));
      if (alive.current && current === revision.current) { setGrants(rows); setGrantsError(null); }
    } catch (e) { if (alive.current && current === revision.current) setGrantsError({ message: errorMessage(e), status: errorStatus(e) }); }
    finally { if (alive.current && current === revision.current) setGrantsLoading(false); }
  }
  useEffect(() => { void loadGrants(); return () => { revision.current++; }; }, [userId]);
  useRealtimeRefresh(['security', 'access'], () => loadGrants());

  const role = roles.find(item => item.code === grant?.roleCode);
  const grantValid = !!role && !!grant && role.scopeTypes.includes(grant.scopeType) && (grant.scopeType === 'platform' || /^[1-9]\d*$/.test(grant.scopeId ?? '')) && (grant.constraints?.mustEndWithinHours == null || Number.isSafeInteger(grant.constraints.mustEndWithinHours) && grant.constraints.mustEndWithinHours > 0) && (!grant.validFrom || !grant.validTo || Date.parse(grant.validFrom) <= Date.parse(grant.validTo));
  const saveGrant = () => run(async () => {
    if (!grant) return;
    const { id, version, ...payload } = grant;
    const path = id ? `/admin/access/grants/${id}` : '/admin/access/grants';
    await apiFetch(path, command(path, id ? 'PUT' : 'POST', payload, version)); confirmed(); setGrant(null); setTab('roles'); await loadGrants(); setNotice('Доступ сохранён.');
  });
  const revoke = (row: AccessGrantRecord) => run(async () => {
    const path = `/admin/access/grants/${row.id}`;
    await apiFetch(path, command(path, 'DELETE', undefined, row.version)); confirmed(); await loadGrants(); setNotice('Доступ отозван.');
  });
  const openTab = (next: Tab) => { setTab(next); if (next === 'grant' && !grant) setGrant(newGrant(userId)); };
  const counts = (grants ?? []).reduce<Record<string, number>>((acc, row) => { const s = grantStatus(row); acc[s] = (acc[s] ?? 0) + 1; return acc; }, {});
  const shown = (grants ?? []).filter(row => filter === 'all' || grantStatus(row) === filter);
  const constraintText = (row: AccessGrantRecord) => {
    const c = row.constraints; if (!c) return null;
    const parts = [c.allowedEventRuntimeTypes?.length ? c.allowedEventRuntimeTypes.map(eventTypeName).join(', ') : null, c.mustEndWithinHours ? `до ${c.mustEndWithinHours} ч` : null].filter(Boolean);
    return parts.length ? 'Ограничения: ' + parts.join(' · ') : null;
  };
  return (
    <>
      <RecordTopline back={{ label: 'Доступы пользователей', onClick: back }} disabled={busy} current={name} />
      <RecordHead title={user ? name : <Skeleton width={220} height={22} />} meta={`ID ${userId}${user?.steamId ? ` · SteamID ${user.steamId}` : ''}`} actions={<Button to={`/users?userId=${encodeURIComponent(userId)}`}>Профиль пилота</Button>} />
      <Tabs variant="module" label="Доступы пользователя" value={tab} onChange={openTab} items={[{ key: 'roles', label: 'Роли', count: grants ? grants.length : null }, { key: 'grant', label: grant?.id ? 'Изменение роли' : 'Выдать роль' }, { key: 'password', label: 'Пароль админки' }]} />
      {error && <div className="lsr-access-gap"><Notice tone="danger">{error}</Notice></div>}
      {notice && <div className="lsr-access-gap"><Notice role="status">{notice}</Notice></div>}
      {tab === 'roles' && <Panel title="Роли и доступы" sub="Статус приходит с сервера: действует, запланирован, истёк или отозван." body={false} actions={<Button size="sm" variant="soft" disabled={busy} onClick={() => { setGrant(newGrant(userId)); setTab('grant'); }}>＋ Выдать роль</Button>}>
        <div className="lsr-toolbar"><PillButtons label="Состояние доступа" value={filter} onChange={setFilter} options={[{ value: 'all', label: `Все · ${grants?.length ?? 0}` }, ...(['active', 'scheduled', 'expired', 'revoked'] as const).map(value => ({ value, label: `${statusNames[value]} · ${counts[value] ?? 0}` }))]} /></div>
        {grantsError ? <div className="lsr-access-pad"><ErrorState error={grantsError.message} status={grantsError.status} onRetry={() => void loadGrants()} /></div>
          : !grants ? <div className="lsr-access-pad"><LoadingBlock label="Загружаем доступы…" /></div>
          : !shown.length ? <EmptyState compact title={grants.length ? 'Нет доступов в этом состоянии' : 'Ролей пока нет'}>{grants.length ? 'Выберите другой фильтр.' : 'Выдайте роль на вкладке «Выдать роль».'}</EmptyState>
          : <Table variant="module" label="Роли пользователя">
              <thead><tr><th>Роль</th><th>Область</th><th>Срок действия</th><th>Состояние</th><th className="lsr-right">Действия</th></tr></thead>
              <tbody>{shown.map(row => {
                const s = grantStatus(row);
                return <tr key={row.id}>
                  <td><div className="lsr-primary">{roleTitle(row.roleCode, roles)}</div><div className="lsr-minor">{row.roleCode}{constraintText(row) ? ' · ' + constraintText(row) : ''}</div></td>
                  <td>{scopeLabel(row, organizers)}</td>
                  <td className="lsr-nowrap">{validity(row)}</td>
                  <td><StatusBadge variant="badge" status={{ code: s, label: statusNames[s] }} tone={statusTones[s]} /></td>
                  <td className="lsr-right"><div className="lsr-access-rowactions">
                    {!row.revokedAt && <><Button size="sm" disabled={busy} onClick={() => { const { revokedAt: _revoked, status: _status, ...draft } = row; setGrant(draft); setTab('grant'); }}>Изменить</Button><Button size="sm" variant="danger" disabled={busy} onClick={() => void revoke(row)}>Отозвать</Button></>}
                    <Button size="sm" variant="plain" disabled={busy} onClick={() => void run(async () => setHistory(await apiFetch<GrantChange[]>(`/admin/access/grants/${row.id}/history`)))}>История</Button>
                  </div></td>
                </tr>;
              })}</tbody>
            </Table>}
        {grantsLoading && grants && <div className="lsr-tablefoot"><span>Обновляем…</span></div>}
      </Panel>}
      {tab === 'grant' && grant && <div className="lsr-stack">
        <GrantEditor value={grant} onChange={setGrant} roles={roles} organizers={organizers} disabled={busy} />
        <SaveBar status={grant.id ? 'Изменение действующего доступа сохраняется с версией записи.' : 'Новый доступ появится в списке ролей после сохранения.'}
          actions={<><Button disabled={busy} onClick={() => { setGrant(null); setTab('roles'); }}>Отменить</Button><Button variant="primary" disabled={busy || !grantValid} onClick={() => void saveGrant()}>{grant.id ? 'Сохранить доступ' : 'Выдать роль'}</Button></>} />
      </div>}
      {tab === 'password' && <FormGroup title="Пароль админки" description="Второй шаг входа после Steam. Изменение пароля завершит административные сессии пользователя.">
        <div className="lsr-fields"><TextField label="Новый пароль" type="password" autoComplete="new-password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></div>
        <div className="lsr-form-actions">
          <Button variant="danger" disabled={busy} onClick={() => void run(async () => { await apiFetch(`/admin/auth/password/${userId}`, { method: 'DELETE' }); setPassword(''); setNotice('Пароль удалён.'); })}>Удалить пароль</Button>
          <Button variant="primary" disabled={busy || !password} onClick={() => void run(async () => { await apiFetch('/admin/auth/password', putJsonBody({ userId, adminPassword: password })); setPassword(''); setNotice('Пароль изменён.'); })}>Установить пароль</Button>
        </div>
      </FormGroup>}
      <Dialog open={history !== null} onClose={() => setHistory(null)} width={680} title="История доступа" actions={<Button onClick={() => setHistory(null)}>Закрыть</Button>}>
        {history?.length ? <Timeline items={history.map(change => ({ title: !change.before ? 'Доступ выдан' : change.after.revokedAt ? 'Доступ отозван' : 'Доступ изменён', detail: `${roleTitle(change.after.roleCode, roles)} · ${scopeLabel(change.after, organizers)} · ${validity(change.after)}`, at: `${dateTime(change.at)} · пользователь ${change.actorId}` }))} /> : <EmptyState compact>История пуста.</EmptyState>}
      </Dialog>
    </>
  );
}
