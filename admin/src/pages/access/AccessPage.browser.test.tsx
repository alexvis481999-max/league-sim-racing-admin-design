// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { AccessPage } from './AccessPage';
import { apiFetch } from '../../shared/api';
import type { AdminAccess } from '../../shared/types';
vi.mock('../../shared/api',()=>({apiFetch:vi.fn(),ApiError:class extends Error{},putJsonBody:(v:unknown)=>({method:'PUT',body:JSON.stringify(v)})}));
let root:Root,container:HTMLDivElement;
const organizer={id:'9007199254740993',version:'original-version',code:'club',name:'Club',description:null,active:true,settings:{maxEvents:5,maxRaceEvents:null,maxConcurrentEvents:null,maxConcurrentRaces:null,quotaEnforcementMode:'block',allowedEventRuntimeTypes:[],allowedTougeSubtypes:[],allowedTougeDuelEntryModes:[],websiteUrl:null,discordUrl:null,theme:null},actions:{edit:false,editPresentation:true},usage:null,remaining:null};
const access={userId:'1',panelAccess:true,grants:[{permissions:['panel.access','organizers.read.scoped','organizers.presentation.write.scoped']}]} as AdminAccess;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);vi.mocked(apiFetch).mockImplementation(async(path,init)=>init?.method?{...organizer,version:'changed'}:path.endsWith('/roles')?{items:[{code:'server-role',title:'Роль с сервера',description:'Описание с сервера',scopeTypes:['organizer'],permissions:['panel.access']}]}:[organizer]);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function click(text:string){const b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent===text)!;expect(b).toBeTruthy();await act(async()=>b.click());}
it('scoped organizer owner sees presentation only and sends separate versioned PUT without quota fields',async()=>{
 await act(async()=>root.render(createElement(AccessPage,{access})));expect(container.textContent).toContain('Club');expect(container.textContent).not.toContain('Роли пользователя');
 await click('Оформление');const dialog=document.querySelector('[role="dialog"]')!;expect(dialog.textContent).not.toContain('При превышении квоты');expect(dialog.textContent).not.toContain('Всего событий');
 await click('Сохранить');const request=vi.mocked(apiFetch).mock.calls.find(([,i])=>i?.method==='PUT')!;expect(request[0]).toBe('/admin/access/organizers/9007199254740993/presentation');expect(new Headers(request[1]?.headers).get('If-Match')).toBe('original-version');expect(new Headers(request[1]?.headers).get('Idempotency-Key')).toBeTruthy();expect(Object.keys(JSON.parse(String(request[1]?.body))).sort()).toEqual(['name','description','theme','websiteUrl','discordUrl'].sort());
});
it('no hardcoded grants query or role catalog is used on mount',async()=>{
 await act(async()=>root.render(createElement(AccessPage,{access:{...access,grants:[{...access.grants[0],permissions:['access.manage.all','organizers.write.all']}]}})));
 expect(apiFetch).toHaveBeenCalledWith('/admin/access/roles');expect(vi.mocked(apiFetch).mock.calls.some(([p])=>p==='/admin/access/grants')).toBe(false);expect(container.textContent).toContain('Роль с сервера');expect(container.querySelector('input[placeholder="Имя, SteamID или ID пользователя"]')).toBeTruthy();
});
it('user search uses userId returned by the profile API without numeric conversion',async()=>{
 vi.mocked(apiFetch).mockImplementation(async path=>path.endsWith('/roles')?{items:[]}:path.startsWith('/admin/users?')?{items:[{userId:'9007199254740995',presentation:{displayName:'Found pilot'}}]}:[]);
 await act(async()=>root.render(createElement(AccessPage,{access:{...access,grants:[{...access.grants[0],permissions:['access.manage.all','organizers.write.all']}]}})));
 await click('Found pilot');expect(apiFetch).toHaveBeenCalledWith('/admin/access/grants?subjectId=9007199254740995');
});

vi.mock('../../shared/realtime',()=>({useRealtimeRefresh:()=>{},subscribeAdminRefresh:()=>()=>{}}));

const existingGrant={id:'9007199254740997',version:'grant-version',subjectId:'9007199254740995',roleCode:'server-role',scopeType:'organizer',scopeId:organizer.id,validFrom:null,validTo:null,constraints:null,revokedAt:null,status:'active'};
async function mountUserGrant(){
 vi.mocked(apiFetch).mockImplementation(async(path,init)=>init?.method?existingGrant:path.endsWith('/roles')?{items:[{code:'server-role',title:'Роль с сервера',description:'Описание с сервера',scopeTypes:['organizer'],permissions:['panel.access']}]}:path.startsWith('/admin/users?')?{items:[{userId:existingGrant.subjectId,presentation:{displayName:'Found pilot'}}]}:path.startsWith('/admin/access/grants?')?[existingGrant]:[organizer]);
 await act(async()=>root.render(createElement(AccessPage,{access:{...access,grants:[{...access.grants[0],permissions:['access.manage.all','organizers.write.all']}]}})));
 await click('Found pilot');
}
it('edits a grant with the current API fields, original version and Moscow time',async()=>{
 await mountUserGrant();await click('Изменить');
 const date=document.querySelector('input[type="datetime-local"]')!;
 await act(async()=>fireEvent.change(date,{target:{value:'2026-10-01T12:00'}}));
 await click('Сохранить доступ');
 const request=vi.mocked(apiFetch).mock.calls.find(([,init])=>init?.method==='PUT')!;
 expect(request[0]).toBe('/admin/access/grants/'+existingGrant.id);
 expect(new Headers(request[1]?.headers).get('If-Match')).toBe(existingGrant.version);
 expect(new Headers(request[1]?.headers).get('Idempotency-Key')).toBeTruthy();
 expect(JSON.parse(String(request[1]?.body))).toEqual({subjectId:existingGrant.subjectId,roleCode:'server-role',scopeType:'organizer',scopeId:organizer.id,validFrom:'2026-10-01T09:00:00.000Z',validTo:null,constraints:null});
});
it('revokes a grant through versioned DELETE without a request body',async()=>{
 await mountUserGrant();await click('Отозвать');
 const request=vi.mocked(apiFetch).mock.calls.find(([,init])=>init?.method==='DELETE')!;
 expect(request[0]).toBe('/admin/access/grants/'+existingGrant.id);
 expect(new Headers(request[1]?.headers).get('If-Match')).toBe(existingGrant.version);
 expect(new Headers(request[1]?.headers).get('Idempotency-Key')).toBeTruthy();expect(request[1]?.body).toBeUndefined();
});
