import { newPools, selectionProbability, type Pools } from './PoolFields';
// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, it, expect, afterEach } from 'vitest';
import { ApiError } from '../../shared/api';
import { MatchmakingPage } from './MatchmakingPage';
import { defaultGame } from '../../features/standalone/GameFields';
import type { AdminAccess } from '../../shared/types';
const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../shared/api', async () => ({
  ...(await vi.importActual('../../shared/api')),
  apiFetch: fetch,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('выбирает League Sim Racing по умолчанию и не показывает основные настройки', async () => {
  fetch.mockImplementation(async (path:string)=>{
    if(path==='/admin/matchmaking')return {items:[]};
    if(path==='/admin/access/organizers')return [{id:'7',name:'League Sim Racing'}];
    if(path.startsWith('/games/'))return [];
    throw new Error(path);
  });
  render(<MatchmakingPage access={{permissions:['matchmaking.manage.all'],grants:[]} as unknown as AdminAccess}/>);
  await screen.findByText(/Не настроен/);
  await userEvent.click(screen.getByRole('tab',{name:'Настройки'}));
  expect(screen.queryByText(/Не задан организатор/)).toBeNull();
  expect(screen.queryByLabelText('Название')).toBeNull();
  expect(screen.queryByLabelText('Организатор')).toBeNull();
  expect(screen.queryByText('Изменений нет')).toBeNull();
});

it('скрывает настройку шин вне трассы для матчмейкинга', async()=>{
  setup(undefined,newPools());
  await screen.findByRole('button',{name:'Выключить поиск'});
  await userEvent.click(screen.getByRole('tab',{name:'Настройки'}));
  await userEvent.click(screen.getByRole('tab',{name:'Условия сервера'}));
  expect(screen.queryByLabelText('Шин вне трассы')).toBeNull();
  expect(screen.getByLabelText('Повреждения, %')).toBeTruthy();
});
it('объясняет отсутствие настройки очереди', async () => {
  fetch.mockImplementation(async (path: string) => {
    if (path === '/admin/matchmaking') return { items: [] };
    if (path === '/admin/access/organizers') return [];
    throw new Error('Unexpected ' + path);
  });
  render(
    <MatchmakingPage
      access={{ permissions: ['matchmaking.manage.all'], grants: [] } as unknown as AdminAccess}
    />,
  );
  expect(await screen.findByText(/Не настроен/)).toBeTruthy();
  expect(screen.getByText(/Сохраните условия подбора/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Включить поиск' })).toBeNull();
});
it('не показывает служебные плашки готовности', async () => {
  setup();
  const original = fetch.getMockImplementation()!;
  fetch.mockImplementation((path: string, init?: RequestInit) =>
    path.endsWith('/live')
      ? Promise.resolve({
          readiness: {
            code: 'WAITING_SERVER',
            label: 'Ожидает сервер',
            availableConditions: 12,
            action: 'Проверьте свободные серверы и резервы.',
          },
          queue: [],
          matches: [],
        })
      : original(path, init),
  );
  await screen.findByRole('button', {name:'Выключить поиск'});
  expect(screen.queryByText(/Доступных сочетаний/)).toBeNull();
  expect(screen.queryByText(/Новые настройки применяются/)).toBeNull();
  expect(screen.getAllByRole('tab').map(t=>t.textContent)).toEqual(['Live','Журнал сессий','Аналитика','Настройки']);
});
function setup(permissions = ['matchmaking.manage.all'], pools?: Pools) {
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
    conditions: [
      { key: 'a', title: 'Гора', trackTitle: 'Гора', weatherTitle: 'Ясно', game: defaultGame() },
    ],
    duel: { winsTo: 2, maximumOmtRounds: 1, runtimeTimeLimitMinutes: 20 },
    rating: { mode: 'NONE' },
  };
  const queue = { id: '9007199254740993', version: 7, enabled: true, config };
  fetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'PUT')
      return { ...queue, enabled: false, version: 8 };
    if (path === '/admin/matchmaking') return { items: [queue] };
    if (path.endsWith('/config')) return queue;
    if (path.endsWith('/live')) return { queue: [], matches: [] };
    if (path.includes('/races')) return { items: [], total: 0 };
    if (path.endsWith('/analytics')) return {};
    if (path === '/admin/access/organizers') return [{ id: '1', name: 'Организатор' }];
    if (path.startsWith('/games/')) return [];
    throw new Error('Unexpected ' + path);
  });
  render(
    <MatchmakingPage
      access={
        {
          permissions,
          grants: [{ permissions, scope: { type: 'platform', id: null } }],
        } as unknown as AdminAccess
      }
    />,
  );
  return queue;
}
it('отключает самостоятельную очередь одной командой с версией и ключом', async () => {
  const q = setup();
  await userEvent.click(await screen.findByRole('button', { name: 'Выключить поиск' }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([p, i]) => p === `/admin/matchmaking/${q.id}/disable` && i.method === 'POST',
      ),
    ).toBe(true),
  );
  const [, init] = fetch.mock.calls.find(([p]) => p.endsWith('/disable'))!;
  expect(JSON.parse(init.body)).toEqual({ version: 7 });
  expect(init.headers['Idempotency-Key']).toBeTruthy();
  expect(fetch.mock.calls.some(([p]) => p.includes('/events/') || p.includes('/profiles/'))).toBe(
    false,
  );
});
it('требует явного перехода старой очереди к пулам перед сохранением', async () => {
  setup();
  await screen.findByRole('button', {name:'Выключить поиск'});
  await userEvent.click(screen.getByRole('tab',{name:'Настройки'}));
  expect(
    (await screen.findByRole('button', { name: 'Сохранить настройки' })).hasAttribute('disabled'),
  ).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Настроить пулы вручную' }));
  expect(screen.getByLabelText('Время на выбор и готовность, секунд')).toHaveProperty(
    'value',
    '120',
  );
  expect(screen.getByLabelText('Машин на выбор обоим пилотам')).toBeTruthy();
  expect(screen.queryByLabelText('Длительность блока, минут')).toBeNull();
});
it('event scoped grant не даёт управление общей очередью', async () => {
  setup(['events.write.scoped']);
  expect(
    (await screen.findByRole('button', { name: 'Выключить поиск' })).hasAttribute('disabled'),
  ).toBe(true);
});

