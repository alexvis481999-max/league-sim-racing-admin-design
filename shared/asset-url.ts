const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export function getContentAssetUrl(assetId: unknown, fallbackUrl: string): string {
  const normalizedAssetId = typeof assetId === 'string' ? assetId.trim() : '';
  return normalizedAssetId
    ? `${API_BASE_URL}/content-assets/${encodeURIComponent(normalizedAssetId)}/file`
    : fallbackUrl;
}

export function getCatalogImageUrl(catalogItemId: unknown, assetId: unknown, fallbackUrl: string): string {
  const normalizedCatalogItemId = typeof catalogItemId === 'string' ? catalogItemId.trim() : '';
  return normalizedCatalogItemId
    ? `${API_BASE_URL}/catalog-items/${encodeURIComponent(normalizedCatalogItemId)}/image`
    : getContentAssetUrl(assetId, fallbackUrl);
}

export function getCatalogArchiveUrl(catalogItemId: unknown, fallbackUrl = ''): string {
  const normalizedCatalogItemId = String(catalogItemId ?? '').trim();
  return normalizedCatalogItemId
    ? `${API_BASE_URL}/catalog-items/${encodeURIComponent(normalizedCatalogItemId)}/archive`
    : fallbackUrl;
}

export function normalizeRichTextAssetUrls(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const catalogItemId = readHtmlAttribute(tag, 'data-catalog-item-id');
    const assetId = readHtmlAttribute(tag, 'data-photo-asset-id');
    if (!catalogItemId && !assetId) return tag;

    const fallbackUrl = readHtmlAttribute(tag, 'src') ?? '';
    const resolvedUrl = getCatalogImageUrl(catalogItemId, assetId, fallbackUrl);
    return writeHtmlAttribute(tag, 'src', resolvedUrl);
  });
}

function readHtmlAttribute(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`\\s${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2]?.trim() || null;
}

function writeHtmlAttribute(tag: string, name: string, value: string): string {
  const escapedValue = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const attribute = `${name}="${escapedValue}"`;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\s)${escapedName}\\s*=\\s*(["']).*?\\2`, 'i');
  return pattern.test(tag) ? tag.replace(pattern, `$1${attribute}`) : tag.replace(/\s*(\/?)>$/, ` ${attribute} $1>`);
}
