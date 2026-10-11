import type { BlockDefinition } from '../blocks/contracts/blocks.contract';
import type { BlockExecutionRecord } from '../blocks/contracts/block-execution.contract';
import type { RuntimeStatusSource as RuntimeSessionRecord } from '../runtime/runtime-status.contract';
import { runtimeDisplayStatus,statusView,type DisplayStatus } from '../runtime/runtime-status.contract';
export type {DisplayStatus};
export interface ProgressView extends Omit<import('../blocks/contracts/blocks-module.contract').BlockProgressNode,'children'> {displayStatus:DisplayStatus;children:ProgressView[]}
export function progressDisplayStatus(nodes:readonly import('../blocks/contracts/blocks-module.contract').BlockProgressNode[],sessions:readonly RuntimeSessionRecord[],now:string):ProgressView[] {
  const labels:Record<string,string>={PENDING:'Запланировано',REQUESTED:'Запуск запрошен',PREPARING:'Подготовка',RUNNING:'Выполняется',PRACTICE:'Практика',QUALIFYING:'Квалификация',RACE_1:'Гонка',RACE_2:'Вторая гонка',COMPLETED:'Завершено',FINISHED:'Завершено',FAILED:'Не состоялось',CANCELLED:'Отменено',BYE:'Проход без соперника',TIED:'Ничья',NOT_RUN:'Не проводился',DISQUALIFIED:'Дисквалификация'};
  return nodes.map(node=>{
    const session=sessions.find(s=>s.id===node.runtimeSessionId);
    const terminal=['COMPLETED','FINISHED','FAILED','CANCELLED','BYE','TIED','NOT_RUN','DISQUALIFIED'].includes(node.status);
    const displayStatus=!terminal&&session?runtimeDisplayStatus(session,now):statusView(node.status,labels[node.status],now);
    return {...node,displayStatus,children:progressDisplayStatus(node.children,sessions,now)};
  });
}
export interface StatusBlock {key:string;title:string;type:string;plannedStartsAt:string;displayStatus:DisplayStatus}
const final = ['COMPLETED','CANCELLED','FAILED','SKIPPED'];
export function blockDisplayStatus(def:BlockDefinition,execution:BlockExecutionRecord|null,sessions:readonly RuntimeSessionRecord[],now:string):DisplayStatus {
  const raw=execution?.status;
  const reason=execution?.statusReason;
  if(raw && final.includes(raw)) {
    const label=def.type==='PRACTICE'?({CANCELLED:'Практика отменена',FAILED:'Практика завершилась ошибкой',SKIPPED:'Практика пропущена',COMPLETED:'Практика завершена'} as Record<string,string>)[raw]:({CANCELLED:'Отменён',FAILED:'Не состоялся',SKIPPED:'Пропущен',COMPLETED:'Завершён'} as Record<string,string>)[raw];
    const messages:Record<string,string>={INSUFFICIENT_PARTICIPANTS:'Недостаточно участников.',SESSION_FAILED:'Техническая ошибка игрового сервера.',SESSION_ENDED_WITHOUT_REQUIRED_OUTPUT:'Сервер завершился без необходимого результата.',ALL_INTERNAL_SESSIONS_FAILED:'Не удалось завершить заезды.',ADMIN_CANCELLED:'Отменено администратором.',OWNER_CANCELLED:'Отменено владельцем события.'};
    return statusView(raw,label,now,execution!.finishedAt,raw==='COMPLETED'?null:{code:reason!.code,message:reason!.message??messages[reason!.code]??'Исполнение завершено по правилам события.'});
  }
  if(def.type==='TIME_ATTACK') {
    if(Date.parse(now)<Date.parse(def.schedule.startsAt))return statusView('SCHEDULED','Окно ещё не открыто',now);
    if(Date.parse(now)>=Date.parse(def.attemptWindowClosesAt))return statusView('FINISHING','Окно закрыто · завершение',now,def.attemptWindowClosesAt);
    return statusView('OPEN','Окно попыток открыто',now,def.schedule.startsAt);
  }
  const active=sessions.filter(s=>!['STOPPED','CANCELLED','FAILED'].includes(s.status));
  const states=active.map(s=>runtimeDisplayStatus(s,now));
  const unknown=states.find(s=>s.code==='UNKNOWN');if(unknown)return unknown;
  const running=active.filter(s=>s.status==='RUNNING'&&!s.stopRequestedAt);
  if(running.length) {
    const phases=running.map(s=>runtimeDisplayStatus(s,now));
    if(def.type==='PRACTICE')return phases.every(s=>s.code==='PROCESSING')?statusView('FINISHING','Практика завершается',now):statusView('OPEN','Практика открыта',now,execution?.startedAt??null);
    if(phases.every(s=>s.code===phases[0].code))return phases[0];
    return statusView('RUNNING','Заезды идут',now,execution?.startedAt??null);
  }
  if(states.some(s=>s.code==='FINISHING'))return states.find(s=>s.code==='FINISHING')!;
  if(sessions.length && sessions.every(s=>['STOPPED','CANCELLED','FAILED'].includes(s.status)))
    return statusView('PROCESSING','Завершение и обработка',now,sessions.map(s=>s.stoppedAt).filter((x):x is string=>!!x).sort().at(-1)??null);
  if(states.length)return states[0];
  if(raw==='WAITING')return statusView('WAITING','Ожидание готовности заезда',now);
  return statusView('SCHEDULED',def.type==='PRACTICE'?'Практика запланирована':'Заезд запланирован',now);
}
export function eventDisplayStatus(event:{status:string;scenarioCode:string;completion?:{completedAt:string}|null},blocks:readonly StatusBlock[],now:string,context?:{stop?:{reason:string;requestedAt:string}|null;failure?:string|null}):DisplayStatus & {currentStage:{key:string;title:string}|null} {
  const ordered=[...blocks].sort((a,b)=>Date.parse(a.plannedStartsAt)-Date.parse(b.plannedStartsAt)||a.key.localeCompare(b.key));
  const relevant=event.scenarioCode==='circuit_single_race'?ordered.filter(b=>b.type==='RACE'):ordered;
  const current=relevant.find(b=>!final.includes(b.displayStatus.code)&&!['SCHEDULED','WAITING'].includes(b.displayStatus.code))??relevant.find(b=>!final.includes(b.displayStatus.code));
  const currentStage=current?{key:current.key,title:current.title}:null;
  const wrap=(s:DisplayStatus)=>({...s,currentStage});
  const titles:Record<string,string>={championship:'Чемпионат',weekly:'Серия',double_elimination_tournament:'Турнир'};
  const title=titles[event.scenarioCode];
  if(['CANCELLED','FAILED','COMPLETED','DRAFT'].includes(event.status)) {
    const label=event.status==='CANCELLED'?(title?`${title} ${title==='Серия'?'отменена':'отменён'}`:'Отменено'):event.status==='FAILED'?(title?`${title}: ошибка`:'Не состоялось'):event.status==='DRAFT'?'Черновик':title?`${title} ${title==='Серия'?'завершена':'завершён'}`:'Завершено';
    const failedBlock=context?.failure?.startsWith('BLOCK_FAILED:')?blocks.find(b=>b.key===context.failure!.slice('BLOCK_FAILED:'.length)):null;
    const reason=event.status==='CANCELLED'&&context?.stop?{code:'CANCELLED',message:context.stop.reason}:event.status==='FAILED'&&context?.failure?{code:context.failure,message:failedBlock?`Обязательный этап «${failedBlock.title}» завершился ошибкой.`:context.failure.startsWith('PRIMARY_RESULT_')?'Не удалось подготовить итоговый результат события.':'Не удалось завершить событие по его правилам.'}:null;
    return {...statusView(event.status,label,now,event.status==='CANCELLED'?context?.stop?.requestedAt??null:event.completion?.completedAt??null,reason),currentStage:null};
  }
  if(!title && relevant.length===1)return wrap(relevant[0].displayStatus);
  if(!current && relevant.length)return wrap(statusView('FINISHING','Завершение…',now));
  if(title) {
    const begun=relevant.some(b=>!['SCHEDULED','WAITING'].includes(b.displayStatus.code));
    const uncertain=relevant.some(b=>b.displayStatus.freshness==='UNCERTAIN');
    return wrap(statusView(uncertain?'UNKNOWN':begun?'RUNNING':'SCHEDULED',uncertain?`${title}: состояние уточняется`:begun?`${title} идёт`:`${title}: запланировано`,now));
  }
  return wrap(current?.displayStatus??statusView('SCHEDULED','Запланировано',now));
}
/** Group identity follows the materialized scenario's canonical keys, not frontend guesses. */
export function blockGroup(scenario:string,key:string,title:string,tournament?:{bracket:string;round:number}|null) {
  if(scenario==='championship') {
    const stage=/^stage-(\d+)-(?:practice|race)$/.exec(key);
    if(stage)return {key:`stage-${stage[1]}`,title:title.replace(/: (?:гонка|практика)$/u,''),kind:'STAGE'};
  }
  if(tournament)return {key:`${tournament.bracket}-${tournament.round}`,title:`${tournament.bracket==='UPPER'?'Основная сетка':tournament.bracket==='LOWER'?'Нижняя сетка':'Финал'} · раунд ${tournament.round}`,kind:'ROUND'};
  return null;
}
