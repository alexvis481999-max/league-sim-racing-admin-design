import {Link} from 'react-router-dom';
import {Button} from '@mui/material';
import { Page, Section, RefreshAction } from '../../shared/ui';
import { displayRuntimeStatus } from '../../../../shared/presentation';
import { realtime, useRealtimeStatus } from '../../shared/realtime';
import {OwnerGameJournal} from '../../features/standalone/OwnerGameJournal';
import {useEffect,useState,useRef} from 'react';
import {Alert,Box,Paper,Chip,Stack,Table,TableContainer,TableBody,TableCell,TableHead,TableRow,Typography} from '@mui/material';
import {apiFetch} from '../../shared/api';
import {formatDate} from '../../shared/format';
import {activeSession,processFor,sessionTitle,plannedPeak,type Snapshot,type Session} from './runtime-monitoring';
export function RuntimePage(){const q=new URLSearchParams(window.location.search);const path=q.get('practiceServerId')?`/admin/practice-servers/${q.get('practiceServerId')}/game-chat`:q.get('matchmakingId')&&q.get('matchId')?`/admin/matchmaking/${q.get('matchmakingId')}/matches/${q.get('matchId')}/game-chat`:null;return path?<OwnerGameJournal path={path}/>:<>{q.get("eventId")&&<Button component={Link} to={`/events/${encodeURIComponent(q.get("eventId")!)}?section=execution&view=servers`}>Вернуться к событию</Button>}<RuntimeMonitoring/></>;}
function RuntimeMonitoring(){
 const generation=useRef(0);
 const connected=useRealtimeStatus();
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState('');
 async function load(){const request=++generation.current;try{const next=await apiFetch<Snapshot>('/admin/runtime/ac/daemon');if(request!==generation.current)return;setData(next);setError('');}catch(e){if(request!==generation.current)return;setError(e instanceof Error?e.message:'Не удалось получить состояние серверов');}}
 useEffect(()=>{void load();const unsubscribe=realtime.subscribe('admin:runtime',message=>{if(message.type==='runtime.snapshot'){generation.current++;setData(previous=>!previous || Date.parse((message.payload as Snapshot).checkedAt)>=Date.parse(previous.checkedAt)?message.payload as Snapshot:previous);setError('');}});return()=>{generation.current++;unsubscribe();};},[]);
 return <Page title="Игровые серверы" actions={<RefreshAction onClick={()=>void load()} />}>
  {error&&<Alert severity="error">{error}</Alert>}
  {!connected&&<Alert severity="info">Подключаем обновление состояния…</Alert>}
  {!data?<Typography>Загружаем состояние…</Typography>:<>
   <DaemonOverview data={data} />
   {data.stale&&<Alert severity="warning">Связь уточняется. Отсутствие ответа не означает остановку гонки; занятые серверы сохраняются за текущими заездами.</Alert>}
   <ServerLoad data={data}/>
  </>}
 </Page>;
}

