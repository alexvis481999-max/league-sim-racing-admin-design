// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CurrentUsersPage } from './CurrentUsersPage';
import { apiFetch } from '../../shared/api';
vi.mock('../../shared/api',async()=>({...await vi.importActual('../../shared/api'),apiFetch:vi.fn()}));
let root:Root, container:HTMLDivElement;
const user = {userId:'9007199254740993',steamId:'76561198000000001',firstName:'John',lastName:'Smith',shortName:'JSM',country:'GB',discord:null,youtube:null,avatar:null,complete:true,missingFields:[],version:'v1',presentation:{displayName:'John Smith',avatarUrl:'/avatar.png'},actions:{edit:true,uploadAvatar:true,deleteAvatar:false}};
beforeEach(()=>{
  window.history.replaceState({},'', '/users');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); vi.clearAllMocks(); container=document.createElement('div');document.body.append(container);root=createRoot(container);
  vi.mocked(apiFetch).mockImplementation(async(path,init)=>path==='/site/countries'?[{code:'GB',name:'Великобритания'}]:init?.method==='PATCH'?{...user,firstName:'Jane',version:'v2'}:path.startsWith('/admin/users?')?{items:[user],pagination:{page:1,totalPages:1,total:1}}:user);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function click(label:string){const button=Array.from(container.querySelectorAll('button')).find(node=>node.textContent===label)!;expect(button).toBeTruthy();await act(async()=>button.click());}
it('loads exact string ID and sends only changed fields with the displayed version',async()=>{
  await act(async()=>root.render(createElement(CurrentUsersPage)));await click('John Smith');await click('Редактировать профиль');
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
  await act(async()=>root.render(createElement(CurrentUsersPage)));expect(container.textContent).toContain('Недостаточно прав');expect(container.textContent).not.toContain('John Smith');expect(apiFetch).toHaveBeenCalledTimes(1);
});

it('searches while typing and shows a structured user table',async()=>{
 await act(async()=>root.render(createElement(CurrentUsersPage)));
 const input=container.querySelector('input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Smith John');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,400));});
 expect(apiFetch).toHaveBeenLastCalledWith('/admin/users?q=Smith%20John&page=1&pageSize=20');
 expect(container.querySelector('table')?.textContent).toContain('SteamID');
 expect(container.querySelector('table')?.textContent).toContain('76561198000000001');
});
