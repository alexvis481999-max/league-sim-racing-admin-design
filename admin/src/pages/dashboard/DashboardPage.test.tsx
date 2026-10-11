// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AdminAccess } from '../../shared/types';
import { DashboardPage } from './DashboardPage';

const api = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../../shared/api', () => ({
  apiFetch: api.call,
  ApiError: class extends Error { status: number; constructor(message: string, status = 500) { super(message); this.status = status; } },
}));
vi.mock('../../shared/realtime', () => ({ useRealtimeRefresh: () => {}, useRealtimeStatus: () => false }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const access = (permissions: string[]) => ({ grants: [{ permissions }] }) as unknown as AdminAccess;

it('reads only the blocks allowed by the grants', async () => {
  api.call.mockImplementation(async (path: string) => (path.startsWith('/admin/events') ? { items: [{ id: '1', title: 'A', displayStatus: { label: 'Идёт', reason: null } }], nextAfterId: 'x' } : Promise.reject(new Error(path))));
  render(<MemoryRouter><DashboardPage access={access(['events.read.all'])} /></MemoryRouter>);
  expect(await screen.findByText('1+')).toBeTruthy();
  expect(api.call.mock.calls.every(([path]) => String(path).startsWith('/admin/events'))).toBe(true);
  expect(screen.queryByText('Занято игровых серверов')).toBeNull();
});

it('a forbidden projection is shown as missing access, not as zero', async () => {
  const { ApiError } = await import('../../shared/api');
  api.call.mockImplementation(async (path: string) => {
    if (path.startsWith('/admin/runtime')) throw new (ApiError as unknown as new (m: string, s: number) => Error)('Нет прав', 403);
    return { items: [], nextAfterId: null };
  });
  render(<MemoryRouter><DashboardPage access={access(['monitoring.read'])} /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByText('Нет прав').length).toBeGreaterThan(0));
  expect(screen.queryByText('0 / 0')).toBeNull();
});
