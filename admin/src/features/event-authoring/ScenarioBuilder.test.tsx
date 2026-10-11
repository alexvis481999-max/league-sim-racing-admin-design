// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ScenarioBuilder } from './ScenarioBuilder';
import catalog from './fixtures/catalog.json';
import type { Document, Settings } from './types';
const api = vi.hoisted(() => ({ call: vi.fn(), upload: vi.fn() }));
vi.mock('../../shared/api', () => ({
  apiFetch: api.call,
  apiUploadFormData: api.upload,
  getApiBaseUrl: () => 'http://api.test',
  ApiError: class extends Error {
    status = 400;
  },
}));
vi.mock('../../pages/events/current/EventCardFields', () => ({ EventCardFields: () => null }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function mock() {
  api.call.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/admin/access/organizers') return [{ id: '1', name: 'Клуб' }];
    if (path.startsWith('/admin/event-authoring/catalog')) return catalog;
    if (path.startsWith('/games/')) return [];
    if (path === '/admin/event-authoring/resolve') {
      const body = JSON.parse(String(options?.body));
      return {
        contractVersion: 1,
        revision: body.revision,
        issues: [],
        canPublish: false,
        preview: null,
      };
    }
    if (path === '/admin/event-drafts') {
      const body = JSON.parse(String(options?.body));
      return {
        id: '12',
        revision: '1',
        publishedEventId: null,
        updatedAt: '2027-01-01T00:00:00Z',
        document: body.document,
      };
    }
    throw new Error(path);
  });
}
it('saves an entirely empty draft without choosing a format or organizer', async () => {
  mock();
  const saved = vi.fn();
  render(<ScenarioBuilder onSaved={saved} />);
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(saved.mock.calls[0][0].document).toEqual({
    contractVersion: 1,
    scenarioCode: null,
    settings: {},
    pendingImages: [],
  });
  expect(screen.getByRole('button', { name: 'Проверить и опубликовать' }).hasAttribute('disabled')).toBe(true);
});
it.each(catalog.items.map((item) => item.code))(
  'opens every section of %s and preserves incomplete numbers',
  async (code) => {
    mock();
    const item = catalog.items.find((item) => item.code === code)!;
    const document: Document = {
      contractVersion: 1,
      scenarioCode: code,
      settings: {
        ...structuredClone(item.defaults),
        event: { ...item.defaults.event, organizerId: '1' },
      } as unknown as Settings,
      pendingImages: [],
    };
    const saved = vi.fn();
    render(<ScenarioBuilder initialDocument={document} onSaved={saved} />);
    await screen.findByRole('tablist', { name: 'Разделы конструктора' });
    expect(screen.getByText(item.title, { selector: 'b' })).toBeTruthy();
    for (const label of ['Программа|Расписание|Этапы|Сетка', 'Машины и условия', 'Внешний вид', 'Проверка', 'Основное']) {
      fireEvent.click(screen.getByRole('tab', { name: new RegExp(label) }));
      expect(
        screen.queryByText('Выберите формат события. Пустую форму уже можно сохранить.'),
      ).toBeNull();
    }
    fireEvent.change(screen.getByLabelText('Название события'), {
      target: { value: 'Мой черновик' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(saved.mock.calls[0][0].document.settings.event.title).toBe('Мой черновик');
  },
);
it('invalidates publication immediately after changing the current revision', async () => {
  mock();
  const original = api.call.getMockImplementation()!;
  api.call.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/admin/event-authoring/resolve') {
      const body = JSON.parse(String(options?.body));
      return {
        contractVersion: 1,
        revision: body.revision,
        issues: [],
        canPublish: true,
        preview: { blocks: [] },
      };
    }
    return original(path, options);
  });
  const item = catalog.items[0];
  render(
    <ScenarioBuilder
      initialDocument={{
        contractVersion: 1,
        scenarioCode: item.code,
        settings: {
          ...structuredClone(item.defaults),
          event: { ...item.defaults.event, organizerId: '1' },
        } as unknown as Settings,
        pendingImages: [],
      }}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Проверить и опубликовать' }).hasAttribute('disabled')).toBe(
      false,
    ),
  );
  fireEvent.change(screen.getByLabelText('Название события'), { target: { value: 'Изменено' } });
  expect(screen.getByRole('button', { name: 'Проверить и опубликовать' }).hasAttribute('disabled')).toBe(true);
});
it('retries the same publication after a lost response without saving the published draft again', async () => {
  mock();
  const original = api.call.getMockImplementation()!;
  let calls = 0;
  api.call.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/admin/event-authoring/resolve') {
      const body = JSON.parse(String(options?.body));
      return {
        contractVersion: 1,
        revision: body.revision,
        issues: [],
        canPublish: true,
        preview: { blocks: [] },
      };
    }
    if (path === '/admin/event-drafts/12/publish') {
      calls++;
      if (calls === 1) throw new Error('Ответ потерян');
      return { eventId: '90' };
    }
    return original(path, options);
  });
  const item = catalog.items[0],
    published = vi.fn();
  render(
    <ScenarioBuilder
      onPublished={published}
      initialDocument={{
        contractVersion: 1,
        scenarioCode: item.code,
        settings: {
          ...structuredClone(item.defaults),
          event: { ...item.defaults.event, organizerId: '1' },
        } as unknown as Settings,
        pendingImages: [],
      }}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Проверить и опубликовать' }).hasAttribute('disabled')).toBe(
      false,
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Проверить и опубликовать' }));
  await screen.findByText('Ответ потерян');
  fireEvent.click(screen.getByRole('button', { name: 'Проверить публикацию' }));
  await waitFor(() => expect(published).toHaveBeenCalledWith('90'));
  expect(api.call.mock.calls.filter(([path]) => path === '/admin/event-drafts')).toHaveLength(1);
  const attempts = api.call.mock.calls.filter(
    ([path]) => path === '/admin/event-drafts/12/publish',
  );
  expect(attempts[0][1]).toEqual(attempts[1][1]);
});
it('preserves an unfinished number and rich text when save is clicked immediately', async () => {
  mock();
  const item = catalog.items.find((item) => item.code === 'circuit_single_race')!,
    saved = vi.fn();
  render(
    <ScenarioBuilder
      onSaved={saved}
      initialDocument={{
        contractVersion: 1,
        scenarioCode: item.code,
        settings: {
          ...structuredClone(item.defaults),
          event: { ...item.defaults.event, organizerId: '1' },
        } as unknown as Settings,
        pendingImages: [],
      }}
    />,
  );
  fireEvent.click(await screen.findByRole('tab', { name: /Программа/ }));
  fireEvent.change(screen.getByLabelText('Участников на сервере'), { target: { value: '1.' } });
  fireEvent.click(screen.getByRole('tab', { name: /Основное/ }));
  const editor = screen.getByRole('textbox', { name: 'Описание события' });
  editor.innerHTML = '<p>Важное <b>описание</b></p>';
  fireEvent.input(editor);
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(saved.mock.calls[0][0].document.settings.race.maxPlayersPerSession).toBe('1.');
  expect(saved.mock.calls[0][0].document.settings.event.description).toContain('<b>описание</b>');
});

