// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { AccessPage } from './AccessPage';
import { apiFetch } from '../../shared/api';
import type { AdminAccess } from '../../shared/types';
vi.mock('../../shared/api',()=>({apiFetch:vi.fn(),ApiError:class extends Error{},putJsonBody:(v:unknown)=>({method:'PUT',body:JSON.stringify(v)})}));
vi.mock('../../shared/realtime',()=>({useRealtimeRefresh:()=>{},subscribeAdminRefresh:()=>()=>{}}));
let root:Root,container:HTMLDivElement;
const organizer={id:'9007199254740993',version:'original-version',code:'club',name:'Club',description:null,active:true,settings:{maxEvents:5,maxRaceEvents:null,maxConcurrentEvents:null,maxConcurrentRaces:null,quotaEnforcementMode:'block',allowedEventRuntimeTypes:[],allowedTougeSubtypes:[],allowedTougeDuelEntryModes:[],websiteUrl:null,discordUrl:null,theme:null},actions:{edit:false,editPresentation:true},usage:null,remaining:null};
const access={userId:'1',panelAccess:true,grants:[{permissions:['panel.access','organizers.read.scoped','organizers.presentation.write.scoped']}]} as AdminAccess;
const admin={...access,grants:[{...access.grants[0],permissions:['access.manage.all','organizers.write.all']}]} as AdminAccess;
const role={code:'server-role',title:'Роль с сервера',description:'Описание с сервера',scopeTypes:['organizer'],permissions:['panel.access']};
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);vi.mocked(apiFetch).mockImplementation(async(path,init)=>init?.method?{...organizer,version:'changed'}:path.endsWith('/roles')?{items:[role]}:[organizer]);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const mount=(value:AdminAccess,entry='/access')=>act(async()=>root.render(createElement(MemoryRouter,{initialEntries:[entry]},createElement(AccessPage,{access:value}))));
async function click(text:string){const b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent===text)!;expect(b).toBeTruthy();await act(async()=>b.click());}
const type=(input:HTMLInputElement|HTMLTextAreaElement,value:string)=>act(async()=>fireEvent.change(input,{target:{value}}));

it('scoped organizer owner sees presentation only and sends separate versioned PUT without quota fields',async()=>{
 await mount(access);expect(container.textContent).toContain('Club');expect(container.textContent).not.toContain('Доступы пользователей');expect(container.textContent).not.toContain('＋ Организатор');
 await click('Оформление');expect(container.textContent).not.toContain('При превышении квоты');expect(container.textContent).not.toContain('Всего событий');expect(container.textContent).not.toContain('Настройки и квоты');
 await type(container.querySelector('textarea')!,'Новое описание');
 await click('Сохранить изменения');const request=vi.mocked(apiFetch).mock.calls.find(([,i])=>i?.method==='PUT')!;expect(request[0]).toBe('/admin/access/organizers/9007199254740993/presentation');expect(new Headers(request[1]?.headers).get('If-Match')).toBe('original-version');expect(new Headers(request[1]?.headers).get('Idempotency-Key')).toBeTruthy();expect(Object.keys(JSON.parse(String(request[1]?.body))).sort()).toEqual(['name','description','theme','websiteUrl','discordUrl'].sort());
});
it('no hardcoded grants query or role catalog is used on mount',async()=>{
 await mount(admin);
 expect(apiFetch).toHaveBeenCalledWith('/admin/access/roles');expect(vi.mocked(apiFetch).mock.calls.some(([p])=>p.startsWith('/admin/access/grants'))).toBe(false);
 await click('Роли1');expect(container.textContent).toContain('Роль с сервера');
 await click('Доступы пользователей');expect(container.querySelector('input[placeholder="Имя, SteamID или ID пользователя"]')).toBeTruthy();
 expect(vi.mocked(apiFetch).mock.calls.some(([p])=>p.startsWith('/admin/access/grants'))).toBe(false);
});
it('null organizer limits are shown as no limit, never as zero',async()=>{
 vi.mocked(apiFetch).mockImplementation(async path=>path.endsWith('/roles')?{items:[]}:[{...organizer,settings:{...organizer.settings,maxEvents:null}}]);
 await mount(admin);expect(container.textContent).toContain('Без ограничений');expect(container.textContent).not.toContain(': 0');
});
it('user search uses userId returned by the profile API without numeric conversion',async()=>{
 vi.mocked(apiFetch).mockImplementation(async path=>path.endsWith('/roles')?{items:[]}:path.startsWith('/admin/users?')?{items:[{userId:'9007199254740995',presentation:{displayName:'Found pilot'}}]}:[]);
 await mount(admin);await click('Доступы пользователей');
 await click('Found pilot');expect(apiFetch).toHaveBeenCalledWith('/admin/access/grants?subjectId=9007199254740995');
});

const existingGrant={id:'9007199254740997',version:'grant-version',subjectId:'9007199254740995',roleCode:'server-role',scopeType:'organizer',scopeId:organizer.id,validFrom:null,validTo:null,constraints:null,revokedAt:null,status:'active'};
async function mountUserGrant(entry?:string){
 vi.mocked(apiFetch).mockImplementation(async(path,init)=>init?.method?existingGrant:path.endsWith('/roles')?{items:[role]}:path.startsWith('/admin/users?')?{items:[{userId:existingGrant.subjectId,presentation:{displayName:'Found pilot'}}]}:path.startsWith('/admin/users/')?{userId:existingGrant.subjectId,presentation:{displayName:'Found pilot'}}:path.startsWith('/admin/access/grants?')?[existingGrant]:[organizer]);
 if(entry){await mount(admin,entry);return;}
 await mount(admin);await click('Доступы пользователей');
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
it('opens a user from ?userId= and sets the admin password without keeping it in the form',async()=>{
 await mountUserGrant('/access?userId='+existingGrant.subjectId);
 expect(apiFetch).toHaveBeenCalledWith('/admin/users/'+existingGrant.subjectId);expect(container.textContent).toContain('Found pilot');
 await click('Пароль админки');
 const input=container.querySelector<HTMLInputElement>('input[type="password"]')!;await type(input,'secret-test-value');
 await click('Установить пароль');
 const request=vi.mocked(apiFetch).mock.calls.find(([path])=>path==='/admin/auth/password')!;
 expect(JSON.parse(String(request[1]?.body))).toEqual({userId:existingGrant.subjectId,adminPassword:'secret-test-value'});
 expect(container.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe('');expect(container.textContent).toContain('Пароль изменён.');
});
