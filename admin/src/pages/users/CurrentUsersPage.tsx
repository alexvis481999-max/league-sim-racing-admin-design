import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import { useDebouncedValue } from '../../shared/ui';
import { Button, EmptyState, ErrorState, Kpis, PageHeader, Panel, SearchInput, Skeleton, StatusBadge, Table, TableFoot, Toolbar, clickableRow, count, usePageChrome } from '../../ui/v16';
import { UserProfilePage } from './UserProfilePage';
import { Avatar, UserEditor, type User } from './UserEditor';
import { countryName } from './user-format';
import './users.v16.css';

type UserPage = { items: User[]; pagination: { page: number; totalPages: number; total: number } };
const PAGE_SIZE = 20;

/** Pilots: the list and the profile share `/users`; `?userId=` opens the profile, `q`/`page` keep the list position. */
export function CurrentUsersPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('userId');
  const [reload, setReload] = useState(0);
  if (selected) {
    const back = () => { setParams(old => { const next = new URLSearchParams(old); ['userId', 'tab', 'eventId'].forEach(key => next.delete(key)); return next; }); setReload(value => value + 1); };
    return <UserProfilePage key={selected} id={selected} back={back} editor={(close, dirty) => <UserEditor id={selected} back={close} onDirty={dirty} />} />;
  }
  return <UsersList reload={reload} />;
}

function UsersList({ reload: outerReload }: { reload: number }) {
  usePageChrome({ crumbs: [{ label: 'Пилоты' }] });
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [query, setQuery] = useState(search);
  const [data, setData] = useState<UserPage | null>(null), [error, setError] = useState<{ message: string; status: number | null } | null>(null), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const debounced = useDebouncedValue(query.trim());
  const update = (patch: Record<string, string | null>) => setParams(old => { const next = new URLSearchParams(old); Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); return next; }, { replace: true });
  useEffect(() => { if (debounced !== search) update({ q: debounced || null, page: null }); }, [debounced]);
  useRealtimeRefresh(['profiles'], () => setReload(v => v + 1));
  useEffect(() => {
    let live = true; setError(null); setLoading(true);
    apiFetch<UserPage>(`/admin/users?q=${encodeURIComponent(search)}&page=${page}&pageSize=${PAGE_SIZE}`)
      .then(value => { if (!live) return; setData(value); const last = Math.max(1, value.pagination?.totalPages ?? 1); if (page > last) update({ page: last > 1 ? String(last) : null }); })
      .catch(e => { if (live) setError({ message: e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : null }); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [search, page, reload, outerReload]);
  const open = (id: string) => setParams(old => { const next = new URLSearchParams(old); next.set('userId', id); return next; });
  const items = data?.items ?? [];
  const incomplete = items.filter(user => !user.complete).length;
  const total = data?.pagination?.total ?? items.length, pages = Math.max(1, data?.pagination?.totalPages ?? 1);
  const pending = loading && !data;
  return (
    <>
      <PageHeader overline="Администрирование" title="Пилоты" description="Поиск, профиль, рейтинги и история участника" />
      {!error && <Kpis items={[
        { label: 'Пилотов в выборке', value: pending ? '…' : total, foot: search ? `Поиск: «${search}»` : 'Все зарегистрированные пилоты' },
        { label: 'Показано на странице', value: pending ? '…' : items.length, foot: `Страница ${page} из ${pages}` },
        { label: 'Профиль заполнен', value: pending ? '…' : items.length - incomplete, foot: 'На текущей странице' },
        { label: 'Профиль не заполнен', value: pending ? '…' : incomplete, foot: 'На текущей странице', problem: incomplete > 0 },
      ]} />}
      <Panel title="Пользователи" body={false}>
        <Toolbar><SearchInput wide value={query} onChange={value => setQuery(value.slice(0, 200))} onCommit={value => { if (value !== search) update({ q: value || null, page: null }); }} placeholder="Имя, SteamID, ID или Discord" label="Поиск пользователей" /></Toolbar>
        {error ? <div className="lsr-users-pad"><ErrorState error={error.message} status={error.status} onRetry={() => setReload(v => v + 1)} /></div>
          : !pending && !items.length ? <EmptyState title="Пользователи не найдены">{search ? 'Измените запрос: поиск идёт по имени, SteamID, ID и Discord.' : 'В системе пока нет пользователей.'}</EmptyState>
          : <Table variant="module" label="Пользователи">
              <thead><tr><th>Пилот</th><th>SteamID</th><th className="lsr-hide-sm">Страна</th><th className="lsr-hide-md">Discord</th><th>Профиль</th></tr></thead>
              <tbody>
                {pending && Array.from({ length: 6 }, (_, i) => <tr key={i}><td><Skeleton width="55%" height={14} /><Skeleton width="35%" height={11} style={{ marginTop: 6 }} /></td><td><Skeleton width={130} height={14} /></td><td className="lsr-hide-sm"><Skeleton width={70} height={14} /></td><td className="lsr-hide-md"><Skeleton width={90} height={14} /></td><td><Skeleton width={90} height={20} /></td></tr>)}
                {items.map(user => (
                  <tr key={user.userId} {...clickableRow(() => open(user.userId))} aria-label={'Открыть профиль ' + user.presentation.displayName}>
                    <td><div className="lsr-users-pilot"><Avatar url={user.presentation.avatarUrl} name={user.presentation.displayName} size={32} /><div style={{ minWidth: 0 }}><div className="lsr-primary">{user.presentation.displayName}</div><div className="lsr-minor">ID {user.userId}{user.shortName ? ' · ' + user.shortName : ''}</div></div></div></td>
                    <td className="lsr-num lsr-nowrap">{user.steamId}</td>
                    <td className="lsr-hide-sm">{countryName(user.country)}</td>
                    <td className="lsr-hide-md">{user.discord ?? '—'}</td>
                    <td><StatusBadge variant="badge" status={{ code: user.complete ? 'complete' : 'incomplete', label: user.complete ? 'Заполнен' : 'Не заполнен' }} tone={user.complete ? 'done' : 'current'} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>}
        {data && !error && total > 0 && (
          <TableFoot>
            <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} из {count(total, ['пилота', 'пилотов', 'пилотов'])}{loading ? ' · обновление…' : ''}</span>
            {pages > 1 && <div className="lsr-hstack">
              <Button size="sm" disabled={page <= 1 || loading} onClick={() => update({ page: page - 1 > 1 ? String(page - 1) : null })}>← Назад</Button>
              <span>Страница {page} из {pages}</span>
              <Button size="sm" disabled={page >= pages || loading} onClick={() => update({ page: String(page + 1) })}>Далее →</Button>
            </div>}
          </TableFoot>
        )}
      </Panel>
    </>
  );
}
