// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchiveDropZone } from '../shared/ArchiveDropZone';
import type { CatalogItem } from '../shared/types';
import { CatalogPage } from './catalog/CatalogPage';
import { SkinsPage } from './skins/SkinsPage';

const { apiFetch, apiUploadFormData, apiDownload } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiUploadFormData: vi.fn(),
  apiDownload: vi.fn(),
}));

vi.mock('../shared/api', async () => {
  const actual = await vi.importActual<typeof import('../shared/api')>('../shared/api');
  return {
    ...actual,
    apiFetch,
    apiUploadFormData,
    apiDownload,
  };
});

let catalogItems: CatalogItem[] = [];

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  catalogItems = [];
  apiFetch.mockReset();
  apiUploadFormData.mockReset();
  apiDownload.mockReset();
  apiFetch.mockImplementation(async (path: string) => {
    if (path.startsWith('/skins/admin?')) return { items: [], nextAfterId: null };
    if (path === '/games/assetto_corsa/cars') {
      return [{ id: 1, code: 'ks_nissan_gtr', title: 'Nissan GTR' }];
    }
    if (path.startsWith('/admin/catalog/items?')) return { items: catalogItems, nextAfterId: null };
    if (path.startsWith('/admin/catalog/tags?')) return [];
    if (path === '/admin/access/organizers') return [];
    if (path === '/admin/catalog/car-brands') return [];
    if (path.startsWith('/admin/catalog/official-dlcs?')) return [];
    return [];
  });
});

afterEach(() => cleanup());

describe('ArchiveDropZone', () => {
  it('accepts a ZIP by drag and drop', async () => {
    const onSelect = vi.fn();
    render(<ArchiveDropZone file={null} onSelect={onSelect} />);
    const file = new File(['archive'], 'track.zip', { type: 'application/zip' });

    fireEvent.drop(screen.getByText('Перетащите ZIP-архив сюда'), {
      dataTransfer: { files: [file] },
    });

    expect(onSelect).toHaveBeenCalledWith(file);
  });

  it('accepts a ZIP through the hidden file input', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(<ArchiveDropZone file={null} onSelect={onSelect} />);
    const file = new File(['archive'], 'car.zip', { type: 'application/zip' });

    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(onSelect).toHaveBeenCalledWith(file);
  });
});

describe('SkinsPage upload dialog', () => {
  it('parses the title from ZIP and keeps upload disabled until a car is selected', async () => {
    const user = userEvent.setup();
    render(<SkinsPage />);
    await user.click(await screen.findByRole('button', { name: 'Добавить' }));
    const dialog = await screen.findByRole('dialog', { name: 'Добавить скин' });
    const addButton = within(dialog).getByRole('button', { name: 'Добавить' });
    expect((addButton as HTMLButtonElement).disabled).toBe(true);

    const file = await skinArchive('Parsed Team Name');
    await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, file);

    await waitFor(() => {
      expect((within(dialog).getByLabelText('Название') as HTMLInputElement).value)
        .toBe('Parsed Team Name');
    });
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText('Архив проверен и готов к загрузке')).toBeTruthy();
  });

  it('discards the local skin draft on cancel without uploading anything', async () => {
    const user = userEvent.setup();
    render(<SkinsPage />);
    await user.click(await screen.findByRole('button', { name: 'Добавить' }));
    let dialog = await screen.findByRole('dialog', { name: 'Добавить скин' });
    const file = await skinArchive('Discarded Draft');
    await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, file);
    await waitFor(() => expect(
      (within(dialog).getByLabelText('Название') as HTMLInputElement).value,
    ).toBe('Discarded Draft'));

    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(apiUploadFormData).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Добавить скин' })).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    dialog = await screen.findByRole('dialog', { name: 'Добавить скин' });
    expect((within(dialog).getByLabelText('Название') as HTMLInputElement).value).toBe('');
    expect((dialog.querySelector('input[type="file"]') as HTMLInputElement).files).toHaveLength(0);
  });
});

