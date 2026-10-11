import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../../../shared/api';
import type { Settings } from '../../current/event-api';

export type EditForm = { settings: Settings | null; description: string; version: string };

/** GET …/workspace/edit, loaded when the editing screen is shown. The version is kept for expectedVersion. */
export function useEditForm(eventId: string, active: boolean) {
  const [form, setForm] = useState<EditForm | null>(null);
  const [error, setError] = useState<{ message: string; status: number | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || form) return;
    let alive = true;
    setError(null);
    apiFetch<{ settings: Settings | null; description: string | null; version: string }>(`/admin/events/${eventId}/workspace/edit`)
      .then((value) => { if (alive) setForm({ ...value, description: value.description ?? '' }); })
      .catch((e) => { if (alive) setError({ message: e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : null }); });
    return () => { alive = false; };
  }, [active, form, attempt, eventId]);
  const v2 = (form?.settings?.authoring as Settings | undefined)?.editorVersion === 2;
  return { form, setForm, error, retry: () => setAttempt((n) => n + 1), reset: () => setForm(null), v2 };
}
