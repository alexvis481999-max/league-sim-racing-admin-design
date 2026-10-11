// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {AuditPage} from './AuditPage';
import {apiFetch} from '../../shared/api';
vi.mock('../../shared/api',async()=>({...await vi.importActual('../../shared/api'),apiFetch:vi.fn()}));
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);vi.mocked(apiFetch).mockImplementation(async path=>({items:[{id:path.includes('cursor')?'2':'3',at:'2026-09-20T10:00:00Z',actor:{type:'system',userId:null},action:path.includes('cursor')?'second':'first',target:{type:'grant',id:'9007199254740993'}}],nextCursor:path.includes('cursor')?null:'opaque-cursor'}));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('appends server cursor page and preserves exact string identifiers and system actor',async()=>{await act(async()=>root.render(createElement(AuditPage)));expect(container.textContent).toContain('Система');expect(container.textContent).toContain('9007199254740993');await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Показать ещё')!.click());expect(apiFetch).toHaveBeenLastCalledWith('/admin/audit?limit=50&cursor=opaque-cursor');expect(container.textContent).toContain('first');expect(container.textContent).toContain('second');expect(container.textContent).not.toContain('Показать ещё');});

it('searches the whole journal automatically with one field and resets the cursor',async()=>{
 await act(async()=>root.render(createElement(AuditPage)));
 expect(container.querySelectorAll('input')).toHaveLength(1);
 const input=container.querySelector('input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Горный 24.09.2026');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,400));});
 expect(apiFetch).toHaveBeenLastCalledWith('/admin/audit?limit=50&q='+encodeURIComponent('Горный').replace(/%20/g,'+')+'+24.09.2026');
 expect(container.textContent).not.toContain('Дополнительные фильтры');
});
