// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OfficiatingPage } from './OfficiatingPage';
import { ApiError } from '../../shared/api';
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('../../shared/api', async () => ({ ...await vi.importActual<typeof import('../../shared/api')>('../../shared/api'), apiFetch }));
const report = { id: '1', status: 'submitted', reason: 'Контакт', submittedById: '10', accusedId: '11', incidentLocation: 'T1', videoUrl: null,
  context: { eventId: '20', source: { id: 'race:["30",1,1]' }, participantIds: ['10', '11'] }, comments: [] };
beforeEach(() => { apiFetch.mockReset(); apiFetch.mockImplementation(async (path: string) => {
  if (path.startsWith('/admin/officiating/protests?')) return { items: [report], nextAfterId: null };
  if (path === '/admin/officiating/protests/1') return { report, history: [] };
  if (path.includes('/decisions?')) return { items: [], nextAfterId: null };
  throw new Error('Unexpected request: ' + path);
}); });
afterEach(cleanup);
it('editing a draft sends its version and selected backend rule through PATCH', async () => {
  const read = apiFetch.getMockImplementation()!;
  apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') return {};
    if (path.includes('/penalty-rules?')) return { rulesVersion: 'v1', resultId: '30', rules: [{ ruleCode: 'warning', title: 'Предупреждение', description: 'Без результата', values: [] }] };
    if (path.includes('/decisions?')) return { items: [{ id: '8', status: 'draft', version: 'draft-v1', reason: 'Исходная причина', source: { id: '30' }, effect: { type: 'WARNING', participantId: '11', target: { type: 'RESULT' } }, supersedesDecisionId: null }], nextAfterId: null };
    return read(path, init);
  });
  await openReport(); fireEvent.click(screen.getByRole('button', { name: 'Загрузить правила и решения' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Редактировать черновик' }));
  fireEvent.change(await screen.findByLabelText('Причина изменения'), { target: { value: 'Уточнение' } });
  fireEvent.change(screen.getByLabelText('Обоснование решения / отмены'), { target: { value: 'Новая причина' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
  await waitFor(() => expect(apiFetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true));
  const [path, init] = apiFetch.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
  expect(path).toBe('/admin/events/20/decisions/8');
  expect(JSON.parse(init.body)).toMatchObject({ expectedVersion: 'draft-v1', ruleCode: 'warning', rulesVersion: 'v1', reason: 'Новая причина', changeReason: 'Уточнение' });
});
async function openReport() {
  render(<OfficiatingPage />); fireEvent.click(await screen.findByRole('button', { name: /№1.*Контакт/ }));
  fireEvent.change(await screen.findByLabelText('Обоснование рассмотрения / переоткрытия'), { target: { value: 'Проверить запись' } });
}
it('a lost response retries the same moderation command and clears pending after confirmation', async () => {
  const read = apiFetch.getMockImplementation()!; let sends = 0;
  apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') { if (++sends === 1) throw new Error('Connection lost'); return {}; }
    return read(path, init);
  });
  await openReport(); fireEvent.click(screen.getByRole('button', { name: 'На рассмотрении' }));
  const retry = await screen.findByRole('button', { name: 'Повторить ту же команду' });
  await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(retry);
  await waitFor(() => expect(sends).toBe(2));
  const posts = apiFetch.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(posts[1]).toEqual(posts[0]);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Повторить ту же команду' })).toBeNull());
});
it('a definitive permission refusal releases the form without an endless retry lock', async () => {
  const read = apiFetch.getMockImplementation()!;
  apiFetch.mockImplementation(async (path: string, init?: RequestInit) => { if (init?.method === 'POST') throw new ApiError('Нет прав', 403); return read(path, init); });
  await openReport(); fireEvent.click(screen.getByRole('button', { name: 'На рассмотрении' }));
  await screen.findByText('Нет прав');
  expect(screen.queryByRole('button', { name: 'Повторить ту же команду' })).toBeNull();
  expect((screen.getByLabelText('Обоснование рассмотрения / переоткрытия') as HTMLInputElement).disabled).toBe(false);
});
