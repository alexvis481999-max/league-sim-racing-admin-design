// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../shared/api';
import { EventCardStudioPage } from './EventCardStudioPage';
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('../../shared/api', async () => ({ ...await vi.importActual('../../shared/api'), apiFetch }));
vi.mock('../../shared/realtime', async () => ({ ...await vi.importActual('../../shared/realtime'), useRealtimeRefresh: () => undefined }));
afterEach(cleanup);
beforeEach(() => { apiFetch.mockReset(); });

const event = (id: string, title: string, scenarioCode: string, cardAppearance: Record<string, unknown> | null = null) => ({
  id, title, scenarioCode, organizerId: '1', status: 'PUBLISHED', timezone: 'Europe/Moscow', gameCode: 'assetto_corsa', disciplineCode: 'circuit', version: '1',
  startsAt: '2026-10-16T15:00:00.000Z', endsAt: '2026-10-16T16:00:00.000Z', description: null, actions: [], displaySchedule: null, observedAt: '2026-10-09T10:00:00Z',
  displayStatus: { code: 'SCHEDULED', label: 'Запланировано' }, presentation: { coverUrl: null, subtitle: null, cardAppearance },
});

it('lists event cards from the events API, links to the event appearance editor and previews the selected saved card', async () => {
  apiFetch.mockImplementation(async (path: string) => {
    if (path.startsWith('/admin/events?')) return { items: [event('10', 'Weekly', 'weekly'), event('20', 'Cup', 'double_elimination_tournament', { previewTheme: 'light', showTitle: false })], nextAfterId: null };
    if (path === '/admin/access/organizers') return [{ id: '1', name: 'LSR', code: 'lsr' }];
    return [];
  });
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/event-cards']}><EventCardStudioPage /></MemoryRouter>);
  const table = await screen.findByRole('table', { name: 'Карточки событий' });
  expect(apiFetch).toHaveBeenCalledWith('/admin/events?limit=20&view=list');
  expect(within(table).getByText('Собственное')).toBeTruthy();
  expect(within(table).getByRole('link', { name: 'Открыть редактор карточки: Cup' }).getAttribute('href')).toBe('/events/20?section=appearance');
  await user.click(within(table).getByText('Cup'));
  const frame = screen.getByTitle('Карточка на странице событий') as HTMLIFrameElement;
  const send = vi.spyOn(frame.contentWindow!, 'postMessage');
  fireEvent.load(frame);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'lsr-event-card-preview', config: expect.objectContaining({ showTitle: false, previewTheme: 'light' }), publicEvent: expect.objectContaining({ id: '20' }) }), 'http://localhost:5174');
});

it('shows missing access instead of an empty catalog', async () => {
  apiFetch.mockImplementation(async (path: string) => {
    if (path.startsWith('/admin/events?')) throw new ApiError('forbidden', 403);
    return [];
  });
  render(<MemoryRouter><EventCardStudioPage /></MemoryRouter>);
  expect(await screen.findByText('Недостаточно прав')).toBeTruthy();
  expect(screen.queryByText('Событий пока нет')).toBeNull();
});
