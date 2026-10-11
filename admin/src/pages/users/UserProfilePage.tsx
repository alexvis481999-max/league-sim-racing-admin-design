import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import Drawer from '@mui/material/Drawer';
import { ApiError, apiFetch } from '../../shared/api';
import { ChatsPage } from '../chats/ChatsPage';
import { Button, Dialog, EmbeddedContext, EmptyState, ErrorState, LoadingBlock, Meta, MetaGrid, Panel, SelectInput, Skeleton, StatusBadge, Table, Tabs, TextLink, usePageChrome } from '../../ui/v16';
import { StateBadge } from './PlayerHistoryTable';
import { date, display, field, type HistoryRow } from './history';
import { Avatar } from './UserEditor';
import { countryName, fieldLabels, gameNames, games } from './user-format';
import { Activity, Content, EventLink, Moderation, Participation, Ratings } from './profile-sections';
import './users.v16.css';

export type AdminPlayer = { userId: string; steamId: string; steamName?: string; createdAt?: string; updatedAt?: string; enabledGames?: string[]; themeMode?: string; firstName: string | null; lastName: string | null; shortName: string | null; country: string; discord: string | null; youtube: string | null; complete: boolean; missingFields: string[]; presentation: { displayName: string; avatarUrl: string }; actions: { edit: boolean; uploadAvatar: boolean; deleteAvatar: boolean } };
type TabKey = 'overview' | 'participation' | 'rating' | 'chats' | 'activity' | 'moderation' | 'content';
const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Профиль' }, { key: 'participation', label: 'Выступления' }, { key: 'rating', label: 'Рейтинги' }, { key: 'chats', label: 'Чаты' },
  { key: 'activity', label: 'Сессии и аудит' }, { key: 'moderation', label: 'Ограничения и жалобы' }, { key: 'content', label: 'Каталог и доступы' },
];
const siteUrl = String(import.meta.env.VITE_SITE_URL || 'http://localhost:5174').replace(/\/$/, '');

export function UserProfilePage({ id, back, editor }: { id: string; back(): void; editor(close: () => void, dirty: (value: boolean) => void): ReactNode }) {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('eventId');
  const requested = params.get('tab');
  const tab: TabKey = tabs.some(item => item.key === requested) ? requested as TabKey : 'overview';
  const [user, setUser] = useState<AdminPlayer | null>(null), [error, setError] = useState<{ message: string; status: number | null } | null>(null), [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false), [dirty, setDirty] = useState(false), [confirm, setConfirm] = useState(false);
  const name = user?.presentation.displayName ?? (error ? 'Профиль пилота' : 'Загрузка…');
  usePageChrome({ crumbs: [{ label: 'Пилоты', to: '/users' }, { label: user?.presentation.displayName ?? `ID ${id}` }], back: eventId ? { label: 'К событию', to: `/events/${encodeURIComponent(eventId)}?section=participants` } : null });
  useEffect(() => { let live = true; setError(null); void apiFetch<AdminPlayer>(`/admin/users/${id}`).then(v => { if (live) setUser(v); }).catch(e => { if (live) setError({ message: e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : null }); }); return () => { live = false; }; }, [id, revision]);
  const close = () => { setEditing(false); setDirty(false); setConfirm(false); setRevision(v => v + 1); };
  const requestClose = () => dirty ? setConfirm(true) : close();
  const select = (next: TabKey) => setParams(old => { const url = new URLSearchParams(old); url.set('userId', id); url.set('tab', next); return url; }, { replace: true });
  return (
    <>
      <div className="lsr-users-topline">
        <button type="button" onClick={back}>← Пилоты</button><b>{name}</b>
        {eventId && <><span aria-hidden="true">·</span><TextLink size="sm" to={`/events/${encodeURIComponent(eventId)}?section=participants`}>Вернуться к событию</TextLink></>}
      </div>
      {error && !user && <ErrorState error={error.message} status={error.status} onRetry={() => setRevision(v => v + 1)} />}
      {error && user && <ErrorState compact error={error.message} status={error.status} onRetry={() => setRevision(v => v + 1)} />}
      {!user && !error && <div className="lsr-users-head"><Skeleton width={52} height={52} style={{ borderRadius: '50%' }} /><div style={{ flex: 1 }}><Skeleton width="30%" height={22} /><Skeleton width="45%" height={13} style={{ marginTop: 8 }} /></div></div>}
      {user && <>
        <div className="lsr-users-head">
          <Avatar url={user.presentation.avatarUrl} name={user.presentation.displayName} size={52} />
          <div className="lsr-users-head-main">
            <div className="lsr-users-head-title"><h1>{user.presentation.displayName}</h1><StatusBadge variant="badge" status={{ code: user.complete ? 'complete' : 'incomplete', label: user.complete ? 'Профиль заполнен' : 'Профиль не заполнен' }} tone={user.complete ? 'done' : 'current'} /></div>
            <div className="lsr-users-head-meta">ID {id}{user.shortName ? ` · ${user.shortName}` : ''} · {user.country === 'unknown' ? 'Страна не указана' : countryName(user.country)} · <a className="lsr-link is-sm" href={`https://steamcommunity.com/profiles/${user.steamId}`} target="_blank" rel="noreferrer">Steam · {user.steamId} ↗</a></div>
          </div>
          <div className="lsr-page-actions">
            <a className="lsr-btn" href={`${siteUrl}/profile/${id}`} target="_blank" rel="noreferrer">Открыть на сайте ↗</a>
            <Button variant="primary" disabled={!user.actions.edit && !user.actions.uploadAvatar} title={!user.actions.edit && !user.actions.uploadAvatar ? 'Ваш доступ не позволяет изменять профиль' : undefined} onClick={() => setEditing(true)}>Редактировать профиль</Button>
          </div>
        </div>
        <Tabs variant="module" label="Разделы профиля" items={tabs} value={tab} onChange={select} />
        {tab === 'overview' && <Overview user={user} onTab={select} />}
        {tab === 'participation' && <Participation id={id} />}
        {tab === 'rating' && <Ratings id={id} />}
        {tab === 'chats' && <EmbeddedContext.Provider value={true}><ChatsPage key={id} userId={id} /></EmbeddedContext.Provider>}
        {tab === 'activity' && <Activity id={id} />}
        {tab === 'moderation' && <Moderation id={id} />}
        {tab === 'content' && <Content user={user} />}
      </>}
      <Drawer anchor="right" open={editing} onClose={requestClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 600 }, background: 'var(--lsr-bg)' } } }}>{editing && editor(requestClose, setDirty)}</Drawer>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Есть несохранённые изменения" description="Закрыть редактирование без сохранения?" actions={<><Button onClick={() => setConfirm(false)}>Продолжить редактирование</Button><Button variant="danger-solid" onClick={close}>Не сохранять</Button></>} />
    </>
  );
}