function DaemonOverview({ data }: { data: Snapshot }) {
  const metrics = data.metrics;
  const running = data.slots.filter(slot => processFor(data,slot)?.status === 'running').length;
  const totalMemory = metrics?.system.memoryTotalBytes;
  const usedMemory = totalMemory === undefined || !metrics ? undefined : totalMemory - metrics.system.memoryFreeBytes;
  const plugin = ({ CURRENT: 'Актуален', FAILED: 'Ошибка', UNKNOWN: 'Нет данных', NOT_CONFIGURED: 'Не настроен' } as Record<string, string>)[metrics?.plugin?.status ?? 'UNKNOWN'] ?? 'Нет данных';
  return <Section title="Состояние демона" actions={<Chip size="small" label={data.stale ? 'Сведения устарели' : 'Связь установлена'} color={data.stale ? 'warning' : 'success'} />}>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' }, gap: 1 }}>
      <Metric label="Daemon" value={data.daemonId} detail={metrics ? [metrics.system.platform, metrics.system.arch, metrics.process.pid ? 'PID ' + metrics.process.pid : ''].filter(Boolean).join(' / ') : 'Ожидается подключение'} />
      <Metric label="Слоты" value={metrics ? running + ' / ' + data.slots.length : '—'} detail="Запущено сейчас" />
      <Metric label="CPU daemon" value={percent(metrics?.process.cpuPercent)} detail={metrics?.system.cpuCount ? metrics.system.cpuCount + ' ядер на машине' : '—'} />
      <Metric label="CPU машины" value={percent(metrics?.system.cpuPercent)} detail={metrics?.system.loadAverage ? 'Load ' + metrics.system.loadAverage[0]?.toFixed(2) : '—'} />
      <Metric label="RAM daemon" value={bytes(metrics?.process.memoryRssBytes)} detail={'Heap ' + bytes(metrics?.process.memoryHeapUsedBytes)} />
      <Metric label="RAM машины" value={usedMemory === undefined ? '—' : bytes(usedMemory) + ' / ' + bytes(totalMemory)} detail={'Свободно ' + bytes(metrics?.system.memoryFreeBytes)} />
      <Metric label="Uptime" value={uptime(metrics?.uptimeSeconds)} detail={data.receivedAt ? 'Снимок ' + formatDate(data.receivedAt) : 'Нет снимка'} />
    </Box>
    <Stack direction="row" gap={2} useFlexGap flexWrap="wrap"><Typography variant="body2" color="text.secondary">Плагин: {plugin}</Typography><Typography variant="body2" color="text.secondary">В очереди: {data.queue.length}</Typography></Stack>
  </Section>;
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Paper variant="outlined" sx={{ px: 1, py: 0.8, minWidth: 0, height: '100%' }}><Typography variant="caption" color="text.secondary" noWrap display="block">{label}</Typography><Typography noWrap title={value} sx={{ fontWeight: 800, mt: 0.15, fontSize: 16, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Typography><Typography variant="caption" color="text.secondary" noWrap display="block" title={detail} sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail}</Typography></Paper>;
}
function percent(value?: number) { return value === undefined ? '—' : value.toFixed(1) + '%'; }
function bytes(value?: number) { return value === undefined ? '—' : value >= 1073741824 ? (value / 1073741824).toFixed(1) + ' ГБ' : Math.round(value / 1048576) + ' МБ'; }
function uptime(seconds?: number) { if (seconds === undefined) return '—'; const hours = Math.floor(seconds / 3600); return (hours >= 24 ? Math.floor(hours / 24) + ' д ' : '') + hours % 24 + ' ч ' + Math.floor(seconds % 3600 / 60) + ' мин'; }
function sessionStatus(session:Session) {
 return session.displayStatus?.label ?? (session.connectionLostAt?'Уточнение состояния':displayRuntimeStatus(session.status));
}
function ServerLoad({data}:{data:Snapshot}) {
 const reservations=data.reservations??[];
 const future=reservations.filter(r=>Date.parse(r.estimatedEndsAt)>Date.parse(data.checkedAt));
 const owner=(r:typeof reservations[number])=>`${({EVENT:'Событие',PRACTICE_SERVER:'Практика',MATCHMAKING:'Матчмейкинг'} as Record<string,string>)[r.owner.type]??'Резерв'} #${r.owner.id}`;
 const current=data.sessions.filter(s=>!['STOPPED','CANCELLED','FAILED'].includes(s.status));
 const history=data.sessions.filter(s=>['STOPPED','CANCELLED','FAILED'].includes(s.status)).sort((a,b)=>Date.parse(b.stoppedAt??'')-Date.parse(a.stoppedAt??''));
 const [historyOpen,setHistoryOpen]=useState(false);
 const [showFree,setShowFree]=useState(false),[reserveLimit,setReserveLimit]=useState(20);
 const visibleSlots=data.slots.filter(slot=>showFree||slot.state!=='AVAILABLE'||processFor(data,slot)?.status==='running');
 return <Stack spacing={3}>
  <Section title="Серверы сейчас">
   <Typography variant="body2" color="text.secondary">Занято {data.slots.filter(s=>s.state==='ALLOCATED').length} из {data.slots.length} · В очереди {data.queue.length} · Пиковый резерв по расписанию {plannedPeak(future,data.checkedAt)} из {data.slots.length}</Typography>
   <TableContainer><Table size="small"><TableHead><TableRow>{['Сервер','Состояние','Что запущено','Игроки','Запуск / плановое окончание','Процесс'].map(label=><TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
    {visibleSlots.map(slot=>{const session=activeSession(data,slot),process=processFor(data,slot);
     const state=slot.state==='ALLOCATED'?'Занят':displayRuntimeStatus(slot.state);
     return <TableRow key={slot.serverId}>
      <TableCell><Typography variant="body2" fontWeight={700}>{slot.serverId}</Typography>{slot.serverCode&&slot.serverCode!==slot.serverId&&<Typography variant="caption" color="text.secondary">{slot.serverCode}</Typography>}</TableCell>
      <TableCell><Chip size="small" label={state} color={slot.state==='ALLOCATED'?'info':slot.state==='AVAILABLE'?'success':'default'}/>{slot.state==='COOLDOWN'&&slot.availableAt&&<Typography variant="caption" display="block">Доступен {formatDate(slot.availableAt)}</Typography>}</TableCell>
      <TableCell>{session?<><Typography variant="body2">{sessionTitle(session)} #{session.id}</Typography><Typography variant="caption" color="text.secondary">{sessionStatus(session)}</Typography></>:'Нет назначенной сессии'}</TableCell>
      <TableCell>{session?.connectedPlayers??'—'}</TableCell>
      <TableCell>{session?<><Typography variant="body2">{session.startedAt?formatDate(session.startedAt):'Ожидает запуска'}</Typography><Typography variant="caption" color="text.secondary">{session.estimatedEndsAt?`До ${formatDate(session.estimatedEndsAt)}`:'Окончание не задано'}</Typography></>:'—'}</TableCell>
      <TableCell>{process?<><Typography variant="body2">{process.status==='running'?'Запущен':process.status==='idle'?'Не запущен':'Состояние не подтверждено'}{process.pid!=null?` · PID ${process.pid}`:''}</Typography>{data.stale&&<Typography variant="caption" color="warning.main">Последние полученные данные</Typography>}</>:<Typography variant="body2" color="text.secondary">Нет телеметрии {slot.serverCode??slot.serverId}</Typography>}</TableCell>
     </TableRow>;
    })}
    {!visibleSlots.length&&<TableRow><TableCell colSpan={6}>{data.slots.length?'Все серверы свободны.':'Серверы не настроены.'}</TableCell></TableRow>}
   </TableBody></Table></TableContainer>
   {data.slots.some(slot=>slot.state==='AVAILABLE')&&<Button onClick={()=>setShowFree(value=>!value)}>{showFree?'Скрыть свободные серверы':'Показать свободные серверы'}</Button>}
  </Section>
  <Section title="Будущая нагрузка">
   <Typography variant="body2" color="text.secondary">Резервы мощности по расписанию. Конкретный сервер назначается при запуске. Динамические запуски без резерва сюда не входят.</Typography>
   {!future.length?<Typography color="text.secondary">Будущих резервов нет.</Typography>:<TableContainer><Table size="small"><TableHead><TableRow>{['Владелец','Начало','Плановое окончание','Серверов','Состояние'].map(label=><TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{future.slice(0,reserveLimit).map(r=><TableRow key={r.id}><TableCell>{owner(r)}</TableCell><TableCell>{formatDate(r.startsAt)}</TableCell><TableCell>{formatDate(r.estimatedEndsAt)}</TableCell><TableCell>{r.serverCount}</TableCell><TableCell>{Date.parse(r.startsAt)<=Date.parse(data.checkedAt)?'Окно резерва открыто':'Запланирован'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
   {future.length>reserveLimit&&<Button onClick={()=>setReserveLimit(value=>value+20)}>Ещё резервы ({future.length-reserveLimit})</Button>}
  </Section>
  <Section title="Очередь запуска">
   {!data.queue.length?<Typography color="text.secondary">Ожидающих запусков нет.</Typography>:<TableContainer><Table size="small"><TableHead><TableRow><TableCell>Сессия</TableCell><TableCell>В очереди с</TableCell><TableCell>Плановый старт</TableCell><TableCell>Основание</TableCell></TableRow></TableHead><TableBody>{data.queue.map(q=><TableRow key={q.runtimeSessionId}><TableCell>#{q.runtimeSessionId}</TableCell><TableCell>{formatDate(q.requestedAt)}</TableCell><TableCell>{q.plannedStartsAt?formatDate(q.plannedStartsAt):'При освобождении сервера'}</TableCell><TableCell>{q.reservationId?`По резерву #${q.reservationId}`:'Без резерва'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
  </Section>
  <Section title="Сессии">
   {!current.length&&<Typography color="text.secondary">Активных сессий нет.</Typography>}
   <SessionRows sessions={current}/>
   {!!history.length&&<><Button onClick={()=>setHistoryOpen(value=>!value)}>{historyOpen?'Скрыть историю':`История запусков (${history.length})`}</Button>{historyOpen&&<SessionRows sessions={history}/>}</>}
  </Section>
 </Stack>;
}
function SessionRows({sessions}:{sessions:Session[]}) {
 if(!sessions.length)return null;
 return <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Сессия</TableCell><TableCell>Сервер</TableCell><TableCell>Состояние</TableCell><TableCell>Подробности</TableCell></TableRow></TableHead><TableBody>{sessions.map(s=><TableRow key={s.id} selected={new URLSearchParams(window.location.search).get('sessionId')===s.id}><TableCell>{sessionTitle(s)} #{s.id}</TableCell><TableCell>{s.serverId??'Ожидает назначения'}</TableCell><TableCell>{sessionStatus(s)}</TableCell><TableCell>{s.displayStatus?.reason?.message??'—'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}
