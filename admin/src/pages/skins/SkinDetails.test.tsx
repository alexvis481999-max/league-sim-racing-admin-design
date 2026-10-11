// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SkinDetails } from './SkinDetails';
import { apiFetch } from '../../shared/api';
import type { Skin } from './skinModel';
vi.mock('../../shared/api', async () => ({ ...await vi.importActual('../../shared/api'), apiFetch: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const skin = { id: 1, gameCode: 'assetto_corsa', carCode: 'old', displayName: 'Livery', folderName: 'skin', tags: ['ac'], active: true, ownerType: 'official', visibility: 'official', version: 1, metadataVersion: 2, createdByUser: { id: '7', firstName: 'Иван', lastName: 'Петров', steamName: 'steam' }, createdAt: null, updatedAt: '2026-09-29T10:00:00Z', allowedActions: { edit: true, moderate: true, download: true }, moderation: { blocked: false, reason: '' }, history: [{ metadataVersion: 1, version: '1', displayName: 'Old livery', carCode: 'old', tags: ['ac'], active: true, changedAt: null, actorId: null, archiveUrl: null }] } as unknown as Skin;

it('shows creator and history and saves the selected car, tags and availability with the current revision', async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => (path.includes('/games/') ? [{ code: 'old', title: 'Old car' }, { code: 'new', title: 'New car' }] : skin));
  render(<MemoryRouter><SkinDetails skinId="1" initial={skin} backTo="/media-catalog?kind=skin" /></MemoryRouter>);
  expect(await screen.findByText('Иван Петров · ID 7')).toBeTruthy();
  expect(await screen.findByText('Old livery')).toBeTruthy();
  const user = userEvent.setup();
  const car = screen.getByRole('combobox', { name: /Машина/ });
  await user.click(car); await user.clear(car); await user.type(car, 'New');
  await user.click(await screen.findByRole('option', { name: 'New car' }));
  await user.click(screen.getByRole('button', { name: 'acc' }));
  await user.click(screen.getByRole('checkbox', { name: 'Доступен для нового выбора' }));
  await user.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(vi.mocked(apiFetch).mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true));
  const call = vi.mocked(apiFetch).mock.calls.find(([, init]) => init?.method === 'PATCH')!;
  expect(call[0]).toBe('/skins/admin/1');
  expect(JSON.parse(String(call[1]!.body))).toEqual({ expectedVersion: 2, patch: { displayName: 'Livery', carCode: 'new', tags: ['ac', 'acc'], active: false } });
  expect(new Headers(call[1]!.headers).get('Idempotency-Key')).toBeTruthy();
});

it('blocks a skin for new choices only with a moderator reason', async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => (path.includes('/games/') ? [] : skin));
  render(<MemoryRouter><SkinDetails skinId="1" initial={skin} backTo="/media-catalog?kind=skin" /></MemoryRouter>);
  const user = userEvent.setup();
  const block = await screen.findByRole('button', { name: 'Заблокировать для новых выборов' });
  expect((block as HTMLButtonElement).disabled).toBe(true);
  await user.type(screen.getByLabelText('Причина решения модератора'), 'Чужой логотип');
  await user.click(block);
  await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/skins/admin/1/moderation', expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 2, blocked: true, reason: 'Чужой логотип' }) })));
});

it('shows a missing skin as not found instead of an empty card', async () => {
  const { ApiError } = await vi.importActual<typeof import('../../shared/api')>('../../shared/api');
  vi.mocked(apiFetch).mockRejectedValue(new ApiError('not found', 404));
  render(<MemoryRouter><SkinDetails skinId="404" backTo="/media-catalog?kind=skin" /></MemoryRouter>);
  expect(await screen.findByText('Скин не найден')).toBeTruthy();
});
