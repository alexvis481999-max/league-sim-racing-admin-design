import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiFetch, getAdminToken, jsonBody, subscribeAdminAuthChanged } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import { useDebouncedValue } from '../../shared/ui';
import {
  Button, Dialog, EmbeddedContext, EmptyState, ErrorState, FilterButtons, LoadMore, LoadingBlock, Notice, PageHeader, Panel, SearchInput, SelectField,
  StatusBadge, SubTabs, Table, TextArea, TextField, TextLink, Toolbar, Tabs, clickableRow, recordTone, shortDateTime, usePageChrome,
} from '../../ui/v16';
import './chats.v16.css';

type Thread = { id: string; type: 'DIRECT' | 'EVENT'; eventId: string | null; status: string; messageCount: number };
type Review = { reviewId: string; threadId: string; actorId: string; createdAt: string; reason: string };
type Message = { id: string; kind: 'USER' | 'SYSTEM'; authorName: string | null; authorUserId: string | null; createdAt: string; originalBody: string; moderation: { hidden: boolean } };
type Tab = 'chats' | 'reviews' | 'announcement';
type LoadError = { message: string; status: number | null };
const toError = (e: unknown, fallback: string): LoadError => ({ message: e instanceof Error ? e.message : fallback, status: e instanceof ApiError ? e.status : null });

/**
 * Commands keep their Idempotency-Key until the server answers definitively:
 * resending the same path and body after a lost response reuses the key, a 4xx answer releases it.
 */
function useCommand() {
  const keys = useRef(new Map<string, string>());
  return async function command<T>(path: string, body: unknown): Promise<T> {
    const signature = path + '\n' + JSON.stringify(body);
    const key = keys.current.get(signature) ?? crypto.randomUUID();
    keys.current.set(signature, key);
    try {
      const result = await apiFetch<T>(path, { ...jsonBody(body), headers: { 'Idempotency-Key': key } });
      keys.current.delete(signature);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408) keys.current.delete(signature);
      throw e;
    }
  };
}
type Command = ReturnType<typeof useCommand>;

const threadTitle = (t: Thread) => (t.type === 'DIRECT' ? 'Личный диалог' : t.eventId ? `Чат события №${t.eventId}` : 'Чат события');
const threadType = (t: Thread) => (t.type === 'DIRECT' ? 'Личный' : 'Событие');
const threadStatus = (t: Thread) => <StatusBadge variant="badge" status={{ code: t.status, label: t.status === 'OPEN' ? 'Открыт' : 'Архив' }} tone={recordTone(t.status, { OPEN: 'live' })} />;

/**
 * Chat moderation. Standalone: module page with chats, review journal and announcement tabs.
 * Embedded in an event journal (`eventId`) or a user profile (`userId`): no page chrome, filtered lists.
 * Message text is loaded only inside a review registered with a reason.
 */
