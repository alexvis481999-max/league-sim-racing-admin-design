import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiFetch } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import { useDebouncedValue } from '../../shared/ui';
import type { AuditItem } from '../../shared/access-types';
import {
  Details, EmbeddedContext, EmptyState, ErrorState, LoadMore, LoadingBlock, Meta, MetaGrid, PageHeader, Panel, SearchInput, Table, TextLink, Toolbar,
  clickableRow, dateTime, usePageChrome,
} from '../../ui/v16';
import './audit.v16.css';

type AuditPageData = { items: AuditItem[]; nextCursor: string | null };

/** dd.mm.yyyy hh:mm:ss — audit needs exact second marks (display only, browser time zone). */
function auditTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return `${dateTime(value)}:${String(date.getSeconds()).padStart(2, '0')}`;
}
const auditActor = (item: AuditItem) => (item.actor.type === 'system' ? 'Система' : `Пользователь ${item.actor.userId ?? '—'}`);

/**
 * Admin action journal. Standalone: module page with search, table and a record card.
 * Embedded (event journal): the same list without page chrome, filtered by `eventId`.
 */
export function AuditPage({ eventId, active = true }: { eventId?: string; active?: boolean } = {}) {
  const embedded = !!eventId;
  const [data, setData] = useState<AuditPageData | null>(null);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q')?.slice(0, 200) ?? '');
  const search = useDebouncedValue(query.trim());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; status: number | null } | null>(null);
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const revision = useRef(0);
  const load = useCallback(async (after?: string) => {
    const request = ++revision.current;
    setBusy(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('q', search);
      if (eventId) params.set('eventId', eventId);
      if (after) params.set('cursor', after);
      const page = await apiFetch<AuditPageData>(`/admin/audit?${params}`);
      if (request !== revision.current) return;
      setData((old) => (after && old ? { items: [...old.items, ...page.items], nextCursor: page.nextCursor } : page));
    } catch (e) {
      if (request === revision.current) setError({ message: e instanceof Error ? e.message : 'Не удалось загрузить журнал', status: e instanceof ApiError ? e.status : null });
    } finally {
      if (request === revision.current) setBusy(false);
    }
  }, [search, eventId]);
  useRealtimeRefresh(['audit'], () => load(), active);
  useEffect(() => { void load(); return () => { revision.current++; }; }, [load]);

  const content = selected ? (
    <AuditRecord item={selected} embedded={embedded} onBack={() => setSelected(null)} />
  ) : (
    <AuditList data={data} busy={busy} error={error} embedded={embedded} query={query} search={search}
      setQuery={(value) => setQuery(value.slice(0, 200))} onOpen={setSelected} onRetry={() => void load()} onMore={() => data?.nextCursor && void load(data.nextCursor)} />
  );
  if (embedded) return <EmbeddedContext.Provider value><div className="lsr-stack lsr-audit-embedded">{content}</div></EmbeddedContext.Provider>;
  return (
    <div className="lsr-stack" style={{ gap: 0 }}>
      <Chrome selected={selected} />
      <PageHeader overline="Администрирование" title="Журнал действий" description="Поиск изменений и проверка административных действий" />
      {content}
    </div>
  );
}

function Chrome({ selected }: { selected: AuditItem | null }) {
  usePageChrome({ crumbs: selected ? [{ label: 'Журнал действий' }, { label: `Запись ${selected.id}` }] : [{ label: 'Журнал действий' }] });
  return null;
}

