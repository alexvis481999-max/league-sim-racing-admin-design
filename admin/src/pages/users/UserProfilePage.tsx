import { ResultRevisions } from '../events/workspace/common/results';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, MenuItem, Skeleton, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { apiFetch } from '../../shared/api';
import { Page, BackAction } from '../../shared/ui';
import { ChatsPage } from '../chats/ChatsPage';
import { PlayerHistoryTable, date, display, field, status, type Column, type HistoryRow } from './PlayerHistoryTable';

export type AdminPlayer = {userId:string;steamId:string;steamName?:string;createdAt?:string;updatedAt?:string;enabledGames?:string[];themeMode?:string;firstName:string|null;lastName:string|null;shortName:string|null;country:string;discord:string|null;youtube:string|null;complete:boolean;missingFields:string[];presentation:{displayName:string;avatarUrl:string};actions:{edit:boolean;uploadAvatar:boolean;deleteAvatar:boolean}};
const games:Record<string,string>={assetto_corsa:'Assetto Corsa',assetto_corsa_competizione:'ACC',iracing:'iRacing'};
const tabs=[['overview','Обзор'],['participation','Участие'],['rating','Рейтинги'],['chats','Чаты'],['activity','Входы и активность'],['moderation','Модерация'],['content','Контент и настройки']];
const time=(key:string,title='Дата'):Column=>({title,render:r=>date(field(r,key))});
const state=(key='status',title='Статус'):Column=>({title,render:r=>status(field(r,key))});
const eventColumn:Column={title:'Событие',render:r=>r.eventId?<Button component="a" href={`/events/${encodeURIComponent(String(r.eventId))}?section=results`}>{display(r.title)}</Button>:display(r.title)};
const auditNames:Record<string,string>={'auth.login':'Вход','auth.logout':'Выход','auth.sessions_revoked':'Сессии завершены','chat.review':'Проверка переписки','chat.message.hide':'Скрытие сообщения','user.profile_updated':'Изменение профиля','user.avatar.replace':'Изменение аватара'};
function History({url,...props}:Parameters<typeof PlayerHistoryTable>[0]){return <PlayerHistoryTable key={url} url={url} {...props}/>;}

