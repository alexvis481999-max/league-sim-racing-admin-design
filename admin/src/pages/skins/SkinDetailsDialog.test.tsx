// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,waitFor,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SkinDetailsDialog} from './SkinDetailsDialog';
import {apiFetch} from '../../shared/api';
import type {Skin} from './SkinsPage';
vi.mock('../../shared/api',async()=>({...await vi.importActual('../../shared/api'),apiFetch:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('shows creator and history and saves the selected car, tags and availability with the current revision',async()=>{
 const skin={id:1,gameCode:'assetto_corsa',carCode:'old',displayName:'Livery',folderName:'skin',tags:['ac'],active:true,ownerType:'official',visibility:'official',version:1,metadataVersion:2,createdByUser:{id:'7',firstName:'Иван',lastName:'Петров',steamName:'steam'},createdAt:null,updatedAt:'2026-09-29T10:00:00Z',allowedActions:{edit:true,moderate:false},history:[{metadataVersion:1,version:'1',displayName:'Old livery',carCode:'old',tags:['ac'],active:true,changedAt:null,actorId:null,archiveUrl:null}]} as unknown as Skin;
 const saved=vi.fn(async()=>{});
 vi.mocked(apiFetch).mockImplementation(async(path,init)=>path.includes('/games/')?[{code:'old',title:'Old car'},{code:'new',title:'New car'}]:init?skin:skin);
 render(<SkinDetailsDialog skin={skin} onClose={()=>{}} onSaved={saved} onDeleted={async()=>{}}/>);
 expect(await screen.findByText('Иван Петров · ID 7')).toBeTruthy();expect(await screen.findByText('Old livery')).toBeTruthy();
 const user=userEvent.setup();const car=screen.getByRole('combobox',{name:/Машина/});await user.click(car);await user.clear(car);await user.type(car,'New');await user.click(await screen.findByRole('option',{name:'New car'}));
 await user.click(screen.getByRole('button',{name:'acc',exact:true}));await user.click(screen.getByRole('switch',{name:'Доступен для нового выбора'}));await user.click(screen.getByRole('button',{name:'Сохранить'}));
 await waitFor(()=>expect(saved).toHaveBeenCalled());
 const call=vi.mocked(apiFetch).mock.calls.find(([,init])=>init?.method==='PATCH')!;
 expect(JSON.parse(String(call[1]!.body))).toEqual({expectedVersion:2,patch:{displayName:'Livery',carCode:'new',tags:['ac','acc'],active:false}});
});
