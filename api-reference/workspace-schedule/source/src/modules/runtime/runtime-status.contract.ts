import type { RuntimeSessionRecord } from './runtime.contract';

/** A read projection of evidence, never an independently stored lifecycle. */
export interface DisplayStatus {
  code: string;
  label: string;
  reason: {code:string;message:string} | null;
  effectiveAt: string | null;
  observedAt: string;
  freshness: 'CURRENT' | 'UNCERTAIN';
}
export function statusView(code:string,label:string,observedAt:string,effectiveAt:string|null=null,reason:DisplayStatus['reason']=null):DisplayStatus {
  return {code,label,reason,effectiveAt,observedAt,freshness:code==='UNKNOWN'?'UNCERTAIN':'CURRENT'};
}
const phaseLabels:Record<string,string>={PRACTICE:'Практика',QUALIFYING:'Квалификация',QUALIFICATION:'Квалификация',RACE:'Гонка',RACE_1:'Гонка',RACE_2:'Вторая гонка',DUEL:'Дуэль'};
/** Only explicit phase names from the game protocol; an unknown value is not a race. */
export function confirmedRuntimePhase(value:string):string|null {
  const code=value.trim().toUpperCase();
  return ({PRACTICE:'PRACTICE',QUALIFY:'QUALIFYING',QUALIFYING:'QUALIFYING',QUALIFICATION:'QUALIFYING',RACE:'RACE_1',RACE_1:'RACE_1',RACE_2:'RACE_2',DUEL:'DUEL',FINISHED:'FINISHED'} as Record<string,string>)[code]??null;
}
export type RuntimeStatusSource=Pick<RuntimeSessionRecord,'id'|'failure'|'stoppedAt'|'connectionLostAt'|'stopRequestedAt'|'phase'|'startedAt'|'capacityWaitStartedAt'|'allocatedAt'> & {status:`${RuntimeSessionRecord['status']}`};
export function runtimeDisplayStatus(s:RuntimeStatusSource,observedAt:string):DisplayStatus {
  if(s.status==='CANCELLED')return statusView('CANCELLED','Отменён',observedAt,s.stoppedAt);
  if(s.status==='FAILED' || s.failure)return statusView('FAILED','Ошибка сервера',observedAt,s.stoppedAt,{code:s.failure?.code??'SESSION_FAILED',message:'Не удалось штатно выполнить запуск.'});
  if(s.status==='STOPPED')return statusView('STOPPED','Сервер остановлен',observedAt,s.stoppedAt);
  if(s.connectionLostAt)return statusView('UNKNOWN','Состояние уточняется',observedAt,s.connectionLostAt,{code:'CONNECTION_LOST',message:'Нет подтверждённого актуального состояния сервера.'});
  if(s.stopRequestedAt || s.status==='STOPPING')return statusView('FINISHING','Завершение…',observedAt,s.stopRequestedAt);
  if(s.status==='RUNNING') {
    if(s.phase?.code==='FINISHED')return statusView('PROCESSING','Обработка результатов',s.phase.observedAt,s.phase.effectiveAt);
    if(s.phase && phaseLabels[s.phase.code])return statusView(s.phase.code,phaseLabels[s.phase.code],s.phase.observedAt,s.phase.effectiveAt);
    return statusView('RUNNING','Сервер работает',observedAt,s.startedAt);
  }
  if(s.status==='WAITING_CAPACITY')return statusView('WAITING_CAPACITY','Ожидание сервера',observedAt,s.capacityWaitStartedAt);
  return statusView('PREPARING','Подготовка сервера',observedAt,s.allocatedAt);
}
