// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, it, expect, afterEach } from 'vitest';
import { ApiError } from '../../shared/api';
import { MatchmakingPage } from './MatchmakingPage';
import { defaultGame } from '../../features/standalone/GameFields';
import { newPools, selectionProbability, type Pools } from './matchmaking-model';
import type { AdminAccess } from '../../shared/types';
const { fetch, changes } = vi.hoisted(() => ({ fetch: vi.fn(), changes: new Set<() => unknown>() }));
vi.mock('../../shared/realtime', () => ({
  subscribeAdminRefresh: (_domains: string[], callback: () => unknown) => {
    changes.add(callback);
    return () => changes.delete(callback);
  },
}));
vi.mock('../../shared/api', async () => ({
  ...(await vi.importActual('../../shared/api')),
  apiFetch: fetch,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  changes.clear();
});
const accessFor = (permissions: string[]) => ({ permissions, grants: [{ permissions, scope: { type: 'platform', id: null } }] }) as unknown as AdminAccess;
const renderPage = (permissions = ['matchmaking.manage.all'], path = '/matchmaking') =>
  render(<MemoryRouter initialEntries={[path]}><MatchmakingPage access={accessFor(permissions)} /></MemoryRouter>);
const openSettings = async (section?: string) => {
  await userEvent.click(screen.getByRole('tab', { name: 'Настройки' }));
  if (section) await userEvent.click(await screen.findByRole('tab', { name: section }));
};

const sunWeather = { key: 'sun', title: 'Ясно', enabled: true, weight: 10, codes: ['clear'], weather: { mode: 'FIXED' as const, presetCode: 'clear', ambientTemperature: 18, roadTemperature: 28, ambientVariation: 2, roadVariation: 2 } };
const validPools = (): Pools => ({
  ...newPools(),
  carIds: ['a', 'b'],
  tracks: [{ key: 't', title: 'Гора', code: 'mountain', layoutCode: null, enabled: true, weight: 10, durationMinutes: 6, carIds: ['a', 'b'], weatherKeys: ['sun'] }],
  weather: [sunWeather],
});
const player = (id: string, name: string) => ({ id, name, ready: true, selection: null });
const liveMatch = { id: '55', status: 'RUNNING', failure: null, condition: { key: 'c', title: 'Гора', trackTitle: 'Гора', weatherTitle: 'Ясно' }, players: [player('1', 'Alice'), player('2', 'Bob')], resultId: null, result: null, startedAt: '2026-10-08T18:00:00Z', runtimeSessionId: '90', runtimeStatus: 'RUNNING', serverId: 'srv-1' };

function setup(permissions = ['matchmaking.manage.all'], pools?: Pools, path?: string) {
  const config = {
    pools,
    organizerId: '1',
    title: 'Очередь',
    description: null,
    coverImageId: null,
    timezone: 'UTC',
    gameCode: 'assetto_corsa',
    disciplineCode: 'touge',
    blockDurationMinutes: 20,
    game: defaultGame(),
    conditions: [{ key: 'a', title: 'Гора', trackTitle: 'Гора', weatherTitle: 'Ясно', game: defaultGame() }],
    duel: { winsTo: 2, maximumOmtRounds: 1, runtimeTimeLimitMinutes: 20 },
    rating: { mode: 'NONE' },
  };
  const queue = { id: '9007199254740993', version: 7, enabled: true, config };
  fetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'PUT') return { ...queue, enabled: false, version: 8 };
    if (path === '/admin/matchmaking') return { items: [queue] };
    if (path.endsWith('/config')) return queue;
    if (path.endsWith('/live')) return { queue: [], matches: [liveMatch] };
    if (path.includes('/races')) return { items: [], total: 0 };
    if (path.endsWith('/analytics')) return {};
    if (path === '/admin/access/organizers') return [{ id: '1', name: 'Организатор' }];
    if (path.startsWith('/games/')) return [];
    throw new Error('Unexpected ' + path);
  });
  renderPage(permissions, path);
  return queue;
}

it('выбирает League Sim Racing по умолчанию и не показывает основные настройки', async () => {
  fetch.mockImplementation(async (path: string) => {
    if (path === '/admin/matchmaking') return { items: [] };
    if (path === '/admin/access/organizers') return [{ id: '7', name: 'League Sim Racing' }];
    if (path.startsWith('/games/')) return [];
    throw new Error(path);
  });
  renderPage();
  await screen.findByText('Не настроен');
  await openSettings();
  expect(screen.queryByText(/Не задан организатор/)).toBeNull();
  expect(screen.queryByLabelText('Название')).toBeNull();
  expect(screen.queryByLabelText('Организатор')).toBeNull();
});

it('скрывает настройку шин вне трассы для матчмейкинга', async () => {
  setup(undefined, newPools());
  await screen.findByRole('button', { name: 'Выключить поиск' });
  await openSettings('Игра и помощники');
  expect(screen.queryByLabelText('Шин вне трассы')).toBeNull();
  expect(screen.getByLabelText('Повреждения, %')).toBeTruthy();
});