describe('CatalogPage draft upload', () => {
  it('does not enable Save until the draft upload has completed', async () => {
    const user = userEvent.setup();
    let finishUpload!: (value: unknown) => void;
    apiUploadFormData.mockImplementation((_path, _body, onProgress) => {
      onProgress?.({ percent: 35 });
      return new Promise((resolve) => { finishUpload = resolve; });
    });
    render(<CatalogPage access={{
      userId: '1',
      panelAccess: true,
      grants: [{ id: '1', roleCode: 'platform_owner', scopeType: 'platform' as const, scopeId: null, validFrom: null, validTo: null, constraints: null, permissions: ['catalog.manage.all'] }],
    }} />);

    await user.click(await screen.findByRole('tab', { name: 'Машины' }));
    await user.click(screen.getByRole('button', { name: /Добавить/ }));
    const dialog = await screen.findByRole('dialog', { name: /Добавить: Машины/ });
    const file = new File(['archive'], 'nissan_gtr.zip', { type: 'application/zip' });
    await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect((within(dialog).getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(within(dialog).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('35');
    finishUpload({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'uploaded',
      assetKind: 'archive',
      fileName: file.name,
      sizeBytes: String(file.size),
      checksumSha256: 'a'.repeat(64),
      assetId: null,
      expiresAt: '2026-07-26T00:00:00.000Z',
    });

    await waitFor(() => {
      expect(within(dialog).getByText('Архив загружен')).toBeTruthy();
    });

    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/admin/content-upload-sessions/11111111-1111-4111-8111-111111111111',
        { method: 'DELETE' },
      );
    });
  });

  it('keeps Save disabled and shows an error when draft upload fails', async () => {
    const user = userEvent.setup();
    apiUploadFormData.mockRejectedValueOnce(new Error('S3 unavailable'));
    render(<CatalogPage access={{
      userId: '1',
      panelAccess: true,
      grants: [{ id: '1', roleCode: 'platform_owner', scopeType: 'platform' as const, scopeId: null, validFrom: null, validTo: null, constraints: null, permissions: ['catalog.manage.all'] }],
    }} />);

    await user.click(await screen.findByRole('tab', { name: 'Машины' }));
    await user.click(screen.getByRole('button', { name: /Добавить/ }));
    const dialog = await screen.findByRole('dialog', { name: /Добавить: Машины/ });
    const file = new File(['archive'], 'broken.zip', { type: 'application/zip' });
    await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, file);

    await waitFor(() => expect(
      within(dialog).getAllByRole('alert').some((alert) => alert.textContent?.includes('S3 unavailable')),
    ).toBe(true));
    expect((within(dialog).getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('shows a client validation error before creating catalog content', async () => {
    const user = userEvent.setup();
    apiUploadFormData.mockResolvedValue(uploadSession('track-upload'));
    renderCatalog('track');

    await user.click(await screen.findByRole('button', { name: /Добавить/ }));
    const dialog = await screen.findByRole('dialog', { name: /Добавить: Трассы/ });
    await user.upload(
      dialog.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['track'], 'track.zip', { type: 'application/zip' }),
    );
    await screen.findByText('Архив загружен');
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(within(dialog).getByRole('alert').textContent).toContain('Добавь тег игры');
    expect(apiFetch).not.toHaveBeenCalledWith('/admin/catalog/items', expect.anything());
  });

  it('surfaces a daemon/shared installation failure on an existing track', async () => {
    const user = userEvent.setup();
    catalogItems = [catalogItem({ installStatus: 'failed', sharedStatus: 'failed', installError: 'daemon offline' })];
    apiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith('/skins/admin?')) return { items: [], nextAfterId: null };
      if (path.startsWith('/admin/catalog/items?')) return { items: catalogItems, nextAfterId: null };
      if (path.startsWith('/admin/catalog/tags?')) return [];
      if (path === '/admin/access/organizers' || path === '/admin/catalog/car-brands' || path.startsWith('/admin/catalog/official-dlcs?')) return [];
      if (path.endsWith('/install-shared')) throw new Error('daemon offline');
      return [];
    });
    renderCatalog('track');

    await user.click(await screen.findByRole('button', { name: /Test Track/ }));
    const dialog = await screen.findByRole('dialog', { name: /Редактировать: Test Track/ });
    await user.click(within(dialog).getByRole('button', { name: 'Установить' }));

    await waitFor(() => expect(
      within(dialog).getAllByRole('alert').some((alert) => alert.textContent?.includes('daemon offline')),
    ).toBe(true));
  });

  it('replaces an archive only after confirming its draft asset', async () => {
    const user = userEvent.setup();
    const existing = catalogItem();
    catalogItems = [existing];
    apiUploadFormData.mockResolvedValue(uploadSession('replacement-upload'));
    apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.startsWith('/skins/admin?')) return { items: [], nextAfterId: null };
      if (path.startsWith('/admin/catalog/items?')) return { items: catalogItems, nextAfterId: null };
      if (path.startsWith('/admin/catalog/tags?')) return ['ac'];
      if (path === '/admin/access/organizers' || path === '/admin/catalog/car-brands' || path.startsWith('/admin/catalog/official-dlcs?')) return [];
      if (path === '/admin/content-upload-sessions/replacement-upload/confirm') {
        return { session: uploadSession('replacement-upload'), asset: contentAsset('new-archive', 'replacement.zip', 'archive') };
      }
      if (path === `/admin/catalog/items/${existing.id}/versions`) return { ...existing, revision: 2, archiveAssetId: 'new-archive' };
      if (path === `/admin/catalog/items/${existing.id}` && options?.method === 'PATCH') {
        return { ...existing, archiveAssetId: 'new-archive', archiveAsset: contentAsset('new-archive', 'replacement.zip', 'archive') };
      }
      if (path.endsWith('/install-shared')) return { ...existing, sharedStatus: 'present', installStatus: 'installed' };
      return [];
    });
    renderCatalog('track');

    await user.click(await screen.findByRole('button', { name: /Test Track/ }));
    const dialog = await screen.findByRole('dialog', { name: /Редактировать: Test Track/ });
    await user.upload(
      dialog.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['replacement'], 'replacement.zip', { type: 'application/zip' }),
    );
    await screen.findByText('Архив загружен');
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      `/admin/catalog/items/${existing.id}/versions`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"archiveAssetId":"new-archive"'),
      }),
    ));
    expect(apiFetch).not.toHaveBeenCalledWith(
      `/admin/catalog/items/${existing.id}/install-shared`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uploads, replaces and deletes a catalog preview through the asset session contract', async () => {
    const user = userEvent.setup();
    const existing = catalogItem({
      primaryImageAssetId: 'old-preview',
      primaryImageAsset: contentAsset('old-preview', 'old.webp', 'image'),
    });
    catalogItems = [existing];
    apiUploadFormData.mockResolvedValue(uploadSession('preview-upload', 'image'));
    const updated = { ...existing, primaryImageAssetId: 'new-preview', primaryImageAsset: contentAsset('new-preview', 'new.webp', 'image') };
    apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.startsWith('/skins/admin?')) return { items: [], nextAfterId: null };
      if (path.startsWith('/admin/catalog/items?')) return { items: catalogItems, nextAfterId: null };
      if (path.startsWith('/admin/catalog/tags?')) return ['ac'];
      if (path === '/admin/access/organizers' || path === '/admin/catalog/car-brands' || path.startsWith('/admin/catalog/official-dlcs?')) return [];
      if (path === '/admin/content-upload-sessions/preview-upload/confirm') {
        return { session: uploadSession('preview-upload', 'image'), asset: contentAsset('new-preview', 'new.webp', 'image') };
      }
      if (path === `/admin/catalog/items/${existing.id}` && options?.method === 'PATCH') {
        const body = JSON.parse(String(options.body)) as { patch?: { primaryImageAssetId?: string | null } };
        return body.patch?.primaryImageAssetId === null
          ? { ...existing, primaryImageAssetId: null, primaryImageAsset: null }
          : updated;
      }
      return [];
    });
    renderCatalog('track');

    await user.click(await screen.findByRole('button', { name: /Test Track/ }));
    let dialog = await screen.findByRole('dialog', { name: /Редактировать: Test Track/ });
    const imageInput = [...dialog.querySelectorAll('input[type="file"]')]
      .find((input) => input.getAttribute('accept')?.includes('image/png')) as HTMLInputElement;
    await user.upload(imageInput, new File(['image'], 'new.webp', { type: 'image/webp' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      `/admin/catalog/items/${existing.id}`,
      expect.objectContaining({ body: expect.stringContaining('"primaryImageAssetId":"new-preview"') }),
    ));

    dialog = await screen.findByRole('dialog', { name: /Редактировать: Test Track/ });
    await user.click(within(dialog).getByRole('button', { name: 'Удалить фото' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      `/admin/catalog/items/${existing.id}`,
      expect.objectContaining({ body: expect.stringContaining('"primaryImageAssetId":null') }),
    ));
  });

  it('uploads and downloads Touge zones for the selected track layout', async () => {
    const user = userEvent.setup();
    const existing = catalogItem();
    catalogItems = [existing];
    const updated = catalogItem({
      metadata: { layouts: [{ code: 'gp', title: 'GP', isDefault: true, tougeZones: { status: 'present', checksumSha256: 'c'.repeat(64) } }] },
    });
    apiUploadFormData.mockImplementation(async (path: string) => {
      if (path === '/admin/content-upload-sessions') return uploadSession('zones-upload', 'touge_zones');
      throw new Error(`unexpected upload ${path}`);
    });
    apiDownload.mockResolvedValue({
      blob: new Blob(['{}'], { type: 'application/json' }),
      fileName: 'test_track-gp-touge-zones.json',
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['{}']) })));
    apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/admin/content-upload-sessions/zones-upload/confirm') return { asset: { id: '88' } };
      if (path.endsWith('/layouts/gp/touge-zones')) return options?.method === 'POST' ? updated : { url: 'https://storage.test/zones.json', fileName: 'touge-zones.json' };
      if (path.startsWith('/skins/admin?')) return { items: [], nextAfterId: null };
      if (path.startsWith('/admin/catalog/items?')) return { items: catalogItems, nextAfterId: null };
      if (path.startsWith('/admin/catalog/tags?')) return ['ac'];
      if (path === '/admin/access/organizers' || path === '/admin/catalog/car-brands' || path.startsWith('/admin/catalog/official-dlcs?')) return [];
      return [];
    });
    renderCatalog('track');

    await user.click(await screen.findByRole('button', { name: /Test Track/ }));
    const dialog = await screen.findByRole('dialog', { name: /Редактировать: Test Track/ });
    const zonesInput = [...dialog.querySelectorAll('input[type="file"]')]
      .find((input) => input.getAttribute('accept')?.includes('application/json')) as HTMLInputElement;
    await user.upload(zonesInput, new File(['{}'], 'touge-zones.json', { type: 'application/json' }));
    await waitFor(() => expect(apiUploadFormData).toHaveBeenCalledWith(
      '/admin/content-upload-sessions',
      expect.any(FormData),
    ));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/admin/catalog/items/${existing.id}/layouts/gp/touge-zones`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 1, assetId: '88' }) })));

    await user.click(within(dialog).getByRole('button', { name: 'Скачать конфиг' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('https://storage.test/zones.json'));
    vi.unstubAllGlobals();
  });

  it.each([
    ['car' as const, 'Test Car'],
    ['track' as const, 'Test Track'],
  ])('deletes a %s through the catalog delete endpoint', async (kind, title) => {
    const user = userEvent.setup();
    const existing = catalogItem({
      kind,
      id: `${kind}-1`,
      title,
      currentTitle: title,
      code: kind === 'car' ? 'test_car' : 'test_track',
      carBrandCode: kind === 'car' ? 'nissan' : null,
    });
    catalogItems = [existing];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith('/skins/admin?')) return { items: [], nextAfterId: null };
      if (path.startsWith('/admin/catalog/items?')) return { items: catalogItems, nextAfterId: null };
      if (path.startsWith('/admin/catalog/tags?')) return ['ac'];
      if (path === '/admin/catalog/car-brands') return [{ code: 'nissan', title: 'Nissan', region: 'asian' }];
      if (path === '/admin/access/organizers' || path.startsWith('/admin/catalog/official-dlcs?')) return [];
      if (path === `/admin/catalog/items/${existing.id}`) return { deleted: true };
      return [];
    });
    renderCatalog(kind);

    await user.click(await screen.findByRole('button', { name: new RegExp(title) }));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(`Редактировать: ${title}`) });
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      `/admin/catalog/items/${existing.id}`,
      { method: 'DELETE', body: JSON.stringify({ expectedVersion: 1 }) },
    ));
  });

  it('keeps an event-owned item open and shows the backend usage conflict', async () => {
    const user = userEvent.setup();
    const existing = catalogItem({
      usages: [{
        id: 'usage-1',
        usageType: 'event',
        targetId: '91',
        targetTitle: 'Race 91',
        placement: null,
        url: null,
        createdAt: '2026-07-25T00:00:00.000Z',
        updatedAt: '2026-07-25T00:00:00.000Z',
        createdByUserId: 1,
        updatedByUserId: null,
      }],
    });
    catalogItems = [existing];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith('/skins/admin?')) return { items: [], nextAfterId: null };
      if (path.startsWith('/admin/catalog/items?')) return { items: catalogItems, nextAfterId: null };
      if (path.startsWith('/admin/catalog/tags?')) return ['ac'];
      if (path === '/admin/access/organizers' || path === '/admin/catalog/car-brands' || path.startsWith('/admin/catalog/official-dlcs?')) return [];
      if (path === `/admin/catalog/items/${existing.id}`) throw new Error('catalog_item_in_use');
      return [];
    });
    renderCatalog('track');

    await user.click(await screen.findByRole('button', { name: /Test Track/ }));
    const dialog = await screen.findByRole('dialog', { name: /Редактировать: Test Track/ });
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(
      within(dialog).getAllByRole('alert').some((alert) => alert.textContent?.includes('catalog_item_in_use')),
    ).toBe(true));
    expect(screen.getByRole('dialog', { name: /Редактировать: Test Track/ })).toBeTruthy();
  });
});

function renderCatalog(kind: 'car' | 'track') {
  window.history.replaceState({}, '', `/?kind=${kind}`);
  return render(<CatalogPage access={{
    userId: '1',
    panelAccess: true,
    grants: [{ id: '1', roleCode: 'platform_owner', scopeType: 'platform' as const, scopeId: null, validFrom: null, validTo: null, constraints: null, permissions: ['catalog.manage.all'] }],
  }} />);
}

function uploadSession(id: string, assetKind = 'archive') {
  return {
    id,
    status: 'uploaded',
    assetKind,
    fileName: assetKind === 'image' ? 'preview.webp' : 'content.zip',
    sizeBytes: '100',
    checksumSha256: 'a'.repeat(64),
    assetId: null,
    expiresAt: '2026-07-26T00:00:00.000Z',
  };
}

function contentAsset(id: string, fileName: string, assetKind: string) {
  return {
    id,
    storageProvider: 'beget_s3' as const,
    fileName,
    mimeType: assetKind === 'image' ? 'image/webp' : 'application/zip',
    sizeBytes: 100,
    assetKind,
    publicUrl: `https://storage.test/${fileName}`,
    objectKey: `catalog/${fileName}`,
    createdAt: '2026-07-25T00:00:00.000Z',
  };
}