function AuditList({ data, busy, error, embedded, query, search, setQuery, onOpen, onRetry, onMore }: {
  data: AuditPageData | null; busy: boolean; error: { message: string; status: number | null } | null; embedded: boolean; query: string; search: string;
  setQuery: (value: string) => void; onOpen: (item: AuditItem) => void; onRetry: () => void; onMore: () => void;
}) {
  const body: ReactNode = (
    <>
      <Toolbar><SearchInput wide label="Поиск по журналу" placeholder="Автор, объект, действие, событие, ID или дата" value={query} onChange={setQuery} /></Toolbar>
      {error && (data ? <div style={{ padding: embedded ? '0 0 12px' : '12px 16px 0' }}><ErrorState error={error.message} status={error.status} onRetry={onRetry} compact /></div> : <div style={{ padding: embedded ? 0 : 16 }}><ErrorState error={error.message} status={error.status} onRetry={onRetry} /></div>)}
      {!data && !error && <div style={{ padding: embedded ? 0 : 16 }}><LoadingBlock rows={5} label="Загрузка журнала" /></div>}
      {data && !data.items.length && <EmptyState compact title={search ? 'Ничего не найдено' : 'Записей нет'}>{search ? 'Измените запрос: поиск идёт по всему журналу.' : 'Журнал пока пуст.'}</EmptyState>}
      {data && !!data.items.length && (
        <Table variant="module" label="Журнал действий">
          <thead><tr><th>Время</th><th>Инициатор</th><th>Действие</th><th>Целевой объект</th><th>Связи</th></tr></thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} {...clickableRow(() => onOpen(item))} aria-label={`Запись ${item.id}`}>
                <td className="lsr-audit-time">{auditTime(item.at)}</td>
                <td>{item.actor.type === 'user' && item.actor.userId ? <TextLink size="sm" to={`/users?userId=${encodeURIComponent(item.actor.userId)}`}>{auditActor(item)}</TextLink> : auditActor(item)}</td>
                <td><div className="lsr-audit-action">{item.action}</div>{item.reason && <div className="lsr-audit-reason">{item.reason}</div>}</td>
                <td>{item.target.type} · <span className="lsr-mono">{item.target.id}</span></td>
                <td>{item.eventId && !embedded ? <TextLink size="sm" to={`/events/${encodeURIComponent(item.eventId)}`}>Событие №{item.eventId}</TextLink> : item.eventId ? `Событие №${item.eventId}` : item.organizerId ? `Организатор №${item.organizerId}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <LoadMore hasMore={!!data?.nextCursor} busy={busy || query.trim() !== search} onClick={onMore} />
      {busy && data && <span className="lsr-muted" role="status" style={{ padding: embedded ? 0 : '0 16px 12px' }}>Обновление…</span>}
    </>
  );
  if (embedded) return body;
  return (
    <>
      <Panel title="История административных действий" body={false}>{body}</Panel>
      <div className="lsr-notice" style={{ marginTop: 16 }}>Журнал — диагностический инструмент: поиск идёт по всему журналу, карточка записи показывает переданные сервером изменения, причину и идентификатор команды.</div>
    </>
  );
}

function AuditRecord({ item, embedded, onBack }: { item: AuditItem; embedded: boolean; onBack: () => void }) {
  const changes = changeRows(item.changes);
  return (
    <div>
      <div className="lsr-audit-topline"><button type="button" onClick={onBack}>← Журнал действий</button><b>Запись {item.id}</b></div>
      <div className="lsr-cols-module">
        <Panel title="Событие аудита">
          <MetaGrid columns={2}>
            <Meta label="Дата и время">{auditTime(item.at)}</Meta>
            <Meta label="Инициатор">{auditActor(item)}</Meta>
            <Meta label="Действие">{item.action}</Meta>
            <Meta label="Объект">{`${item.target.type} · ${item.target.id}`}</Meta>
          </MetaGrid>
          <div className="lsr-audit-block"><label>Причина</label><div className="lsr-audit-detailbox">{item.reason ?? 'Причина не передана'}</div></div>
          <div className="lsr-audit-block">
            <label>Изменения</label>
            {item.changes == null ? <div className="lsr-audit-detailbox">Изменения не переданы</div> : changes ? (
              <Table label="Изменения">
                <thead><tr><th>Поле</th><th>До</th><th>После</th></tr></thead>
                <tbody>{changes.map(([field, before, after]) => <tr key={field}><td className="lsr-primary">{field}</td><td className="lsr-mono">{before}</td><td className="lsr-mono">{after}</td></tr>)}</tbody>
              </Table>
            ) : <pre className="lsr-pre">{JSON.stringify(item.changes, null, 2)}</pre>}
          </div>
        </Panel>
        <Panel title="Трассировка" body={false}>
          <div className="lsr-audit-items">
            <div><b>ID записи</b><span className="lsr-mono">{item.id}</span></div>
            <div><b>Команда</b><span className="lsr-mono">{item.commandId ?? '—'}</span></div>
            <div><b>Целевой объект</b><span>{item.target.type} · {item.target.id}</span></div>
            <div><b>Событие</b><span>{item.eventId ? (embedded ? `№${item.eventId}` : <TextLink size="sm" to={`/events/${encodeURIComponent(item.eventId)}`}>№{item.eventId}</TextLink>) : '—'}</span></div>
            <div><b>Организатор</b><span>{item.organizerId ? `№${item.organizerId}` : '—'}</span></div>
            <div><b>Субъект</b><span>{item.subjectId ? <TextLink size="sm" to={`/users?userId=${encodeURIComponent(item.subjectId)}`}>{item.subjectId}</TextLink> : '—'}</span></div>
          </div>
          <div style={{ padding: '4px 19px 16px' }}><Details value={item} /></div>
        </Panel>
      </div>
    </div>
  );
}

/** `{field: {before, after}}` maps render as a table; any other shape stays raw JSON. */
function changeRows(changes: unknown): [string, string, string][] | null {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null;
  const entries = Object.entries(changes as Record<string, unknown>);
  if (!entries.length || !entries.every(([, v]) => v && typeof v === 'object' && 'before' in v && 'after' in v)) return null;
  const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
  return entries.map(([field, v]) => [field, show((v as { before: unknown }).before), show((v as { after: unknown }).after)]);
}
