// @vitest-environment jsdom
import {act,render,screen,waitFor,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe,it,expect,vi} from 'vitest';
import {RuntimePage} from './RuntimePage';
const page=(path='/runtime')=><MemoryRouter initialEntries={[path]}><RuntimePage/></MemoryRouter>;
const stream=vi.hoisted(()=>({listener:null as null | ((message: {type:string;payload:Record<string,unknown>})=>void),off:vi.fn()}));
const fetcher=vi.hoisted(()=>vi.fn());vi.mock('../../shared/api',()=>({apiFetch:fetcher}));
describe('Runtime monitoring',()=>{it('uses the authorized projection and displays unknown connection without inferring a crash',async()=>{
 fetcher.mockResolvedValue({daemonId:'daemon',status:'STALE',receivedAt:null,checkedAt:'2040-01-01T00:00:00Z',stale:true,slots:[],queue:[],metrics:null,sessions:[{id:'1',status:'RUNNING',serverId:'server_01',runtimeRunId:'run_1',connectionLostAt:'2040-01-01T00:00:00Z',failure:null,resultsPending:false}]});
 const view=render(page('/runtime?tab=sessions'));await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/admin/runtime/ac/daemon'));
 expect(await screen.findByText('Уточнение состояния')).toBeTruthy();expect(screen.getByText('Сведения устарели')).toBeTruthy();view.unmount();
});});

vi.mock('../../shared/realtime',()=>({subscribeAdminRefresh:()=>()=>{},useRealtimeStatus:()=>true,realtime:{subscribe:vi.fn((channel,listener)=>{expect(channel).toBe('admin:runtime');stream.listener=listener;return stream.off;})}}));

it('updates from websocket snapshots without issuing another HTTP read and unsubscribes on exit',async()=>{
 fetcher.mockClear();stream.off.mockClear();
 const snapshot={daemonId:'daemon',status:'CURRENT',receivedAt:null,checkedAt:'2040-01-01T00:00:00Z',stale:false,slots:[],queue:[],metrics:null,sessions:[]};
 fetcher.mockResolvedValue(snapshot);const view=render(page());
 await screen.findByText('Связь установлена');
 act(()=>stream.listener!({type:'runtime.snapshot',payload:{...snapshot,stale:true,status:'STALE'}}));
 expect(screen.getByText('Сведения устарели')).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(1);
 act(()=>stream.listener!({type:'runtime.snapshot',payload:snapshot}));
 expect(screen.getByText('Связь установлена')).toBeTruthy();view.unmount();expect(stream.off).toHaveBeenCalledTimes(1);
});
it('shows running practice with daemon process identity and future capacity',async()=>{
 fetcher.mockResolvedValue({daemonId:'daemon',status:'CURRENT',receivedAt:'2040-01-01T00:00:00Z',checkedAt:'2040-01-01T00:00:00Z',stale:false,
 slots:[{serverId:'server-1',serverCode:'server_01',state:'ALLOCATED',currentRuntimeSessionId:'7'}],queue:[],
 sessions:[{id:'7',status:'RUNNING',serverId:'server-1',sessionTypes:['PRACTICE'],connectedPlayers:3,startedAt:'2040-01-01T00:00:00Z',estimatedEndsAt:null,displayStatus:{label:'Практика'}}],
 reservations:[{id:'1',owner:{type:'EVENT',id:'42'},serverCount:1,status:'SCHEDULED',startsAt:'2040-01-02T10:00:00Z',estimatedEndsAt:'2040-01-02T11:00:00Z'}],
 metrics:{process:{cpuPercent:0,memoryRssBytes:0},system:{cpuPercent:0,memoryFreeBytes:0},servers:[{serverId:'server_01',status:'running',pid:1234}]}});
 const view=render(page());
 expect(await screen.findByText('Запущен · PID 1234')).toBeTruthy();
 expect(screen.getByText('Занят')).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'Будущая нагрузка'}));expect(screen.getByText('Событие №42')).toBeTruthy();
 expect(screen.queryByText('ALLOCATED')).toBeNull();expect(screen.queryByText('неизвестно')).toBeNull();
 view.unmount();
});

const base={daemonId:'daemon',status:'CURRENT',receivedAt:'2040-01-01T00:00:00Z',checkedAt:'2040-01-01T00:00:00Z',stale:false,queue:[],reservations:[]};
it('occupied slot without a process report is flagged for checking, not shown as stopped',async()=>{
 fetcher.mockResolvedValue({...base,slots:[{serverId:'server-1',serverCode:'server_01',state:'ALLOCATED',currentRuntimeSessionId:'7'}],
  sessions:[{id:'7',status:'RUNNING',serverId:'server-1',sessionTypes:['PRACTICE'],startedAt:'2040-01-01T00:00:00Z',displayStatus:{code:'PRACTICE',label:'Практика'}}],
  metrics:{process:{cpuPercent:0,memoryRssBytes:0},system:{cpuPercent:0,memoryFreeBytes:0},servers:[]}});
 const view=render(page('/runtime?slot=server-1'));
 expect(await screen.findByText(/Слот занят, но демон не подтверждает работающий процесс/)).toBeTruthy();
 expect(screen.getByText('Нет телеметрии server_01')).toBeTruthy();expect(screen.queryByText('Остановлен')).toBeNull();
 view.unmount();
});
it('sessionId from an event opens the sessions tab with that session highlighted',async()=>{
 fetcher.mockResolvedValue({...base,slots:[],metrics:null,sessions:[{id:'7',status:'RUNNING',serverId:null,sessionTypes:['RACE']},{id:'8',status:'RUNNING',serverId:null,sessionTypes:['RACE']}]});
 const view=render(page('/runtime?sessionId=8&eventId=3'));
 const row=(await screen.findByText('Гоночная сессия №8')).closest('tr')!;
 expect(row.getAttribute('aria-current')).toBe('true');expect(screen.getByText('Гоночная сессия №7').closest('tr')!.getAttribute('aria-current')).toBeNull();
 view.unmount();
});
it('practice journal link reads the owner game chat instead of the daemon projection',async()=>{
 fetcher.mockReset();fetcher.mockResolvedValue({items:[{id:'1',driverName:'Marko',message:'gg',occurredAt:'2040-01-01T00:00:00Z'}],nextCursor:null});
 const view=render(page('/service-journal?practiceServerId=5'));
 expect(await screen.findByText(/Marko: gg/)).toBeTruthy();
 expect(fetcher).toHaveBeenCalledWith('/admin/practice-servers/5/game-chat?limit=50');expect(fetcher).not.toHaveBeenCalledWith('/admin/runtime/ac/daemon');
 view.unmount();
});
