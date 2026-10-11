import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../shared/api';
import type { AccessOrganizer, CatalogItem } from '../../shared/types';
import { GAME_TAGS, errorText, normalizeTagOptions, type CarBrand, type CatalogDetails, type CatalogPage, type OfficialDlc } from './catalogModel';

export type LoadError = { message: string; status: number | null };
export const loadError = (error: unknown): LoadError => ({ message: errorText(error), status: error instanceof ApiError ? error.status : null });

/** Reference lists of the editor. A failed list stays empty: owner names fall back to IDs, selects show what is known. */
export function useCatalogReferences() {
  const [organizers, setOrganizers] = useState<AccessOrganizer[]>([]);
  const [carBrands, setCarBrands] = useState<CarBrand[]>([]);
  const [officialDlcs, setOfficialDlcs] = useState<OfficialDlc[]>([]);
  useEffect(() => {
    let live = true;
    void apiFetch<AccessOrganizer[]>('/admin/access/organizers').then((rows) => { if (live) setOrganizers(Array.isArray(rows) ? rows : []); }).catch(() => undefined);
    void apiFetch<CarBrand[]>('/admin/catalog/car-brands').then((rows) => { if (live) setCarBrands(Array.isArray(rows) ? rows : []); }).catch(() => undefined);
    void apiFetch<OfficialDlc[]>('/admin/catalog/official-dlcs').then((rows) => { if (live) setOfficialDlcs(Array.isArray(rows) ? rows : []); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return { organizers, carBrands, officialDlcs };
}

/** Tags used by the kind plus the game tags the editor requires. */
export function useTagOptions(kind: string) {
  const [options, setOptions] = useState<string[]>([...GAME_TAGS]);
  const reload = useCallback(async () => {
    try {
      const data = await apiFetch<string[]>(`/admin/catalog/tags?${new URLSearchParams({ kind })}`);
      setOptions(normalizeTagOptions([...(Array.isArray(data) ? data : []), ...GAME_TAGS]));
    } catch {
      setOptions([...GAME_TAGS]);
    }
  }, [kind]);
  useEffect(() => { void reload(); }, [reload]);
  return { options, reload };
}

/** `GET /admin/catalog/items/{id}`: versions and dependency usages; re-read after each new revision. */
export function useCatalogDetails(id: string, revision: number | undefined) {
  const [data, setData] = useState<CatalogDetails | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    apiFetch<CatalogDetails>(`/admin/catalog/items/${encodeURIComponent(id)}`)
      .then((value) => { if (live) setData(value && typeof value === 'object' && !Array.isArray(value) ? value : {}); })
      .catch((caught) => { if (live) setError(loadError(caught)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, revision]);
  return { data, error, loading };
}

/** A details answer is used as the card only when it carries the card fields; dependency usages are not `CatalogUsage`. */
export function itemFromDetails(details: CatalogDetails | null): CatalogItem | null {
  if (!details || typeof details.id !== 'string' || typeof details.kind !== 'string' || typeof details.title !== 'string') return null;
  const usages = Array.isArray(details.usages) && details.usages.every((u) => u && typeof u === 'object' && 'usageType' in (u as object)) ? details.usages as CatalogItem['usages'] : [];
  return { tags: [], metadata: {}, ...details, usages } as CatalogItem;
}

/**
 * Car choices of a car set. The list endpoint answers `{items, nextAfterId}`; an older client typed this read as `CatalogItem[]`,
 * so both shapes are accepted and every page is read (the picker must resolve all selected IDs).
 */
export async function fetchAllCars(gameTag: string, signal: { cancelled: boolean }): Promise<CatalogItem[]> {
  const all: CatalogItem[] = [];
  let after: string | null = null;
  for (let pageIndex = 0; pageIndex < 50 && !signal.cancelled; pageIndex += 1) {
    const params = new URLSearchParams({ kind: 'car', tags: gameTag, limit: '100' });
    if (after) params.set('afterId', after);
    const response = await apiFetch<CatalogPage<CatalogItem> | CatalogItem[]>(`/admin/catalog/items?${params}`);
    if (Array.isArray(response)) return response;
    all.push(...(response?.items ?? []));
    after = response?.nextAfterId ?? null;
    if (!after) break;
  }
  return all;
}
