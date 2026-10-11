// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ContentSelectionFields} from './ContentSelectionFields';
import catalog from './fixtures/catalog.json';
import type {Settings} from './types';
const api=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('../../shared/api',()=>({apiFetch:api.call}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('weather creation keeps the document on error and retries the identical command before selecting the saved preset',async()=>{
  let failures=1;const writes:{body:string;headers:Record<string,string>}[]=[];
  api.call.mockImplementation(async(path:string,options?:any)=>{
    if(path.startsWith('/games/'))return [];
    writes.push(options);if(failures-->0)throw new Error('Нет связи');
    return {id:'42',currentVersionId:'43',...JSON.parse(options.body)};
  });
  const change=vi.fn(),value=structuredClone(catalog.items[0].defaults.game) as Settings;
  render(<ContentSelectionFields value={value} organizerId="7" disabled={false} onChange={change}/>);
  fireEvent.click(screen.getByRole('button',{name:'Создать пресет'}));
  fireEvent.change(screen.getByLabelText('Название'),{target:{value:'Ясный день'}});
  fireEvent.click(screen.getByRole('button',{name:'Сохранить и выбрать'}));
  await screen.findAllByText('Нет связи');expect(change).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Ясный день');
  fireEvent.click(screen.getByRole('button',{name:'Сохранить и выбрать'}));
  await waitFor(()=>expect(change).toHaveBeenCalledTimes(1));
  expect(writes[1].body).toBe(writes[0].body);expect(writes[1].headers['Idempotency-Key']).toBe(writes[0].headers['Idempotency-Key']);
  expect(JSON.parse(writes[1].body)).toMatchObject({ownerType:'organizer',ownerId:'7'});
  expect(change.mock.calls[0][0].catalogChoices.weatherCodes).toEqual([JSON.parse(writes[1].body).code]);
  expect(change.mock.calls[0][0].environment.weather).toMatchObject({mode:'FIXED',ambientVariation:2,roadVariation:3});
});
