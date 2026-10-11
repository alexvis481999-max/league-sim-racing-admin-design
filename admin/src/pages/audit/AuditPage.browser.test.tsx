// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {AuditPage} from './AuditPage';
import {apiFetch} from '../../shared/api';
vi.mock('../../shared/api',async()=>({...await vi.importActual('../../shared/api'),apiFetch:vi.fn()}));
vi.mock('../../shared/realtime',()=>({useRealtimeRefresh:()=>{},subscribeAdminRefresh:()=>()=>{}}));
const page=(props={})=>createElement(MemoryRouter,null,createElement(AuditPage,props));
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);vi.mocked(apiFetch).mockImplementation(async path=>({items:[{id:path.includes('cursor')?'2':'3',at:'2026-09-20T10:00:00Z',actor:{type:'system',userId:null},action:path.includes('cursor')?'second':'first',target:{type:'grant',id:'9007199254740993'}}],nextCursor:path.includes('cursor')?null:'opaque-cursor'}));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('appends server cursor page and preserves exact string identifiers and system actor',async()=>{await act(async()=>root.render(page()));expect(container.textContent).toContain('Система');expect(container.textContent).toContain('9007199254740993');await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Показать ещё')!.click());expect(apiFetch).toHaveBeenLastCalledWith('/admin/audit?limit=50&cursor=opaque-cursor');expect(container.textContent).toContain('first');expect(container.textContent).toContain('second');expect(container.textContent).not.toContain('Показать ещё');});

it('searches the whole journal automatically with one field and resets the cursor',async()=>{
 await act(async()=>root.render(page()));
 expect(container.querySelectorAll('input')).toHaveLength(1);
 const input=container.querySelector('input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Горный 24.09.2026');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,400));});
 expect(apiFetch).toHaveBeenLastCalledWith('/admin/audit?limit=50&q='+encodeURIComponent('Горный').replace(/%20/g,'+')+'+24.09.2026');
 expect(container.textContent).not.toContain('Дополнительные фильтры');
});

it('opens a record card with server changes, reason and command id; embedded journal filters by event without page chrome',async()=>{
 vi.mocked(apiFetch).mockImplementation(async()=>({items:[{id:'7',at:'2026-09-20T10:00:05Z',actor:{type:'user',userId:'701'},action:'event.reschedule',target:{type:'event',id:'1038'},subjectId:null,organizerId:'1',eventId:'1038',changes:{startsAt:{before:'10:30',after:'10:40'}},reason:'Перенос старта',commandId:'cmd-1'}],nextCursor:null}));
 await act(async()=>root.render(page({eventId:'1038'})));
 expect(apiFetch).toHaveBeenLastCalledWith('/admin/audit?limit=50&eventId=1038');
 expect(container.querySelector('h1')).toBeNull();
 await act(async()=>(container.querySelector('tbody tr') as HTMLElement).click());
 expect(container.textContent).toContain('cmd-1');expect(container.textContent).toContain('Перенос старта');
 expect(container.textContent).toContain('startsAt');expect(container.textContent).toContain('10:40');
 await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='← Журнал действий')!.click());
 expect(container.querySelector('tbody tr')).not.toBeNull();
});
