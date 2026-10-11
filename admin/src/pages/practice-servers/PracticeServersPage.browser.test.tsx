// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, it, expect, afterEach } from 'vitest';
import { PracticeServersPage } from './PracticeServersPage';
import { ApiError } from '../../shared/api';
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
const config = {
  organizerId: '1',
  title: 'Тренировка',
  description: null,
  coverImageId: null,
  timezone: 'UTC',
  gameCode: 'assetto_corsa',
  disciplineCode: 'touge',
  sessionDurationMinutes: 60,
  extraDelaySeconds: 15,
  game: {
    ...defaultGame(),
    track: { code: 'akina', layoutCode: null },
    cars: { allowedCarIds: ['ae86'], defaultCarId: 'ae86' },
  },
  practice: { durationMinutes: 60, maxParticipants: 16 },
};
const server = {
  id: '2',
  status: 'ACTIVE',
  config,
  configVersion: 4,
  currentCycle: {
    executionId: '10',
    state: 'RUNNING',
    runtimeSessionId: '20',
    resourceState: 'RUNNING',
  },
  lastCycle: null,
  nextEligibleAt: null,
  allowedActions: { configure: true, start: false, pause: true, stop: true, restart: true },
};
function setup(path = '/practice-servers') {
  fetch.mockImplementation(async (p: string, i?: RequestInit) => {
    if (i?.method) return server;
    if (p.startsWith('/admin/practice-servers?')) return { items: [server], total: 1 };
    if (p === '/admin/practice-servers/2') return server;
    if (p.startsWith('/admin/practice-servers/2/sessions?')) return {items: [], total: 0};
    if (p.endsWith('/tracks'))
      return [{ id: '10', code: 'akina', title: 'Akina', metadata: { layouts: [] } }];
    if (p.endsWith('/cars'))
      return [{ id: '11', code: 'ae86', title: 'Toyota AE86', metadata: {} }];
    if (p.startsWith('/games/')) return [];
    if (p === '/admin/access/organizers') return [{ id: '1', name: 'Лига' }];
    throw new Error('Unexpected ' + p);
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <PracticeServersPage
        access={
          {
            grants: [
              { permissions: ['practice.manage.scoped'], scope: { type: 'organizer', id: '1' } },
            ],
          } as unknown as AdminAccess
        }
      />
    </MemoryRouter>,
  );
}
it('перезапуск отправляется одной командой; клиент не выполняет stop/start', async () => {
  setup('/practice-servers/2');
  await userEvent.click(await screen.findByRole('button', { name: 'Перезапуск' }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([p, i]) => p === '/admin/practice-servers/2/restart' && i?.method === 'POST',
      ),
    ).toBe(true),
  );
  expect(fetch.mock.calls.filter(([, i]) => i?.method).map(([p]) => p)).toEqual([
    '/admin/practice-servers/2/restart',
  ]);
  expect(
    fetch.mock.calls.some(([p]) => p.includes('/events') || p.includes('/games-runtime')),
  ).toBe(false);
});
it('настройки активного сервиса сохраняются с версией без команды остановки', async () => {
  setup('/practice-servers/2/edit');
  const button = await screen.findByRole('button', { name: 'Сохранить для следующего цикла' });
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  await userEvent.click(button);
  await waitFor(() =>
    expect(fetch.mock.calls.some(([p, i]) => p.endsWith('/config') && i?.method === 'PUT')).toBe(
      true,
    ),
  );
  const [, i] = fetch.mock.calls.find(([p, i]) => p.endsWith('/config') && i?.method)!;
  expect(JSON.parse(i.body).version).toBe(4);
  expect(fetch.mock.calls.some(([p]) => p.endsWith('/stop'))).toBe(false);
});

it('сохраняет новую длительность в обоих полях и оставляет текущую сессию', async () => {
  setup('/practice-servers/2/edit');
  await screen.findByLabelText('Название');
  await userEvent.click(screen.getByRole('tab', { name: 'Сессия' }));
  const duration = screen.getByLabelText('Длительность цикла, минут');
  await userEvent.clear(duration);
  await userEvent.type(duration, '90');
  await userEvent.click(screen.getByRole('tab', { name: 'Проверка' }));
  expect(screen.getByText('Есть несохранённые изменения')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить для следующего цикла' }));
  await waitFor(() =>
    expect(fetch.mock.calls.some(([p, i]) => p.endsWith('/config') && i?.method === 'PUT')).toBe(
      true,
    ),
  );
  const [, init] = fetch.mock.calls.find(([p, i]) => p.endsWith('/config') && i?.method === 'PUT')!;
  expect(JSON.parse(init.body).config).toMatchObject({
    sessionDurationMinutes: 90,
    practice: { durationMinutes: 90, maxParticipants: 16 },
  });
});
it('конфликт версии сохраняет правки и блокирует повторное сохранение', async () => {
  setup('/practice-servers/2/edit');
  const input = await screen.findByLabelText('Название');
  fireEvent.change(input, { target: { value: 'Мои правки' } });
  const original = fetch.getMockImplementation()!;
  fetch.mockImplementation((p: string, i?: RequestInit) =>
    i?.method === 'PUT' ? Promise.reject(new ApiError('Конфликт', 409)) : original(p, i),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить для следующего цикла' }));
  await screen.findByText('Конфликт');
  expect(screen.getByLabelText('Название')).toHaveProperty('value', 'Мои правки');
  expect(
    screen.getByRole('button', { name: 'Сохранить для следующего цикла' }).hasAttribute('disabled'),
  ).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Загрузить актуальные настройки' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Название')).toHaveProperty('value', 'Тренировка'),
  );
});

