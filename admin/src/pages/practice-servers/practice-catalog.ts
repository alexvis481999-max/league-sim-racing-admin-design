import { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api';

/** Display names of catalog codes stored in the practice config. Missing entries fall back to the stored code. */
export type PracticeCatalog = { tracks: Record<string, { title: string; layouts: Record<string, string> }>; cars: Record<string, string>; weather: Record<string, string> };
type Item = { id?: string; code: string; title?: string | null; metadata?: { layouts?: { code: string; title: string }[] } };

const catalogs = new Map<string, Promise<PracticeCatalog>>();
function loadCatalog(gameCode: string) {
  let request = catalogs.get(gameCode);
  if (!request) {
    const read = (part: string) => apiFetch<Item[]>(`/games/${gameCode}/${part}`, {}, 'none').then((v) => (Array.isArray(v) ? v : []), () => [] as Item[]);
    request = Promise.all([read('tracks'), read('cars'), read('weather-presets')]).then(([tracks, cars, weather]) => ({
      tracks: Object.fromEntries(tracks.map((t) => [t.code, { title: t.title || t.code, layouts: Object.fromEntries((t.metadata?.layouts ?? []).map((l) => [l.code, l.title])) }])),
      cars: Object.fromEntries(cars.flatMap((c) => [[c.code, c.title || c.code], ...(c.id ? [[c.id, c.title || c.code]] : [])])),
      weather: Object.fromEntries(weather.map((w) => [w.code, w.title || w.code])),
    }));
    catalogs.set(gameCode, request);
  }
  return request;
}

export function usePracticeCatalog(gameCode = 'assetto_corsa') {
  const [catalog, setCatalog] = useState<PracticeCatalog | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCatalog(gameCode).then((value) => { if (alive) setCatalog(value); });
    return () => { alive = false; };
  }, [gameCode]);
  return catalog;
}

export function trackTitle(catalog: PracticeCatalog | null, code: string, layoutCode: string | null) {
  if (!code) return 'Трасса не выбрана';
  const track = catalog?.tracks[code];
  const layout = layoutCode ? track?.layouts[layoutCode] ?? layoutCode : track?.layouts[''] ?? null;
  return [track?.title ?? code, layout].filter(Boolean).join(' · ');
}
export const carTitle = (catalog: PracticeCatalog | null, code: string) => catalog?.cars[code] ?? code;

let organizersRequest: Promise<Record<string, string>> | null = null;
/** Organizer names for display; the id stays visible when the name is not available. */
export function useOrganizerNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    organizersRequest ??= apiFetch<{ id: string; name: string }[]>('/admin/access/organizers')
      .then((items) => Object.fromEntries((Array.isArray(items) ? items : []).map((o) => [String(o.id), o.name])))
      .catch(() => { organizersRequest = null; return {}; });
    void organizersRequest.then((value) => { if (alive) setNames(value); });
    return () => { alive = false; };
  }, []);
  return names;
}
export const organizerName = (names: Record<string, string>, id: string) => (id ? names[id] ?? `Организатор №${id}` : '—');
