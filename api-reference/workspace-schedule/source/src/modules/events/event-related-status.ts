import {statusView} from '../runtime/runtime-status.contract';
import type {ResultRecord} from '../results/results.contract';
import {registrationStatusAt, type RegistrationState} from '../registration/registration.contract';

export function resultDisplayStatus(result:Pick<ResultRecord,'status'|'resolvedAt'|'reason'>,now:string) {
  const labels={WAITING:'Ожидается результат',READY:'Результат опубликован',UNAVAILABLE:'Результат недоступен',FAILED:'Ошибка обработки результата'};
  return statusView(result.status,labels[result.status],now,result.resolvedAt,
    result.reason?{code:result.status,message:result.reason}:null);
}
export function registrationDisplayStatus(registration:RegistrationState,now:string) {
  const {closesAt}=registration.definition.config;
  const effective=['CLOSED','CANCELLED'].includes(registration.status)||!registration.activatedAt?registration.status:registrationStatusAt(registration.definition.config,now);
  if(effective==='CANCELLED')return statusView('CANCELLED','Регистрация отменена',now,registration.cancelledAt);
  if(effective==='CLOSED')return statusView('CLOSED','Регистрация закрыта',now,registration.closedAt??closesAt);
  if(effective==='ACTIVE')return statusView('OPEN','Регистрация открыта',now,registration.activatedAt);
  return statusView('SCHEDULED','Регистрация ещё не открыта',now);
}
