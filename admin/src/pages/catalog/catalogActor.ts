import type { CatalogItem } from '../../shared/types';

export function catalogActorLabel(item: Pick<CatalogItem, 'createdBy' | 'createdByUserId'>): string {
  const actor = item.createdBy;
  const name = [actor?.firstName?.trim(), actor?.lastName?.trim()].filter(Boolean).join(' ') || actor?.steamName?.trim();
  return name ? `${name} · #${item.createdByUserId}` : `#${item.createdByUserId}`;
}
