// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CurrentUsersPage } from './CurrentUsersPage';
import { apiFetch } from '../../shared/api';
vi.mock('../../shared/api',async()=>({...await vi.importActual('../../shared/api'),apiFetch:vi.fn()}));
vi.mock('../../shared/realtime',()=>({useRealtimeRefresh:()=>{}}));
let root:Root, container:HTMLDivElement, search='';
const user = {userId:'9007199254740993',steamId:'76561198000000001',firstName:'John',lastName:'Smith',shortName:'JSM',country:'GB',discord:null,youtube:null,avatar:null,complete:true,missingFields:[],version:'v1',presentation:{displayName:'John Smith',avatarUrl:'/avatar.png'},actions:{edit:true,uploadAvatar:true,deleteAvatar:false}};
function Probe(){const location=useLocation();useEffect(()=>{search=location.search;},[location]);return null;}
const mount=(entry='/users')=>act(async()=>root.render(createElement(MemoryRouter,{initialEntries:[entry]},createElement(CurrentUsersPage),createElement(Probe))));
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); vi.clearAllMocks(); container=document.createElement('div');document.body.append(container);root=createRoot(container);
  vi.mocked(apiFetch).mockImplementation(async(path,init)=>path==='/site/countries'?[{code:'GB',name:'Великобритания'}]:init?.method==='PATCH'?{...user,firstName:'Jane',version:'v2'}:path.startsWith('/admin/users?')?{items:[user],pagination:{page:1,totalPages:1,total:1}}:path.startsWith('/admin/users/9007199254740993/history')||path.startsWith('/admin/sanctions')?{items:[],nextAfterId:null}:user);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function click(label:string){const button=Array.from(document.querySelectorAll('button')).find(node=>node.textContent===label)!;expect(button).toBeTruthy();await act(async()=>button.click());}
it('loads exact string ID and sends only changed fields with the displayed version',async()=>{
  await mount();
  const row=container.querySelector<HTMLTableRowElement>('tr[aria-label="Открыть профиль John Smith"]')!;expect(row).toBeTruthy();
  await act(async()=>row.click());expect(search).toContain('userId=9007199254740993');
  await click('Редактировать профиль');
  expect(apiFetch).toHaveBeenCalledWith('/admin/users/9007199254740993');
  const input=Array.from(document.querySelectorAll('input')).find(node=>node.value==='John')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Jane');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  const call=vi.mocked(apiFetch).mock.calls.find(([,init])=>init?.method==='PATCH')!;
  expect(call[0]).toBe('/admin/users/9007199254740993');expect(JSON.parse(String(call[1]?.body))).toEqual({firstName:'Jane'});expect(call[1]?.headers).toEqual({'If-Match':'v1'});
  expect(document.body.textContent).toContain('Сохранено.');expect(container.textContent).not.toContain('Пароль');
});
it('denial is displayed without showing a fake list or trying legacy endpoints',async()=>{
  vi.mocked(apiFetch).mockRejectedValue(new Error('Недостаточно прав'));
  await mount();expect(container.textContent).toContain('Недостаточно прав');expect(container.textContent).not.toContain('John Smith');expect(container.textContent).not.toContain('Пилотов в выборке');expect(apiFetch).toHaveBeenCalledTimes(1);
});

it('searches while typing and shows a structured user table',async()=>{
 await mount();
 const input=container.querySelector('input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Smith John');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,400));});
 expect(apiFetch).toHaveBeenLastCalledWith('/admin/users?q=Smith%20John&page=1&pageSize=20');
 expect(search).toContain('q=Smith+John');
 expect(container.querySelector('table')?.textContent).toContain('SteamID');
 expect(container.querySelector('table')?.textContent).toContain('76561198000000001');
});

it('shows an empty result instead of a table and opens a profile from the URL',async()=>{
 vi.mocked(apiFetch).mockImplementation(async path=>path.startsWith('/admin/users?')?{items:[],pagination:{page:1,totalPages:0,total:0}}:{items:[],nextAfterId:null});
 await mount();expect(container.textContent).toContain('В системе пока нет пользователей.');expect(container.querySelector('table')).toBeNull();
 await act(async()=>root.unmount());root=createRoot(container);
 vi.mocked(apiFetch).mockImplementation(async path=>path===`/admin/users/${user.userId}`?user:{items:[],nextAfterId:null});
 await mount(`/users?userId=${user.userId}&eventId=55`);
 expect(container.textContent).toContain('John Smith');expect(container.textContent).toContain('Вернуться к событию');
 await click('← Пилоты');expect(search).not.toContain('userId');
});