it('keeps failed pasted images explicit while saving the text and incomplete date', async () => {
  mock();
  api.upload.mockRejectedValue(new Error('Загрузка не удалась'));
  const saved = vi.fn(),
    item = catalog.items.find((x) => x.code === 'circuit_single_race')!;
  const document = {
    contractVersion: 1 as const,
    scenarioCode: item.code,
    settings: {
      ...structuredClone(item.defaults),
      event: { ...item.defaults.event, organizerId: '1' },
    },
    pendingImages: [],
  };
  render(<ScenarioBuilder initialDocument={document as unknown as Document} onSaved={saved} />);
  fireEvent.click(await screen.findByRole('tab', { name: /Программа/ }));
  fireEvent.change(screen.getByLabelText('Старт гоночной сессии — дата'), { target: { value: '2027-01-04' } });
  fireEvent.click(screen.getByRole('tab', { name: /Основное/ }));
  const editor = screen.getByRole('textbox', { name: 'Описание события' });
  editor.innerHTML = '<p>Текст не должен пропасть</p>';
  fireEvent.input(editor);
  fireEvent.paste(editor, {
    clipboardData: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] },
  });
  await screen.findByText('Загрузка не удалась');
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  const state = saved.mock.calls[0][0].document;
  expect(state.settings.raceStartsAt).toBe('2027-01-04T');
  expect(state.settings.event.description).toContain('Текст не должен пропасть');
  expect(state.pendingImages).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Проверить и опубликовать' }).hasAttribute('disabled')).toBe(true);
});

