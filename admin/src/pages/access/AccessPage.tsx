import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import { useDebouncedValue } from '../../shared/ui';
import type { AdminAccess } from '../../shared/types';
import type { AccessRole, OrganizerRecord } from '../../shared/access-types';
import { Button, EmptyState, ErrorState, Notice, PageHeader, Panel, PillButtons, SearchInput, Skeleton, StatusBadge, Table, TableFoot, Tabs, Toolbar, clickableRow, count, usePageChrome } from '../../ui/v16';
import { OrganizerDetail } from './OrganizerDetail';
import { UserAccessDetail } from './UserAccessDetail';
import { errorMessage, errorStatus, eventTypeName, quotaFields, quotaModeName, scopeNames, type AccessUser } from './access-model';
import './access.v16.css';

type Tab = 'organizers' | 'users' | 'roles';
type UserPage = { items: AccessUser[]; pagination?: { total: number; totalPages: number } };

/** Organizers, user grants and the role catalog. `?organizer=<id|new>` and `?userId=` open the record screens. */
export function AccessPage({ access }: { access: AdminAccess }) {
  const manage = access.grants.some(grant => grant.permissions.includes('access.manage.all'));
  const create = access.grants.some(grant => grant.permissions.includes('organizers.write.all'));
  const [params, setParams] = useSearchParams();
  const organizerParam = params.get('organizer'), userParam = manage ? params.get('userId') : null;
  const requested = params.get('tab') as Tab | null;
  const tab: Tab = requested === 'users' && manage ? 'users' : requested === 'roles' ? 'roles' : 'organizers';
  const [roles, setRoles] = useState<AccessRole[] | null>(null), [organizers, setOrganizers] = useState<OrganizerRecord[] | null>(null);
  const [listError, setListError] = useState<{ message: string; status: number | null } | null>(null), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const [known, setKnown] = useState<Record<string, AccessUser>>({}), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function load() {
    setLoading(true);
    try {
      const [catalog, rows] = await Promise.all([apiFetch<{ items: AccessRole[] }>('/admin/access/roles'), apiFetch<OrganizerRecord[]>('/admin/access/organizers?includeInactive=true')]);
      if (alive.current) { setRoles(catalog.items); setOrganizers(rows); setListError(null); }
    } catch (e) { if (alive.current) setListError({ message: errorMessage(e), status: errorStatus(e) }); }
    finally { if (alive.current) setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useRealtimeRefresh(['security', 'access'], () => load());
  const go = (patch: Record<string, string | null>, replace = false) => setParams(old => { const next = new URLSearchParams(old); Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); return next; }, { replace });

  if (organizerParam) {
    const creating = organizerParam === 'new' && create;
    return <OrganizerDetail key={organizerParam} creating={creating} loading={loading} record={creating ? null : organizers?.find(row => row.id === organizerParam) ?? null}
      back={() => go({ organizer: null })}
      onSaved={async (message, created) => { await load(); if (created) { setNotice(message); go({ organizer: null }); } }} />;
  }
  if (userParam) return <UserAccessDetail key={userParam} userId={userParam} known={known[userParam] ?? null} roles={roles ?? []} organizers={organizers ?? []} back={() => go({ userId: null, tab: 'users' })} />;
  return <AccessLists tab={tab} manage={manage} create={create} roles={roles} organizers={organizers} loading={loading} error={listError} notice={notice}
    onTab={next => { setNotice(''); go({ tab: next === 'organizers' ? null : next }, true); }}
    onRefresh={() => void load()}
    onOrganizer={id => { setNotice(''); go({ organizer: id }); }}
    onUser={user => { setKnown(old => ({ ...old, [user.userId]: user })); setNotice(''); go({ userId: user.userId }); }} />;
}

function AccessLists({ tab, manage, create, roles, organizers, loading, error, notice, onTab, onRefresh, onOrganizer, onUser }: { tab: Tab; manage: boolean; create: boolean; roles: AccessRole[] | null; organizers: OrganizerRecord[] | null; loading: boolean; error: { message: string; status: number | null } | null; notice: string; onTab(tab: Tab): void; onRefresh(): void; onOrganizer(id: string): void; onUser(user: AccessUser): void }) {
  usePageChrome({ crumbs: [{ label: 'Организаторы и доступы' }] });
  return (
    <>
      <PageHeader overline="Администрирование" title="Организаторы и доступы" description="Организаторы, квоты и роли сотрудников"
        actions={<><Button disabled={loading} onClick={onRefresh}>{loading ? 'Обновляем…' : 'Обновить'}</Button>{create && <Button variant="primary" onClick={() => onOrganizer('new')}>＋ Организатор</Button>}</>} />
      <Tabs variant="module" label="Разделы доступа" value={tab} onChange={onTab} items={[{ key: 'organizers', label: 'Организаторы', count: organizers?.length ?? null }, { key: 'users', label: 'Доступы пользователей', hidden: !manage }, { key: 'roles', label: 'Роли', count: roles?.length ?? null }]} />
      {notice && <div className="lsr-access-gap"><Notice role="status">{notice}</Notice></div>}
      {tab === 'organizers' && <OrganizersTab rows={organizers} loading={loading} error={error} onRetry={onRefresh} onOpen={onOrganizer} />}
      {tab === 'users' && manage && <UsersTab onOpen={onUser} />}
      {tab === 'roles' && <RolesTab roles={roles} loading={loading} error={error} onRetry={onRefresh} />}
    </>
  );
}

function OrganizersTab({ rows, loading, error, onRetry, onOpen }: { rows: OrganizerRecord[] | null; loading: boolean; error: { message: string; status: number | null } | null; onRetry(): void; onOpen(id: string): void }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const all = rows ?? [];
  const shown = all.filter(row => (filter === 'all' || row.active === (filter === 'active')) && query.toLocaleLowerCase('ru').split(/\s+/).every(term => [row.name, row.code, row.id].join(' ').toLocaleLowerCase('ru').includes(term)));
  return <>
    <Panel title="Организаторы" body={false}>
      <Toolbar>
        <SearchInput wide value={query} onChange={setQuery} placeholder="Название, код или ID" label="Поиск организатора" />
        <PillButtons label="Состояние организатора" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Все' }, { value: 'active', label: 'Активные' }, { value: 'inactive', label: 'Выключенные' }]} />
      </Toolbar>
      {error && !rows ? <div className="lsr-access-pad"><ErrorState error={error.message} status={error.status} onRetry={onRetry} /></div>
        : rows && !shown.length ? <EmptyState compact title="Организаторы не найдены">{all.length ? 'Измените поиск или фильтр.' : 'Организаторов пока нет.'}</EmptyState>
        : <Table variant="module" label="Организаторы">
            <thead><tr><th>Организатор</th><th>Статус</th><th>Разрешённые типы</th><th>Квоты</th><th className="lsr-right">Доступ к записи</th></tr></thead>
            <tbody>
              {!rows && loading && Array.from({ length: 3 }, (_, i) => <tr key={i}><td><Skeleton width="50%" height={14} /><Skeleton width="30%" height={11} style={{ marginTop: 6 }} /></td><td><Skeleton width={70} height={20} /></td><td><Skeleton width={120} height={14} /></td><td><Skeleton width={140} height={14} /></td><td /></tr>)}
              {shown.map(row => {
                const limited = quotaFields.filter(([key]) => row.settings[key] !== null);
                const action = row.actions?.edit ? 'Настроить' : row.actions?.editPresentation ? 'Оформление' : 'Просмотр';
                return <tr key={row.id} {...clickableRow(() => onOpen(row.id))} aria-label={'Открыть организатора ' + row.name}>
                  <td><div className="lsr-primary">{row.name}</div><div className="lsr-minor">{row.code} · ID {row.id}</div></td>
                  <td><StatusBadge variant="badge" status={{ code: row.active ? 'active' : 'inactive', label: row.active ? 'Активен' : 'Выключен' }} tone={row.active ? 'done' : 'scheduled'} /></td>
                  <td>{row.settings.allowedEventRuntimeTypes.length ? row.settings.allowedEventRuntimeTypes.map(eventTypeName).join(' · ') : <span className="lsr-sub">Все типы</span>}</td>
                  <td>{limited.length ? <div className="lsr-access-quotas">{limited.map(([key, label, usage]) => <span key={key}>{label}: <b>{row.usage ? `${row.usage[usage]} / ` : ''}{row.settings[key]}</b>{row.remaining?.[key] != null ? ` · осталось ${row.remaining[key]}` : ''}</span>)}<span className="lsr-minor">При превышении: {quotaModeName(row.settings.quotaEnforcementMode).toLowerCase()}</span></div> : <span className="lsr-sub">Без ограничений</span>}</td>
                  <td className="lsr-right"><Button size="sm" variant={row.actions?.edit || row.actions?.editPresentation ? 'default' : 'plain'} onClick={() => onOpen(row.id)}>{action}</Button></td>
                </tr>;
              })}
            </tbody>
          </Table>}
      {error && rows && <div className="lsr-access-pad"><ErrorState compact error={error.message} status={error.status} onRetry={onRetry} /></div>}
    </Panel>
    <div className="lsr-access-gap is-top"><Notice>Разрешённые типы и квоты организатора ограничивают выбор в конструкторе событий. Пустой лимит означает «без ограничения», а не «0».</Notice></div>
  </>;
}

function UsersTab({ onOpen }: { onOpen(user: AccessUser): void }) {
  const [query, setQuery] = useState(''), [page, setPage] = useState(0), [users, setUsers] = useState<AccessUser[] | null>(null), [total, setTotal] = useState(0), [pages, setPages] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState<{ message: string; status: number | null } | null>(null), [reload, setReload] = useState(0);
  const search = useDebouncedValue(query.trim());
  useEffect(() => {
    let current = true; setLoading(true); setError(null);
    void apiFetch<UserPage>(`/admin/users?q=${encodeURIComponent(search)}&page=${page + 1}&pageSize=20`).then(data => {
      if (!current) return;
      setUsers(data.items ?? []); setTotal(data.pagination?.total ?? data.items?.length ?? 0); setPages(Math.max(1, data.pagination?.totalPages ?? 1));
      if (data.pagination) setPage(value => Math.min(value, Math.max(0, data.pagination!.totalPages - 1)));
    }).catch(e => { if (current) setError({ message: errorMessage(e), status: errorStatus(e) }); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [search, page, reload]);
  useRealtimeRefresh(['profiles'], () => setReload(v => v + 1));
  return <>
    <Panel title="Пользователи" sub="Выберите пользователя, чтобы увидеть, выдать или отозвать его роли" body={false}>
      <Toolbar><SearchInput wide value={query} onChange={value => { setQuery(value.slice(0, 200)); setPage(0); }} placeholder="Имя, SteamID или ID пользователя" label="Поиск пользователя" /></Toolbar>
      {error ? <div className="lsr-access-pad"><ErrorState error={error.message} status={error.status} onRetry={() => setReload(v => v + 1)} /></div>
        : users && !users.length && !loading ? <EmptyState compact title="Пользователи не найдены">Измените запрос.</EmptyState>
        : <Table variant="module" label="Доступы пользователей">
            <thead><tr><th>Пользователь</th><th>SteamID</th><th className="lsr-right">Доступы</th></tr></thead>
            <tbody>
              {!users && Array.from({ length: 5 }, (_, i) => <tr key={i}><td><Skeleton width="40%" height={14} /></td><td><Skeleton width={130} height={14} /></td><td /></tr>)}
              {users?.map(user => <tr key={user.userId} {...clickableRow(() => onOpen(user))}>
                <td><button type="button" className="lsr-access-namebtn" onClick={() => onOpen(user)}>{user.presentation.displayName}</button><div className="lsr-minor">ID {user.userId}</div></td>
                <td className="lsr-num">{user.steamId ?? '—'}</td>
                <td className="lsr-right"><Button size="sm" onClick={() => onOpen(user)}>Роли и доступы</Button></td>
              </tr>)}
            </tbody>
          </Table>}
      {users && !error && total > 0 && <TableFoot>
        <span>{page * 20 + 1}–{Math.min((page + 1) * 20, total)} из {count(total, ['пользователя', 'пользователей', 'пользователей'])}{loading ? ' · обновление…' : ''}</span>
        {pages > 1 && <div className="lsr-hstack"><Button size="sm" disabled={page <= 0 || loading} onClick={() => setPage(page - 1)}>← Назад</Button><span>Страница {page + 1} из {pages}</span><Button size="sm" disabled={page + 1 >= pages || loading} onClick={() => setPage(page + 1)}>Далее →</Button></div>}
      </TableFoot>}
    </Panel>
    <div className="lsr-access-gap is-top"><Notice>API отдаёт права только для выбранного пользователя, поэтому общей таблицы выданных прав нет. Выдача роли: пользователь → роль → область → срок действия; у каждого доступа есть история изменений.</Notice></div>
  </>;
}

function RolesTab({ roles, loading, error, onRetry }: { roles: AccessRole[] | null; loading: boolean; error: { message: string; status: number | null } | null; onRetry(): void }) {
  return <Panel title="Матрица ролей" sub="Область определяет, где действуют права: на всей платформе, у организатора или в конкретном событии." body={false}>
    {error && !roles ? <div className="lsr-access-pad"><ErrorState error={error.message} status={error.status} onRetry={onRetry} /></div>
      : roles && !roles.length ? <EmptyState compact>Каталог ролей пуст.</EmptyState>
      : <Table variant="module" label="Роли">
          <thead><tr><th>Роль</th><th>Область</th><th>Возможности</th><th>Разрешения</th></tr></thead>
          <tbody>
            {!roles && loading && Array.from({ length: 4 }, (_, i) => <tr key={i}>{[0, 1, 2, 3].map(c => <td key={c}><Skeleton height={14} width="70%" /></td>)}</tr>)}
            {roles?.map(item => <tr key={item.code}>
              <td><div className="lsr-primary">{item.title}</div><div className="lsr-minor">{item.code}</div></td>
              <td>{item.scopeTypes.map(type => scopeNames[type]).join(' · ')}</td>
              <td>{item.description}</td>
              <td><details className="lsr-access-details"><summary>{count(item.permissions.length, ['разрешение', 'разрешения', 'разрешений'])}</summary><div className="lsr-chiplist" style={{ marginTop: 8 }}>{item.permissions.map(permission => <span key={permission} className="lsr-small-tag">{permission}</span>)}</div></details></td>
            </tr>)}
          </tbody>
        </Table>}
  </Panel>;
}