function catalogItem(patch: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'track-1',
    revision: 1,
    ownerType: 'platform', ownerId: null,
    kind: 'track',
    code: 'test_track',
    slug: 'test-track',
    contentCode: null,
    title: 'Test Track',
    currentTitle: 'Test Track',
    description: null,
    sourceType: 'platform',
    submittedByOrganizerId: null,
    tags: ['ac'],
    usages: [],
    metadata: { layouts: [{ code: 'gp', title: 'GP', isDefault: true, tougeZones: { status: 'present', checksumSha256: 'b'.repeat(64) } }] },
    archiveAssetId: 'old-archive',
    primaryImageAssetId: null,
    status: 'active',
    storageStatus: 'present',
    sharedStatus: 'present',
    installStatus: 'installed',
    installError: null,
    installedAt: '2026-07-25T00:00:00.000Z',
    archiveAsset: contentAsset('old-archive', 'track.zip', 'archive'),
    primaryImageAsset: null,
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
    createdByUserId: 1,
    updatedByUserId: null,
    ...patch,
  };
}

async function skinArchive(title: string): Promise<File> {
  const zip = new JSZip();
  zip.file('team/preview.jpg', 'preview');
  zip.file('team/livery.png', 'livery');
  zip.file('team/ui_skin.json', JSON.stringify({ skinname: title }));
  const buffer = await zip.generateAsync({ type: 'uint8array' });
  const file = new File([buffer], 'team.zip', { type: 'application/zip' });
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    });
  }
  return file;
}