it('shows sections after organizer and format selection, and colors only visited sections independently', async () => {
  mock();
  const original = api.call.getMockImplementation()!;
  api.call.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/admin/event-authoring/resolve') {
      const body = JSON.parse(String(options?.body));
      return {
        contractVersion: 1,
        revision: body.revision,
        canPublish: false,
        preview: null,
        issues: [
          {
            code: 'required',
            path: 'game.track.code',
            sectionId: 'program',
            message: 'Выберите трассу',
            severity: 'error',
          },
          {
            code: 'required',
            path: 'game.track.code',
            sectionId: 'conditions',
            message: 'Укажите дату',
            severity: 'error',
          },
        ],
      };
    }
    return original(path, options);
  });
  render(<ScenarioBuilder />);
  expect(screen.queryByRole('tab')).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: /Assetto Corsa/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Клуб/ }));
  expect(screen.queryByRole('tab')).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: /Разовая гонка/ }));
  await screen.findByRole('tab', { name: /Программа/ });
  await waitFor(() =>
    expect(
      api.call.mock.calls.some(
        ([path, options]) =>
          path === '/admin/event-authoring/resolve' &&
          JSON.parse(String(options?.body)).document.settings.event?.organizerId === '1',
      ),
    ).toBe(true),
  );
  for (const tab of screen.getAllByRole('tab')) expect(tab.title).toBe('Раздел ещё не проверен');
  fireEvent.click(screen.getByRole('tab', { name: /Внешний вид/ }));
  await waitFor(() => expect(screen.getByRole('tab', { name: /Внешний вид/ }).title).toBe('Раздел заполнен'));
  fireEvent.click(screen.getByRole('tab', { name: /Программа/ }));
  expect(screen.getByRole('tab', { name: /Программа/ }).title).toBe('Нужно исправить или заполнить поля');
  expect(screen.getByRole('tab', { name: /Машины и условия/ }).title).toBe('Раздел ещё не проверен');
  expect(screen.queryByRole('tab', { name: 'Формат' })).toBeNull();
});
it('switches formats without confirmation and restores the entered program on return', async () => {
  mock();
  const confirm = vi.spyOn(window, 'confirm');
  const item = catalog.items[0];
  render(
    <ScenarioBuilder
      initialDocument={{
        contractVersion: 1,
        scenarioCode: item.code,
        settings: {
          ...structuredClone(item.defaults),
          event: { ...item.defaults.event, organizerId: '1' },
        } as unknown as Settings,
        pendingImages: [],
      }}
    />,
  );
  fireEvent.click(await screen.findByRole('tab', { name: /Программа/ }));
  fireEvent.change(screen.getByLabelText('Участников на сервере'), { target: { value: '17' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сменить тип' }));
  fireEvent.click(screen.getByRole('button', { name: /^Практика/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Сменить тип' }));
  fireEvent.click(screen.getByRole('button', { name: /^Разовая гонка/ }));
  fireEvent.click(screen.getByRole('tab', { name: /Программа/ }));
  expect((screen.getByLabelText('Участников на сервере') as HTMLInputElement).value).toBe('17');
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});
