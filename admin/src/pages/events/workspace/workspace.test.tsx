// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { statusFixture } from '../../../../../shared/test/event-status.fixture';
import { EventWorkspacePage } from './EventWorkspacePage';

const api = vi.hoisted(() => ({ call: vi.fn(), changes: new Set<() => unknown>() }));
vi.mock('../../../shared/api', () => ({
  apiFetch: api.call,
  getApiBaseUrl: () => 'http://localhost:3000',
  ApiError: class extends Error { status = 409; },
}));
vi.mock('../../../shared/realtime', () => ({
  useRealtimeRefresh: () => {},
  useRealtimeStatus: () => true,
  subscribeAdminRefresh: (_domains: string[], callback: () => unknown) => { api.changes.add(callback); return () => { api.changes.delete(callback); }; },
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); api.changes.clear(); });

const summaryBase = (extra: Record<string, unknown> = {}) => ({
  eventId: '9', version: '17', observedAt: statusFixture().observedAt,
  event: { title: 'Гонка', description: null, scenarioCode: 'custom', gameCode: 'assetto_corsa', disciplineCode: 'circuit', timezone: 'Europe/Moscow', status: 'PUBLISHED', displayStatus: statusFixture(), displaySchedule: null, startsAt: '2026-10-01T10:00:00Z', endsAt: '2026-10-01T12:00:00Z' },
  metadata: { createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', publishedAt: null, author: null, organizer: null },
  currentStage: null, nextStage: null, stop: null, program: [],
  activity: { applications: { pending: 0, accepted: 0 }, runtime: { active: 0, uncertain: 0 }, hasRegistration: true },
  primaryResultId: null, counts: { stages: 0, results: 0 }, actions: [], editableFields: [], ...extra,
});
const open = (url: string) => render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/events/:eventId" element={<EventWorkspacePage />} /></Routes></MemoryRouter>);
const refresh = async () => act(async () => { for (const callback of [...api.changes]) await callback(); });
const paths = () => api.call.mock.calls.map(([path]) => path as string);

it('saves a description edit with the workspace version and an idempotency key', async () => {
  const summary = summaryBase({ actions: [{ code: 'edit', enabled: true, reason: null }, { code: 'cancel', enabled: false, reason: { code: 'access_denied', message: 'Нет прав' } }], editableFields: ['description'] });
  api.call.mockImplementation(async (path: string) => (path.endsWith('/workspace/edit') ? { settings: null, version: '17', description: 'Исходное описание' } : path.endsWith('/workspace') ? summary : { eventId: '9', version: '18' }));
  open('/events/9');
  fireEvent.click(await screen.findByRole('button', { name: 'Редактировать событие' }));
  fireEvent.change(await screen.findByLabelText('Описание'), { target: { value: 'Новое описание' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
  await waitFor(() => expect(paths()).toContain('/admin/events/9'));
  const [, init] = api.call.mock.calls.find(([path]) => path === '/admin/events/9')!;
  expect(init.method).toBe('PATCH');
  expect(init.headers['Idempotency-Key']).toBeTruthy();
  expect(JSON.parse(init.body)).toEqual({ expectedVersion: '17', patch: { description: 'Новое описание' } });
});

it('a socket refresh keeps the unsaved description and its original optimistic version', async () => {
  let current = '17';
  api.call.mockImplementation(async (path: string) => path.endsWith('/workspace/edit') ? { settings: null, version: current, description: 'Сервер ' + current }
    : path.endsWith('/workspace') ? summaryBase({ version: current, actions: [{ code: 'edit', enabled: true, reason: null }], editableFields: ['description'] }) : { eventId: '9', version: '19' });
  open('/events/9?section=settings');
  fireEvent.change(await screen.findByLabelText('Описание'), { target: { value: 'Мой черновик' } });
  current = '18';
  await refresh();
  expect((screen.getByLabelText('Описание') as HTMLTextAreaElement).value).toBe('Мой черновик');
  expect(screen.getByText(/Событие изменилось после открытия формы/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить описание' }));
  await waitFor(() => expect(paths()).toContain('/admin/events/9'));
  expect(JSON.parse(api.call.mock.calls.find(([path]) => path === '/admin/events/9')![1].body).expectedVersion).toBe('17');
});

it('an unanswered command is retried with the same key and blocks other commands', async () => {
  let fail = true;
  const summary = summaryBase({ event: { ...summaryBase().event, status: 'DRAFT' }, actions: [{ code: 'publish', enabled: true, reason: null }, { code: 'edit', enabled: true, reason: null }] });
  api.call.mockImplementation(async (path: string) => {
    if (path.endsWith('/workspace')) return summary;
    if (path.endsWith('/publish')) { if (fail) throw new Error('Нет ответа'); return { eventId: '9' }; }
    return {};
  });
  open('/events/9');
  fireEvent.click(await screen.findByRole('button', { name: 'Опубликовать' }));
  await screen.findByText(/Ответ на команду не получен/);
  expect((screen.getByRole('button', { name: 'Редактировать событие' }) as HTMLButtonElement).disabled).toBe(true);
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Повторить незавершённый запрос' }));
  await waitFor(() => expect(screen.queryByText(/Ответ на команду не получен/)).toBeNull());
  const keys = api.call.mock.calls.filter(([path]) => path.endsWith('/publish')).map(([, init]) => init.headers['Idempotency-Key']);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

it('loads only the selected tab and keeps participants visible during a background refresh', async () => {
  const roster = { items: [{ id: '1', registrationKey: 'race', participantId: '7', status: 'ACCEPTED', createdAt: '2026-09-01T00:00:00Z', decidedAt: null, withdrawnAt: null, removedAt: null, identity: { displayName: 'Пилот Семь' }, car: null, skin: null, selection: null, reviews: [], actions: [] }], registrations: [], nextAfterId: null };
  let pending: ((value: typeof roster) => void) | undefined, slow = false;
  api.call.mockImplementation((path: string) => path.endsWith('/workspace') ? Promise.resolve(summaryBase()) : path.endsWith('/participants') ? (slow ? new Promise((resolve) => { pending = resolve; }) : Promise.resolve(roster)) : Promise.reject(new Error('Unexpected ' + path)));
  open('/events/9');
  await screen.findByRole('heading', { name: 'Гонка' });
  expect(paths()).toEqual(['/admin/events/9/workspace']);
  fireEvent.click(screen.getByRole('tab', { name: 'Участники' }));
  await screen.findByText('Пилот Семь');
  slow = true;
  await act(async () => { for (const callback of [...api.changes]) void callback(); });
  expect(screen.getByText('Пилот Семь')).toBeTruthy();
  await act(async () => { pending!(roster); });
  expect(paths().every((path) => path.endsWith('/workspace') || path.endsWith('/participants'))).toBe(true);
});

it('an event without registration shows actual attendance and never requests applications', async () => {
  api.call.mockImplementation(async (path: string) => path.endsWith('/workspace') ? summaryBase({ activity: { applications: { pending: 0, accepted: 0 }, runtime: { active: 0, uncertain: 0 }, hasRegistration: false } })
    : path.endsWith('/attendance') ? { items: [{ id: '7', participantId: '7', identity: { displayName: 'Участник попытки' }, stages: [{ key: 'attempts', title: 'Попытки' }] }], nextAfterId: null } : Promise.reject(new Error(path)));
  open('/events/9?section=participants');
  await screen.findByText('Участник попытки');
  expect(screen.queryByRole('button', { name: 'Заявки' })).toBeNull();
  expect(paths().some((path) => path.endsWith('/participants'))).toBe(false);
});

it('switches from applications to attendance when the refreshed event has no registration', async () => {
  let hasRegistration = true;
  api.call.mockImplementation(async (path: string) => path.endsWith('/workspace') ? summaryBase({ activity: { applications: { pending: 0, accepted: 0 }, runtime: { active: 0, uncertain: 0 }, hasRegistration } })
    : path.endsWith('/attendance') ? { items: [], nextAfterId: null } : Promise.reject(new Error('internal_error')));
  open('/events/9?section=participants');
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Заявки' })).toBeTruthy();
  hasRegistration = false;
  await refresh();
  await screen.findByText('Фактическое участие пока не зафиксировано.');
  expect(screen.queryByRole('button', { name: 'Заявки' })).toBeNull();
  api.call.mockClear();
  await refresh();
  expect(paths().some((path) => path.endsWith('/participants'))).toBe(false);
});

it('a rejected review keeps the selected pilot and the typed reason', async () => {
  const roster = { items: [{ id: '1', participantId: '7', registrationKey: 'entry', identity: { displayName: 'Выбранный пилот' }, status: 'PENDING', createdAt: '2026-09-01T00:00:00Z', decidedAt: null, withdrawnAt: null, removedAt: null, car: null, skin: null, selection: null, reviews: [], actions: [{ code: 'review', enabled: true, reason: null }] }], registrations: [], nextAfterId: null };
  api.call.mockImplementation(async (path: string) => path.endsWith('/workspace') ? summaryBase({ version: '1' }) : path.endsWith('/participants') ? roster : Promise.reject(new Error('Нет ответа на команду')));
  open('/events/9?section=participants');
  fireEvent.click(await screen.findByRole('button', { name: 'Выбранный пилот' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Отклонить' }));
  fireEvent.change(within(dialog).getByLabelText('Причина отказа'), { target: { value: 'Уточнить допуск' } });
  await refresh();
  expect((within(screen.getByRole('dialog')).getByLabelText('Причина отказа') as HTMLTextAreaElement).value).toBe('Уточнить допуск');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отклонить заявку' }));
  await screen.findByText('Нет ответа на команду');
  expect((within(screen.getByRole('dialog')).getByLabelText('Причина отказа') as HTMLTextAreaElement).value).toBe('Уточнить допуск');
  const call = api.call.mock.calls.find(([path]) => path.endsWith('/entries/1/review'))!;
  expect(JSON.parse(call[1].body)).toEqual({ expectedVersion: '1', decision: 'REJECTED', reason: 'Уточнить допуск' });
});

it('opens the explicit primary result even when it is outside the first page', async () => {
  const head = (id: string, title: string) => ({ id, title, definition: { key: id, type: 'SEASON_STANDINGS' }, displayStatus: statusFixture(), currentRevisionId: null, currentRevisionNumber: 0 });
  api.call.mockImplementation(async (path: string) => path.endsWith('/workspace') ? summaryBase({ primaryResultId: '2', counts: { stages: 30, results: 31 } })
    : path.endsWith('/results') ? { items: [head('1', 'Этап 1')], nextAfterId: '1' } : path.endsWith('/results?resultId=2') ? { items: [head('2', 'Общий зачёт')], nextAfterId: null }
    : path.endsWith('/revisions?resultId=2') ? { items: [], nextAfterId: null } : Promise.reject(new Error(path)));
  open('/events/9?section=results');
  await screen.findByText('Опубликованных ревизий пока нет.');
  expect(screen.getAllByText(/Общий зачёт/).length).toBeGreaterThan(0);
  expect(paths().some((path) => path.includes('/revisions?resultId=1'))).toBe(false);
});

it('a race page requests only the conditions of its own block', async () => {
  const block = { id: '1', key: 'one', title: 'Первая гонка', type: 'RACE', status: 'PENDING', executionId: null, displayStatus: statusFixture(), group: null, plannedStartsAt: '2026-09-28T12:00:00Z', estimatedEndsAt: null, startedAt: null, finishedAt: null, actualParticipantIds: [], sessions: [], progress: [], resultIds: [] };
  const conditions = { stages: [{ key: 'one', title: 'one', type: 'RACE', origins: {}, game: { track: { code: 'one', layoutCode: null }, cars: { allowedCarIds: ['car'] }, environment: { weather: { mode: 'FIXED', ambientTemperature: 17, roadTemperature: 25 } }, assists: { absAllowed: 1 }, simulation: { damageMultiplierPercent: 100 } }, settings: { practice: { durationMinutes: 10 }, qualifying: null, race: { durationMinutes: 25, laps: null } }, track: { title: 'Трасса one', imageUrl: null }, cars: [{ title: 'Машина', imageUrl: null }], carClass: null, weatherPresets: [], plugins: [], content: [], admission: null, layoutTitle: null }], registrations: [], results: [], rating: null };
  api.call.mockImplementation(async (path: string) => path.endsWith('/workspace') ? summaryBase({ program: [{ key: 'one', title: 'Первая гонка', type: 'RACE', startsAt: block.plannedStartsAt, endsAt: null, track: 'Трасса one', cars: [] }] })
    : path.includes('/schedule') ? { items: [block], nextAfterId: null, registrations: [], dependencies: null } : path.includes('/conditions') ? conditions : Promise.reject(new Error(path)));
  open('/events/9?stage=one');
  expect(await screen.findAllByText('Трасса one')).toBeTruthy();
  expect(screen.getByText(/воздух 17°C/)).toBeTruthy();
  expect(screen.queryByText('Квалификация')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Помощники и симуляция' }));
  expect(screen.getByText('Заводской')).toBeTruthy();
  expect(paths().filter((path) => path.includes('/conditions'))).toEqual(['/admin/events/9/workspace/conditions?stageKey=one']);
  expect(paths().filter((path) => path.includes('/schedule'))).toEqual(['/admin/events/9/workspace/schedule?stageKey=one']);
});

it('weekly weeks come from server groups and races are grouped by the local day of the event zone', async () => {
  const block = (key: string, week: number, startsAt: string, code = 'SCHEDULED') => ({ key, title: key, type: 'RACE', group: { key: `week-${week}`, title: `Неделя ${week}`, kind: 'WEEK' }, displayStatus: statusFixture(code, code), startsAt, endsAt: null, startedAt: null, finishedAt: null, track: 'Monza', cars: [] });
  const program = [block('r3', 2, '2026-10-12T15:00:00Z'), block('r1', 1, '2026-10-05T15:00:00Z', 'COMPLETED'), block('r2', 1, '2026-10-11T21:30:00Z')];
  api.call.mockImplementation(async (path: string) => path.endsWith('/workspace') ? summaryBase({ event: { ...summaryBase().event, scenarioCode: 'weekly' }, program, counts: { stages: 3, results: 1 } })
    : path.includes('/conditions') ? { stages: null, registrations: null, results: null, rating: null } : Promise.reject(new Error(path)));
  const view = open('/events/9?section=weeks');
  const rows = await screen.findAllByRole('row');
  expect(rows.map((r) => r.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/Неделя 1.*1 \/ 2/), expect.stringMatching(/Неделя 2.*0 \/ 1/)]));
  view.unmount();
  open('/events/9?week=week-1');
  // 21:30Z on 11 Oct is already 12 Oct in Europe/Moscow: the race belongs to Monday, not Sunday.
  expect(await screen.findByText(/Понедельник · 12 октября/)).toBeTruthy();
  expect(screen.queryByText(/Воскресенье · 11 октября/)).toBeNull();
});
