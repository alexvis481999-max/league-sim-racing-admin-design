// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../shared/api';
import type { AdminAccess } from '../../shared/types';
import { SitePage } from './SitePage';
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('../../shared/api', async () => ({ ...await vi.importActual('../../shared/api'), apiFetch }));
vi.mock('../../shared/realtime', async () => ({ ...await vi.importActual('../../shared/realtime'), useRealtimeRefresh: () => undefined }));
afterEach(cleanup);
beforeEach(() => { apiFetch.mockReset(); });

const access = (permissions = ['news.write.all', 'news.publish.all', 'publications.reorder.all']): AdminAccess => ({ userId: '1', panelAccess: true, grants: [{ id: '1', roleCode: 'platform_owner', scopeType: 'platform', scopeId: null, validFrom: null, validTo: null, constraints: null, permissions }] } as AdminAccess);
const placement = (code: string) => ({ placementCode: code, enabled: true, sortOrder: 0, titleOverride: null, summaryOverride: null, eyebrowOverride: null, imageAssetId: null, actions: [], presentation: {}, startsAt: null, endsAt: null });
const publication = (id: string, status: string, title: string, version = 4, codes = ['home.feed']) => ({
  version, entry: { id, slug: `slug-${id}`, status, publicationKind: 'news', coverAssetId: null, publishedAt: status === 'published' ? '2020-01-01T00:00:00Z' : null, scheduledPublishAt: null, accessOrganizerId: null, currentRevisionId: `r${id}` },
  revision: { id: `r${id}`, title, summary: 'Summary', body: '<p>Text</p>' }, placements: codes.map(placement), allowedActions: { edit: true, publish: true, delete: true },
});
const writes = () => apiFetch.mock.calls.filter(([, options]) => options?.method && options.method !== 'GET');
const page = (path: string, permissions?: string[]) => render(<MemoryRouter initialEntries={[path]}><SitePage access={access(permissions)} /></MemoryRouter>);

it('saving published content sends one PATCH and no second publish command', async () => {
  const item = publication('7', 'published', 'Old title');
  apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path.startsWith('/admin/publications?')) return { items: [item], nextAfterId: null };
    if (path === '/admin/publications/7' && options?.method === 'PATCH') return { ...item, version: 5 };
    return [];
  });
  const user = userEvent.setup();
  page('/site/7');
  const title = await screen.findByDisplayValue('Old title'); await user.clear(title); await user.type(title, 'Updated title'); await user.tab();
  await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/admin/publications/7', expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"expectedVersion":4') })));
  expect(writes()).toHaveLength(1);
  expect(JSON.parse(writes()[0][1].body).publication.title).toBe('Updated title');
});

it('lists every page of publications with lifecycle statuses and filters them on the client', async () => {
  apiFetch.mockImplementation(async (path: string) => {
    if (path === '/admin/publications?limit=100') return { items: [publication('1', 'published', 'Live news')], nextAfterId: '1' };
    if (path === '/admin/publications?limit=100&afterId=1') return { items: [publication('2', 'draft', 'Draft news'), publication('3', 'scheduled', 'Later news', 1, ['home.hero'])], nextAfterId: null };
    return [];
  });
  const user = userEvent.setup();
  page('/site');
  const table = await screen.findByRole('table', { name: 'Публикации' });
  expect(within(table).getAllByRole('row')).toHaveLength(4);
  expect(within(table).getByText('Запланирована')).toBeTruthy();
  expect(within(table).getByText('Главная · большой слайдер')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Черновики' }));
  expect(within(screen.getByRole('table', { name: 'Публикации' })).getAllByRole('row')).toHaveLength(2);
  await user.type(screen.getByRole('searchbox'), 'nothing-matches');
  expect(screen.getByText('Ничего не найдено')).toBeTruthy();
});

it('shows missing access instead of an empty list', async () => {
  apiFetch.mockImplementation(async (path: string) => {
    if (path.startsWith('/admin/publications?')) throw new ApiError('forbidden', 403);
    return [];
  });
  page('/site');
  expect(await screen.findByText('Недостаточно прав')).toBeTruthy();
  expect(screen.queryByText('Публикаций пока нет')).toBeNull();
});

it('creates a draft and publishes it with the returned version; an unconfirmed publish is retried with the same key', async () => {
  let publishAttempts = 0;
  apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path.startsWith('/admin/publications?')) return { items: [], nextAfterId: null };
    if (path === '/admin/publications' && options?.method === 'POST') return publication('9', 'draft', 'Fresh', 1);
    if (path === '/admin/publications/9' && options?.method === 'PATCH') return publication('9', 'draft', 'Fresh', 1);
    if (path === '/admin/publications/9/publish') { publishAttempts += 1; if (publishAttempts === 1) throw new TypeError('Failed to fetch'); return publication('9', 'published', 'Fresh', 2); }
    return [];
  });
  const user = userEvent.setup();
  page('/site/new');
  await user.type(await screen.findByRole('textbox', { name: 'Заголовок' }), 'Fresh');
  await user.tab();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Тип' }), 'promo');
  await user.type(screen.getByRole('textbox', { name: 'Краткое описание' }), 'Short');
  await user.click(within(screen.getByRole('group', { name: 'Главная страница' })).getByRole('button', { name: 'Новостная лента' }));
  await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
  expect(await screen.findByText('Failed to fetch')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
  await waitFor(() => expect(publishAttempts).toBe(2));
  const created = writes().find(([path]) => path === '/admin/publications')!;
  expect(JSON.parse(created[1].body)).toMatchObject({ title: 'Fresh', kind: 'promo', placements: [expect.objectContaining({ placementCode: 'home.feed' })] });
  const publishes = writes().filter(([path]) => path === '/admin/publications/9/publish');
  expect(publishes.map(([, o]) => JSON.parse(o.body))).toEqual([{ expectedVersion: 1, endsAt: null }, { expectedVersion: 1, endsAt: null }]);
  expect(new Headers(publishes[0][1].headers).get('Idempotency-Key')).toBe(new Headers(publishes[1][1].headers).get('Idempotency-Key'));
});

