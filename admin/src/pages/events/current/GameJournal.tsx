import { useRealtimeRefresh } from '../../../shared/realtime';
import { useEffect, useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { apiFetch } from '../../../shared/api';
type Entry = {
  id: string;
  occurredAt: string;
  receivedAt: string;
  sessionId: string;
  runId: string;
  driverGuid: string;
  driverName: string;
  message: string;
};
export function GameJournal({ eventId,active=true }: { eventId: string;active?:boolean }) {
  const [items, setItems] = useState<Entry[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(''),
    [session, setSession] = useState(''),
    [run, setRun] = useState('');
  async function load(after?: string) {
    try {
      const q = new URLSearchParams({ limit: '50' });
      if (after) q.set('afterId', after);
      if (session.trim()) q.set('runtimeSessionId', session.trim());
      if (run.trim()) q.set('runId', run.trim());
      const page = await apiFetch<{ items: Entry[]; nextCursor: string | null }>(
        `/admin/events/${eventId}/game-chat?${q}`,
      );
      setItems((old) => (after ? [...old, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить журнал');
    }
  }
  useRealtimeRefresh(['runtime'], () => load(),active);
  useEffect(() => {
    setItems([]);
    setCursor(null);
    void load();
  }, [eventId]);
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">Сообщения, полученные с игровых серверов</Typography>
      <Typography variant="body2">
        Журнал сообщений с игрового сервера. Чат сайта ведётся отдельно.
      </Typography>
      <Stack direction="row" gap={1}>
        <TextField label="ID сессии" value={session} onChange={(e) => setSession(e.target.value)} />
        <TextField label="ID запуска" value={run} onChange={(e) => setRun(e.target.value)} />
        <Button onClick={() => void load()}>Показать</Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {items.map((m) => (
        <Stack key={m.id}>
          <Typography variant="caption">
            {new Date(m.occurredAt).toLocaleString()} · сессия {m.sessionId} ·{' '}
            {m.driverName || m.driverGuid} · SteamID {m.driverGuid}
          </Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {m.message}
          </Typography>
        </Stack>
      ))}
      {!error && !items.length && <Typography>Сообщений пока нет</Typography>}
      {cursor && <Button onClick={() => void load(cursor)}>Ранее</Button>}
    </Stack>
  );
}
