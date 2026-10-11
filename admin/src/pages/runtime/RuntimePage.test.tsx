// @vitest-environment jsdom
import {act,render,screen,waitFor} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {RuntimePage} from './RuntimePage';
const stream=vi.hoisted(()=>({listener:null as null | ((message: {type:string;payload:Record<string,unknown>})=>void),off:vi.fn()}));
const fetcher=vi.hoisted(()=>vi.fn());vi.mock('../../shared/api',()=>({apiFetch:fetcher}));
describe('Runtime monitoring',()=>{it('uses the authorized projection and displays unknown connection without inferring a crash',async()=>{
 fetcher.mockResolvedValue({daemonId:'daemon',status:'STALE',receivedAt:null,checkedAt:'2040-01-01T00:00:00Z',stale:true,slots:[],queue:[],metrics:null,sessions:[{id:'1',status:'RUNNING',serverId:'server_01',runtimeRunId:'run_1',connectionLostAt:'2040-01-01T00:00:00Z',failure:null,resultsPending:false}]});
 const view=render(<RuntimePage/>);await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/admin/runtime/ac/daemon'));
 expect(await screen.findByText('Уточнение состояния')).toBeTruthy();expect(screen.getByText('Сведения устарели')).toBeTruthy();view.unmount();
});});

vi.mock('../../shared/realtime',()=>({useRealtimeStatus:()=>true,realtime:{subscribe:vi.fn((channel,listener)=>{expect(channel).toBe('admin:runtime');stream.listener=listener;return stream.off;})}}));

it('updates from websocket snapshots without issuing another HTTP read and unsubscribes on exit',async()=>{
 fetcher.mockClear();stream.off.mockClear();
 const snapshot={daemonId:'daemon',status:'CURRENT',receivedAt:null,checkedAt:'2040-01-01T00:00:00Z',stale:false,slots:[],queue:[],metrics:null,sessions:[]};
 fetcher.mockResolvedValue(snapshot);const view=render(<RuntimePage/>);
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
 const view=render(<RuntimePage/>);
 expect(await screen.findByText('Запущен · PID 1234')).toBeTruthy();
 expect(screen.getByText('Занят')).toBeTruthy();expect(screen.getByText('Событие #42')).toBeTruthy();
 expect(screen.queryByText('ALLOCATED')).toBeNull();expect(screen.queryByText('неизвестно')).toBeNull();
 view.unmount();
});
