/** Required read-model contract shared by the site and administration. */
export interface DisplayStatus {
  code:string;
  label:string;
  reason:{code:string;message:string}|null;
  effectiveAt:string|null;
  observedAt:string;
  freshness:'CURRENT'|'UNCERTAIN';
}
export type EventDisplayStatus=DisplayStatus & {currentStage:{key:string;title:string}|null};
export type StatusGroup={key:string;title:string;kind:string}|null;
/** Only for an unsaved editor preview; published records always use the server projection. */
export const draftDisplayStatus:EventDisplayStatus={code:'DRAFT',label:'Черновик',reason:null,effectiveAt:null,observedAt:'1970-01-01T00:00:00.000Z',freshness:'CURRENT',currentStage:null};
export interface ProgressView {key:string;title:string;status:string;runtimeSessionId:string|null;participants:{participantId:string;displayName:string}[];displayStatus:DisplayStatus;children:ProgressView[]}
