// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OfficiatingPage } from './OfficiatingPage';
import { ApiError } from '../../shared/api';
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('../../shared/realtime', () => ({ useRealtimeRefresh: () => {}, subscribeAdminRefresh: () => () => {} }));
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
  fireEvent.change(screen.getByLabelText('Обоснование решения'), { target: { value: 'Новая причина' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
  await waitFor(() => expect(apiFetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true));
  const [path, init] = apiFetch.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
  expect(path).toBe('/admin/events/20/decisions/8');
  expect(JSON.parse(init.body)).toMatchObject({ expectedVersion: 'draft-v1', ruleCode: 'warning', rulesVersion: 'v1', reason: 'Новая причина', changeReason: 'Уточнение' });
});
async function openReport() {
  render(<MemoryRouter><OfficiatingPage /></MemoryRouter>); fireEvent.click(await screen.findByRole('button', { name: /№1.*Контакт/ }));
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

const draftRow = { id: '8', status: 'draft', version: 'draft-v1', reason: 'Исходная причина', source: { id: '30' }, effect: { type: 'WARNING', participantId: '11', target: { type: 'RESULT' } }, supersedesDecisionId: null };
function withDecisions(onWrite: (path: string, init: RequestInit) => unknown = () => ({})) {
  const read = apiFetch.getMockImplementation()!;
  apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'PATCH') return onWrite(path, init);
    if (path.includes('/penalty-rules?')) return { rulesVersion: 'v1', resultId: '30', rules: [{ ruleCode: 'time_penalty', title: 'Штраф времени', description: 'По регламенту', values: [5000, 10000] }] };
    if (path.includes('/decisions?')) return { items: [draftRow], nextAfterId: null };
    return read(path, init);
  });
}
it('issuing a decision asks for confirmation and sends the row version', async () => {
  withDecisions();
  await openReport(); fireEvent.click(screen.getByRole('button', { name: 'Загрузить правила и решения' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Вынести решение' }));
  expect(apiFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  fireEvent.click(await screen.findByRole('button', { name: 'Вынести' }));
  await waitFor(() => expect(apiFetch.mock.calls.some(([path]) => path === '/admin/events/20/decisions/8/issue')).toBe(true));
  const [, init] = apiFetch.mock.calls.find(([path]) => path === '/admin/events/20/decisions/8/issue')!;
  expect(JSON.parse(init.body)).toEqual({ expectedVersion: 'draft-v1' });
  expect(init.headers['Idempotency-Key']).toEqual(expect.any(String));
});
it('cancelling a decision requires its own reason', async () => {
  withDecisions();
  await openReport(); fireEvent.click(screen.getByRole('button', { name: 'Загрузить правила и решения' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Отменить' }));
  const confirm = await screen.findByRole('button', { name: 'Отменить решение' });
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Причина отмены'), { target: { value: 'Ошибочный пилот' } });
  fireEvent.click(confirm);
  await waitFor(() => expect(apiFetch.mock.calls.some(([path]) => path === '/admin/events/20/decisions/8/cancel')).toBe(true));
  const [, init] = apiFetch.mock.calls.find(([path]) => path === '/admin/events/20/decisions/8/cancel')!;
  expect(JSON.parse(init.body)).toEqual({ reason: 'Ошибочный пилот' });
});
it('a new draft takes its value only from the rule catalogue and links the protest', async () => {
  withDecisions();
  await openReport(); fireEvent.click(screen.getByRole('button', { name: 'Загрузить правила и решения' }));
  const save = await screen.findByRole('button', { name: 'Сохранить черновик' });
  fireEvent.change(screen.getByLabelText('Обоснование решения'), { target: { value: 'Контакт' } });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  expect(Array.from((screen.getByLabelText('Штраф, секунды') as HTMLSelectElement).options).map((o) => o.value)).toEqual(['', '5000', '10000']);
  fireEvent.change(screen.getByLabelText('Штраф, секунды'), { target: { value: '10000' } });
  fireEvent.click(save);
  await waitFor(() => expect(apiFetch.mock.calls.some(([path, init]) => path === '/admin/events/20/decisions' && init?.method === 'POST')).toBe(true));
  const [, init] = apiFetch.mock.calls.find(([path, init]) => path === '/admin/events/20/decisions' && init?.method === 'POST')!;
  expect(JSON.parse(init.body)).toMatchObject({ resultId: '30', ruleCode: 'time_penalty', rulesVersion: 'v1', value: 10000, participantId: '11', reportId: '1', submitted: false, target: { type: 'RACE_SESSION', splitIndex: 1, occurrence: 1 } });
});
it('shows a forbidden queue as missing access, not as an empty list', async () => {
  apiFetch.mockImplementation(async () => { throw new ApiError('Нет доступа к протестам', 403); });
  render(<MemoryRouter><OfficiatingPage /></MemoryRouter>);
  expect(await screen.findByText('Недостаточно прав')).toBeTruthy();
  expect(screen.queryByText('Протестов пока нет.')).toBeNull();
});
