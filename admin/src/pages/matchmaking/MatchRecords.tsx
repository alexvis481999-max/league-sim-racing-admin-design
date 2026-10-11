import {useState} from 'react';
import {Alert,Box,Button,Chip,Dialog,DialogActions,DialogContent,DialogTitle,Divider,List,ListItemButton,Stack,Typography} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {displayDateTime,displayMatchStatus} from '../../../../shared/presentation';
import {MatchDetails} from './MatchDetails';
import type {Match} from './MatchmakingPage';

const statusLabel=(match:Match)=>match.status==='FAILED'&&!match.startedAt?'Ошибка запуска':match.runtimeStatus==='WAITING_CAPACITY'?'Ожидает сервер':displayMatchStatus(match.status);
const statusColor=(match:Match)=>match.status==='FAILED'?'error':match.status==='FINISHED'?'success':'default';
const winner=(match:Match)=>match.players.find(p=>p.id===match.result?.winnerId)?.name;
const score=(match:Match)=>match.result?.rounds?.length&&match.players.length===2&&match.players.every(p=>typeof match.result?.roundsWon?.[p.id]==='number')?match.players.map(p=>match.result!.roundsWon![p.id]).join(' : '):'—';

export function MatchRecords({items,queueId}:{items:Match[];queueId:string|undefined}){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const match=items.find(item=>item.id===selectedId);
  if(!items.length)return <Typography color="text.secondary">Заездов пока нет.</Typography>;
  return <>
    <List disablePadding aria-label="Заезды матчмейкинга">
      {items.map(item=><ListItemButton key={item.id} onClick={()=>setSelectedId(item.id)} aria-label={`Открыть заезд №${item.id}`} sx={{px:2,py:1.5,borderBottom:1,borderColor:'divider',display:'grid',gridTemplateColumns:{xs:'1fr auto',md:'155px minmax(180px,1.4fr) minmax(140px,1fr) minmax(170px,1fr) 20px'},gap:2}}>
        <Box sx={{display:{xs:'none',md:'block'}}}><Typography variant="body2">{displayDateTime(item.startedAt??item.createdAt)}</Typography><Typography variant="caption" color="text.secondary">№{item.id}</Typography></Box>
        <Box sx={{minWidth:0}}><Typography variant="body2" fontWeight={750}>{item.players.map(p=>p.name).join(' · ')}</Typography><Typography variant="caption" color="text.secondary">{winner(item)?`Победа: ${winner(item)}`:item.result?'Без победителя':'Результат отсутствует'}{score(item)!=='—'?` · ${score(item)}`:''}</Typography><Typography variant="caption" color="text.secondary" sx={{display:{xs:'block',md:'none'}}}>№{item.id} · {displayDateTime(item.startedAt??item.createdAt)}</Typography></Box>
        <Box sx={{display:{xs:'none',md:'block'},minWidth:0}}><Typography variant="body2">{item.condition.trackTitle}</Typography><Typography variant="caption" color="text.secondary">{item.condition.weatherTitle}{item.condition.pool?` · ${item.condition.pool.durationMinutes} мин`:''}</Typography></Box>
        <Chip size="small" variant="outlined" label={statusLabel(item)} color={statusColor(item)} sx={{justifySelf:'start',maxWidth:'100%'}}/>
        <ChevronRightIcon color="action" sx={{display:{xs:'none',md:'block'}}}/>
      </ListItemButton>)}
    </List>
    <Dialog open={!!match} onClose={()=>setSelectedId(null)} fullWidth maxWidth="md" aria-labelledby="match-record-title">
      {match&&<>
        <DialogTitle id="match-record-title"><Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}><span>Заезд №{match.id}</span><Chip size="small" label={statusLabel(match)} color={statusColor(match)}/></Stack><Typography variant="body2" color="text.secondary" sx={{mt:1}}>{match.condition.trackTitle} · {match.condition.weatherTitle}{match.condition.pool?` · ${match.condition.pool.durationMinutes} мин`:''}</Typography></DialogTitle>
        <DialogContent dividers>
          <Box sx={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:2,alignItems:'start',py:2}}>
            {match.players.map((player,index)=><Box key={player.id} sx={{gridColumn:index===0?1:3,gridRow:1,textAlign:index===0?'left':'right',minWidth:0}}>
              <Button component="a" href={`/users?userId=${player.id}`} sx={{p:0,minHeight:0,textAlign:'inherit',fontSize:16,overflowWrap:'anywhere'}}>{player.name}</Button>
              <Typography variant="body2" color="text.secondary" sx={{mt:1,overflowWrap:'anywhere'}}>{player.selection?.carId??'Машина не выбрана'}</Typography>
              <Typography variant="caption" color="text.secondary">{player.ready?'Готов':'Не готов'}{player.selection?.skinId?` · скин №${player.selection.skinId}`:''}</Typography>
              {match.result?.winnerId===player.id&&<Typography variant="body2" color="success.main" fontWeight={750} sx={{mt:1}}>Победа</Typography>}
            </Box>)}
            <Box sx={{gridColumn:2,gridRow:1,textAlign:'center'}}><Typography variant="h4" fontWeight={800}>{score(match)}</Typography><Typography variant="caption" color="text.secondary">{score(match)==='—'?'Без счёта':'По раундам'}</Typography></Box>
          </Box>
          {match.status==='READY_CHECK'&&<Alert severity="info" sx={{mb:2}}>Готовность до {displayDateTime(match.readyDeadlineAt)}</Alert>}
          {(match.failure||match.runtimeFailure)&&<Alert severity={match.status==='FAILED'?'error':'warning'} sx={{mb:2}}>{match.failure&&<div>Заезд прерван: {match.failure}</div>}{match.runtimeFailure&&<div>{match.runtimeFailure.message??match.runtimeFailure.code}</div>}</Alert>}
          <MatchDetails match={match}/>
          <Divider sx={{my:2.5}}/>
          <Typography variant="subtitle2" sx={{mb:1.5}}>Действия и журналы</Typography>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
            {match.resultId&&<Button variant="contained" component="a" href={`/officiating?matchmakingId=${queueId}&matchId=${match.id}&resultId=${match.resultId}`}>Решения по заезду</Button>}
            <Button variant="outlined" component="a" href={`/runtime?matchmakingId=${queueId}&matchId=${match.id}`}>Журнал игры</Button>
            {match.runtimeSessionId&&<Button variant="outlined" component="a" href={`/runtime?sessionId=${match.runtimeSessionId}`}>Сессия №{match.runtimeSessionId}</Button>}
            <Button variant="outlined" component="a" href={`/audit?q=${encodeURIComponent(`matchmaking ${match.id}`)}`}>Аудит</Button>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={()=>setSelectedId(null)}>Закрыть</Button></DialogActions>
      </>}
    </Dialog>
  </>;
}
