import { describe,it,expect } from 'vitest';
import {activeSession,processFor,plannedPeak,type Snapshot,type Reservation} from './runtime-monitoring';
describe('runtime monitoring',()=>{
 it('matches daemon server codes instead of backend slot IDs and selects the assigned session',()=>{
  const slot={serverId:'server-1',serverCode:'server_01',state:'ALLOCATED',currentRuntimeSessionId:'2'};
  const data={slots:[slot],sessions:[{id:'1',serverId:'server-1',status:'STOPPED'},{id:'2',serverId:'server-1',status:'RUNNING'}],metrics:{servers:[{serverId:'server_01',status:'running',pid:42}]}} as Snapshot;
  expect(processFor(data,slot)?.pid).toBe(42);expect(activeSession(data,slot)?.id).toBe('2');
 });
 it('counts overlapping reservations without double-counting adjacent windows or released reserves',()=>{
  const r=(id:string,start:number,end:number,count:number,status='SCHEDULED'):Reservation=>({id,owner:{type:'EVENT',id:'1'},startsAt:new Date(start*1000).toISOString(),estimatedEndsAt:new Date(end*1000).toISOString(),serverCount:count,status});
  expect(plannedPeak([r('1',0,10,2),r('2',10,20,3)],new Date(0).toISOString())).toBe(3);
  expect(plannedPeak([r('1',0,15,2),r('2',10,20,3),r('3',0,50,100,'RELEASED')],new Date(0).toISOString())).toBe(5);
  expect(plannedPeak([r('1',0,10,2)],new Date(10000).toISOString())).toBe(0);
 });
});
