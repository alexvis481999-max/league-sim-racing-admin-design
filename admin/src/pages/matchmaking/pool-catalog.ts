import { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api';
import { subscribeAdminRefresh } from '../../shared/realtime';

export type CatalogItem = {
  id?: string;
  code: string;
  title: string;
  metadata?: { [key: string]: unknown; carIds?: string[]; layouts?: { code: string; title?: string; name?: string }[] };
};
export type PoolCatalog = { cars: CatalogItem[]; tracks: CatalogItem[]; weather: CatalogItem[]; sets: CatalogItem[] };
const empty: PoolCatalog = { cars: [], tracks: [], weather: [], sets: [] };

/** Assetto Corsa catalog for the pool editor; refreshed on catalog changes. */
export function usePoolCatalog() {
  const [catalog, setCatalog] = useState<PoolCatalog>(empty);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true,
      revision = 0;
    const load = async () => {
      const request = ++revision;
      try {
        const [cars, tracks, weather, sets] = await Promise.all(
          ['cars', 'tracks', 'weather-presets', 'car-sets'].map((path) => apiFetch<CatalogItem[]>(`/games/assetto_corsa/${path}`, {}, 'none')),
        );
        if (active && request === revision) {
          setCatalog({ cars, tracks, weather, sets });
          setLoaded(true);
          setError('');
        }
      } catch (e) {
        if (active && request === revision) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void load();
    const off = subscribeAdminRefresh(['catalog'], load);
    return () => {
      active = false;
      off();
    };
  }, []);
  return { catalog, loaded, error, setError };
}

export function layoutTitle(tracks: CatalogItem[], code: string, layoutCode: string | null) {
  if (!layoutCode) return 'Основная конфигурация';
  const layout = tracks.find((t) => t.code === code)?.metadata?.layouts?.find((l) => l.code === layoutCode);
  return layout?.title ?? layout?.name ?? layoutCode;
}
