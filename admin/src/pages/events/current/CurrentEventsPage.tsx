import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../../../shared/api';
import { useDebouncedValue } from '../../../shared/ui';
import { useRealtimeRefresh } from '../../../shared/realtime';
import { displayGame } from '../../../../../shared/presentation';
import type { AdminAccess } from '../../../shared/types';
import type { EventSummary } from './event-api';
import type { Draft, Settings } from '../../../features/event-authoring/types';
import {
  Button, Dialog, EmptyState, ErrorState, FilterButtons, PageHeader, SearchInput, SelectInput, Skeleton, Stats, StatusBadge, Table, TableFoot, clickableRow,
  eventTone, period, shortDateTime, usePageChrome,
} from '../../../ui/v16';
import { htmlToText, scenarioLabel, scenarioLabels, useOrganizerNames } from './event-labels';

type Filter = 'all' | 'RUNNING' | 'PUBLISHED' | 'drafts' | 'COMPLETED' | 'CANCELLED';
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'RUNNING', label: 'Активные' },
  { value: 'PUBLISHED', label: 'Запланированы' },
  { value: 'drafts', label: 'Черновики' },
  { value: 'COMPLETED', label: 'Завершённые' },
  { value: 'CANCELLED', label: 'Отменённые' },
];
const typeOptions = [{ value: '', label: 'Все типы событий' }, ...Object.entries(scenarioLabels).map(([value, label]) => ({ value, label }))];
type Page<T> = { items: T[]; nextAfterId: string | null };

