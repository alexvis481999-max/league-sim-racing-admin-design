// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {ChatsPage} from './ChatsPage';
import {apiFetch} from '../../shared/api';
vi.mock('../../shared/api',()=>({apiFetch:vi.fn(),jsonBody:(body:unknown)=>({method:'POST',body:JSON.stringify(body)}),getAdminToken:()=>null,subscribeAdminAuthChanged:()=>()=>{}}));
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);
 vi.mocked(apiFetch).mockImplementation(async path=>path.includes('/messages?')?{items:[{id:'19',kind:'USER',authorName:'Pilot',authorUserId:'2',createdAt:'2026-09-20T10:00:00Z',originalBody:'Секретный текст',moderation:{hidden:false}}],hasMore:false,nextBeforeId:'19'}:path.endsWith('/review')?{reviewId:'9007199254740997'}:{items:[{id:'9007199254740993',type:'DIRECT',status:'OPEN',messageCount:1}],nextCursor:null});});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
function button(text:string){return Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text)!;}
it('does not load content before review and sends bound reviewId with idempotency header',async()=>{await act(async()=>root.render(createElement(ChatsPage)));expect(document.body.textContent).not.toContain('Секретный текст');expect(apiFetch).toHaveBeenCalledTimes(1);
 await act(async()=>button('Начать проверку').click());expect(button('Открыть переписку').disabled).toBe(true);expect(apiFetch).toHaveBeenCalledTimes(1);
 const textarea=document.querySelector('textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'Проверка жалобы');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>button('Открыть переписку').click());
 expect(apiFetch).toHaveBeenCalledWith('/admin/chat/threads/9007199254740993/review',expect.objectContaining({headers:{'Idempotency-Key':expect.any(String)}}));
 expect(apiFetch).toHaveBeenCalledWith('/admin/chat/threads/9007199254740993/messages?reviewId=9007199254740997&limit=50');expect(document.body.textContent).toContain('Секретный текст');
});

vi.mock('../../shared/realtime',()=>({useRealtimeRefresh:()=>{},subscribeAdminRefresh:()=>()=>{}}));

it('combines free text with the direct chat button without reading messages',async()=>{
 await act(async()=>root.render(createElement(ChatsPage)));
 const input=container.querySelector('input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Пилот 42');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,400));});
 await act(async()=>button('Личные').click());
 const last=vi.mocked(apiFetch).mock.calls.at(-1)![0];const params=new URL(last,'http://local').searchParams;
 expect(params.get('q')).toBe('Пилот 42');expect(params.get('type')).toBe('DIRECT');expect(params.has('cursor')).toBe(false);
 expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path.includes('/messages'))).toBe(false);
 expect(container.textContent).not.toContain('Дополнительные фильтры');
});
