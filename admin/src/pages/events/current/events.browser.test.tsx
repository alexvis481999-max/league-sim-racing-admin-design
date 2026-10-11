import {statusFixture} from '../../../../../shared/test/event-status.fixture';
import { localInput, localInstant } from './event-time';
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AdminAccess } from '../../../shared/types';
import { useState } from 'react';
import type { Settings } from './event-api';
import { CurrentEventsPage } from './CurrentEventsPage';
import { EventWorkspacePage } from './EventWorkspacePage';
const api = vi.hoisted(() => ({ call: vi.fn(), changes: new Set<() => unknown>() }));
vi.mock('../../../shared/api', () => ({
  apiFetch: api.call,
  getApiBaseUrl: () => 'http://localhost:3000',
  ApiError: class extends Error {
    status = 409;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('offers only publication filters and includes drafts among unpublished events',async()=>{
  api.call.mockImplementation(async(path:string)=>path.startsWith('/admin/event-drafts')?{items:[{id:'draft-1',revision:'1',document:{settings:{event:{title:'Неопубликованный черновик'}}}}],nextAfterId:null}:{items:[{id:'1',title:'Опубликованная гонка',scenarioTitle:'Гонка',startsAt:'2027-01-01T10:00:00Z',displayStatus:statusFixture()}],nextAfterId:null});
  render(<MemoryRouter><CurrentEventsPage access={{grants:[{permissions:['events.write.all']}]} as AdminAccess}/></MemoryRouter>);
  await screen.findByText('Неопубликованный черновик');
  expect(screen.getByRole('button',{name:'Публикация: Все'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Черновики'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Публикация: Опубликованные'}));
  await waitFor(()=>expect(screen.queryByText('Неопубликованный черновик')).toBeNull());
  expect(api.call.mock.calls.some(([path])=>path.includes('publication=published'))).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Публикация: Неопубликованные'}));
  await screen.findByText('Неопубликованный черновик');
  expect(api.call.mock.calls.some(([path])=>path.includes('publication=unpublished'))).toBe(true);
});
  it('uses workspace permission and expected version for description changes', async () => {
    const workspace = {
      metadata:{createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-01T00:00:00Z',publishedAt:null,author:null,organizer:null},currentStage:null,nextStage:null,stop:null,activity:{applications:{pending:0,accepted:0},runtime:{active:0,uncertain:0},hasRegistration:true},primaryResultId:null,counts:{stages:0,results:0},
      eventId: '9',
      version: '17',
      event: { displayStatus:statusFixture(),observedAt:statusFixture().observedAt,title: 'Гонка', description: 'Исходное описание', status: 'PUBLISHED' },
      settings: null,
      state: { displayStatus:statusFixture(),stopState: 'NONE', blocks: [] },
      actions: [
        { code: 'edit', enabled: true },
        { code: 'cancel', enabled: false },
      ],
      editableFields: ['description'],
      registrations: [],
      results: [],
    };
    api.call.mockImplementation(async (path: string) =>
      path.endsWith('/workspace/edit') ? {settings:null,version:'17',description:'Исходное описание'} : path.includes('/game-chat')
        ? { items: [], nextCursor: null }
        : path.endsWith('/workspace')
          ? workspace
          : { eventId: '9', version: '18' },
    );
    render(
      <MemoryRouter initialEntries={['/events/9']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Гонка');
    fireEvent.click(screen.getByText('Редактировать'));
    await screen.findByLabelText('Описание');
    fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Новое описание' } });
    expect(screen.queryByText('Отменить событие')).toBeNull();
    fireEvent.click(screen.getByText('Сохранить описание'));
    await waitFor(() =>
      expect(api.call.mock.calls.some(([path]) => path === '/admin/events/9')).toBe(true),
    );
    const saved = api.call.mock.calls.find(([path]) => path === '/admin/events/9')!;
    expect(saved[1].method).toBe('PATCH');
    expect(JSON.parse(saved[1].body)).toEqual({
      expectedVersion: '17',
      patch: { description: 'Новое описание' },
    });
  });
vi.mock('../../../shared/realtime', () => ({
  useRealtimeRefresh: () => {},
  subscribeAdminRefresh: (_domains: string[], callback: () => unknown) => {
    api.changes.add(callback);
    return () => {
      api.changes.delete(callback);
    };
  },
}));

it('socket refresh preserves unsaved description and its original optimistic version', async () => {
  let current = '17';
  const snapshot = () => ({
    metadata:{createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-01T00:00:00Z',publishedAt:null,author:null,organizer:null},currentStage:null,nextStage:null,stop:null,activity:{applications:{pending:0,accepted:0},runtime:{active:0,uncertain:0},hasRegistration:true},primaryResultId:null,counts:{stages:0,results:0},
    eventId: '9',
    version: current,
    event: { displayStatus:statusFixture(),observedAt:statusFixture().observedAt,title: 'Гонка', description: 'Сервер ' + current, status: 'PUBLISHED' },
    settings: null,
    state: { displayStatus:statusFixture(),stopState: 'NONE', blocks: [] },
    actions: [{ code: 'edit', enabled: true }],
    editableFields: ['description'],
    registrations: [],
    results: [],
  });
  api.call.mockImplementation(async (path: string) =>
    path.endsWith('/workspace/edit') ? {settings:null,version:current,description:'Сервер '+current} : path.includes('/game-chat')
      ? { items: [], nextCursor: null }
      : path.endsWith('/workspace')
        ? snapshot()
        : { eventId: '9', version: '19' },
  );
  render(
    <MemoryRouter initialEntries={['/events/9']}>
      <Routes>
        <Route path="/events/:eventId" element={<EventWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText('Гонка');
  fireEvent.click(screen.getByText('Редактировать'));
  await screen.findByLabelText('Описание');
  fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Мой черновик' } });
  current = '18';
  await import('@testing-library/react').then(({ act }) =>
    act(async () => {
      for (const callback of api.changes) await callback();
    }),
  );
  expect((screen.getByLabelText('Описание') as HTMLTextAreaElement).value).toBe('Мой черновик');
  expect(screen.getByText(/Событие изменилось/)).toBeTruthy();
  fireEvent.click(screen.getByText('Сохранить описание'));
  await waitFor(() =>
    expect(api.call.mock.calls.some(([path]) => path === '/admin/events/9')).toBe(true),
  );
  expect(
    JSON.parse(api.call.mock.calls.find(([path]) => path === '/admin/events/9')![1].body)
      .expectedVersion,
  ).toBe('17');
});

// Actual server templates, not a reduced event-only fixture.
it('loads only the selected section and retains participants during a background refresh',async()=>{
  const summary={eventId:'9',version:'1',observedAt:statusFixture().observedAt,
    event:{title:'Событие',description:null,gameCode:'assetto_corsa',displayStatus:statusFixture()},
    metadata:{createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-01T00:00:00Z',publishedAt:null,author:null,organizer:null},
    currentStage:null,nextStage:null,stop:null,activity:{applications:{pending:0,accepted:0},runtime:{active:0,uncertain:0},hasRegistration:true},primaryResultId:null,counts:{stages:1,results:1},actions:[],editableFields:[]};
  const roster={items:[{id:'1',registrationKey:'race',participantId:'7',status:'ACCEPTED',createdAt:'2026-09-01T00:00:00Z',decidedAt:null,withdrawnAt:null,removedAt:null,identity:{displayName:'Пилот Семь'},selection:null,reviews:[],actions:[]}],registrations:[],nextAfterId:null};
  let refresh=false,resolveRoster:((value:typeof roster)=>void)|undefined;
  api.call.mockImplementation((path:string)=>path.endsWith('/workspace')?Promise.resolve(summary):path.endsWith('/participants')?(refresh?new Promise(resolve=>{resolveRoster=resolve;}):Promise.resolve(roster)):Promise.reject(new Error('Unexpected request '+path)));
  render(<MemoryRouter initialEntries={['/events/9']}><Routes><Route path="/events/:eventId" element={<EventWorkspacePage/>}/></Routes></MemoryRouter>);
  await screen.findByText('Событие');
  expect(api.call.mock.calls.map(([path])=>path)).toEqual(['/admin/events/9/workspace']);
  fireEvent.click(screen.getByRole('tab',{name:'Участники'}));
  await screen.findByText('Пилот Семь');
  expect(screen.queryByText('Показать ещё')).toBeNull();
  refresh=true;
  const {act}=await import('@testing-library/react');
  await act(async()=>{for(const callback of [...api.changes])void callback();});
  expect(screen.getByText('Пилот Семь')).toBeTruthy();
  expect(screen.queryByText('Загружаем раздел…')).toBeNull();
  await act(async()=>{resolveRoster!(roster);});
  expect(api.call.mock.calls.every(([path])=>path.endsWith('/workspace')||path.endsWith('/participants'))).toBe(true);
});

it('conduct keeps selected stage conditions scoped to the stage',async()=>{
  const summary={eventId:'9',version:'1',observedAt:statusFixture().observedAt,event:{title:'Чемпионат',description:null,gameCode:'assetto_corsa',displayStatus:statusFixture()},metadata:{createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-01T00:00:00Z',publishedAt:null,author:null,organizer:null},currentStage:null,nextStage:null,stop:null,activity:{applications:{pending:0,accepted:0},runtime:{active:0,uncertain:0},hasRegistration:true},primaryResultId:null,counts:{stages:2,results:1},actions:[],editableFields:[]};
  const stages=['one','two'].map((key,i)=>({id:String(i+1),key,title:i?'Второй этап':'Первый этап',type:'PRACTICE',displayStatus:statusFixture(),plannedStartsAt:'2026-09-28T12:00:00Z',startedAt:null,finishedAt:null,sessions:[],progress:[],resultIds:[]}));
  const conditions=(key:string)=>({stages:[{key,title:key,type:'PRACTICE',origins:{},game:{track:{code:key,layoutCode:null},cars:{allowedCarIds:['car']},environment:{weather:{ambientTemperature:key==='one'?17:29}},assists:{absAllowed:1},simulation:{damageMultiplierPercent:100}},settings:{durationMinutes:25},track:{title:'Трасса '+key,imageUrl:null},cars:[{title:'Машина',imageUrl:null}],carClass:null,weatherPresets:[],plugins:[],content:[]}],registrations:[],results:[],rating:null});
  api.call.mockImplementation(async(path:string)=>path.endsWith('/workspace')?summary:path.includes('/schedule')?{items:path.includes('stageKey=')?stages.filter(s=>path.endsWith(s.key)):stages,registrations:[],dependencies:null,nextAfterId:null}:path.includes('/conditions')?conditions(new URL(path,'http://localhost').searchParams.get('stageKey')!):Promise.reject(new Error(path)));
  render(<MemoryRouter initialEntries={['/events/9?section=execution&stage=one']}><Routes><Route path="/events/:eventId" element={<EventWorkspacePage/>}/></Routes></MemoryRouter>);
  await screen.findByText('Трасса one');expect(screen.getByText('17')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Второй этап/}));
  await screen.findByText('Трасса two');expect(screen.getByText('29')).toBeTruthy();expect(screen.queryByText('17')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Все условия'}));fireEvent.click(screen.getByRole('button',{name:'Помощники'}));expect(screen.getByText('Заводской')).toBeTruthy();
  expect(api.call.mock.calls.filter(([path])=>path.includes('/conditions')).map(([path])=>path)).toEqual(['/admin/events/9/workspace/conditions?stageKey=one','/admin/events/9/workspace/conditions?stageKey=two']);
});

it('an event without registration opens actual attendance without requesting applications',async()=>{
  const summary={eventId:'9',version:'1',observedAt:statusFixture().observedAt,event:{title:'Тайм-аттак',displayStatus:statusFixture()},metadata:{organizer:null},currentStage:null,nextStage:null,activity:{applications:{pending:0,accepted:0},runtime:{active:0,uncertain:0},hasRegistration:false},primaryResultId:null,counts:{stages:1,results:1},actions:[],editableFields:[]};
  api.call.mockImplementation(async(path:string)=>path.endsWith('/workspace')?summary:path.endsWith('/attendance')?{items:[{id:'7',participantId:'7',identity:{displayName:'Участник попытки'},stages:[{key:'attempts',title:'Попытки'}]}],nextAfterId:null}:Promise.reject(new Error(path)));
  render(<MemoryRouter initialEntries={['/events/9?section=participants']}><Routes><Route path="/events/:eventId" element={<EventWorkspacePage/>}/></Routes></MemoryRouter>);
  await screen.findByText('Участник попытки');expect(screen.queryByRole('button',{name:'Заявки'})).toBeNull();expect(screen.queryByText('Заявок нет.')).toBeNull();expect(api.call.mock.calls.some(([path])=>path.endsWith('/participants'))).toBe(false);
});

it('switches from applications to attendance when refreshed event has no registration',async()=>{
  let hasRegistration = true;
  const summary = () => ({eventId:'9',version:'1',observedAt:statusFixture().observedAt,event:{title:'Событие',displayStatus:statusFixture()},metadata:{organizer:null},currentStage:null,nextStage:null,activity:{applications:{pending:0,accepted:0},runtime:{active:0,uncertain:0},hasRegistration},primaryResultId:null,counts:{stages:1,results:0},actions:[],editableFields:[]});
  api.call.mockImplementation(async(path:string)=>path.endsWith('/workspace')?summary():path.endsWith('/attendance')?{items:[],nextAfterId:null}:Promise.reject(new Error('internal_error')));
  render(<MemoryRouter initialEntries={['/events/9?section=participants']}><Routes><Route path="/events/:eventId" element={<EventWorkspacePage/>}/></Routes></MemoryRouter>);
  await screen.findByRole('alert');
  expect(screen.getByRole('button',{name:'Заявки'})).toBeTruthy();
  hasRegistration = false;
  const {act}=await import('@testing-library/react');
  await act(async()=>{for(const callback of [...api.changes])await callback();});
  await screen.findByText('Фактическое участие пока не зафиксировано.');
  expect(screen.queryByRole('button',{name:'Заявки'})).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  api.call.mockClear();
  await act(async()=>{for(const callback of [...api.changes])await callback();});
  expect(api.call.mock.calls.some(([path])=>path.endsWith('/participants'))).toBe(false);
});

it('a rejected command keeps the selected pilot and typed reason during refresh',async()=>{
  const summary={eventId:'9',version:'1',observedAt:statusFixture().observedAt,event:{title:'Гонка',displayStatus:statusFixture()},metadata:{organizer:null},currentStage:null,nextStage:null,activity:{applications:{pending:1,accepted:0},runtime:{active:0,uncertain:0},hasRegistration:true},primaryResultId:null,counts:{stages:1,results:1},actions:[],editableFields:[]};
  const roster={items:[{id:'1',participantId:'7',registrationKey:'entry',identity:{displayName:'Выбранный пилот'},status:'PENDING',createdAt:'2026-09-01T00:00:00Z',reviews:[],actions:[{code:'review',enabled:true}]}],registrations:[],nextAfterId:null};
  api.call.mockImplementation(async(path:string)=>path.endsWith('/workspace')?summary:path.endsWith('/participants')?roster:Promise.reject(new Error('Нет ответа на команду')));
  render(<MemoryRouter initialEntries={['/events/9?section=participants']}><Routes><Route path="/events/:eventId" element={<EventWorkspacePage/>}/></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Выбранный пилот'}));fireEvent.click(screen.getByRole('button',{name:'Отклонить'}));
  fireEvent.change(screen.getByLabelText('Причина отказа'),{target:{value:'Уточнить допуск'}});
  const {act}=await import('@testing-library/react');await act(async()=>{for(const callback of [...api.changes])await callback();});
  expect((screen.getByLabelText('Причина отказа') as HTMLInputElement).value).toBe('Уточнить допуск');
  fireEvent.click(screen.getByRole('button',{name:'Отклонить заявку'}));
  await screen.findByText('Нет ответа на команду');expect((screen.getByLabelText('Причина отказа') as HTMLInputElement).value).toBe('Уточнить допуск');
  const call=api.call.mock.calls.find(([path])=>path.endsWith('/entries/1/review'))!;
  expect(JSON.parse(call[1].body)).toEqual({expectedVersion:'1',decision:'REJECTED',reason:'Уточнить допуск'});
});

it('opens the explicit primary result even when it is outside the first page',async()=>{
  const summary={eventId:'9',version:'1',observedAt:statusFixture().observedAt,event:{title:'Чемпионат',displayStatus:statusFixture()},metadata:{organizer:null},currentStage:null,nextStage:null,activity:{applications:{pending:0,accepted:0},runtime:{active:0,uncertain:0},hasRegistration:true},primaryResultId:'2',counts:{stages:30,results:31},actions:[],editableFields:[]};
  const head=(id:string,title:string)=>({id,title,displayStatus:statusFixture(),currentRevisionNumber:0});
  api.call.mockImplementation(async(path:string)=>path.endsWith('/workspace')?summary:path.endsWith('/results')?{items:[head('1','Этап 1')],nextAfterId:'1'}:path.endsWith('/results?resultId=2')?{items:[head('2','Общий зачёт')],nextAfterId:null}:path.endsWith('/revisions?resultId=2')?{items:[],nextAfterId:null}:Promise.reject(new Error(path)));
  render(<MemoryRouter initialEntries={['/events/9?section=results']}><Routes><Route path="/events/:eventId" element={<EventWorkspacePage/>}/></Routes></MemoryRouter>);
  await screen.findByText(/Общий зачёт/);await screen.findByText('Опубликованных ревизий пока нет.');
  expect(api.call.mock.calls.some(([path])=>path.includes('/revisions?resultId=1'))).toBe(false);
});
