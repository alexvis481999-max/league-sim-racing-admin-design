// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { SkinsList } from './SkinsPage';
import { apiFetch } from '../../shared/api';
vi.mock('../../shared/api', async () => ({ ...await vi.importActual('../../shared/api'), apiFetch: vi.fn() }));
vi.mock('../../shared/realtime', () => ({ useRealtimeRefresh: () => {} }));

const skin = { id: 7, gameCode: 'assetto_corsa', carCode: 'bmw_m4_gt3', displayName: 'Blue', folderName: 'blue', tags: ['ac'], active: true, ownerType: 'platform', ownerId: null, visibility: 'public', version: 1, previewUrl: null, createdAt: null, updatedAt: null };

it('requests one skin page, shows skeletons and loads the next page by cursor', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let resolve!: (v: unknown) => void;
  vi.mocked(apiFetch).mockImplementation(async (path) => (path.startsWith('/skins/admin') ? new Promise((r) => { resolve = r; }) : []));
  try {
    await act(async () => root.render(<MemoryRouter><SkinsList search="" onSearch={() => {}} onCreate={() => {}} /></MemoryRouter>));
    expect(host.querySelector('.lsr-skeleton')).not.toBeNull();
    await act(async () => resolve({ items: [skin], nextAfterId: '42' }));
    expect(vi.mocked(apiFetch).mock.calls.filter(([path]) => path.startsWith('/skins/admin'))).toHaveLength(1);
    expect(host.textContent).toContain('Blue');
    await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Показать ещё')!.click());
    expect(vi.mocked(apiFetch).mock.calls.some(([path]) => path.includes('afterId=42'))).toBe(true);
    expect([...host.querySelectorAll('button')].find((b) => b.textContent === 'Загрузка…')?.hasAttribute('disabled')).toBe(true);
    await act(async () => resolve({ items: [{ ...skin, id: 8, displayName: 'Red' }], nextAfterId: null }));
    expect(host.textContent).toContain('Blue');
    expect(host.textContent).toContain('Red');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
