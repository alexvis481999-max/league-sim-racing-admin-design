import { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api';
import { ResultRevisions } from '../events/workspace/common/results';
import { Button, Dialog, EmptyState, ErrorState, InfoTiles, LoadingBlock, Meta, MetaGrid, Notice, Panel, SelectInput, SubTabs, TextLink, Timeline, Toolbar } from '../../ui/v16';
import { PlayerHistoryTable, StateBadge } from './PlayerHistoryTable';
import { date, display, field, status, type Column, type HistoryRow } from './history';
import { gameNames, games } from './user-format';
import type { AdminPlayer } from './UserProfilePage';

const time = (key: string, title = 'Дата'): Column => ({ title, className: 'lsr-nowrap', render: r => date(field(r, key)) });
const state = (key = 'status', title = 'Статус'): Column => ({ title, render: r => <StateBadge value={field(r, key)} /> });
export function EventLink({ row }: { row: HistoryRow }) { return row.eventId ? <TextLink size="sm" to={`/events/${encodeURIComponent(String(row.eventId))}?section=results`}>{display(row.title)}</TextLink> : <>{display(row.title)}</>; }
const eventColumn: Column = { title: 'Событие', render: r => <EventLink row={r} /> };
const auditNames: Record<string, string> = { 'auth.login': 'Вход', 'auth.logout': 'Выход', 'auth.sessions_revoked': 'Сессии завершены', 'chat.review': 'Проверка переписки', 'chat.message.hide': 'Скрытие сообщения', 'user.profile_updated': 'Изменение профиля', 'user.avatar.replace': 'Изменение аватара' };
function History({ url, ...props }: Parameters<typeof PlayerHistoryTable>[0]) { return <PlayerHistoryTable key={url} url={url} {...props} />; }
const raceName = (r: HistoryRow) => r.raceKey === 'duel' ? 'Парный заезд' : r.raceKey === 'time-attack' ? 'Time Attack' : String(r.raceKey).startsWith('match-') ? 'Матч ' + String(r.raceKey).slice(6) : 'Гонка ' + String(r.raceKey).split(':').at(-1);

export function Participation({ id }: { id: string }) {
  const [kind, setKind] = useState<'participations' | 'registrations' | 'matchmaking'>('participations');
  const [result, setResult] = useState<{ eventId: string; resultId: string } | null>(null);
  const columns: Record<typeof kind, Column[]> = {
    participations: [time('date'), eventColumn, { title: 'Заезд', render: raceName }, { title: 'Место', key: 'position', className: 'lsr-num' }, state('finishStatus'), { title: 'Результат', render: r => r.eventId ? <TextLink size="sm" onClick={() => setResult({ eventId: String(r.eventId), resultId: String(r.resultId) })}>Открыть</TextLink> : <TextLink size="sm" to={`/officiating?matchmakingId=${r.matchmakingId ?? ''}&matchId=${field(r, 'owner.id') ?? ''}&resultId=${r.resultId}`}>Матчмейкинг →</TextLink> }],
    registrations: [time('createdAt', 'Подана'), eventColumn, state(), time('decidedAt', 'Решение'), time('withdrawnAt', 'Снятие'), time('removedAt', 'Удаление')],
    matchmaking: [time('queuedAt', 'В очереди с'), state(), { title: 'Трасса', key: 'trackTitle' }, { title: 'Погода', key: 'weatherTitle' }, state('matchStatus', 'Матч'), time('startedAt', 'Начало'), time('finishedAt', 'Окончание'), { title: 'Подробности', render: r => <TextLink size="sm" to={r.resultId ? `/officiating?matchmakingId=${r.queueId}&matchId=${r.matchId}&resultId=${r.resultId}` : `/runtime?matchmakingId=${r.queueId}&matchId=${r.matchId ?? ''}`}>Открыть →</TextLink> }],
  };
  const titles = { participations: 'Выступления', registrations: 'Заявки на события', matchmaking: 'Очереди матчмейкинга' };
  return <>
    <SubTabs label="Участие" value={kind} onChange={setKind} items={[{ key: 'participations', label: 'Выступления' }, { key: 'registrations', label: 'Заявки' }, { key: 'matchmaking', label: 'Матчмейкинг' }]} />
    <Panel title={titles[kind]} body={false}><History url={`/admin/users/${id}/history/${kind}?limit=20`} paging={kind === 'participations' ? 'page' : 'cursor'} columns={columns[kind]} /></Panel>
    <Dialog open={!!result} onClose={() => setResult(null)} width={1200} title="Результаты заезда" actions={<Button onClick={() => setResult(null)}>Закрыть</Button>}>{result && <ResultRevisions eventId={result.eventId} resultId={result.resultId} active />}</Dialog>
  </>;
}

const disciplineNames: Record<string, string> = { circuit: 'Кольцо', touge: 'Тоге' };
export function Ratings({ id }: { id: string }) {
  const [game, setGame] = useState('assetto_corsa'), [discipline, setDiscipline] = useState('circuit');
  const metric = (key: string) => (r: HistoryRow) => <span className="lsr-num">{display(field(r, key + '.before'))} → {display(field(r, key + '.after'))} <span className={Number(field(r, key + '.delta')) > 0 ? 'lsr-users-up' : Number(field(r, key + '.delta')) < 0 ? 'lsr-users-down' : 'lsr-sub'}>({Number(field(r, key + '.delta')) > 0 ? '+' : ''}{display(field(r, key + '.delta'))})</span></span>;
  return <Panel title="История начислений" sub="Значения на момент начисления" body={false}>
    <Toolbar>
      <div className="lsr-toolbar-group">
        <SelectInput label="Игра" value={game} onChange={value => { setGame(value); if (value !== 'assetto_corsa') setDiscipline('circuit'); }} options={Object.entries(games).map(([value, label]) => ({ value, label }))} />
        <SelectInput label="Дисциплина" value={discipline} onChange={setDiscipline} options={[{ value: 'circuit', label: 'Кольцо' }, ...(game === 'assetto_corsa' ? [{ value: 'touge', label: 'Тоге' }] : [])]} />
      </div>
    </Toolbar>
    <History url={`/admin/users/${id}/history/rating?gameCode=${game}&disciplineCode=${discipline}&limit=20`} paging="sequence"
      summary={data => <div className="lsr-users-pad lsr-stack">
        <InfoTiles items={[{ label: 'Текущий PR', value: display(field(data, 'current.pilot.value')) }, { label: 'Текущий SR', value: display(field(data, 'current.safety.value')) }, { label: 'Дисциплина', value: disciplineNames[discipline], small: true }, { label: 'Игра', value: games[game] ?? game, small: true }]} />
        <RatingChart rows={Array.isArray(data.items) ? data.items as HistoryRow[] : []} />
      </div>}
      columns={[time('appliedAt'), { title: 'Событие / гонка', render: r => `${display(field(r, 'race.eventTitle'))} · ${display(field(r, 'race.raceTitle'))}` }, { title: 'PR: было → стало (Δ)', render: metric('pilot') }, { title: 'SR: было → стало (Δ)', render: metric('safety') }, state('kind', 'Изменение'), { title: 'Причина', key: 'reason' }]} />
  </Panel>;
}
function RatingChart({ rows }: { rows: HistoryRow[] }) {
  if (rows.length < 2) return null;
  return <div className="lsr-users-charts">{['pilot', 'safety'].map(key => {
    const values = rows.map(r => Number(field(r, key + '.after'))).reverse(), low = Math.min(...values), high = Math.max(...values);
    const points = values.map((v, i) => `${10 + i * 480 / (values.length - 1)},${90 - (v - low) * 70 / (high - low || 1)}`).join(' ');
    return <div key={key} className="lsr-users-chart"><span className="lsr-eyebrow">{key === 'pilot' ? 'PR' : 'SR'} · показанная страница истории</span><svg viewBox="0 0 500 100" role="img" aria-label={`Динамика ${key === 'pilot' ? 'PR' : 'SR'}`} preserveAspectRatio="none"><polyline points={points} fill="none" stroke={key === 'pilot' ? '#285ed6' : '#1b7654'} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg></div>;
  })}</div>;
}

type ActivityKind = 'sessions' | 'presence' | 'audit' | 'notifications';
export function Activity({ id }: { id: string }) {
  const [kind, setKind] = useState<ActivityKind>('sessions'), [action, setAction] = useState(''), [relation, setRelation] = useState('subjectId'), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const url = kind === 'audit' ? `/admin/audit?${relation}=${id}&limit=20${action ? '&action=' + encodeURIComponent(action) : ''}${from ? '&from=' + encodeURIComponent(new Date(from + 'T00:00:00').toISOString()) : ''}${to ? '&to=' + encodeURIComponent(new Date(to + 'T23:59:59.999').toISOString()) : ''}` : `/admin/users/${id}/history/${kind}?limit=20`;
  const columns: Column[] = kind === 'notifications' ? [time('createdAt'), { title: 'Заголовок', key: 'title' }, { title: 'Текст', key: 'body' }, state()]
    : kind === 'sessions' ? [state('audience', 'Раздел'), { title: 'Браузер / устройство', key: 'userAgent' }, state(), time('expiresAt', 'Истекает'), time('revokedAt', 'Завершена')]
    : kind === 'presence' ? [time('occurredAt'), state('kind', 'Подключение'), { title: 'Сессия заезда', key: 'sessionId' }, { title: 'Имя в игре', key: 'name' }, { title: 'Причина', key: 'reason' }]
    : [time('at'), { title: 'Действие', render: r => auditNames[String(r.action)] ?? display(r.action) }, { title: 'Автор', render: r => display(field(r, 'actor.userId')) }, { title: 'Причина', key: 'reason' }, { title: 'Сведения', render: r => <><div>{display(field(r, 'changes.userAgent'))}</div><div className="lsr-minor">{status(field(r, 'changes.audience'))}</div><AuditChanges row={r} /></> }];
  const titles: Record<ActivityKind, string> = { sessions: 'Сессии входа', presence: 'Игровые подключения', audit: 'Журнал действий', notifications: 'Уведомления' };
  return <>
    <SubTabs label="Сессии и аудит" value={kind} onChange={setKind} items={[{ key: 'sessions', label: 'Сессии входа' }, { key: 'presence', label: 'Игровые подключения' }, { key: 'audit', label: 'Журнал действий' }, { key: 'notifications', label: 'Уведомления' }]} />
    {kind === 'sessions' && <div style={{ marginBottom: 14 }}><Notice>Действующая сессия не означает, что игрок сейчас онлайн. Даты старых входов не сохранялись. Новые входы и выходы доступны в журнале действий.</Notice></div>}
    <Panel title={titles[kind]} body={false}>
      {kind === 'audit' && <Toolbar><div className="lsr-toolbar-group lsr-users-filters">
        <label className="lsr-users-filter">С<input type="date" className="lsr-select" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="lsr-users-filter">По<input type="date" className="lsr-select" value={to} onChange={e => setTo(e.target.value)} /></label>
        <SelectInput label="Связь с игроком" value={relation} onChange={setRelation} options={[{ value: 'subjectId', label: 'Действия над аккаунтом' }, { value: 'actorId', label: 'Действия игрока' }]} />
        <SelectInput label="Действие" value={action} onChange={setAction} options={[{ value: '', label: 'Все действия' }, { value: 'auth.login', label: 'Входы' }, { value: 'auth.logout', label: 'Выходы' }]} />
      </div></Toolbar>}
      <History url={url} columns={columns} paging={kind === 'sessions' ? 'page' : 'cursor'} />
    </Panel>
  </>;
}

type ModerationKind = 'sanctions' | 'authored' | 'accused';
export function Moderation({ id }: { id: string }) {
  const [kind, setKind] = useState<ModerationKind>('sanctions');
  const [report, setReport] = useState<string | null>(null);
  const titles: Record<ModerationKind, string> = { sanctions: 'Ограничения', authored: 'Жалобы игрока', accused: 'Жалобы на игрока' };
  return <>
    <SubTabs label="Ограничения и жалобы" value={kind} onChange={setKind} items={[{ key: 'sanctions', label: 'Ограничения' }, { key: 'authored', label: 'Жалобы игрока' }, { key: 'accused', label: 'Жалобы на игрока' }]} />
    <Panel title={titles[kind]} body={false} actions={<Button size="sm" to="/officiating">Открыть судейство</Button>}>
      {kind === 'sanctions'
        ? <History url={`/admin/sanctions?userId=${id}&limit=20`} columns={[state('type', 'Ограничение'), state(), { title: 'Причина', key: 'publicReason' }, time('startsAt', 'Начало'), time('endsAt', 'Окончание'), time('revokedAt', 'Отозвано')]} />
        : <History url={`/admin/officiating/protests?userId=${id}&relation=${kind}&limit=20`} columns={[time('createdAt'), { title: 'Жалоба', render: r => <TextLink size="sm" onClick={() => setReport(String(r.id))}>№ {display(r.id)}</TextLink> }, state(), { title: 'Причина', key: 'reason' }, { title: 'Автор', key: 'submittedById' }, { title: 'На игрока', key: 'accusedId' }]} />}
    </Panel>
    <div style={{ marginTop: 14 }}><Notice tone="warning">Здесь ограничения и жалобы только читаются. Санкции и решения по жалобам принимаются в судействе с указанием основания.</Notice></div>
    <Dialog open={!!report} onClose={() => setReport(null)} width={760} title={`Жалоба № ${report ?? ''}`} actions={<Button onClick={() => setReport(null)}>Закрыть</Button>}>{report && <ReportDetails key={report} id={report} />}</Dialog>
  </>;
}

type ContentKind = 'skins' | 'uploads' | 'settings' | 'preferences' | 'access';
export function Content({ user }: { user: AdminPlayer }) {
  const [kind, setKind] = useState<ContentKind>('skins');
  const titles: Record<ContentKind, string> = { skins: 'Скины', uploads: 'Материалы каталога', settings: 'Настройки', preferences: 'Настройки уведомлений', access: 'Роли и доступы' };
  return <>
    <SubTabs label="Каталог и доступы" value={kind} onChange={setKind} items={[{ key: 'skins', label: 'Скины' }, { key: 'uploads', label: 'Каталог' }, { key: 'settings', label: 'Настройки' }, { key: 'preferences', label: 'Уведомления' }, { key: 'access', label: 'Роли и доступы' }]} />
    <Panel title={titles[kind]} body={kind === 'settings'} actions={kind === 'access' ? <Button size="sm" variant="soft" to={`/access?userId=${encodeURIComponent(user.userId)}`}>Управление доступом</Button> : undefined}>
      {kind === 'skins' && <History url={`/skins/admin?ownerType=user&ownerId=${user.userId}&limit=20`} columns={[{ title: 'Скин', key: 'displayName' }, { title: 'Превью', render: r => r.previewUrl ? <img className="lsr-users-skin" src={String(r.previewUrl)} alt="" loading="lazy" /> : '—' }, { title: 'Статус', render: r => r.deletedAt ? 'Удалён' : field(r, 'moderation.blocked') ? 'Заблокирован' : r.active ? 'Активен' : 'Неактивен' }, { title: 'Видимость', render: r => r.visibility === 'public' ? 'Публичный' : 'Личный' }, time('createdAt')]} />}
      {kind === 'preferences' && <History url={`/admin/users/${user.userId}/history/preferences`} caption="Явно сохранённые настройки. Для остальных категорий действуют настройки платформы." columns={[{ title: 'Категория', key: 'type' }, { title: 'Канал', key: 'channel' }, { title: 'Доставка', render: r => r.enabled ? 'Включена' : 'Выключена' }, time('updatedAt', 'Изменено')]} />}
      {kind === 'uploads' && <History url={`/admin/catalog/items?createdByUserId=${user.userId}&limit=20`} columns={[{ title: 'Название', key: 'title' }, { title: 'Тип', render: r => ({ photo: 'Фото', car: 'Машина', track: 'Трасса', plugin: 'Плагин', car_set: 'Набор машин', weather_preset: 'Погода' }[String(r.kind)] ?? display(r.kind)) }, state(), time('createdAt')]} />}
      {kind === 'settings' && <MetaGrid columns={2}><Meta label="Игры">{gameNames(user.enabledGames)}</Meta><Meta label="Оформление">{user.themeMode === 'light' ? 'Светлое' : user.themeMode === 'dark' ? 'Тёмное' : '—'}</Meta></MetaGrid>}
      {kind === 'access' && <History url={`/admin/access/grants?subjectId=${user.userId}`} columns={[{ title: 'Роль', key: 'roleCode' }, state(), { title: 'Область', render: r => status(r.scopeType) }, { title: 'Объект', key: 'scopeId' }, time('validFrom', 'С'), time('validTo', 'До')]} />}
    </Panel>
  </>;
}

function ReportDetails({ id }: { id: string }) {
  const [data, setData] = useState<HistoryRow | null>(null), [error, setError] = useState<{ message: string; status: number | null } | null>(null);
  useEffect(() => { let live = true; void apiFetch<HistoryRow>(`/admin/officiating/protests/${id}`).then(v => { if (live) setData(v); }).catch(e => { if (live) setError({ message: e.message, status: typeof e.status === 'number' ? e.status : null }); }); return () => { live = false; }; }, [id]);
  if (error) return <ErrorState error={error.message} status={error.status} />;
  if (!data) return <LoadingBlock />;
  const report = data.report as HistoryRow;
  const comments = Array.isArray(report.comments) ? report.comments as HistoryRow[] : [];
  const changes = Array.isArray(data.history) ? data.history as HistoryRow[] : [];
  return <div className="lsr-stack">
    <MetaGrid columns={2}><Meta label="Состояние"><StateBadge value={report.status} /></Meta><Meta label="Причина">{display(report.reason)}</Meta><Meta label="Место инцидента">{display(report.incidentLocation)}</Meta><Meta label="Круг">{display(report.incidentLap)}</Meta><Meta label="Решение по обращению">{display(report.resolutionReason)}</Meta></MetaGrid>
    {report.videoUrl && /^https?:\/\//.test(String(report.videoUrl)) ? <a className="lsr-link" href={String(report.videoUrl)} target="_blank" rel="noreferrer">Видео инцидента ↗</a> : null}
    <div><div className="lsr-eyebrow">Комментарии</div>{comments.length ? <Timeline items={comments.map(c => ({ title: `Игрок ${display(c.authorId)}`, detail: <span style={{ whiteSpace: 'pre-wrap' }}>{display(c.body)}</span>, at: date(c.createdAt) }))} /> : <EmptyState compact>Комментариев нет.</EmptyState>}</div>
    <div><div className="lsr-eyebrow">История рассмотрения</div>{changes.length ? <Timeline items={changes.map(c => ({ title: status(c.to), detail: display(c.reason), at: date(c.at) }))} /> : <EmptyState compact>Изменений не было.</EmptyState>}</div>
    <div><Button size="sm" variant="soft" to={`/officiating?resultId=${field(report, 'context.source.id') ?? ''}${field(report, 'context.eventId') ? '&eventId=' + field(report, 'context.eventId') : ''}`}>Перейти к судейству</Button></div>
  </div>;
}
function AuditChanges({ row }: { row: HistoryRow }) {
  const labels: Record<string, string> = { firstName: 'Имя', lastName: 'Фамилия', shortName: 'Короткое имя', country: 'Страна', discord: 'Discord', youtube: 'YouTube', avatar: 'Аватар', enabledGames: 'Игры', themeMode: 'Оформление' };
  const changed = field(row, 'changes.fields');
  if (!Array.isArray(changed)) return null;
  return <div>{changed.map(key => <div key={String(key)}>{labels[String(key)] ?? String(key)}: {display(field(row, `changes.before.${key}`))} → {display(field(row, `changes.after.${key}`))}</div>)}</div>;
}
