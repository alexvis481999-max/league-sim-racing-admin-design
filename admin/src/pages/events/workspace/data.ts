import {useCallback,useEffect,useRef,useState} from 'react';
import {ApiError,apiFetch} from '../../../shared/api';
import {subscribeAdminRefresh} from '../../../shared/realtime';
import type {Action,EventSummary} from '../current/event-api';
import type {ProgramBlock} from './program';
export interface WorkspaceSummary {
  eventId:string;version:string;observedAt:string;event:EventSummary;actions:Action[];editableFields:string[];
  metadata:{createdAt:string;updatedAt:string;publishedAt:string|null;author:{participantId:string;displayName:string}|null;organizer:{id:string;name:string}|null};
  currentStage:{key:string;title:string}|null;nextStage:{key:string;title:string;startsAt:string}|null;stop:{reason:string;requestedAt:string}|null;
  program?:ProgramBlock[];
  counts:{stages:number;results:number;participants?:number};
  activity:{applications:{pending:number;accepted:number};runtime:{active:number;uncertain:number};hasRegistration:boolean};primaryResultId:string|null;
}
/** A refresh preserves the mounted section and previously fetched history pages. */
export function useWorkspaceData<T>(path:string,active=true) {
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[status,setStatus]=useState<number|null>(null),[busy,setBusy]=useState(false);
  const generation=useRef(0),loadedMore=useRef(false);
  const load=useCallback(async(cursor?:string)=>{
    const revision=++generation.current;setBusy(true);setError('');setStatus(null);
    try {
      const next=await apiFetch<T>(path+(cursor?`${path.includes('?')?'&':'?'}afterId=${encodeURIComponent(cursor)}`:''));
      if(revision!==generation.current)return;
      setData(old=>{
        if(old&&(cursor||loadedMore.current)&&typeof next==='object'&&next&&'items' in next&&Array.isArray(next.items)&&'items' in (old as object)) {
          const a=old as T&{items:{id:string}[];nextAfterId:string|null},b=next as T&{items:{id:string}[];nextAfterId:string|null};
          const combined=cursor?[...a.items,...b.items]:[...b.items,...a.items.filter(x=>!b.items.some(y=>y.id===x.id))];
          const previous=a as typeof a&{identities?:{participantId:string}[]},incoming=b as typeof b&{identities?:{participantId:string}[]};
          return {...b,...(incoming.identities?{identities:[...new Map([...(previous.identities??[]),...incoming.identities].map(x=>[x.participantId,x])).values()]}:{}),items:[...new Map(combined.map(x=>[x.id,x])).values()],nextAfterId:cursor?b.nextAfterId:a.nextAfterId};
        }
        return next;
      });
      if(cursor)loadedMore.current=true;
    } catch(e) {
      if(revision===generation.current) {
        if(e instanceof ApiError&&[401,403].includes(e.status))setData(null);
        setStatus(e instanceof ApiError?e.status:null);
        setError(e instanceof ApiError&&e.status===403?'Недостаточно прав для просмотра этого раздела.':e instanceof Error?e.message:'Не удалось загрузить данные');
      }
    } finally {if(revision===generation.current)setBusy(false);}
  },[path]);
  useEffect(()=>{setData(null);loadedMore.current=false;return()=>{generation.current++;};},[path]);
  useEffect(()=>{if(!active)return;void load();const stop=subscribeAdminRefresh(['events','runtime','results','rating','registration'],()=>load());return()=>{generation.current++;stop();};},[active,load]);
  return {data,error,status,busy,load};
}

export type PageData<T> = { items: T[]; nextAfterId: string | null };
export const workspacePath = (id: string, section: string) => `/admin/events/${id}/workspace/${section}`;
