// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '../../shared/api';
import { useCommandSender } from './commandKeys';
import { fetchAllCars } from './catalogData';
vi.mock('../../shared/api', async () => ({ ...await vi.importActual('../../shared/api'), apiFetch: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const key = (call: unknown[]) => new Headers((call[1] as RequestInit).headers).get('Idempotency-Key');

it('repeats an unconfirmed command with the same key and starts a new command after a confirmed answer or a 4xx', async () => {
  const send = renderHook(() => useCommandSender()).result.current;
  const init = { method: 'POST', body: JSON.stringify({ expectedVersion: 3 }) };
  vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });
  await expect(send('/admin/catalog/items/1/install-shared', init)).rejects.toThrow('network');
  await send('/admin/catalog/items/1/install-shared', init);
  await send('/admin/catalog/items/1/install-shared', init);
  const calls = vi.mocked(apiFetch).mock.calls;
  expect(key(calls[0])).toBe(key(calls[1]));
  expect(key(calls[2])).not.toBe(key(calls[1]));

  vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('version_conflict', 409)).mockResolvedValueOnce({ ok: true });
  await expect(send('/admin/catalog/items/1', init)).rejects.toThrow('version_conflict');
  await send('/admin/catalog/items/1', init);
  expect(key(calls[3])).not.toBe(key(calls[4]));
});

it('reads every page of the car picker and still accepts a plain array answer', async () => {
  vi.mocked(apiFetch)
    .mockResolvedValueOnce({ items: [{ id: 'a' }], nextAfterId: 'a' })
    .mockResolvedValueOnce({ items: [{ id: 'b' }], nextAfterId: null });
  expect((await fetchAllCars('ac', { cancelled: false })).map((car) => car.id)).toEqual(['a', 'b']);
  expect(vi.mocked(apiFetch).mock.calls[1][0]).toContain('afterId=a');
  vi.mocked(apiFetch).mockResolvedValueOnce([{ id: 'legacy' }]);
  expect((await fetchAllCars('ac', { cancelled: false })).map((car) => car.id)).toEqual(['legacy']);
});
