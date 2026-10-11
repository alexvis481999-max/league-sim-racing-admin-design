import CloseIcon from '@mui/icons-material/Close';
import { Alert, IconButton, Stack } from '@mui/material';
import { useSyncExternalStore } from 'react';
import { useEffect, useId } from 'react';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';
type NotificationItem = { id: string; message: string; severity: NotificationSeverity };

const items = new Map<string, NotificationItem>();
const timers = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot: NotificationItem[] = [];

function emit(): void {
  snapshot = [...items.values()];
  listeners.forEach((listener) => listener());
}

export function showNotification(input: NotificationItem & { durationMs?: number | null }): void {
  const timer = timers.get(input.id);
  if (timer !== undefined) window.clearTimeout(timer);
  timers.delete(input.id);
  items.set(input.id, { id: input.id, message: input.message, severity: input.severity });
  emit();
  if (input.durationMs !== null) {
    const duration = Math.max(5000, input.durationMs ?? 5000);
    timers.set(input.id, window.setTimeout(() => dismissNotification(input.id), duration));
  }
}

export function dismissNotification(id: string): void {
  const timer = timers.get(id);
  if (timer !== undefined) window.clearTimeout(timer);
  timers.delete(id);
  if (items.delete(id)) emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function NotificationsViewport() {
  const notifications = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  return (
    <Stack spacing={1} sx={{ position: 'fixed', zIndex: (theme) => theme.zIndex.snackbar, top: 16, right: 16, width: { xs: 'calc(100vw - 32px)', sm: 380 }, pointerEvents: 'none' }}>
      {notifications.map((notification) => (
        <Alert key={notification.id} severity={notification.severity} variant="filled" elevation={6} action={<IconButton size="small" color="inherit" aria-label="Закрыть" onClick={() => dismissNotification(notification.id)}><CloseIcon fontSize="small" /></IconButton>} sx={{ pointerEvents: 'auto', alignItems: 'center', boxShadow: 6 }}>
          {notification.message}
        </Alert>
      ))}
    </Stack>
  );
}

export function NotificationAlert({ message, severity = 'error' }: { message: string | null | undefined; severity?: NotificationSeverity }) {
  const reactId = useId();
  const id = `notice-${reactId}`;
  useEffect(() => {
    if (message) showNotification({ id, message, severity, durationMs: 5000 });
  }, [id, message, severity]);
  return null;
}
