import { useEffect, useState } from 'react';
import { apiFetch } from '../../../shared/api';

/** Short scenario names used by v16 lists and tabs. The server title wins when it is present. */
export const scenarioLabels: Record<string, string> = {
  weekly: 'Weekly',
  championship: 'Чемпионат',
  circuit_single_race: 'Одиночная гонка',
  practice: 'Практика',
  time_attack: 'Time Attack',
  double_elimination_tournament: 'Турнир',
};
export const scenarioLabel = (code: string | null | undefined, serverTitle?: string | null) =>
  serverTitle || (code ? scenarioLabels[code] ?? code : 'Тип не выбран');

export function htmlToText(value: string | null | undefined): string {
  if (!value) return '';
  if (typeof DOMParser === 'undefined') return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (new DOMParser().parseFromString(value, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

type Organizer = { id: string; name: string };
let organizersRequest: Promise<Organizer[]> | null = null;
/** Organizer names for list rows. Without the access permission the list is unavailable and rows fall back to IDs. */
export function useOrganizerNames(enabled = true) {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    organizersRequest ??= apiFetch<Organizer[]>('/admin/access/organizers').catch(() => {
      organizersRequest = null;
      return [];
    });
    void organizersRequest.then((items) => {
      if (alive && Array.isArray(items)) setNames(Object.fromEntries(items.map((o) => [String(o.id), o.name])));
    });
    return () => { alive = false; };
  }, [enabled]);
  return names;
}