export function ChatsPage({ eventId, userId, active = true }: { eventId?: string; userId?: string; active?: boolean } = {}) {
  const embedded = !!eventId || !!userId;
  const [tab, setTab] = useState<Tab>('chats');
  const [threads, setThreads] = useState<Thread[] | null>(null), [reviews, setReviews] = useState<Review[] | null>(null), [cursor, setCursor] = useState<string | null>(null);
  const [type, setType] = useState(eventId ? 'EVENT' : ''), [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim()), listRevision = useRef(0);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [error, setError] = useState<LoadError | null>(null), [busy, setBusy] = useState(false);
  const session = useRef(adminIdentity());
  const command = useCommand();
  useEffect(() => subscribeAdminAuthChanged(() => {
    const next = adminIdentity();
    if (next !== session.current) { session.current = next; listRevision.current++; setSelected(null); setThreads(null); setReviews(null); }
  }), []);
  async function load(more = false) {
    const request = ++listRevision.current, identity = adminIdentity();
    const q = new URLSearchParams({ limit: '50' });
    if (more && cursor) q.set('cursor', cursor);
    if (tab === 'chats' && type) q.set('type', type);
    if (userId) q.set('userId', userId);
    if (search) q.set('q', search);
    if (eventId) q.set('eventId', eventId);
    setBusy(true); setError(null);
    try {
      const page = await apiFetch<{ items: (Thread & Review)[]; nextCursor: string | null }>('/admin/chat/' + (tab === 'chats' ? 'threads' : 'reviews') + '?' + q);
      if (identity !== adminIdentity() || request !== listRevision.current) return;
      if (tab === 'chats') setThreads((old) => (more && old ? [...old, ...page.items] : page.items));
      else setReviews((old) => (more && old ? [...old, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch (e) {
      if (request === listRevision.current) setError(toError(e, 'Не удалось загрузить список'));
    } finally {
      if (request === listRevision.current) setBusy(false);
    }
  }
  useRealtimeRefresh(['chat'], async () => { if (tab !== 'announcement') await load(); }, active);
  useEffect(() => { setCursor(null); if (tab !== 'announcement') void load(); return () => { listRevision.current++; }; }, [tab, type, search, eventId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [{ key: 'chats' as const, label: 'Чаты' }, ...(userId ? [] : [{ key: 'reviews' as const, label: 'Журнал проверок' }, { key: 'announcement' as const, label: 'Объявление' }])];
  const changeTab = (next: Tab) => { setTab(next); setCursor(null); };
  const list = tab === 'announcement' ? <Announcement eventId={eventId} embedded={embedded} command={command} /> : (
    <ChatList tab={tab} embedded={embedded} threads={threads} reviews={reviews} busy={busy} error={error} query={query} search={search} cursor={cursor}
      type={type} showType={!eventId && tab === 'chats'} setType={setType} setQuery={(v) => setQuery(v.slice(0, 200))} onOpen={setSelected}
      onRetry={() => void load()} onMore={() => void load(true)} />
  );
  const content = selected
    ? <ThreadReview key={selected.id} thread={selected} embedded={embedded} active={active} command={command} onBack={() => setSelected(null)} />
    : <>
        {tabs.length > 1 && (embedded ? <SubTabs label="Разделы чатов" items={tabs} value={tab} onChange={changeTab} /> : <Tabs variant="module" label="Разделы чатов" items={tabs} value={tab} onChange={changeTab} />)}
        {list}
      </>;
  if (embedded) return <EmbeddedContext.Provider value><div className="lsr-stack lsr-chat-embedded">{content}</div></EmbeddedContext.Provider>;
  return (
    <div className="lsr-stack" style={{ gap: 0 }}>
      <Chrome selected={selected} />
      <PageHeader overline="Администрирование" title="Чаты" description="Проверки переписки, журнал модерации и объявления" />
      {content}
    </div>
  );
}

function Chrome({ selected }: { selected: Thread | null }) {
  usePageChrome({ crumbs: selected ? [{ label: 'Чаты' }, { label: `Чат ${selected.id}` }] : [{ label: 'Чаты' }] });
  return null;
}

function ChatList({ tab, embedded, threads, reviews, busy, error, query, search, cursor, type, showType, setType, setQuery, onOpen, onRetry, onMore }: {
  tab: 'chats' | 'reviews'; embedded: boolean; threads: Thread[] | null; reviews: Review[] | null; busy: boolean; error: LoadError | null; query: string; search: string; cursor: string | null;
  type: string; showType: boolean; setType: (v: string) => void; setQuery: (v: string) => void; onOpen: (t: Thread) => void; onRetry: () => void; onMore: () => void;
}) {
  const rows = tab === 'chats' ? threads : reviews;
  const pad = embedded ? undefined : 16;
  const body: ReactNode = (
    <>
      <Toolbar>
        <SearchInput wide label="Поиск" placeholder={tab === 'chats' ? 'Участник, событие, организатор или ID' : 'Автор, причина проверки или ID'} value={query} onChange={setQuery} />
        {showType && <FilterButtons label="Тип чата" value={type} onChange={setType} disabled={busy} options={[{ value: '', label: 'Все' }, { value: 'DIRECT', label: 'Личные' }, { value: 'EVENT', label: 'События' }]} />}
      </Toolbar>
      {error && <div style={{ padding: pad }}><ErrorState error={error.message} status={error.status} onRetry={onRetry} compact={!!rows} /></div>}
      {!rows && !error && <div style={{ padding: pad }}><LoadingBlock rows={4} /></div>}
      {rows && !rows.length && <EmptyState compact>{tab === 'chats' ? (search ? 'Чаты по запросу не найдены.' : 'Чатов нет.') : search ? 'Проверки по запросу не найдены.' : 'Проверок пока не было.'}</EmptyState>}
      {tab === 'chats' && !!threads?.length && (
        <Table variant="module" label="Чаты">
          <thead><tr><th>Чат</th><th>Тип</th><th>Сообщений</th><th>Событие</th><th>Состояние</th></tr></thead>
          <tbody>
            {threads.map((t) => (
              <tr key={t.id} {...clickableRow(() => onOpen(t))}>
                <td><button type="button" className="lsr-chat-open" aria-label={`Начать проверку чата #${t.id}`} onClick={() => onOpen(t)}>{threadTitle(t)}</button><div className="lsr-minor lsr-mono">{t.id}</div></td>
                <td>{threadType(t)}</td>
                <td className="lsr-num">{t.messageCount}</td>
                <td>{t.eventId ? (embedded ? `№${t.eventId}` : <TextLink size="sm" to={`/events/${encodeURIComponent(t.eventId)}`}>№{t.eventId}</TextLink>) : '—'}</td>
                <td>{threadStatus(t)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {tab === 'reviews' && !!reviews?.length && (
        <Table variant="module" label="Журнал проверок">
          <thead><tr><th>Проверка</th><th>Чат</th><th>Кто открыл</th><th>Основание</th><th>Время</th></tr></thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.reviewId}>
                <td className="lsr-primary lsr-mono">{r.reviewId}</td>
                <td className="lsr-mono">{r.threadId}</td>
                <td>{embedded ? `Администратор #${r.actorId}` : <TextLink size="sm" to={`/users?userId=${encodeURIComponent(r.actorId)}`}>Администратор #{r.actorId}</TextLink>}</td>
                <td style={{ overflowWrap: 'anywhere' }}>{r.reason}</td>
                <td className="lsr-nowrap">{shortDateTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <LoadMore hasMore={!!cursor} busy={busy || query.trim() !== search} onClick={onMore} />
    </>
  );
  if (embedded) return <>{body}</>;
  return (
    <>
      <Panel title={tab === 'chats' ? 'Доступные чаты' : 'История проверок'} body={false}>{body}</Panel>
      {tab === 'chats' && <Notice tone="warning"><span>Просмотр переписки требует причины и регистрации проверки. Содержимое не показывается в общем списке.</span></Notice>}
    </>
  );
}

/** Review request → review-bound message history → hiding a message with a reason. */
function ThreadReview({ thread, embedded, active, command, onBack }: { thread: Thread; embedded: boolean; active: boolean; command: Command; onBack: () => void }) {
  const [reason, setReason] = useState(''), [reviewId, setReviewId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null), [before, setBefore] = useState<string | null>(null);
  const [hideTarget, setHideTarget] = useState<Message | null>(null), [hideReason, setHideReason] = useState('');
  const [error, setError] = useState<LoadError | null>(null), [busy, setBusy] = useState(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await action(); } catch (e) { if (live.current) setError(toError(e, 'Не удалось выполнить действие')); } finally { if (live.current) setBusy(false); }
  }
  async function history(id: string, older = false) {
    const q = new URLSearchParams({ reviewId: id, limit: '50' });
    if (older && before) q.set('beforeId', before);
    const page = await apiFetch<{ items: Message[]; hasMore: boolean; nextBeforeId: string | null }>(`/admin/chat/threads/${thread.id}/messages?${q}`);
    if (!live.current) return;
    setMessages((old) => (older && old ? [...page.items, ...old] : page.items));
    setBefore(page.hasMore ? page.nextBeforeId : null);
  }
  async function review() {
    const result = await command<{ reviewId: string }>(`/admin/chat/threads/${thread.id}/review`, { reason });
    if (!live.current) return;
    setReviewId(result.reviewId);
    await history(result.reviewId);
  }
  useRealtimeRefresh(['chat'], async () => { if (reviewId) await history(reviewId); }, active && !!reviewId);
  const hide = () => run(async () => {
    await command(`/admin/chat/threads/${thread.id}/messages/${hideTarget!.id}/hide`, { reviewId, reason: hideReason });
    if (!live.current) return;
    setHideTarget(null);
    await history(reviewId!);
  });

  return (
    <div>
      <div className="lsr-chat-topline"><button type="button" onClick={onBack}>← Чаты</button><b>{threadTitle(thread)} · {thread.id}</b></div>
      {!reviewId ? (
        <div className="lsr-cols-module">
          <Panel title="Запрос проверки">
            <div className="lsr-stack">
              <Notice tone="warning">Переписка открывается только после регистрации проверки с указанием причины. Участники получат системное сообщение, проверка будет записана в журнал.</Notice>
              {error && <ErrorState error={error.message} status={error.status} />}
              <TextArea label="Причина доступа к переписке" placeholder="Например: жалоба на нарушение правил общения" value={reason} maxLength={4000} rows={4} disabled={busy} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="lsr-form-actions">
              <Button disabled={busy} onClick={onBack}>Отменить</Button>
              <Button variant="primary" disabled={busy || !reason.trim()} onClick={() => void run(review)}>Зарегистрировать проверку</Button>
            </div>
          </Panel>
          <ThreadContext thread={thread} embedded={embedded} />
        </div>
      ) : (
        <Panel title="Сообщения" sub={`Проверка №${reviewId} · ${reason.trim()}`} body={false} actions={<Button size="sm" onClick={onBack}>Завершить просмотр</Button>}>
          {error && <div className="lsr-chat-pad"><ErrorState error={error.message} status={error.status} onRetry={() => void run(() => history(reviewId))} /></div>}
          {!messages && !error && <div className="lsr-chat-pad"><LoadingBlock rows={4} label="Загрузка сообщений" /></div>}
          {before && <LoadMore hasMore busy={busy} label="Предыдущие сообщения" onClick={() => void run(() => history(reviewId, true))} />}
          {messages && !messages.length && <EmptyState compact>Сообщений нет.</EmptyState>}
          {!!messages?.length && (
            <div className="lsr-chat-messages" role="log" aria-label="Сообщения чата">
              {messages.map((m) => (
                <div key={m.id} className={`lsr-chat-message${m.kind === 'SYSTEM' ? ' is-system' : ''}${m.moderation.hidden ? ' is-hidden' : ''}`}>
                  <div className="lsr-chat-meta">
                    <b>{m.kind === 'SYSTEM' ? 'Система' : m.authorName || `#${m.authorUserId ?? '—'}`}</b>
                    <span>{shortDateTime(m.createdAt)}</span>
                    {m.moderation.hidden && <span className="lsr-badge is-current">Скрыто для пользователей</span>}
                  </div>
                  <div className="lsr-chat-body">{m.originalBody}</div>
                  {!m.moderation.hidden && m.kind === 'USER' && <Button size="sm" variant="plain" disabled={busy} onClick={() => { setHideTarget(m); setHideReason(''); }}>Скрыть сообщение</Button>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
      <Dialog open={hideTarget !== null} onClose={() => !busy && setHideTarget(null)} title="Скрыть сообщение" description="Сообщение перестанет показываться пользователям. Причина обязательна и сохраняется в журнале проверки."
        actions={<><Button disabled={busy} onClick={() => setHideTarget(null)}>Отмена</Button><Button variant="danger-solid" disabled={busy || !hideReason.trim()} onClick={() => void hide()}>Скрыть</Button></>}>
        {hideTarget && <div className="lsr-stack">
          <div className="lsr-notice is-neutral" style={{ whiteSpace: 'pre-wrap' }}>{hideTarget.originalBody}</div>
          {error && <ErrorState error={error.message} status={error.status} />}
          <TextArea label="Причина скрытия" placeholder="Основание модерации" value={hideReason} maxLength={4000} rows={3} disabled={busy} onChange={(e) => setHideReason(e.target.value)} />
        </div>}
      </Dialog>
    </div>
  );
}

function ThreadContext({ thread, embedded }: { thread: Thread; embedded: boolean }) {
  return (
    <Panel title="Контекст чата" body={false}>
      <div className="lsr-chat-items">
        <div><b>Тип</b><span>{threadType(thread)}</span></div>
        <div><b>Сообщений</b><span>{thread.messageCount}</span></div>
        <div><b>Событие</b><span>{thread.eventId ? (embedded ? `№${thread.eventId}` : <TextLink size="sm" to={`/events/${encodeURIComponent(thread.eventId)}`}>№{thread.eventId}</TextLink>) : '—'}</span></div>
        <div><b>Статус</b><span>{threadStatus(thread)}</span></div>
      </div>
      <div className="lsr-chat-pad" style={{ paddingTop: 4 }}><Notice>Текст сообщений не раскрывается до регистрации причины.</Notice></div>
    </Panel>
  );
}

function Announcement({ eventId, embedded, command }: { eventId?: string; embedded: boolean; command: Command }) {
  const [audience, setAudience] = useState(eventId ? 'event' : 'users'), [ids, setIds] = useState(eventId ?? '');
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [url, setUrl] = useState('');
  const [result, setResult] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false);
  const userIds = ids.split(/[\s,]+/).filter(Boolean);
  const valid = !!ids.trim() && !!title.trim() && !!body.trim();
  const audienceText = audience === 'users' ? `пользователи: ${userIds.length}` : `принятые участники события №${ids.trim()}`;
  async function send() {
    setBusy(true); setResult(null);
    try {
      const r = await command<{ recipientCount: number }>('/admin/notifications/announcements', {
        audience: audience === 'users' ? { type: 'users', userIds } : { type: 'event', eventId: ids.trim() }, title, body, actionUrl: url.trim() || null,
      });
      setResult({ tone: 'info', text: `Объявление принято сервером. Выбрано получателей: ${r.recipientCount}. Это не подтверждение доставки: доставка учитывает настройки пользователей.` });
      setConfirm(false);
    } catch (e) {
      setResult({ tone: 'danger', text: e instanceof Error ? e.message : 'Ошибка отправки' });
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  const clear = () => { setTitle(''); setBody(''); setUrl(''); if (!eventId) setIds(''); setResult(null); };
  const form = (
    <>
      <div className="lsr-stack">
        <Notice>Объявление сохраняется во входящих выбранных пользователей на сайте. Ответ сервера — число выбранных получателей, а не подтверждение доставки.</Notice>
        <div className="lsr-fields">
          {!eventId && <SelectField label="Аудитория" value={audience} disabled={busy} onChange={(e) => { setAudience(e.target.value); setIds(''); }} options={[{ value: 'users', label: 'Пользователи по ID' }, { value: 'event', label: 'Принятые участники события' }]} />}
          {!eventId && <TextField label={audience === 'users' ? 'ID пользователей' : 'ID события'} help={audience === 'users' ? 'Через запятую или пробел' : undefined} value={ids} disabled={busy} onChange={(e) => setIds(e.target.value)} />}
          <TextField label="Путь на сайте" help="Необязательно, например /events/1038" value={url} disabled={busy} onChange={(e) => setUrl(e.target.value)} full={!!eventId} />
          <TextField label="Заголовок" value={title} maxLength={180} disabled={busy} onChange={(e) => setTitle(e.target.value)} full />
          <TextArea label="Текст" value={body} maxLength={4000} rows={4} disabled={busy} onChange={(e) => setBody(e.target.value)} full />
        </div>
        {result && <Notice tone={result.tone} role="status">{result.text}</Notice>}
      </div>
      <div className="lsr-form-actions">
        <Button disabled={busy || (!title && !body && !url && (!!eventId || !ids))} onClick={clear}>Очистить</Button>
        <Button variant="primary" disabled={busy || !valid} onClick={() => setConfirm(true)}>Отправить объявление</Button>
      </div>
      <Dialog open={confirm} onClose={() => !busy && setConfirm(false)} title="Отправить объявление?" description={`Аудитория — ${audienceText}. Отправленное объявление нельзя отозвать из этого раздела.`}
        actions={<><Button disabled={busy} onClick={() => setConfirm(false)}>Отмена</Button><Button variant="primary" disabled={busy} onClick={() => void send()}>{busy ? 'Отправка…' : 'Отправить'}</Button></>}>
        <div className="lsr-stack is-tight"><b>{title}</b><span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{body}</span></div>
      </Dialog>
    </>
  );
  return embedded ? <div>{form}</div> : <Panel title="Объявление пользователям">{form}</Panel>;
}

function adminIdentity() {
  try {
    const token = getAdminToken();
    if (!token) return null;
    const p = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
    return JSON.stringify([p.sub, p.sid]);
  } catch {
    return null;
  }
}