it('сохраняет несохранённые правила при переключении поиска', async () => {
  setup();
  await screen.findByRole('button', {name:'Выключить поиск'});
  await userEvent.click(screen.getByRole('tab',{name:'Настройки'}));
  await userEvent.click(screen.getByRole('tab',{name:'Правила'}));
  const input = screen.getByLabelText('Побед до победы в матче');
  await userEvent.clear(input);
  fireEvent.change(input,{target:{value:'3'}});
  await userEvent.click(screen.getByRole('button', { name: 'Выключить поиск' }));
  await screen.findByRole('button', { name: 'Включить поиск' });
  expect(screen.getByLabelText('Побед до победы в матче')).toHaveProperty('value', '3');
});

it('конфликт версии блокирует повторную запись, сохраняя правки формы', async () => {
  setup();
  await screen.findByRole('button', {name:'Выключить поиск'});
  await userEvent.click(screen.getByRole('tab',{name:'Настройки'}));
  await userEvent.click(screen.getByRole('tab',{name:'Правила'}));
  const input = screen.getByLabelText('Побед до победы в матче');
  await userEvent.clear(input);
  fireEvent.change(input,{target:{value:'3'}});
  const original = fetch.getMockImplementation()!;
  fetch.mockImplementation((path: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? Promise.reject(new ApiError('Конфликт версии', 409))
      : original(path, init),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Выключить поиск' }));
  await screen.findByText('Конфликт версии');
  expect(screen.getByLabelText('Побед до победы в матче')).toHaveProperty('value', '3');
  expect(screen.getByRole('button', { name: 'Выключить поиск' }).hasAttribute('disabled')).toBe(
    true,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Загрузить актуальные настройки' }));
  await waitFor(() => expect(screen.getByLabelText('Побед до победы в матче')).toHaveProperty('value', '2'));
});

it('сохраняет настройки пулов с версией после редактирования трассы', async () => {
  const pools: Pools = {
    ...newPools(),
    carIds: ['a', 'b'],
    tracks: [
      {
        key: 't',
        title: 'Гора',
        code: 'mountain',
        layoutCode: null,
        enabled: true,
        weight: 10,
        durationMinutes: 6,
        carIds: ['a', 'b'],
        weatherKeys: ['sun'],
      },
    ],
    weather: [
      {
        key: 'sun',
        title: 'Ясно',
        enabled: true,
        weight: 10,
        codes: ['clear'],
        weather: {
          mode: 'FIXED',
          presetCode: 'clear',
          ambientTemperature: 18,
          roadTemperature: 28,
          ambientVariation: 2,
          roadVariation: 2,
        },
      },
    ],
  };
  setup(undefined, pools);
  await screen.findByRole('button', {name:'Выключить поиск'});
  await userEvent.click(screen.getByRole('tab',{name:'Настройки'}));
  fireEvent.click(screen.getByRole('tab', { name: 'Трассы' }));
  fireEvent.click(screen.getByRole('button', { name: /Гора · Включена/ }));
  const duration = screen.getByLabelText('Длительность на этой трассе, минут');
  fireEvent.change(duration, { target: { value: '12' } });
  expect(screen.queryByRole('tab', {name:'Проверка'})).toBeNull();
  expect(screen.queryByRole('tab', {name:'Основное'})).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
  await waitFor(() => expect(fetch.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true));
  const [, init] = fetch.mock.calls.find(([, i]) => i?.method === 'PUT')!;
  const body = JSON.parse(init.body);
  expect(body.version).toBe(7);
  expect(body.config.pools.tracks[0]).toEqual({ ...pools.tracks[0], durationMinutes: 12 });
  expect(body.config.pools.weather).toEqual(pools.weather);
  expect(body.config.conditions).toEqual([]);
  expect(body.config.game.simulation.allowedTyresOut).toBe(-1);
});
it('вероятность считается по относительным весам, пустой пул даёт ноль', () => {
  expect(selectionProbability(10, [10, 30])).toBe(25);
  expect(selectionProbability(0, [])).toBe(0);
});