export function UserProfilePage({id,back,editor}:{id:string;back():void;editor(close:()=>void,dirty:(value:boolean)=>void):ReactNode}) {
  const [user,setUser]=useState<AdminPlayer|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const [tab,setTab]=useState(()=>{const value=new URLSearchParams(location.search).get('tab');return tabs.some(([key])=>key===value)?value!:'overview';});
  const [editing,setEditing]=useState(false),[dirty,setDirty]=useState(false),[confirm,setConfirm]=useState(false);
  useEffect(()=>{let live=true;setError('');void apiFetch<AdminPlayer>(`/admin/users/${id}`).then(v=>{if(live)setUser(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[id,revision]);
  const close=()=>{setEditing(false);setDirty(false);setConfirm(false);setRevision(v=>v+1);};
  const requestClose=()=>dirty?setConfirm(true):close();
  function select(next:string){setTab(next);const url=new URL(location.href);url.searchParams.set('userId',id);url.searchParams.set('tab',next);history.replaceState({},'',url);}
  return <Page title="Профиль игрока" back={<BackAction label="К пользователям" onClick={back}/>}>
    {error&&<Alert severity="error" action={<Button onClick={()=>setRevision(v=>v+1)}>Повторить</Button>}>{error}</Alert>}
    {!user&&!error?<Skeleton variant="rounded" height={130}/>:user&&<>
      <Stack direction={{xs:'column',sm:'row'}} gap={2} alignItems={{sm:'center'}} sx={{pb:3}}>
        <Avatar src={user.presentation.avatarUrl} sx={{width:80,height:80}}/>
        <Box sx={{flex:1,minWidth:0}}><Typography variant="h4">{user.presentation.displayName}</Typography><Typography color="text.secondary">{user.shortName} · {user.country==='unknown'?'Страна не указана':new Intl.DisplayNames(['ru'],{type:'region'}).of(user.country)} · ID {id}</Typography>
          <Button component="a" href={`https://steamcommunity.com/profiles/${user.steamId}`} target="_blank" rel="noreferrer" sx={{p:0,minHeight:0}}>Steam · {user.steamId}</Button>
          <Stack direction="row" spacing={1} sx={{mt:1}}><Chip size="small" variant="outlined" label={user.complete?'Профиль заполнен':'Профиль не заполнен'}/></Stack>
        </Box>
        <Button component="a" href={`${String(import.meta.env.VITE_SITE_URL || 'http://localhost:5174').replace(/\/$/,'')}/profile/${id}`} target="_blank" rel="noreferrer">Открыть на сайте</Button>
        <Button variant="outlined" disabled={!user.actions.edit&&!user.actions.uploadAvatar} onClick={()=>setEditing(true)}>Редактировать профиль</Button>
      </Stack>
      <Tabs value={tabs.some(([key])=>key===tab)?tab:'overview'} onChange={(_,v)=>select(v)} variant="scrollable" scrollButtons="auto" sx={{borderBottom:1,borderColor:'divider',mb:3}}>{tabs.map(([key,label])=><Tab key={key} value={key} label={label}/>)}</Tabs>
      {tab==='overview'&&<Overview user={user}/>}
      {tab==='participation'&&<Participation id={id}/>}
      {tab==='rating'&&<Ratings id={id}/>}
      {tab==='chats'&&<ChatsPage key={id} userId={id}/>}
      {tab==='activity'&&<Activity id={id}/>}
      {tab==='moderation'&&<Moderation id={id}/>}
      {tab==='content'&&<Content user={user}/>}
    </>}
    <Drawer anchor="right" open={editing} onClose={requestClose} slotProps={{paper:{sx:{width:{xs:'100%',sm:580},p:2}}}}>{editing&&editor(requestClose,setDirty)}</Drawer>
    <Dialog open={confirm} onClose={()=>setConfirm(false)}><DialogTitle>Есть несохранённые изменения</DialogTitle><DialogContent>Закрыть редактирование без сохранения?</DialogContent><DialogActions><Button onClick={()=>setConfirm(false)}>Продолжить редактирование</Button><Button onClick={close}>Не сохранять</Button></DialogActions></Dialog>
  </Page>;
}
function Facts({items}:{items:[string,unknown][]}) {return <Box component="dl" sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'180px 1fr'},gap:1,m:0,mb:3}}>{items.map(([label,value])=><Box key={label} sx={{display:'contents'}}><Typography component="dt" color="text.secondary">{label}</Typography><Typography component="dd" sx={{m:0,overflowWrap:'anywhere'}}>{display(value)}</Typography></Box>)}</Box>;}
function Overview({user}:{user:AdminPlayer}) {return <Stack spacing={3}>
  <Facts items={[["Регистрация",date(user.createdAt)],["Обновление аккаунта",date(user.updatedAt)],["Имя в Steam",user.steamName],["Discord",user.discord],["YouTube",user.youtube],["Игры",user.enabledGames?.map(g=>games[g]??g).join(', ')]]}/>
  <RatingsOverview id={user.userId}/>
  <Box><Typography variant="h6" sx={{mb:1}}>Последние выступления</Typography><History url={`/admin/users/${user.userId}/history/participations?limit=5`} paging="page" columns={[time('date'),eventColumn,{title:'Место',key:'position'},state('finishStatus')]} summary={data=><Typography sx={{mb:2}}>Гонок: {display(field(data,'totals.races'))} · Побед: {display(field(data,'totals.wins'))} · DNF: {display(field(data,'totals.dnf'))}</Typography>}/></Box>
  <Box><Typography variant="h6" sx={{mb:1}}>Действующие ограничения</Typography><History url={`/admin/sanctions?userId=${user.userId}&state=active&limit=5`} columns={[state('type','Ограничение'),{title:'Причина',key:'publicReason'},time('endsAt','До')]}/></Box>
</Stack>;}
function RatingsOverview({id}:{id:string}) {
  const [game,setGame]=useState('assetto_corsa'),[data,setData]=useState<HistoryRow[]|null>(null),[error,setError]=useState('');
  useEffect(()=>{let live=true;setData(null);setError('');void Promise.all((game==='assetto_corsa'?['circuit','touge']:['circuit']).map(d=>apiFetch<HistoryRow>(`/admin/users/${id}/history/rating?gameCode=${game}&disciplineCode=${d}&limit=1`))).then(v=>{if(live)setData(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[id,game]);
  return <Box><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{mb:2}}><Typography variant="h6">Текущие рейтинги</Typography><TextField select size="small" value={game} label="Игра" onChange={e=>setGame(e.target.value)} sx={{minWidth:180}}>{Object.entries(games).map(([key,name])=><MenuItem key={key} value={key}>{name}</MenuItem>)}</TextField></Stack>
    {error?<Alert severity="error">{error}</Alert>:data?<Stack direction={{xs:'column',sm:'row'}} gap={4}>{data.map((r,i)=><Box key={i}><Typography color="text.secondary">{i?'Тоге':'Кольцо'}</Typography><Typography variant="h6">PR {display(field(r,'current.pilot.value'))} · SR {display(field(r,'current.safety.value'))}</Typography></Box>)}</Stack>:<Skeleton height={60}/>}
  </Box>;
}
function Participation({id}:{id:string}) {
  const [kind,setKind]=useState('participations');
  const [result,setResult]=useState<{eventId:string;resultId:string}|null>(null);
  const columns:Record<string,Column[]>={
    participations:[time('date'),eventColumn,{title:'Заезд',render:r=>r.raceKey==='duel'?'Парный заезд':r.raceKey==='time-attack'?'Time Attack':String(r.raceKey).startsWith('match-')?'Матч '+String(r.raceKey).slice(6):'Гонка '+String(r.raceKey).split(':').at(-1)},{title:'Место',key:'position'},state('finishStatus'),{title:'Результат',render:r=>r.eventId?<Button onClick={()=>setResult({eventId:String(r.eventId),resultId:String(r.resultId)})}>Открыть</Button>:<Button component="a" href={`/officiating?matchmakingId=${r.matchmakingId??''}&matchId=${field(r,'owner.id')??''}&resultId=${r.resultId}`}>Матчмейкинг</Button>}],
    registrations:[time('createdAt','Подана'),eventColumn,state(),time('decidedAt','Решение'),time('withdrawnAt','Снятие'),time('removedAt','Удаление')],
    matchmaking:[time('queuedAt','В очереди с'),state(),{title:'Трасса',key:'trackTitle'},{title:'Погода',key:'weatherTitle'},state('matchStatus','Матч'),time('startedAt','Начало'),time('finishedAt','Окончание'),{title:'Подробности',render:r=><Button component="a" href={r.resultId?`/officiating?matchmakingId=${r.queueId}&matchId=${r.matchId}&resultId=${r.resultId}`:`/runtime?matchmakingId=${r.queueId}&matchId=${r.matchId??''}`}>Открыть</Button>}],
  };
  return <><Tabs value={kind} onChange={(_,v)=>setKind(v)} sx={{mb:2}}><Tab value="participations" label="Выступления"/><Tab value="registrations" label="Заявки"/><Tab value="matchmaking" label="Матчмейкинг"/></Tabs><History url={`/admin/users/${id}/history/${kind}?limit=20`} paging={kind==='participations'?'page':'cursor'} columns={columns[kind]}/><Dialog open={!!result} onClose={()=>setResult(null)} fullWidth maxWidth="xl"><DialogTitle>Результаты заезда</DialogTitle><DialogContent>{result&&<ResultRevisions eventId={result.eventId} resultId={result.resultId} active/>}</DialogContent><DialogActions><Button onClick={()=>setResult(null)}>Закрыть</Button></DialogActions></Dialog></>;
}
function Ratings({id}:{id:string}) {
  const [game,setGame]=useState('assetto_corsa'),[discipline,setDiscipline]=useState('circuit');
  const metric=(key:string)=>(r:HistoryRow)=>`${display(field(r,key+'.before'))} → ${display(field(r,key+'.after'))} (${Number(field(r,key+'.delta'))>0?'+':''}${display(field(r,key+'.delta'))})`;
  return <><Stack direction="row" spacing={2} sx={{mb:3}}><TextField select size="small" label="Игра" value={game} onChange={e=>{setGame(e.target.value);if(e.target.value!=='assetto_corsa')setDiscipline('circuit');}} sx={{minWidth:200}}>{Object.entries(games).map(([key,name])=><MenuItem key={key} value={key}>{name}</MenuItem>)}</TextField><TextField select size="small" label="Дисциплина" value={discipline} onChange={e=>setDiscipline(e.target.value)} sx={{minWidth:160}}><MenuItem value="circuit">Кольцо</MenuItem>{game==='assetto_corsa'&&<MenuItem value="touge">Тоге</MenuItem>}</TextField></Stack>
    <History url={`/admin/users/${id}/history/rating?gameCode=${game}&disciplineCode=${discipline}&limit=20`} paging="sequence" summary={data=><Box sx={{mb:3}}><Typography variant="h5">Текущий PR {display(field(data,'current.pilot.value'))} · SR {display(field(data,'current.safety.value'))}</Typography><Typography color="text.secondary">История ниже показывает значения на момент начисления.</Typography><RatingChart rows={Array.isArray(data.items)?data.items as HistoryRow[]:[]}/></Box>} columns={[time('appliedAt'),{title:'Событие / гонка',render:r=>`${display(field(r,'race.eventTitle'))} · ${display(field(r,'race.raceTitle'))}`},{title:'PR: было → стало (Δ)',render:metric('pilot')},{title:'SR: было → стало (Δ)',render:metric('safety')},state('kind','Изменение'),{title:'Причина',key:'reason'}]}/>
  </>;
}
function RatingChart({rows}:{rows:HistoryRow[]}) {
  if(rows.length<2)return null;
  return <Stack direction={{xs:'column',sm:'row'}} gap={3} sx={{mt:2}}>{['pilot','safety'].map((key)=>{const values=rows.map(r=>Number(field(r,key+'.after'))),low=Math.min(...values),high=Math.max(...values),points=values.map((v,i)=>`${10+i*480/(values.length-1)},${90-(v-low)*70/(high-low||1)}`).join(' ');return <Box key={key} sx={{flex:1}}><Typography variant="caption">{key==='pilot'?'PR':'SR'} · показанная страница истории</Typography><svg viewBox="0 0 500 100" role="img" aria-label={`Динамика ${key==='pilot'?'PR':'SR'}`} style={{width:'100%',height:100}}><polyline points={points} fill="none" stroke={key==='pilot'?'#ff6a32':'#5badb1'} strokeWidth="2"/></svg></Box>;})}</Stack>;
}
function Activity({id}:{id:string}) {
  const [kind,setKind]=useState('sessions'),[action,setAction]=useState(''),[relation,setRelation]=useState('subjectId'),[from,setFrom]=useState(''),[to,setTo]=useState('');
  const url=kind==='audit'?`/admin/audit?${relation}=${id}&limit=20${action?'&action='+encodeURIComponent(action):''}${from?'&from='+encodeURIComponent(new Date(from+'T00:00:00').toISOString()):''}${to?'&to='+encodeURIComponent(new Date(to+'T23:59:59.999').toISOString()):''}`:`/admin/users/${id}/history/${kind}?limit=20`;
  const columns:Column[]=kind==='notifications'?[time('createdAt'),{title:'Заголовок',key:'title'},{title:'Текст',key:'body'},state()]:kind==='sessions'?[state('audience','Раздел'),{title:'Браузер / устройство',key:'userAgent'},state(),time('expiresAt','Истекает'),time('revokedAt','Завершена')]:kind==='presence'?[time('occurredAt'),state('kind','Подключение'),{title:'Сессия заезда',key:'sessionId'},{title:'Имя в игре',key:'name'},{title:'Причина',key:'reason'}]:[time('at'),{title:'Действие',render:r=>auditNames[String(r.action)]??display(r.action)},{title:'Автор',render:r=>display(field(r,'actor.userId'))},{title:'Причина',key:'reason'},{title:'Сведения',render:r=><><Typography variant="body2">{display(field(r,'changes.userAgent'))}</Typography><Typography variant="caption">{status(field(r,'changes.audience'))}</Typography><AuditChanges row={r}/></>}];
  return <><Tabs value={kind} onChange={(_,v)=>setKind(v)} sx={{mb:2}}><Tab value="sessions" label="Сессии входа"/><Tab value="presence" label="Игровые подключения"/><Tab value="audit" label="Журнал действий"/><Tab value="notifications" label="Уведомления"/></Tabs>
    {kind==='sessions'&&<Alert severity="info" sx={{mb:2}}>Действующая сессия не означает, что игрок сейчас онлайн. Даты старых входов не сохранялись. Новые входы и выходы доступны в журнале действий.</Alert>}
    {kind==='audit'&&<Stack direction="row" gap={2} flexWrap="wrap" sx={{mb:2}}><TextField type="date" size="small" label="С" value={from} onChange={e=>setFrom(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><TextField type="date" size="small" label="По" value={to} onChange={e=>setTo(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><TextField select size="small" label="Связь с игроком" value={relation} onChange={e=>setRelation(e.target.value)}><MenuItem value="subjectId">Действия над аккаунтом</MenuItem><MenuItem value="actorId">Действия игрока</MenuItem></TextField><TextField select size="small" label="Действие" value={action} onChange={e=>setAction(e.target.value)}><MenuItem value="">Все</MenuItem><MenuItem value="auth.login">Входы</MenuItem><MenuItem value="auth.logout">Выходы</MenuItem></TextField></Stack>}
    <History url={url} columns={columns} paging={kind==='sessions'?'page':'cursor'}/></>;
}
function Moderation({id}:{id:string}) {
  const [kind,setKind]=useState('sanctions');
  const [report,setReport]=useState<string|null>(null);
  return <><Tabs value={kind} onChange={(_,v)=>setKind(v)} sx={{mb:2}}><Tab value="sanctions" label="Ограничения"/><Tab value="authored" label="Жалобы игрока"/><Tab value="accused" label="Жалобы на игрока"/></Tabs>
    {kind==='sanctions'?<History url={`/admin/sanctions?userId=${id}&limit=20`} columns={[state('type','Ограничение'),state(),{title:'Причина',key:'publicReason'},time('startsAt','Начало'),time('endsAt','Окончание'),time('revokedAt','Отозвано')]}/>:<History url={`/admin/officiating/protests?userId=${id}&relation=${kind}&limit=20`} columns={[time('createdAt'),{title:'Жалоба',render:r=><Button onClick={()=>setReport(String(r.id))}>№ {display(r.id)}</Button>},state(),{title:'Причина',key:'reason'},{title:'Автор',key:'submittedById'},{title:'На игрока',key:'accusedId'}]}/>}
    <Dialog open={!!report} onClose={()=>setReport(null)} fullWidth maxWidth="md"><DialogTitle>Жалоба № {report}</DialogTitle><DialogContent>{report&&<ReportDetails key={report} id={report}/>}</DialogContent><DialogActions><Button onClick={()=>setReport(null)}>Закрыть</Button></DialogActions></Dialog>
  </>;
}
function Content({user}:{user:AdminPlayer}) {
  const [kind,setKind]=useState('skins');
  return <><Tabs value={kind} onChange={(_,v)=>setKind(v)} sx={{mb:2}}><Tab value="skins" label="Скины"/><Tab value="uploads" label="Каталог"/><Tab value="settings" label="Настройки"/><Tab value="preferences" label="Уведомления"/><Tab value="access" label="Роли и доступы"/></Tabs>
    {kind==='skins'&&<History url={`/skins/admin?ownerType=user&ownerId=${user.userId}&limit=20`} columns={[{title:'Скин',key:'displayName'},{title:'Превью',render:r=>r.previewUrl?<Box component="img" src={String(r.previewUrl)} alt="" loading="lazy" sx={{width:120,height:68,objectFit:'cover'}}/>:'—'},{title:'Статус',render:r=>r.deletedAt?'Удалён':field(r,'moderation.blocked')?'Заблокирован':r.active?'Активен':'Неактивен'},{title:'Видимость',render:r=>r.visibility==='public'?'Публичный':'Личный'},time('createdAt')]}/>}
    {kind==='preferences'&&<History url={`/admin/users/${user.userId}/history/preferences`} caption="Явно сохранённые настройки. Для остальных категорий действуют настройки платформы." columns={[{title:'Категория',key:'type'},{title:'Канал',key:'channel'},{title:'Доставка',render:r=>r.enabled?'Включена':'Выключена'},time('updatedAt','Изменено')]}/>}
    {kind==='uploads'&&<History url={`/admin/catalog/items?createdByUserId=${user.userId}&limit=20`} columns={[{title:'Название',key:'title'},{title:'Тип',render:r=>({photo:'Фото',car:'Машина',track:'Трасса',plugin:'Плагин',car_set:'Набор машин',weather_preset:'Погода'}[String(r.kind)]??display(r.kind))},state(),time('createdAt')]}/>}
    {kind==='settings'&&<Facts items={[["Игры",user.enabledGames?.map(g=>games[g]??g).join(', ')],["Оформление",user.themeMode==='light'?'Светлое':'Тёмное']]}/>}
    {kind==='access'&&<><History url={`/admin/access/grants?subjectId=${user.userId}`} columns={[{title:'Роль',key:'roleCode'},state(),{title:'Область',key:'scopeType'},{title:'Объект',key:'scopeId'},time('validFrom','С'),time('validTo','До')]}/><Button component="a" href={`/access?userId=${user.userId}`} sx={{mt:2}}>Управление доступом</Button></>}
  </>;
}
function ReportDetails({id}:{id:string}) {
  const [data,setData]=useState<HistoryRow|null>(null),[error,setError]=useState('');
  useEffect(()=>{let live=true;void apiFetch<HistoryRow>(`/admin/officiating/protests/${id}`).then(v=>{if(live)setData(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[id]);
  if(error)return <Alert severity="error">{error}</Alert>;
  if(!data)return <Skeleton height={160}/>;
  const report=data.report as HistoryRow;
  const comments=Array.isArray(report.comments)?report.comments as HistoryRow[]:[];
  const changes=Array.isArray(data.history)?data.history as HistoryRow[]:[];
  return <Stack gap={2}><Facts items={[["Состояние",status(report.status)],["Причина",report.reason],["Место инцидента",report.incidentLocation],["Круг",report.incidentLap],["Решение по обращению",report.resolutionReason]]}/>
    {report.videoUrl&&/^https?:\/\//.test(String(report.videoUrl))?<Button component="a" href={String(report.videoUrl)} target="_blank" rel="noreferrer">Видео инцидента</Button>:null}
    <Typography variant="h6">Комментарии</Typography>{comments.length?comments.map(c=><Box key={String(c.id)}><Typography variant="caption">{date(c.createdAt)} · Игрок {display(c.authorId)}</Typography><Typography sx={{whiteSpace:'pre-wrap'}}>{display(c.body)}</Typography></Box>):<Typography color="text.secondary">Комментариев нет.</Typography>}
    <Typography variant="h6">История рассмотрения</Typography>{changes.map((c,i)=><Typography key={i}>{date(c.at)} · {status(c.to)} · {display(c.reason)}</Typography>)}
    <Button component="a" href={`/officiating?resultId=${field(report,'context.source.id')??''}${field(report,'context.eventId')?'&eventId='+field(report,'context.eventId'):''}`}>Перейти к судейству</Button>
  </Stack>;
}
function AuditChanges({row}:{row:HistoryRow}) {
  const labels:Record<string,string>={firstName:'Имя',lastName:'Фамилия',shortName:'Короткое имя',country:'Страна',discord:'Discord',youtube:'YouTube',avatar:'Аватар',enabledGames:'Игры',themeMode:'Оформление'};
  const changed=field(row,'changes.fields');
  if(!Array.isArray(changed))return null;
  return <Box>{changed.map(key=><Typography variant="body2" key={String(key)}>{labels[String(key)]??String(key)}: {display(field(row,`changes.before.${key}`))} → {display(field(row,`changes.after.${key}`))}</Typography>)}</Box>;
}