it('объясняет отсутствие настройки очереди', async () => {
  fetch.mockImplementation(async (path: string) => {
    if (path === '/admin/matchmaking') return { items: [] };
    if (path === '/admin/access/organizers') return [];
    throw new Error('Unexpected ' + path);
  });
  renderPage();
  expect(await screen.findByText('Не настроен')).toBeTruthy();
  expect(screen.getByText(/Сохраните условия подбора/)).toBeTruthy();
  expect(screen.getByText(/Организатор League Sim Racing не найден/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Включить поиск' })).toBeNull();
});

it('отказ в доступе показывается как нехватка прав, а не пустая очередь', async () => {
  fetch.mockImplementation(async () => {
    throw new ApiError('Forbidden', 403);
  });
  renderPage(['matchmaking.read.all']);
  expect(await screen.findByText('Недостаточно прав')).toBeTruthy();
  expect(screen.queryByText('Очередь пуста')).toBeNull();
});

it('не показывает служебные плашки готовности, вкладки соответствуют макету', async () => {
  setup();
  const original = fetch.getMockImplementation()!;
  fetch.mockImplementation((path: string, init?: RequestInit) =>
    path.endsWith('/live')
      ? Promise.resolve({ readiness: { code: 'WAITING_SERVER', label: 'Ожидает сервер', availableConditions: 12, action: 'Проверьте свободные серверы и резервы.' }, queue: [], matches: [] })
      : original(path, init),
  );
  await screen.findByRole('button', { name: 'Выключить поиск' });
  expect(await screen.findByText('Очередь пуста')).toBeTruthy();
  expect(screen.queryByText(/Доступных сочетаний/)).toBeNull();
  expect(screen.queryByText(/Новые настройки применяются/)).toBeNull();
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Очередь', 'Матчи', 'Аналитика', 'Настройки']);
});

it('отключает самостоятельную очередь одной командой с версией и ключом', async () => {
  const q = setup();
  await userEvent.click(await screen.findByRole('button', { name: 'Выключить поиск' }));
  await waitFor(() => expect(fetch.mock.calls.some(([p, i]) => p === `/admin/matchmaking/${q.id}/disable` && i.method === 'POST')).toBe(true));
  const [, init] = fetch.mock.calls.find(([p]) => p.endsWith('/disable'))!;
  expect(JSON.parse(init.body)).toEqual({ version: 7 });
  expect(init.headers['Idempotency-Key']).toBeTruthy();
  expect(fetch.mock.calls.some(([p]) => p.includes('/events/') || p.includes('/profiles/'))).toBe(false);
});

it('неподтверждённая команда повторяется тем же ключом и телом', async () => {
  const q = setup();
  const original = fetch.getMockImplementation()!;
  fetch.mockImplementation((path: string, init?: RequestInit) => (init?.method === 'POST' ? Promise.reject(new TypeError('Failed to fetch')) : original(path, init)));
  await userEvent.click(await screen.findByRole('button', { name: 'Выключить поиск' }));
  const retry = await screen.findByRole('button', { name: 'Повторить неподтверждённую команду' });
  expect(screen.getByRole('button', { name: 'Выключить поиск' }).hasAttribute('disabled')).toBe(true);
  fetch.mockImplementation(original);
  await userEvent.click(retry);
  await waitFor(() => expect(fetch.mock.calls.filter(([p]) => p === `/admin/matchmaking/${q.id}/disable`)).toHaveLength(2));
  const [first, second] = fetch.mock.calls.filter(([p]) => p === `/admin/matchmaking/${q.id}/disable`).map(([, i]) => i);
  expect(second.headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);
  expect(second.body).toBe(first.body);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Повторить неподтверждённую команду' })).toBeNull());
});

it('требует явного перехода старой очереди к пулам перед сохранением', async () => {
  setup();
  await screen.findByRole('button', { name: 'Выключить поиск' });
  await openSettings();
  expect((await screen.findByRole('button', { name: 'Сохранить конфигурацию' })).hasAttribute('disabled')).toBe(true);
  expect(screen.getByText(/Сохранена прежняя модель: 1 сочетание/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Настроить пулы вручную' }));
  expect(screen.getByLabelText('Время на выбор и готовность, секунд')).toHaveProperty('value', '120');
  await userEvent.click(screen.getByRole('tab', { name: 'Пул машин' }));
  expect(screen.getByLabelText('Машин на выбор обоим пилотам')).toBeTruthy();
  expect(screen.queryByLabelText('Длительность блока, минут')).toBeNull();
});

it('event scoped grant не даёт управление общей очередью', async () => {
  setup(['events.write.scoped'], validPools());
  expect((await screen.findByRole('button', { name: 'Выключить поиск' })).hasAttribute('disabled')).toBe(true);
  await openSettings();
  expect(screen.getByText(/Только просмотр/)).toBeTruthy();
  expect(screen.getByLabelText('Побед до победы в матче').hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Сохранить конфигурацию' }).hasAttribute('disabled')).toBe(true);
});

it('сохраняет несохранённые правила при переключении поиска', async () => {
  setup();
  await screen.findByRole('button', { name: 'Выключить поиск' });
  await openSettings('Общие правила');
  const input = screen.getByLabelText('Побед до победы в матче');
  fireEvent.change(input, { target: { value: '3' } });
  expect(screen.getByText('Есть несохранённые изменения')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Выключить поиск' }));
  await screen.findByRole('button', { name: 'Включить поиск' });
  expect(screen.getByLabelText('Побед до победы в матче')).toHaveProperty('value', '3');
});

it('конфликт версии блокирует повторную запись, сохраняя правки формы', async () => {
  setup();
  await screen.findByRole('button', { name: 'Выключить поиск' });
  await openSettings();
  fireEvent.change(screen.getByLabelText('Побед до победы в матче'), { target: { value: '3' } });
  const original = fetch.getMockImplementation()!;
  fetch.mockImplementation((path: string, init?: RequestInit) => (init?.method === 'POST' ? Promise.reject(new ApiError('Конфликт версии', 409)) : original(path, init)));
  await userEvent.click(screen.getByRole('button', { name: 'Выключить поиск' }));
  await screen.findByText('Конфликт версии');
  expect(screen.queryByRole('button', { name: 'Повторить неподтверждённую команду' })).toBeNull();
  expect(screen.getByLabelText('Побед до победы в матче')).toHaveProperty('value', '3');
  expect(screen.getByRole('button', { name: 'Выключить поиск' }).hasAttribute('disabled')).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Загрузить актуальные настройки' }));
  await waitFor(() => expect(screen.getByLabelText('Побед до победы в матче')).toHaveProperty('value', '2'));
});

it('сохраняет настройки пулов с версией после редактирования трассы', async () => {
  const pools = validPools();
  setup(undefined, pools);
  await screen.findByRole('button', { name: 'Выключить поиск' });
  await openSettings('Трассы');
  await userEvent.click(screen.getByRole('button', { name: /^Гора/ }));
  fireEvent.change(screen.getByLabelText('Длительность заезда, мин'), { target: { value: '12' } });
  expect(screen.getByText('Нет ошибок')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить конфигурацию' }));
  await waitFor(() => expect(fetch.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true));
  const [path, init] = fetch.mock.calls.find(([, i]) => i?.method === 'PUT')!;
  expect(path).toBe('/admin/matchmaking/9007199254740993/config');
  expect(init.headers['Idempotency-Key']).toBeTruthy();
  const body = JSON.parse(init.body);
  expect(body.version).toBe(7);
  expect(body.config.pools.tracks[0]).toEqual({ ...pools.tracks[0], durationMinutes: 12 });
  expect(body.config.pools.weather).toEqual(pools.weather);
  expect(body.config.conditions).toEqual([]);
  expect(body.config.game.simulation.allowedTyresOut).toBe(-1);
});

it('проверка конфигурации блокирует сохранение и называет проблему', async () => {
  setup(undefined, { ...validPools(), tracks: [{ ...validPools().tracks[0], carIds: ['a'] }] });
  await screen.findByRole('button', { name: 'Выключить поиск' });
  await openSettings('Пул машин');
  expect(screen.getByText('Не хватает машин')).toBeTruthy();
  expect(screen.getByText(/недостаточно машин для выбранного предложения/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Сохранить конфигурацию' }).hasAttribute('disabled')).toBe(true);
});

it('карточка матча открывается по адресу и берёт матч из живого списка', async () => {
  setup(undefined, validPools(), '/matchmaking/matches/55');
  expect(await screen.findByRole('heading', { name: 'Alice vs Bob' })).toBeTruthy();
  expect(screen.getByText('srv-1')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Сессия №90' })).toBeTruthy();
});

it('realtime-изменение перечитывает очередь без перезагрузки страницы', async () => {
  setup(undefined, validPools());
  expect(await screen.findByText('Очередь пуста')).toBeTruthy();
  const original = fetch.getMockImplementation()!;
  fetch.mockImplementation((path: string, init?: RequestInit) =>
    path.endsWith('/live') ? Promise.resolve({ queue: [{ id: '3', participantId: '777', queuedAt: '2026-10-08T18:00:00Z', waitingSeconds: 75 }], matches: [] }) : original(path, init),
  );
  await Promise.all([...changes].map((refresh) => refresh()));
  expect(await screen.findByRole('link', { name: 'Пилот №777' })).toBeTruthy();
  expect(screen.getAllByText('1:15').length).toBeGreaterThan(0);
});

it('вероятность считается по относительным весам, пустой пул даёт ноль', () => {
  expect(selectionProbability(10, [10, 30])).toBe(25);
  expect(selectionProbability(0, [])).toBe(0);
});
