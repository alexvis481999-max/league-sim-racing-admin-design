import { subscribeAdminRefresh } from '../../shared/realtime';
import { Page } from '../../shared/ui';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Alert, Button, Typography } from '@mui/material';
import { apiFetch } from '../../shared/api';
export function OwnerGameJournal({ path }: { path: string }) {
  const [items, setItems] = useState<
      { id: string; driverName?: string; message: string; occurredAt: string }[]
    >([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState('');
  const generation = useRef(0), loaded = useRef(false);
  const load = useCallback(
    async (after?: string, refresh = false) => {
      const request = ++generation.current;
      try {
        const page = await apiFetch<{ items: typeof items; nextCursor: string | null }>(
          `${path}?limit=50${after ? '&afterId=' + after : ''}`,
        );
        if (request !== generation.current) return;
        setItems(old => after || refresh ? [...new Map((after ? [...old, ...page.items] : [...page.items, ...old]).map(item => [item.id, item])).values()] : page.items);
        if (!refresh || !loaded.current) setCursor(page.nextCursor);
        loaded.current = true;
        setError('');
      } catch (e) {
        if (request === generation.current) setError(String(e));
      }
    },
    [path],
  );
  useEffect(() => {
    loaded.current = false; setItems([]); setCursor(null);
    void load();
    const off = subscribeAdminRefresh(['chat', 'runtime', 'matchmaking', 'practice'], () => load(undefined, true));
    return () => { generation.current++; off(); };
  }, [load]);
  return (
    <Page title="Журнал чата игры">
      {error && <Alert severity="error">{error}</Alert>}
      <Button onClick={() => void load()}>Обновить</Button>
      {items.map((i) => (
        <Typography key={i.id}>
          {new Date(i.occurredAt).toLocaleString('ru')} · {i.driverName ?? 'Пилот'}: {i.message}
        </Typography>
      ))}
      {cursor && <Button onClick={() => void load(cursor)}>Ещё сообщения</Button>}
    </Page>
  );
}