it('создаёт остановленный сервер через общие поля контента', async () => {
  setup('/practice-servers/new');
  await screen.findByLabelText('Организатор');
  fireEvent.mouseDown(screen.getByLabelText('Организатор'));
  fireEvent.click(await screen.findByRole('option', { name: 'Лига' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Условия' }));
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Трасса' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Akina' }));
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Разрешённые машины' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Toyota AE86' }));
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Разрешённые машины' }), {
    key: 'Escape',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Создать остановленный сервер' }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([p, i]) => p === '/admin/practice-servers' && i?.method === 'POST'),
    ).toBe(true),
  );
  const [, init] = fetch.mock.calls.find(
    ([p, i]) => p === '/admin/practice-servers' && i?.method === 'POST',
  )!;
  expect(JSON.parse(init.body).config).toMatchObject({
    organizerId: '1',
    sessionDurationMinutes: 60,
    practice: { durationMinutes: 60, maxParticipants: 16 },
    game: { track: { code: 'akina' }, cars: { allowedCarIds: ['ae86'] } },
  });
  expect(fetch.mock.calls.some(([p]) => p.endsWith('/start'))).toBe(false);
}, 15000);

it('карточка открывает лайв, журнал загружается только при выборе вкладки', async () => {
  setup();
  await userEvent.click(await screen.findByRole('link', {name: 'Открыть Тренировка'}));
  await screen.findByText('Текущая сессия');
  expect(fetch.mock.calls.some(([p]) => p.includes('/sessions?'))).toBe(false);
  await userEvent.click(screen.getByRole('tab', {name: 'Журнал сессий'}));
  await screen.findByText('Сессий пока нет. Они появятся после первого запуска сервера.');
  expect(fetch.mock.calls.filter(([p]) => p.includes('/sessions?'))).toHaveLength(1);
  await userEvent.click(screen.getByRole('tab', {name: 'Настройки'}));
  await screen.findByLabelText('Название');
});
it('кнопка питания карточки останавливает сервер, не открывая его', async () => {
  setup();
  await userEvent.click(await screen.findByRole('button', {name: 'Остановить сервер'}));
  await waitFor(() => expect(fetch.mock.calls.some(([p,i]) => p.endsWith('/2/stop') && i?.method === 'POST')).toBe(true));
  expect(screen.queryByRole('tab', {name: 'Лайв'})).toBeNull();
  expect(fetch.mock.calls.some(([p]) => p.includes('/sessions?'))).toBe(false);
});
it('возврат из настроек сохраняет сервер открытым и предупреждает о несохранённых правках', async () => {
  setup('/practice-servers/2/edit');
  fireEvent.change(await screen.findByLabelText('Название'), {target: {value: 'Новое имя'}});
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await userEvent.click(screen.getByRole('tab', {name: 'Лайв'}));
  expect(screen.getByLabelText('Название')).toHaveProperty('value','Новое имя');
  confirm.mockReturnValue(true);
  await userEvent.click(screen.getByRole('tab', {name: 'Лайв'}));
  await screen.findByText('Текущая сессия');
  await userEvent.click(screen.getByRole('tab', {name: 'Настройки'}));
  expect(await screen.findByLabelText('Название')).toHaveProperty('value','Тренировка');
  confirm.mockRestore();
});

it('остановленный сервер запускается одной командой из карточки', async () => {
  setup();
  const original = fetch.getMockImplementation()!;
  fetch.mockImplementation((p: string, i?: RequestInit) => p.startsWith('/admin/practice-servers?') ? Promise.resolve({items:[{...server,status:'STOPPED',currentCycle:null,allowedActions:{...server.allowedActions,start:true}}],total:1}) : original(p,i));
  // Обновляем список через фильтр, чтобы получить остановленный сервер.
  await screen.findByRole('link', {name:'Открыть Тренировка'});
  await userEvent.click(screen.getByRole('button', {name:'Состояние: Остановленные'}));
  await userEvent.click(await screen.findByRole('button', {name:'Запустить сервер'}));
  await waitFor(() => expect(fetch.mock.calls.some(([p,i]) => p.endsWith('/2/start') && i?.method === 'POST')).toBe(true));
});