export function CurrentEventsPage({ access }: { access: AdminAccess }) {
  usePageChrome({ crumbs: [{ label: 'События' }] });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = (filters.some((f) => f.value === params.get('status')) ? params.get('status') : 'all') as Filter;
  const type = params.get('type') ?? '';
  const [query, setQuery] = useState(params.get('q') ?? '');
  const q = useDebouncedValue(query.trim());
  const [items, setItems] = useState<EventSummary[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draftCursor, setDraftCursor] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; status: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Draft | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const generation = useRef(0);
  const deleteKey = useRef<{ id: string; key: string } | null>(null);
  const organizers = useOrganizerNames();
  const canCreate = access.grants?.some((grant) => grant.permissions.some((p) => p.startsWith('events.write.')));
  const showDrafts = canCreate && (filter === 'all' || filter === 'drafts') && !type;

  const update = (key: string, value: string) => setParams((old) => {
    const next = new URLSearchParams(old);
    if (value && value !== 'all') next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });
  useEffect(() => { update('q', q); }, [q]);

  async function load(more = false, silent = false) {
    const revision = ++generation.current;
    if (!silent) { setLoading(true); if (!more) { setItems([]); setDrafts([]); } }
    try {
      const eventParams = new URLSearchParams({ limit: '20', view: 'list' }), draftParams = new URLSearchParams();
      if (q) { eventParams.set('q', q); draftParams.set('q', q); }
      if (type) eventParams.set('scenarioCode', type);
      if (filter === 'drafts') eventParams.set('publication', 'unpublished');
      else if (filter !== 'all') eventParams.set('status', filter);
      if (more && cursor) eventParams.set('afterId', cursor);
      if (more && draftCursor) draftParams.set('afterId', draftCursor);
      const [eventsResult, draftsResult] = await Promise.all([
        !more || cursor ? apiFetch<Page<EventSummary>>('/admin/events?' + eventParams) : null,
        showDrafts && (!more || draftCursor) ? apiFetch<Page<Draft>>('/admin/event-drafts?' + draftParams) : null,
      ]);
      if (revision !== generation.current) return;
      if (eventsResult) { setItems((old) => (more ? [...old, ...eventsResult.items] : eventsResult.items)); setCursor(eventsResult.nextAfterId); }
      if (draftsResult) { setDrafts((old) => (more ? [...old, ...draftsResult.items] : draftsResult.items)); setDraftCursor(draftsResult.nextAfterId); }
      else if (!more) { setDrafts([]); setDraftCursor(null); }
      setError(null);
    } catch (e) {
      if (revision === generation.current) setError({ message: e instanceof ApiError && e.status === 403 ? 'Недостаточно прав для просмотра событий.' : e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : null });
    } finally {
      if (revision === generation.current) setLoading(false);
    }
  }
  useEffect(() => { void load(); return () => { generation.current++; }; }, [q, filter, type, showDrafts]);
  useRealtimeRefresh(['events', 'runtime'], () => load(false, true));

  async function removeDraft(draft: Draft) {
    if (deleteKey.current?.id !== draft.id) deleteKey.current = { id: draft.id, key: crypto.randomUUID() };
    setDeleteBusy(true);
    try {
      await apiFetch('/admin/event-drafts/' + draft.id, { method: 'DELETE', headers: { 'Idempotency-Key': deleteKey.current.key }, body: JSON.stringify({ expectedVersion: draft.revision }) });
      deleteKey.current = null;
      setDeleting(null);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) deleteKey.current = null;
      setError({ message: e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : null });
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const more = (n: number, hasMore: boolean) => (hasMore ? `${n}+` : String(n));
  const stats = filter === 'all' && !type
    ? [
        { value: more(items.length + drafts.length, !!cursor || !!draftCursor), label: 'Всего событий' },
        { value: more(items.filter((e) => e.status === 'RUNNING').length, !!cursor), label: 'Активные' },
        { value: more(items.filter((e) => e.status === 'PUBLISHED').length, !!cursor), label: 'Запланированы' },
        ...(canCreate ? [{ value: more(drafts.length + items.filter((e) => e.status === 'DRAFT').length, !!draftCursor || !!cursor), label: 'Черновики' }] : []),
      ]
    : [{ value: more(items.length + drafts.length, !!cursor || !!draftCursor), label: 'Найдено' }];
  const rows = filter === 'drafts' ? [...drafts.map((d) => ({ kind: 'draft' as const, d })), ...items.map((e) => ({ kind: 'event' as const, e }))] : [...items.map((e) => ({ kind: 'event' as const, e })), ...drafts.map((d) => ({ kind: 'draft' as const, d }))];
  const draftTitle = (draft: Draft) => String((draft.document.settings.event as Settings | undefined)?.title || 'Без названия');

  return (
    <>
      <PageHeader
        overline="Управление событиями"
        title="События"
        description="Все типы событий в одном списке. Откройте существующее событие или создайте новое."
        actions={canCreate ? <Button variant="primary" to="/events/new">＋ Создать событие</Button> : undefined}
      />
      <Stats items={loading && !items.length ? stats.map((s) => ({ ...s, value: '…' })) : stats} />
      <div className="lsr-card">
        <div className="lsr-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Поиск по названию или ID" label="Поиск событий" />
          <SelectInput value={type} onChange={(value) => update('type', value)} options={typeOptions} label="Тип события" />
          <FilterButtons value={filter} onChange={(value) => update('status', value)} options={filters.filter((f) => f.value !== 'drafts' || canCreate).map((f) => f.value === 'drafts' && filter === 'all' && !type ? { ...f, label: `Черновики · ${more(drafts.length, !!draftCursor)}` } : f)} label="Состояние событий" />
        </div>
        {error && !loading && <div style={{ padding: 16 }}><ErrorState error={error.message} status={error.status} onRetry={() => void load()} /></div>}
        {!error && !loading && !rows.length && (
          <EmptyState title="События не найдены" action={canCreate ? <Button variant="primary" to="/events/new">＋ Создать событие</Button> : undefined}>
            {q || filter !== 'all' || type ? 'Измените поиск или фильтры.' : 'Создайте первое событие, чтобы оно появилось в списке.'}
          </EmptyState>
        )}
        {(loading || rows.length > 0) && (
          <Table variant="list" label="События">
            <thead>
              <tr><th>Событие</th><th className="lsr-hide-sm">Тип</th><th className="lsr-hide-md">Игра и организатор</th><th className="lsr-hide-md">Период / старт</th><th>Статус</th><th aria-hidden="true" /></tr>
            </thead>
            <tbody>
              {loading && !rows.length && Array.from({ length: 6 }, (_, i) => (
                <tr key={i}><td><Skeleton width="60%" height={16} /><Skeleton width="80%" height={12} style={{ marginTop: 8 }} /></td><td className="lsr-hide-sm"><Skeleton width={90} /></td><td className="lsr-hide-md"><Skeleton width={110} /></td><td className="lsr-hide-md"><Skeleton width={120} /></td><td><Skeleton width={80} height={22} /></td><td /></tr>
              ))}
              {rows.map((row) => row.kind === 'event' ? (
                <tr key={'e' + row.e.id} {...clickableRow(() => navigate('/events/' + row.e.id))} aria-label={'Открыть ' + row.e.title}>
                  <td>
                    <div className="lsr-row-title">{row.e.title}</div>
                    <div className="lsr-row-sub"><span className="lsr-idcode">{row.e.id}</span>{htmlToText(row.e.description) ? ` · ${htmlToText(row.e.description)}` : ''}</div>
                  </td>
                  <td className="lsr-hide-sm lsr-nowrap">{scenarioLabel(row.e.scenarioCode, scenarioLabels[row.e.scenarioCode] ? null : row.e.scenarioTitle)}</td>
                  <td className="lsr-hide-md">{displayGame(row.e.gameCode)}<div className="lsr-muted">{organizers[row.e.organizerId] ?? `Организатор #${row.e.organizerId}`}</div></td>
                  <td className="lsr-hide-md lsr-num lsr-nowrap">{period(row.e.displaySchedule?.startsAt ?? row.e.startsAt, row.e.displaySchedule ? row.e.displaySchedule.endsAt : row.e.endsAt, row.e.timezone)}</td>
                  <td><StatusBadge status={row.e.displayStatus} tone={eventTone(row.e.displayStatus)} variant="pill" /></td>
                  <td className="lsr-chev" aria-hidden="true">›</td>
                </tr>
              ) : (
                <tr key={'d' + row.d.id} {...clickableRow(() => navigate('/events/new?draft=' + row.d.id))} aria-label={'Продолжить ' + draftTitle(row.d)}>
                  <td>
                    <div className="lsr-row-title">{draftTitle(row.d)}</div>
                    <div className="lsr-row-sub"><span className="lsr-idcode">{row.d.id}</span> · черновик редактора, изменён {shortDateTime(row.d.updatedAt)}</div>
                  </td>
                  <td className="lsr-hide-sm">{scenarioLabel(row.d.document.scenarioCode)}</td>
                  <td className="lsr-hide-md">—</td>
                  <td className="lsr-hide-md">Не опубликован</td>
                  <td><span className="lsr-pill is-current">Черновик</span></td>
                  <td><Button size="sm" variant="danger" onClick={() => setDeleting(row.d)} aria-label={'Удалить черновик ' + draftTitle(row.d)}>Удалить</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {(cursor || draftCursor) && (
          <TableFoot>
            <span>Показано {rows.length}</span>
            <Button size="sm" disabled={loading} onClick={() => void load(true)}>Показать ещё</Button>
          </TableFoot>
        )}
      </div>
      <Dialog open={!!deleting} onClose={() => !deleteBusy && setDeleting(null)} title="Удалить черновик?" description={deleting ? `«${draftTitle(deleting)}» будет удалён без возможности восстановления.` : undefined}
        actions={<><Button disabled={deleteBusy} onClick={() => setDeleting(null)}>Отмена</Button><Button variant="danger-solid" disabled={deleteBusy} onClick={() => deleting && void removeDraft(deleting)}>Удалить черновик</Button></>} />
    </>
  );
}
