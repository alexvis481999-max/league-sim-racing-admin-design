import { subscribeAdminRefresh } from '../../shared/realtime';
import { useCallback, useEffect, useState, useRef } from 'react';
import { apiFetch } from '../../shared/api';
import { Button, EmptyState, ErrorState, LoadingBlock, LoadMore, PageHeader, Panel, shortDateTime } from '../../ui/v16';
export function OwnerGameJournal({ path }: { path: string }) {
  const [items, setItems] = useState<
      { id: string; driverName?: string; message: string; occurredAt: string }[]
    >([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false);
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
        setReady(true);
        setError('');
      } catch (e) {
        if (request === generation.current) setError(String(e));
      }
    },
    [path],
  );
  useEffect(() => {
    loaded.current = false; setReady(false); setItems([]); setCursor(null);
    void load();
    const off = subscribeAdminRefresh(['chat', 'runtime', 'matchmaking', 'practice'], () => load(undefined, true));
    return () => { generation.current++; off(); };
  }, [load]);
  return (
    <>
      <PageHeader overline="Игровой журнал" title="Журнал чата игры" description="Сообщения, полученные с игрового сервера. Чат сайта ведётся отдельно."
        actions={<Button onClick={() => void load()}>↻ Обновить</Button>} />
      <Panel title="Сообщения" sub="Новые сообщения сверху; более ранние загружаются кнопкой внизу">
        <div className="lsr-stack is-tight">
          {error && <ErrorState error={error} onRetry={() => void load()} />}
          {!error && !ready && !items.length && <LoadingBlock rows={3} label="Загрузка журнала" />}
          {ready && !items.length && !error && <EmptyState compact>Сообщений пока нет.</EmptyState>}
          {!!items.length && (
            <div className="lsr-log" role="log">
              {items.map((i) => `[${shortDateTime(i.occurredAt)}] ${i.driverName ?? 'Пилот'}: ${i.message}`).join('\n')}
            </div>
          )}
          <LoadMore hasMore={!!cursor} onClick={() => void load(cursor!)} label="Ещё сообщения" />
        </div>
      </Panel>
    </>
  );
}
