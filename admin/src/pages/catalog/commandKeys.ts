import { useMemo, useRef } from 'react';
import { ApiError, apiFetch } from '../../shared/api';

export type CommandSender = <T>(path: string, init: RequestInit) => Promise<T>;

/**
 * JSON commands of the catalogue and skins carry an explicit `Idempotency-Key`.
 * A command that was not confirmed (network error, 5xx) is repeated with the same key and body;
 * a confirmed answer or a 4xx rejection releases the key, so the next attempt is a new command.
 */
export function useCommandSender(): CommandSender {
  const keys = useRef(new Map<string, string>());
  return useMemo<CommandSender>(() => async <T,>(path: string, init: RequestInit) => {
    const signature = `${init.method ?? 'POST'} ${path} ${typeof init.body === 'string' ? init.body : ''}`;
    let key = keys.current.get(signature);
    if (!key) { key = crypto.randomUUID(); keys.current.set(signature, key); }
    const headers = new Headers(init.headers);
    headers.set('Idempotency-Key', key);
    try {
      const result = await apiFetch<T>(path, { ...init, headers });
      keys.current.delete(signature);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) keys.current.delete(signature);
      throw error;
    }
  }, []);
}
