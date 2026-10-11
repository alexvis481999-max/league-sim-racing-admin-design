// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { statusFixture } from '../../../../../shared/test/event-status.fixture';
import type { AdminAccess } from '../../../shared/types';
import { CurrentEventsPage } from './CurrentEventsPage';

const api = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../../../shared/api', () => ({
  apiFetch: api.call,
  getApiBaseUrl: () => 'http://localhost:3000',
  ApiError: class extends Error { status = 409; },
}));
vi.mock('../../../shared/realtime', () => ({ useRealtimeRefresh: () => {}, subscribeAdminRefresh: () => () => {} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const draft = { id: 'draft-1', revision: '3', updatedAt: '2026-10-01T10:00:00Z', document: { scenarioCode: 'weekly', settings: { event: { title: 'Неопубликованный черновик' } } } };
const event = { id: '1', title: 'Опубликованная гонка', scenarioCode: 'circuit_single_race', scenarioTitle: 'Гонка', organizerId: '1', gameCode: 'assetto_corsa', timezone: 'Europe/Moscow', status: 'PUBLISHED', startsAt: '2027-01-01T10:00:00Z', endsAt: '2027-01-01T12:00:00Z', displaySchedule: null, displayStatus: statusFixture() };
function setup() {
  api.call.mockImplementation(async (path: string) => path.startsWith('/admin/event-drafts') ? { items: [draft], nextAfterId: null } : path.startsWith('/admin/access/organizers') ? [{ id: '1', name: 'LSR' }] : { items: [event], nextAfterId: null });
  render(<MemoryRouter><CurrentEventsPage access={{ grants: [{ permissions: ['events.write.all'] }] } as AdminAccess} /></MemoryRouter>);
}
const eventCalls = () => api.call.mock.calls.map(([p]) => p as string).filter((p) => p.startsWith('/admin/events?'));

it('lists events and editor drafts together and filters by server status', async () => {
  setup();
  await screen.findByText('Неопубликованный черновик');
  expect(screen.getByText('Опубликованная гонка')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Активные' }));
  await waitFor(() => expect(eventCalls().some((p) => p.includes('status=RUNNING'))).toBe(true));
  await waitFor(() => expect(screen.queryByText('Неопубликованный черновик')).toBeNull());
});

it('the drafts filter requests unpublished events and keeps editor drafts', async () => {
  setup();
  await screen.findByText('Неопубликованный черновик');
  fireEvent.click(screen.getByRole('button', { name: /^Черновики/ }));
  await waitFor(() => expect(eventCalls().some((p) => p.includes('publication=unpublished'))).toBe(true));
  expect(await screen.findByText('Неопубликованный черновик')).toBeTruthy();
});

it('deleting a draft sends its revision and an idempotency key after confirmation', async () => {
  setup();
  await screen.findByText('Неопубликованный черновик');
  fireEvent.click(screen.getByRole('button', { name: 'Удалить черновик Неопубликованный черновик' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Удалить черновик' }));
  await waitFor(() => expect(api.call.mock.calls.some(([p, init]) => p === '/admin/event-drafts/draft-1' && init?.method === 'DELETE')).toBe(true));
  const [, init] = api.call.mock.calls.find(([p, i]) => p === '/admin/event-drafts/draft-1' && i?.method === 'DELETE')!;
  expect(JSON.parse(init.body)).toEqual({ expectedVersion: '3' });
  expect(init.headers['Idempotency-Key']).toBeTruthy();
});
