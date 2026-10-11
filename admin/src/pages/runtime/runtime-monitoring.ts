export type Session = {
  displayStatus?: import('../../../../shared/event-status').DisplayStatus;
  id:string;status:string;serverId:string|null;runtimeRunId:string|null;connectionLostAt:string|null;
  capacityWaitDeadlineAt:string;failure:{code:string}|null;startedAt?:string|null;stoppedAt?:string|null;
  plannedStartsAt?:string|null;estimatedEndsAt?:string|null;reservationId?:string|null;connectedPlayers?:number|null;sessionTypes?:string[];
};
export type Reservation={id:string;owner:{type:string;id:string};serverCount:number;startsAt:string;estimatedEndsAt:string;status:string};
export type Snapshot={daemonId:string;status:string;receivedAt:string|null;checkedAt:string;stale:boolean;
 queue:{runtimeSessionId:string;plannedStartsAt:string|null;requestedAt:string;reservationId:string|null}[];
 slots:{serverId:string;serverCode?:string;state:string;currentRuntimeSessionId?:string|null;availableAt?:string}[];
 sessions:Session[];reservations?:Reservation[];
 metrics:{uptimeSeconds?:number;plugin?:{status:string};process:{pid?:number;cpuPercent:number;memoryRssBytes:number;memoryHeapUsedBytes?:number};system:{platform?:string;arch?:string;cpuCount?:number;loadAverage?:number[];cpuPercent:number;memoryFreeBytes:number;memoryTotalBytes?:number};servers:{serverId:string;status:string;pid:number|null;runtimeSessionRefId?:string|null;runtimeRunId?:string|null}[]}|null;
};
export function activeSession(data:Snapshot,slot:Snapshot['slots'][number]) {
 return data.sessions.find(s=>s.id===slot.currentRuntimeSessionId) ?? data.sessions.find(s=>s.serverId===slot.serverId&&!['STOPPED','CANCELLED','FAILED'].includes(s.status));
}
export function processFor(data:Snapshot,slot:Snapshot['slots'][number]) {
 return data.metrics?.servers.find(s=>s.serverId===(slot.serverCode??slot.serverId));
}
export function sessionTitle(session:Session) {
 const types=session.sessionTypes??[];
 return types.length===1&&types[0]==='PRACTICE'?'Практика':types.includes('RACE')?'Гоночная сессия':'Сессия';
}
export function plannedPeak(reservations:Reservation[],now:string) {
 const points=reservations.filter(r=>['SCHEDULED','ACTIVE'].includes(r.status)&&Date.parse(r.estimatedEndsAt)>Date.parse(now)).flatMap(r=>[
  {at:Math.max(Date.parse(now),Date.parse(r.startsAt)),delta:r.serverCount}, {at:Date.parse(r.estimatedEndsAt),delta:-r.serverCount},
 ]).sort((a,b)=>a.at-b.at||a.delta-b.delta);
 let count=0,peak=0;for(const point of points){count+=point.delta;peak=Math.max(peak,count);}return peak;
}
