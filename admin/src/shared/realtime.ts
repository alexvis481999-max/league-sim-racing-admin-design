import { useLayoutEffect, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  RealtimeClient,
  realtimeUrl,
  type RealtimeEnvelope,
} from '../../../shared/realtime-client';
import {
  settlePendingReads,
  invalidateReferenceCache,
  getAdminToken,
  clearAdminToken,
  getApiBaseUrl,
  subscribeAdminAuthChanged,
} from './api';
export const realtime = new RealtimeClient({
  url: () => realtimeUrl(getApiBaseUrl(), import.meta.env.VITE_WS_BASE_URL),
  token: getAdminToken,
  mode: 'admin',
  unauthorized: clearAdminToken,
});
subscribeAdminAuthChanged(realtime.reset);
export type { RealtimeEnvelope };
export function useRealtimeStatus() {
  return useSyncExternalStore(realtime.observe, realtime.status, () => false);
}
export function useRealtimeChannel(
  channel: string | null,
  onMessage: (message: RealtimeEnvelope) => void,
) {
  const callback = useRef(onMessage);
  useLayoutEffect(() => { callback.current = onMessage; }, [onMessage]);
  const connected = useRealtimeStatus();
  useEffect(
    () =>
      channel
        ? realtime.subscribe('admin:changes', (message) => callback.current(message))
        : undefined,
    [channel],
  );
  return { connected };
}
export function subscribeAdminRefresh(domains: string[], refresh: () => void | Promise<unknown>) {
  let stopped = false,
    running = false,
    pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (stopped) return;
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      await settlePendingReads();
      if (!stopped) await refresh();
    } catch {
      /* screen owns the visible error */
    } finally {
      running = false;
      if (pending && !stopped) {
        pending = false;
        timer = setTimeout(() => void run(), 60);
      }
    }
  };
  const off = realtime.subscribe('admin:changes', (message) => {
    if(message.type==='realtime.resync'||message.payload.domain==='catalog')invalidateReferenceCache();
    if (message.type !== 'realtime.resync' && !domains.includes(String(message.payload.domain)))
      return;
    if (running) {
      pending = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => void run(), 60);
  });
  return () => {
    stopped = true;
    clearTimeout(timer);
    off();
  };
}
export function useRealtimeRefresh(domains: string[], refresh: () => void | Promise<unknown>, enabled=true) {
  const callback = useRef(refresh);
  useLayoutEffect(() => { callback.current = refresh; }, [refresh]);
  const key = domains.join('|');
  useEffect(() => enabled ? subscribeAdminRefresh(key.split('|'), () => callback.current()) : undefined, [key,enabled]);
}
