// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {ChatsPage} from './ChatsPage';
import {apiFetch,ApiError} from '../../shared/api';
vi.mock('../../shared/api',async()=>({...await vi.importActual<typeof import('../../shared/api')>('../../shared/api'),apiFetch:vi.fn(),jsonBody:(body:unknown)=>({method:'POST',body:JSON.stringify(body)}),getAdminToken:()=>null,subscribeAdminAuthChanged:()=>()=>{}}));
vi.mock('../../shared/realtime',()=>({useRealtimeRefresh:()=>{},subscribeAdminRefresh:()=>()=>{}}));
let root:Root,container:HTMLDivElement;
const message={id:'19',kind:'USER',authorName:'Pilot',authorUserId:'2',createdAt:'2026-09-20T10:00:00Z',originalBody:'Секретный текст',moderation:{hidden:false}};
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);
 vi.mocked(apiFetch).mockImplementation(async path=>path.includes('/messages?')?{items:[message],hasMore:false,nextBeforeId:'19'}:path.endsWith('/review')?{reviewId:'9007199254740997'}:{items:[{id:'9007199254740993',type:'DIRECT',status:'OPEN',messageCount:1}],nextCursor:null});});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const render=(props={})=>act(async()=>root.render(createElement(MemoryRouter,null,createElement(ChatsPage,props))));
function button(text:string){return Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text||b.getAttribute('aria-label')===text)!;}
async function type(el:HTMLInputElement|HTMLTextAreaElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
async function openReview(){await render();await act(async()=>button('Начать проверку чата #9007199254740993').click());await type(document.querySelector('textarea')!,'Проверка жалобы');await act(async()=>button('Зарегистрировать проверку').click());}

it('does not load content before review and sends bound reviewId with idempotency header',async()=>{await render();expect(document.body.textContent).not.toContain('Секретный текст');expect(apiFetch).toHaveBeenCalledTimes(1);
 await act(async()=>button('Начать проверку чата #9007199254740993').click());expect(button('Зарегистрировать проверку').disabled).toBe(true);expect(apiFetch).toHaveBeenCalledTimes(1);
 await type(document.querySelector('textarea')!,'Проверка жалобы');
 await act(async()=>button('Зарегистрировать проверку').click());
 expect(apiFetch).toHaveBeenCalledWith('/admin/chat/threads/9007199254740993/review',expect.objectContaining({headers:{'Idempotency-Key':expect.any(String)}}));
 expect(apiFetch).toHaveBeenCalledWith('/admin/chat/threads/9007199254740993/messages?reviewId=9007199254740997&limit=50');expect(document.body.textContent).toContain('Секретный текст');
});

it('combines free text with the direct chat button without reading messages',async()=>{
 await render();
 await type(container.querySelector('input')!,'Пилот 42');
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,400));});
 await act(async()=>button('Личные').click());
 const last=vi.mocked(apiFetch).mock.calls.at(-1)![0];const params=new URL(last,'http://local').searchParams;
 expect(params.get('q')).toBe('Пилот 42');expect(params.get('type')).toBe('DIRECT');expect(params.has('cursor')).toBe(false);
 expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path.includes('/messages'))).toBe(false);
 expect(container.textContent).not.toContain('Дополнительные фильтры');
});

it('hiding a message requires a reason and retries a lost answer with the same key',async()=>{
 await openReview();
 let hides=0;const read=vi.mocked(apiFetch).getMockImplementation()!;
 vi.mocked(apiFetch).mockImplementation(async(path,init)=>{if(path.endsWith('/hide')){if(++hides===1)throw new Error('Connection lost');return {};}return read(path,init);});
 await act(async()=>button('Скрыть сообщение').click());
 expect(button('Скрыть').disabled).toBe(true);
 await type(document.querySelector('[role=dialog] textarea') as HTMLTextAreaElement,'Оскорбление');
 await act(async()=>button('Скрыть').click());
 await act(async()=>button('Скрыть').click());
 const calls=vi.mocked(apiFetch).mock.calls.filter(([path])=>path.endsWith('/hide'));
 expect(calls).toHaveLength(2);
 expect(calls[0][0]).toBe('/admin/chat/threads/9007199254740993/messages/19/hide');
 expect(JSON.parse(String(calls[0][1]!.body))).toEqual({reviewId:'9007199254740997',reason:'Оскорбление'});
 expect(calls[1][1]).toEqual(calls[0][1]);
});

it('shows a forbidden thread list as missing access and keeps the event filter in the embedded journal',async()=>{
 vi.mocked(apiFetch).mockImplementation(async()=>{throw new ApiError('Нет доступа',403);});
 await render({eventId:'1038'});
 expect(container.textContent).toContain('Недостаточно прав');
 expect(container.textContent).not.toContain('Чатов нет');
 const params=new URL(vi.mocked(apiFetch).mock.calls[0][0],'http://local').searchParams;
 expect(params.get('eventId')).toBe('1038');expect(params.get('type')).toBe('EVENT');
 expect(container.querySelector('h1')).toBeNull();
});

it('reports the announcement recipient count without claiming delivery',async()=>{
 vi.mocked(apiFetch).mockImplementation(async path=>path==='/admin/notifications/announcements'?{recipientCount:2}:{items:[],nextCursor:null});
 await render();
 await act(async()=>(Array.from(document.querySelectorAll('[role=tab]')).find(t=>t.textContent==='Объявление') as HTMLElement).click());
 const inputs=Array.from(container.querySelectorAll('input'));
 await type(inputs[0],'701, 702');await type(inputs[2],'Тест');await type(container.querySelector('textarea')!,'Текст');
 await act(async()=>button('Отправить объявление').click());
 await act(async()=>button('Отправить').click());
 const call=vi.mocked(apiFetch).mock.calls.find(([path])=>path==='/admin/notifications/announcements')!;
 expect(JSON.parse(String(call[1]!.body))).toEqual({audience:{type:'users',userIds:['701','702']},title:'Тест',body:'Текст',actionUrl:null});
 expect(container.textContent).toContain('Выбрано получателей: 2');
 expect(container.textContent).toContain('не подтверждение доставки');
});
