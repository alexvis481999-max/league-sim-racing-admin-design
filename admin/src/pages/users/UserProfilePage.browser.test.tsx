// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UserProfilePage, type AdminPlayer } from './UserProfilePage';
import { apiFetch } from '../../shared/api';
vi.mock('../../shared/api',async()=>({...await vi.importActual('../../shared/api'),apiFetch:vi.fn()}));
vi.mock('../../shared/realtime',()=>({useRealtimeRefresh:()=>{}}));
let root:Root,container:HTMLDivElement;
const user={userId:'9007199254740993',steamId:'76561198000000001',country:'GB',complete:true,missingFields:[],presentation:{displayName:'Test Driver',avatarUrl:''},actions:{edit:true,uploadAvatar:true,deleteAvatar:false}} as AdminPlayer;
beforeEach(()=>{window.history.replaceState({},'', '/users?userId='+user.userId);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);
  vi.mocked(apiFetch).mockImplementation(async path=>path===`/admin/users/${user.userId}`?user:{items:[],nextAfterId:null});});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function render(){await act(async()=>root.render(<UserProfilePage id={user.userId} back={()=>{}} editor={()=> <div>Редактор</div>}/>));}
async function click(label:string){await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent===label)!.click());}
it('opens a read-only overview and defers private history and chats until their tab is opened',async()=>{
  await render();expect(container.textContent).toContain('Test Driver');expect(container.querySelector('form')).toBeNull();
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>/sessions|admin\/chat/.test(path))).toBe(false);
  await click('Входы и активность');
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path===`/admin/users/${user.userId}/history/sessions?limit=20&page=1`)).toBe(true);
  expect(location.search).toContain('tab=activity');
});
it('never turns a denied section into an empty history',async()=>{
  await render();vi.mocked(apiFetch).mockRejectedValue(Object.assign(new Error('Forbidden'),{status:403}));
  await click('Входы и активность');expect(container.textContent).toContain('Недостаточно прав');expect(container.textContent).not.toContain('Записей пока нет.');
});
it('requests only the selected player chats and does not open message bodies automatically',async()=>{
  await render();await click('Чаты');
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path.includes('/admin/chat/threads?')&&path.includes('userId='+user.userId))).toBe(true);
  expect(vi.mocked(apiFetch).mock.calls.some(([path])=>/\/messages|\/review\b/.test(path))).toBe(false);
});
