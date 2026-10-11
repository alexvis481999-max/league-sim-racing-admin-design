// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UserProfilePage, type AdminPlayer } from './UserProfilePage';
import { apiFetch } from '../../shared/api';
vi.mock('../../shared/api',async()=>({...await vi.importActual('../../shared/api'),apiFetch:vi.fn()}));
vi.mock('../../shared/realtime',()=>({useRealtimeRefresh:()=>{}}));
let root:Root,container:HTMLDivElement,search='';
const user={userId:'9007199254740993',steamId:'76561198000000001',country:'GB',complete:true,missingFields:[],presentation:{displayName:'Test Driver',avatarUrl:''},actions:{edit:true,uploadAvatar:true,deleteAvatar:false}} as unknown as AdminPlayer;
function Probe(){const location=useLocation();useEffect(()=>{search=location.search;},[location]);return null;}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);
  vi.mocked(apiFetch).mockImplementation(async path=>path===`/admin/users/${user.userId}`?user:{items:[],nextAfterId:null});});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function render(){await act(async()=>root.render(<MemoryRouter initialEntries={['/users?userId='+user.userId]}><UserProfilePage id={user.userId} back={()=>{}} editor={()=> <div>Редактор</div>}/><Probe/></MemoryRouter>));}
async function click(label:string){await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent===label)!.click());}
it('opens a read-only overview and defers private history and chats until their tab is opened',async()=>{
  await render();expect(container.textContent).toContain('Test Driver');expect(container.querySelector('form')).toBeNull();
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>/sessions|admin\/chat/.test(path))).toBe(false);
  expect(container.textContent).toContain('Действующих ограничений нет.');expect(container.textContent).toContain('Выступлений пока нет.');
  await click('Сессии и аудит');
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path===`/admin/users/${user.userId}/history/sessions?limit=20&page=1`)).toBe(true);
  expect(search).toContain('tab=activity');
});
it('never turns a denied section into an empty history',async()=>{
  await render();vi.mocked(apiFetch).mockRejectedValue(Object.assign(new Error('Forbidden'),{status:403}));
  await click('Сессии и аудит');expect(container.textContent).toContain('Недостаточно прав');expect(container.textContent).not.toContain('Записей пока нет.');
});
it('requests only the selected player chats and does not open message bodies automatically',async()=>{
  await render();await click('Чаты');
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path.includes('/admin/chat/threads?')&&path.includes('userId='+user.userId))).toBe(true);
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>/\/messages|\/review\b/.test(path))).toBe(false);
});
it('pages participations by page number and ratings by sequence',async()=>{
  vi.mocked(apiFetch).mockImplementation(async path=>path===`/admin/users/${user.userId}`?user:path.includes('/history/participations?limit=20')?{items:[{id:'p1',date:'2026-10-01T10:00:00Z',title:'Race',eventId:'7',raceKey:'race:1',position:2,finishStatus:'CLASSIFIED',resultId:'r1'}],pagination:{page:1,totalPages:2,total:21}}:path.includes('/history/rating')?{current:{pilot:{value:1600},safety:{value:90}},items:[{id:'x',sequence:9}],nextAfterSequence:'9'}:{items:[],nextAfterId:null});
  await render();await click('Выступления');await click('Далее →');
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path===`/admin/users/${user.userId}/history/participations?limit=20&page=2`)).toBe(true);
  await click('Рейтинги');expect(container.textContent).toContain('1600');await click('Далее →');
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path.includes('/history/rating?gameCode=assetto_corsa&disciplineCode=circuit&limit=20&afterSequence=9'))).toBe(true);
});
