// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SitePage } from './SitePage';
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('../../shared/api', async () => ({ ...await vi.importActual('../../shared/api'), apiFetch }));
afterEach(cleanup);
it('saving published content sends one PATCH and no second publish command', async () => {
  const item = { id: '7', version: 4, ownerType: 'platform', ownerId: null, entry: { id: '7', slug: 'live', status: 'published', publicationKind: 'news', coverAssetId: '8', publishedAt: '2020-01-01T00:00:00Z', accessOrganizerId: null }, revision: { title: 'Old title', summary: 'Summary', body: '<p>Published text</p>' }, placements: [{ placementCode: 'home.feed', enabled: true, sortOrder: 0, titleOverride: null, summaryOverride: null, eyebrowOverride: null, imageAssetId: null, actions: [], presentation: {}, startsAt: null, endsAt: null }], allowedActions: { edit: true, publish: true, delete: true } };
  apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path.startsWith('/admin/publications?')) return { items: [item], nextAfterId: null };
    if (path === '/admin/publications/7' && options?.method === 'PATCH') return { ...item, version: 5 };
    return [];
  });
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/site/7']}><SitePage access={{ userId: '1', panelAccess: true, grants: [{ id: '1', roleCode: 'platform_owner', scopeType: 'platform', scopeId: null, validFrom: null, validTo: null, constraints: null, permissions: ['news.write.all', 'news.publish.all', 'publications.reorder.all'] }] }} /></MemoryRouter>);
  const title = await screen.findByDisplayValue('Old title'); await user.clear(title); await user.type(title, 'Updated title'); await user.tab();
  await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/admin/publications/7', expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"expectedVersion":4') })));
  const writes = apiFetch.mock.calls.filter(([, options]) => options?.method && options.method !== 'GET'); expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0][1].body).publication.title).toBe('Updated title');
});
