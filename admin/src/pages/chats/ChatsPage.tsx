import { ListRecord, FilterButtons, ListToolbar, SearchField, useDebouncedValue } from '../../shared/ui';
import {useRealtimeRefresh} from '../../shared/realtime';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, jsonBody, getAdminToken, subscribeAdminAuthChanged } from '../../shared/api';
import { Page, Section } from '../../shared/ui';
type Thread = {id:string;type:'DIRECT'|'EVENT';eventId:string|null;status:string;messageCount:number};
type Review = {reviewId:string;threadId:string;actorId:string;createdAt:string;reason:string};
type Message = {id:string;kind:'USER'|'SYSTEM';authorName:string|null;authorUserId:string|null;createdAt:string;originalBody:string;moderation:{hidden:boolean}};
const command=(body:unknown)=>({...jsonBody(body),headers:{'Idempotency-Key':crypto.randomUUID()}});
export function ChatsPage({eventId,userId,active=true}:{eventId?:string;userId?:string;active?:boolean}={}){
 const [tab,setTab]=useState('chats'),[threads,setThreads]=useState<Thread[]>([]),[reviews,setReviews]=useState<Review[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [type,setType]=useState(eventId?'EVENT':''),[query,setQuery]=useState('');
 const search=useDebouncedValue(query.trim()),listRevision=useRef(0);
 const [selected,setSelected]=useState<Thread|null>(null),[reason,setReason]=useState(''),[reviewId,setReviewId]=useState<string|null>(null),[messages,setMessages]=useState<Message[]>([]),[before,setBefore]=useState<string|null>(null);
 const [hideTarget,setHideTarget]=useState<Message|null>(null),[hideReason,setHideReason]=useState(''),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const generation=useRef(0),session=useRef(adminIdentity());
 useEffect(()=>subscribeAdminAuthChanged(()=>{const next=adminIdentity();if(next!==session.current){session.current=next;generation.current++;setSelected(null);setMessages([]);setReviewId(null);setThreads([]);setReviews([]);setHideTarget(null);}}),[]);
 async function run(action:()=>Promise<void>){setBusy(true);setError(null);try{await action();}catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить действие');}finally{setBusy(false);}}
 async function load(more=false){const request=++listRevision.current;const identity=adminIdentity();const q=new URLSearchParams({limit:'50'});if(more&&cursor)q.set('cursor',cursor);if(tab==='chats'){if(type)q.set('type',type);}
  if(userId)q.set('userId',userId);if(search)q.set('q',search);if(eventId)q.set('eventId',eventId);
  const page=await apiFetch<{items:(Thread&Review)[];nextCursor:string|null}>('/admin/chat/'+(tab==='chats'?'threads':'reviews')+'?'+q);
  if(identity!==adminIdentity()||request!==listRevision.current)return;
  if(tab==='chats')setThreads(old=>more?[...old,...page.items]:page.items);else setReviews(old=>more?[...old,...page.items]:page.items);setCursor(page.nextCursor);}
 useRealtimeRefresh(['chat'],async()=>{if(tab!=='announcement')await run(()=>load());if(selected&&reviewId)await history(reviewId);},active);
 useEffect(()=>{setCursor(null);if(tab!=='announcement')void run(()=>load());return()=>{listRevision.current++;};},[tab,type,search,eventId,userId]);
 function select(t:Thread){generation.current++;setSelected(t);setReason('');setReviewId(null);setMessages([]);setBefore(null);setError(null);}
 async function history(id:string,older=false){const seq=generation.current,thread=selected!.id,q=new URLSearchParams({reviewId:id,limit:'50'});if(older&&before)q.set('beforeId',before);
  const page=await apiFetch<{items:Message[];hasMore:boolean;nextBeforeId:string|null}>(`/admin/chat/threads/${thread}/messages?${q}`);if(seq!==generation.current)return;setMessages(old=>older?[...page.items,...old]:page.items);setBefore(page.hasMore?page.nextBeforeId:null);}
 async function review(){const seq=generation.current;const result=await apiFetch<{reviewId:string}>(`/admin/chat/threads/${selected!.id}/review`,command({reason}));if(seq!==generation.current)return;setReviewId(result.reviewId);await history(result.reviewId);}
 return <Page embedded={!!eventId||!!userId} title="Чаты" subtitle="Переписка открывается только после регистрации проверки с причиной.">
  {error&&<Alert severity="error">{error}</Alert>}
  <Tabs value={tab} onChange={(_,v)=>setTab(v)}><Tab value="chats" label="Чаты"/>{!userId&&<Tab value="reviews" label="Журнал проверок"/>}{!userId&&<Tab value="announcement" label="Объявление"/>}</Tabs>
  {tab!=='announcement'&&<>   <ListToolbar><SearchField label="Поиск" placeholder={tab==='chats'?'Участник, событие, организатор или ID':'Автор, причина проверки или ID'} value={query} onChange={value=>setQuery(value.slice(0,200))}/>{!eventId&&tab==='chats'&&<FilterButtons label="Тип чата" value={type} onChange={setType} disabled={busy} options={[{value:'',label:'Все'},{value:'DIRECT',label:'Личные'},{value:'EVENT',label:'События'}]}/>}
   </ListToolbar></>}
  {tab==='announcement'?<Announcement eventId={eventId}/>:tab==='chats'?<Section embedded>

   {threads.map(t=><ListRecord key={t.id} id={t.id} title={t.type==='DIRECT'?'Личный диалог':'Событие #'+t.eventId} meta={`${t.messageCount} сообщений · ${t.status==='OPEN'?'Открыт':'Архив'}`} onOpen={()=>select(t)} openLabel={`Начать проверку чата #${t.id}`} actions={<Button onClick={()=>select(t)}>Начать проверку</Button>}/>)}
   {!threads.length&&<Typography>Чаты не найдены</Typography>}
  </Section>:<Section embedded>{reviews.map(r=><ListRecord key={r.reviewId} id={r.reviewId} title={r.reason} meta={`Чат #${r.threadId} · Администратор #${r.actorId} · ${new Date(r.createdAt).toLocaleString('ru')}`} />)}</Section>}
  {tab!=='announcement'&&cursor&&<Button disabled={busy||query.trim()!==search} onClick={()=>void run(()=>load(true))}>Показать ещё</Button>}
  <Dialog open={selected!==null} onClose={()=>{generation.current++;setSelected(null);setMessages([]);}} fullWidth maxWidth="md"><DialogTitle>Проверка чата #{selected?.id}</DialogTitle><DialogContent>
   {error&&<Alert severity="error">{error}</Alert>}
   {!reviewId?<Stack spacing={2}><TextField label="Причина проверки" multiline value={reason} onChange={e=>setReason(e.target.value)} inputProps={{maxLength:4000}}/><Alert severity="info">Участники получат системное сообщение. Проверка будет записана в аудит.</Alert><Button disabled={busy||!reason.trim()} onClick={()=>void run(review)}>Открыть переписку</Button></Stack>:<Stack spacing={2}>
    {before&&<Button disabled={busy} onClick={()=>void run(()=>history(reviewId,true))}>Предыдущие сообщения</Button>}
    {messages.map(m=><Stack key={m.id} sx={{p:1,borderBottom:'1px solid',borderColor:'divider'}}><Typography variant="caption">{m.kind==='SYSTEM'?'Система':m.authorName||'#'+m.authorUserId} · {new Date(m.createdAt).toLocaleString('ru')}</Typography>
     {m.moderation.hidden&&<Chip label="Скрыто для пользователей" size="small"/>}<Typography sx={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{m.originalBody}</Typography>
     {!m.moderation.hidden&&<Button onClick={()=>{setHideTarget(m);setHideReason('');}}>Скрыть сообщение</Button>}</Stack>)}
   </Stack>}
  </DialogContent><DialogActions><Button onClick={()=>{generation.current++;setSelected(null);setMessages([]);}}>Закрыть</Button></DialogActions></Dialog>
  <Dialog open={hideTarget!==null} onClose={()=>setHideTarget(null)} fullWidth><DialogTitle>Причина скрытия сообщения</DialogTitle><DialogContent><TextField fullWidth multiline value={hideReason} onChange={e=>setHideReason(e.target.value)} inputProps={{maxLength:4000}}/></DialogContent><DialogActions><Button onClick={()=>setHideTarget(null)}>Отмена</Button><Button disabled={busy||!hideReason.trim()} onClick={()=>void run(async()=>{await apiFetch(`/admin/chat/threads/${selected!.id}/messages/${hideTarget!.id}/hide`,command({reviewId,reason:hideReason}));setHideTarget(null);await history(reviewId!);})}>Скрыть</Button></DialogActions></Dialog>
 </Page>;
}
function Announcement({eventId}:{eventId?:string}){const [audience,setAudience]=useState(eventId?'event':'users'),[ids,setIds]=useState(eventId??''),[title,setTitle]=useState(''),[body,setBody]=useState(''),[url,setUrl]=useState(''),[result,setResult]=useState(''),[busy,setBusy]=useState(false);
 async function send(){setBusy(true);try{const r=await apiFetch<{recipientCount:number}>('/admin/notifications/announcements',command({audience:audience==='users'?{type:'users',userIds:ids.split(/[\s,]+/).filter(Boolean)}:{type:'event',eventId:ids.trim()},title,body,actionUrl:url.trim()||null}));setResult(`Объявление обработано. Выбрано получателей: ${r.recipientCount}. Доставка учитывает настройки пользователей.`);}catch(e){setResult(e instanceof Error?e.message:'Ошибка отправки');}finally{setBusy(false);}}
 return <Section embedded={!!eventId} title="Объявление на сайте"><Stack spacing={2}>{!eventId&&<Stack direction="row" spacing={1}><Chip label="Пользователи" onClick={()=>setAudience('users')} color={audience==='users'?'primary':'default'}/><Chip label="Принятые участники события" onClick={()=>setAudience('event')} color={audience==='event'?'primary':'default'}/></Stack>}{!eventId&&<TextField label={audience==='users'?'ID пользователей через запятую':'ID события'} value={ids} onChange={e=>setIds(e.target.value)}/>}<TextField label="Заголовок" value={title} onChange={e=>setTitle(e.target.value)} inputProps={{maxLength:180}}/><TextField label="Текст" multiline value={body} onChange={e=>setBody(e.target.value)} inputProps={{maxLength:4000}}/><TextField label="Путь на сайте (необязательно)" value={url} onChange={e=>setUrl(e.target.value)}/><Button disabled={busy||!ids.trim()||!title.trim()||!body.trim()} onClick={()=>void send()}>Отправить объявление</Button>{result&&<Alert severity="info">{result}</Alert>}</Stack></Section>;
}

function adminIdentity(){try{const token=getAdminToken();if(!token)return null;const p=JSON.parse(atob(token.split('.')[1].replaceAll('-','+').replaceAll('_','/')));return JSON.stringify([p.sub,p.sid]);}catch{return null;}}
