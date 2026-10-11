import { useCallback, useState } from 'react';

export type AsyncState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
  done: boolean;
};

export function useAsyncState<T>() {
  const [state, setState] = useState<AsyncState<T>>({ loading: false, error: null, data: null, done: false });

  const run = useCallback(async (task: () => Promise<T>) => {
    setState((current) => ({ ...current, loading: true, error: null, done: false }));
    try {
      const data = await task();
      setState({ loading: false, error: null, data, done: true });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((current) => ({ ...current, loading: false, error: message, done: false }));
      throw error;
    }
  }, []);

  return [state, run, setState] as const;
}
