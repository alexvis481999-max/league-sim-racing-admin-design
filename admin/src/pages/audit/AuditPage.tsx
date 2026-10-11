import {openableRow} from '../../shared/table';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { apiFetch } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import { ListToolbar, Page, SearchField, Section, useDebouncedValue } from '../../shared/ui';
import type { AuditItem } from '../../shared/access-types';

export function AuditPage({eventId,active=true}:{eventId?:string;active?:boolean}={}) {
  const [items, setItems] = useState<AuditItem[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q')?.slice(0, 200) ?? ''), search = useDebouncedValue(query.trim());
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const revision = useRef(0);
  const load = useCallback(async (after?: string) => {
    const request = ++revision.current;
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('q', search);
      if (eventId) params.set('eventId',eventId);
      if (after) params.set('cursor', after);
      const data = await apiFetch<{ items: AuditItem[]; nextCursor: string | null }>(`/admin/audit?${params}`);
      if (request !== revision.current) return;
      setItems(old => after ? [...old, ...data.items] : data.items); setCursor(data.nextCursor);
    } catch (e) { if (request === revision.current) setError(e instanceof Error ? e.message : 'Не удалось загрузить журнал'); }
    finally { if (request === revision.current) setBusy(false); }
  }, [search,eventId]);
  useRealtimeRefresh(['audit'], () => load(),active);
  useEffect(() => { setCursor(null); void load(); return () => { revision.current++; }; }, [load]);
  return <Page embedded={!!eventId} title="Журнал действий"><Section embedded><Stack spacing={2}>
    <ListToolbar><SearchField label="Поиск" placeholder="Имя, организатор, событие, ID или дата" value={query} onChange={value => setQuery(value.slice(0, 200))} /></ListToolbar>
    {error && <Alert severity="error">{error}</Alert>}
    {busy && <Typography color="text.secondary" role="status">Поиск…</Typography>}
    {!busy && !items.length && <Typography color="text.secondary">Ничего не найдено.</Typography>}
    <TableContainer><Table size="small" aria-label="Журнал действий"><TableHead><TableRow><TableCell>Время</TableCell><TableCell>Автор</TableCell><TableCell>Действие</TableCell><TableCell>Объект</TableCell><TableCell /></TableRow></TableHead><TableBody>{items.map(item => <TableRow key={item.id} hover {...openableRow(()=>setSelected(item))}>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(item.at).toLocaleString('ru-RU', {})}</TableCell>
      <TableCell>{item.actor.type === 'system' ? 'Система' : `Пользователь ${item.actor.userId}`}</TableCell><TableCell>{item.action}</TableCell><TableCell>{item.target.type} {item.target.id}</TableCell><TableCell align="right"><Button onClick={() => setSelected(item)}>Подробности</Button></TableCell>
    </TableRow>)}</TableBody></Table></TableContainer>
    {cursor && <Button disabled={busy || query.trim() !== search} onClick={() => void load(cursor)}>Показать ещё</Button>}
    <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="md"><DialogTitle>Действие {selected?.id}</DialogTitle><DialogContent><Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(selected, null, 2)}</Box></DialogContent></Dialog>
  </Stack></Section></Page>;
}
