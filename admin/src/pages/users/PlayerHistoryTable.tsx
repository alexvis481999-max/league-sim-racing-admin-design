import { useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '../../shared/api';
import { Button, EmptyState, ErrorState, Skeleton, StatusBadge, Table, TableFoot, recordTone } from '../../ui/v16';
import { display, field, status, tones, type Column, type HistoryRow } from './history';

/** Server code as a module badge: text from the label map, colour from the UI tone rule; unknown codes stay neutral. */
export function StateBadge({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <>—</>;
  const code = String(value);
  return <StatusBadge variant="badge" status={{ code, label: status(code) }} tone={recordTone(code, tones)} />;
}

/** One visible page per request; switching resource remounts this component. Rendered inside a Panel without body padding. */
export function PlayerHistoryTable({ url, columns, paging = 'cursor', caption, summary }: { url: string; columns: Column[]; paging?: 'cursor' | 'page' | 'sequence'; caption?: ReactNode; summary?(data: HistoryRow): ReactNode }) {
  const [cursors, setCursors] = useState(['']), [data, setData] = useState<HistoryRow | null>(null), [error, setError] = useState<{ message: string; status: number | null } | null>(null), [retry, setRetry] = useState(0);
  const index = cursors.length - 1;
  useEffect(() => {
    let live = true; setData(null); setError(null);
    const query = new URLSearchParams(url.split('?')[1] ?? '');
    if (paging === 'page') query.set('page', String(index + 1));
    else if (cursors[index]) query.set(paging === 'sequence' ? 'afterSequence' : url.startsWith('/admin/audit') ? 'cursor' : 'afterId', cursors[index]);
    const path = url.split('?')[0] + (query.size ? '?' + query : '');
    void apiFetch<HistoryRow | unknown[]>(path).then(value => { if (live) setData(Array.isArray(value) ? { items: value } : value); })
      .catch(e => { if (live) setError({ message: e.status === 403 ? 'Недостаточно прав для просмотра этого раздела.' : e.message ?? 'Не удалось загрузить данные.', status: typeof e.status === 'number' ? e.status : null }); });
    return () => { live = false; };
  }, [url, index, cursors, retry, paging]);
  const rows = Array.isArray(data?.items) ? data.items as HistoryRow[] : [];
  const next = data?.nextAfterId ?? data?.nextCursor ?? data?.nextAfterSequence;
  const hasMore = paging === 'page' ? Boolean(data?.hasMore) || Number(field(data ?? {}, 'pagination.totalPages')) > index + 1 : next !== null && next !== undefined;
  return (
    <div className="lsr-users-history">
      {caption && <p className="lsr-users-caption">{caption}</p>}
      {error ? <div className="lsr-users-pad"><ErrorState error={error.message} status={error.status} onRetry={() => setRetry(v => v + 1)} /></div> : <>
        {data && summary?.(data)}
        <Table variant="module">
          <thead><tr>{columns.map(c => <th key={c.title} className={c.className}>{c.title}</th>)}</tr></thead>
          <tbody>
            {!data ? Array.from({ length: 4 }, (_, i) => <tr key={i}>{columns.map(c => <td key={c.title}><Skeleton height={14} width={i % 2 ? '60%' : '80%'} /></td>)}</tr>)
              : rows.map((row, i) => <tr key={String(row.id ?? i)}>{columns.map(c => <td key={c.title} className={c.className} style={{ overflowWrap: 'anywhere' }}>{c.render ? c.render(row) : display(field(row, c.key ?? ''))}</td>)}</tr>)}
            {data && !rows.length && <tr><td colSpan={columns.length}><EmptyState compact>Записей пока нет.</EmptyState></td></tr>}
          </tbody>
        </Table>
        <TableFoot>
          <span>Страница {index + 1}{!data ? ' · загрузка…' : ''}</span>
          <div className="lsr-hstack">
            {(index > 0 || hasMore) && <><Button size="sm" disabled={!index || !data} onClick={() => setCursors(v => v.slice(0, -1))}>← Назад</Button><Button size="sm" disabled={!data || !hasMore} onClick={() => setCursors(v => [...v, String(next ?? index + 1)])}>Далее →</Button></>}
            <Button size="sm" variant="plain" disabled={!data} onClick={() => setRetry(v => v + 1)}>Обновить</Button>
          </div>
        </TableFoot>
      </>}
    </div>
  );
}