it('deletes only after confirmation and sends the entry version', async () => {
  const item = publication('5', 'draft', 'To remove', 6);
  apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path.startsWith('/admin/publications?')) return { items: [item], nextAfterId: null };
    if (path === '/admin/publications/5' && options?.method === 'DELETE') return {};
    return [];
  });
  const user = userEvent.setup();
  page('/site/5');
  await user.click(await screen.findByRole('button', { name: 'Удалить' }));
  expect(writes()).toHaveLength(0);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(writes()[0][0]).toBe('/admin/publications/5');
  expect(JSON.parse(writes()[0][1].body)).toEqual({ expectedVersion: 6 });
});

it('sends a per-placement override (text, actions, presentation) in the revision placement', async () => {
  const item = publication('8', 'draft', 'Hero news', 2, ['home.hero']);
  apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path.startsWith('/admin/publications?')) return { items: [item], nextAfterId: null };
    if (path === '/admin/publications/8' && options?.method === 'PATCH') return item;
    return [];
  });
  const user = userEvent.setup();
  page('/site/8');
  await user.click(await screen.findByRole('button', { name: 'Настроить отдельно' }));
  await user.type(screen.getByRole('textbox', { name: 'Заголовок только здесь' }), 'Hero only');
  await user.type(screen.getByRole('textbox', { name: 'Надпись основной кнопки' }), 'Go');
  await user.type(screen.getByRole('textbox', { name: 'Ссылка основной кнопки' }), '/go');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Компоновка' }), 'minimal');
  await user.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  const sent = JSON.parse(writes()[0][1].body).publication.placements[0];
  expect(sent).toMatchObject({ placementCode: 'home.hero', titleOverride: 'Hero only', actions: [{ role: 'primary', label: 'Go', url: '/go', newTab: false }], presentation: expect.objectContaining({ slider: expect.objectContaining({ layout: 'minimal' }) }) });
});

it('saves the slide order of one placement with its order version', async () => {
  const a = publication('1', 'published', 'First', 1, ['home.hero']); const b = publication('2', 'published', 'Second', 1, ['home.hero']);
  apiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path.startsWith('/admin/publications?')) return { items: [a, b], nextAfterId: null };
    if (path === '/admin/publications/placements/home.hero/order' && options?.method === 'POST') return { ids: ['2', '1'], version: 4 };
    if (path === '/admin/publications/placements/home.hero/order') return { ids: ['1', '2'], version: 3 };
    if (path.startsWith('/admin/publications/placements/')) return { ids: [], version: 1 };
    return [];
  });
  const user = userEvent.setup();
  page('/site');
  await user.click(await screen.findByRole('tab', { name: 'Порядок слайдов' }));
  await user.click(await screen.findByRole('button', { name: 'Поднять: Second' }));
  const hero = screen.getByRole('region', { name: 'Главная страница · Большой слайдер' });
  await user.click(within(hero).getByRole('button', { name: 'Сохранить порядок' }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(JSON.parse(writes()[0][1].body)).toEqual({ expectedVersion: 3, ids: ['2', '1'] });
});

it('hides slide order without the reorder permission', async () => {
  apiFetch.mockImplementation(async (path: string) => { return path.startsWith('/admin/publications?') ? { items: [], nextAfterId: null } : []; });
  page('/site', ['news.write.scoped']);
  expect(await screen.findByText('Публикаций пока нет')).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Порядок слайдов' })).toBeNull();
});
