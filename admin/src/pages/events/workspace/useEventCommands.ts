import { useRef, useState } from 'react';
import { ApiError } from '../../../shared/api';
import { command } from '../current/event-api';

export type PendingCommand = { path: string; body: object; method: string };
export type Execute = (path: string, body: object, method?: string) => Promise<boolean>;

/**
 * Event commands with idempotency: one key per command identity, kept until the server answers.
 * An unanswered command (network/5xx) is kept as pending and can only be retried with the same key and body.
 */
export function useEventCommands(eventId: string, afterSuccess: () => Promise<unknown> | void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const running = useRef(false);
  const keys = useRef(new Map<string, string>());
  const execute: Execute = async (path, body, method = 'POST') => {
    if (running.current) return false;
    const identity = JSON.stringify({ path, body, method });
    if (pending && JSON.stringify(pending) !== identity) return false;
    const key = keys.current.get(identity) ?? crypto.randomUUID();
    keys.current.set(identity, key);
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await command(`/admin/events/${eventId}${path}`, body, key, method);
      keys.current.delete(identity);
      setPending(null);
      await afterSuccess();
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        keys.current.delete(identity);
        setPending(null);
      } else setPending({ path, body, method });
      setError(e instanceof Error ? e.message : 'Не удалось выполнить действие');
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return { execute, busy, error, setError, pending, blocked: busy || !!pending, running };
}