type Load<T> = { data: T | null; error: string; status: number | null };
function useRead<T>(path: string): Load<T> {
  const [state, setState] = useState<Load<T>>({ data: null, error: '', status: null });
  useEffect(() => {
    let live = true; setState({ data: null, error: '', status: null });
    void apiFetch<T>(path).then(data => { if (live) setState({ data, error: '', status: null }); }).catch(e => { if (live) setState({ data: null, error: e instanceof Error ? e.message : String(e), status: typeof e?.status === 'number' ? e.status : null }); });
    return () => { live = false; };
  }, [path]);
  return state;
}
const rowsOf = (data: HistoryRow | null) => Array.isArray(data?.items) ? data.items as HistoryRow[] : [];

function Overview({ user, onTab }: { user: AdminPlayer; onTab(tab: TabKey): void }) {
  const recent = useRead<HistoryRow>(`/admin/users/${user.userId}/history/participations?limit=5&page=1`);
  const sanctions = useRead<HistoryRow>(`/admin/sanctions?userId=${user.userId}&state=active&limit=5`);
  const activeSanctions = rowsOf(sanctions.data), moreSanctions = sanctions.data?.nextAfterId != null;
  const total = (key: string) => recent.data ? display(field(recent.data, 'totals.' + key)) : recent.error ? '—' : <Skeleton width={34} height={14} />;
  return (
    <div className="lsr-cols-module">
      <div className="lsr-stack">
        <Panel title="Карточка пилота">
          <MetaGrid columns={2}>
            <Meta label="Отображаемое имя">{user.presentation.displayName}</Meta>
            <Meta label="SteamID"><span className="lsr-mono">{user.steamId}</span></Meta>
            <Meta label="Имя и фамилия">{[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}</Meta>
            <Meta label="Три буквы">{user.shortName || '—'}</Meta>
            <Meta label="Страна">{countryName(user.country)}</Meta>
            <Meta label="Имя в Steam">{display(user.steamName)}</Meta>
            <Meta label="Discord">{display(user.discord)}</Meta>
            <Meta label="YouTube">{user.youtube && /^https?:\/\//.test(user.youtube) ? <a className="lsr-link" href={user.youtube} target="_blank" rel="noreferrer">{user.youtube}</a> : display(user.youtube)}</Meta>
            <Meta label="Регистрация">{date(user.createdAt)}</Meta>
            <Meta label="Обновление аккаунта">{date(user.updatedAt)}</Meta>
            <Meta label="Игры">{gameNames(user.enabledGames)}</Meta>
          </MetaGrid>
          <hr className="lsr-rule" />
          <p className="lsr-mutedline" style={{ margin: 0 }}>{user.complete ? 'Профиль заполнен.' : `Не заполнено: ${user.missingFields.map(key => fieldLabels[key] ?? key).join(', ')}.`} Редактирование профиля и аватара доступно в соответствии с правами администратора.</p>
        </Panel>
        <Panel title="Последние выступления" body={false} actions={<TextLink size="sm" onClick={() => onTab('participation')}>Все выступления →</TextLink>}>
          {recent.error ? <div className="lsr-users-pad"><ErrorState compact error={recent.error} status={recent.status} /></div>
            : recent.data && !rowsOf(recent.data).length ? <EmptyState compact>Выступлений пока нет.</EmptyState>
            : <Table variant="module" label="Последние выступления">
                <thead><tr><th>Дата</th><th>Событие</th><th>Место</th><th>Статус</th></tr></thead>
                <tbody>
                  {!recent.data ? Array.from({ length: 3 }, (_, i) => <tr key={i}>{[0, 1, 2, 3].map(c => <td key={c}><Skeleton height={14} width="70%" /></td>)}</tr>)
                    : rowsOf(recent.data).map((row, i) => <tr key={String(row.id ?? i)}><td className="lsr-nowrap">{date(row.date)}</td><td><EventLink row={row} /></td><td className="lsr-num">{display(row.position)}</td><td><StateBadge value={row.finishStatus} /></td></tr>)}
                </tbody>
              </Table>}
        </Panel>
        <Panel title="Действующие ограничения" body={false} actions={<TextLink size="sm" onClick={() => onTab('moderation')}>Ограничения и жалобы →</TextLink>}>
          {sanctions.error ? <div className="lsr-users-pad"><ErrorState compact error={sanctions.error} status={sanctions.status} /></div>
            : sanctions.data && !activeSanctions.length ? <EmptyState compact>Действующих ограничений нет.</EmptyState>
            : <Table variant="module" label="Действующие ограничения">
                <thead><tr><th>Ограничение</th><th>Причина</th><th>До</th></tr></thead>
                <tbody>
                  {!sanctions.data ? <tr>{[0, 1, 2].map(c => <td key={c}><Skeleton height={14} width="70%" /></td>)}</tr>
                    : activeSanctions.map((row, i) => <tr key={String(row.id ?? i)}><td><StateBadge value={row.type} /></td><td>{display(row.publicReason)}</td><td className="lsr-nowrap">{date(row.endsAt)}</td></tr>)}
                </tbody>
              </Table>}
        </Panel>
      </div>
      <div className="lsr-stack">
        <Panel title="Текущее состояние">
          <div className="lsr-rows">
            <div className="lsr-row-item"><b>Ограничения</b>{sanctions.error ? <span className="lsr-muted">{sanctions.status === 403 ? 'Нет доступа' : 'Не загружено'}</span> : !sanctions.data ? <Skeleton width={90} height={20} /> : activeSanctions.length ? <StatusBadge variant="badge" tone="failed" status={{ code: 'active', label: `${activeSanctions.length}${moreSanctions ? '+' : ''} действующих` }} /> : <StatusBadge variant="badge" tone="done" status={{ code: 'none', label: 'Без ограничений' }} />}</div>
            <div className="lsr-row-item"><b>Стартов всего</b><b className="lsr-num">{total('races')}</b></div>
            <div className="lsr-row-item"><b>Побед</b><b className="lsr-num">{total('wins')}</b></div>
            <div className="lsr-row-item"><b>DNF</b><b className="lsr-num">{total('dnf')}</b></div>
          </div>
        </Panel>
        <RatingsOverview id={user.userId} />
      </div>
    </div>
  );
}

function RatingsOverview({ id }: { id: string }) {
  const [game, setGame] = useState('assetto_corsa'), [data, setData] = useState<HistoryRow[] | null>(null), [error, setError] = useState<{ message: string; status: number | null } | null>(null);
  useEffect(() => { let live = true; setData(null); setError(null); void Promise.all((game === 'assetto_corsa' ? ['circuit', 'touge'] : ['circuit']).map(d => apiFetch<HistoryRow>(`/admin/users/${id}/history/rating?gameCode=${game}&disciplineCode=${d}&limit=1`))).then(v => { if (live) setData(v); }).catch(e => { if (live) setError({ message: e instanceof Error ? e.message : String(e), status: typeof e?.status === 'number' ? e.status : null }); }); return () => { live = false; }; }, [id, game]);
  return (
    <Panel title="Текущие рейтинги" className="lsr-users-ratings" actions={<SelectInput label="Игра" value={game} onChange={setGame} options={Object.entries(games).map(([value, label]) => ({ value, label }))} />}>
      {error ? <ErrorState compact error={error.message} status={error.status} /> : !data ? <LoadingBlock rows={2} /> : (
        <div className="lsr-rows">
          {data.map((row, i) => <div className="lsr-row-item" key={i}><b>{i ? 'Тоге' : 'Кольцо'}</b><span className="lsr-users-rating"><span>PR <b>{display(field(row, 'current.pilot.value'))}</b></span><span>SR <b>{display(field(row, 'current.safety.value'))}</b></span></span></div>)}
        </div>
      )}
    </Panel>
  );
}
