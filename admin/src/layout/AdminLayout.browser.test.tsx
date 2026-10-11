// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AdminLayout } from './AdminLayout';
import type { AdminAccess } from '../shared/types';
vi.mock('../shared/realtime', async () => ({ ...await vi.importActual('../shared/realtime'), useRealtimeStatus: () => true, useRealtimeRefresh: () => {} }));
vi.mock('../shared/api', async () => ({ ...await vi.importActual('../shared/api'), apiFetch: vi.fn(async () => ({ items: [], pagination: { page: 1, total: 0, totalPages: 0 } })) }));
it('opens permitted navigation on narrow screens without exposing forbidden modules', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const access: AdminAccess = { userId: '1', panelAccess: true, grants: [{ id: '1', roleCode: 'test', scopeType: 'platform', scopeId: null, validFrom: null, validTo: null, constraints: null, permissions: ['users.read.all'] }] };
  try {
    await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ['/users'] }, createElement(AdminLayout, { access }))));
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Открыть навигацию"]')!;
    expect(toggle).toBeTruthy();
    await act(async () => toggle.click());
    const links = [...document.querySelectorAll('a')];
    expect(links.some(link => link.getAttribute('href') === '/users')).toBe(true);
    expect(links.some(link => link.getAttribute('href') === '/access')).toBe(false);
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
