import { Box, Stack, Typography, Table, TableHead, TableBody, TableRow, TableCell, TableContainer } from '@mui/material';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api';

type ConditionStats={key:string;title:string;matches:number;finished:number;share:number};
export type MatchmakingAnalyticsData={matches?:number;finished?:number;failed?:number;cancelled?:number;uniquePilots?:number;tracks?:ConditionStats[];weather?:ConditionStats[];cars?:{key:string;title:string;selections:number;finished:number;wins:number;share:number;winRate:number|null}[]};

export function MatchmakingAnalytics({data}:{data:MatchmakingAnalyticsData|null}) {
  const [carNames,setCarNames]=useState<Record<string,string>>({});
  const hasCars=!!data?.cars?.length;
  useEffect(()=>{if(!hasCars)return;let active=true;apiFetch<{code:string;title:string}[]>('/games/assetto_corsa/cars',{},'none').then(cars=>{if(active)setCarNames(Object.fromEntries(cars.map(c=>[c.code,c.title])));}).catch(()=>{});return()=>{active=false;};},[hasCars]);
  if(!data)return <Typography color="text.secondary">Загрузка аналитики…</Typography>;
  const total=data.matches??0;
  const outcomes=[['Завершено',data.finished??0],['Технические ошибки',data.failed??0],['Отменено',data.cancelled??0],['В процессе',Math.max(0,total-(data.finished??0)-(data.failed??0)-(data.cancelled??0))]] as const;
  const percent=(value:number)=>total?Math.round(value/total*100):0;
  return <Box className="matchmaking-analytics">
    <Typography variant="subtitle2" color="text.secondary">За всё время</Typography>
    <Box className="matchmaking-metrics">
      {[[total,'Всего пар'],[data.uniquePilots??0,'Уникальных пилотов'],[total?`${percent(data.finished??0)}%`:'—','Завершённых матчей']].map(([value,label])=><Box key={label}>
        <Typography className="matchmaking-metric-value">{value}</Typography><Typography color="text.secondary" variant="body2">{label}</Typography>
      </Box>)}
    </Box>
    <Typography variant="h6" sx={{mb:2}}>Выбор машин и победы</Typography>
    <Typography variant="body2" color="text.secondary" sx={{mb:1}}>Последний сохранённый выбор каждого пилота в паре. Процент побед — среди завершённых участий с опубликованным результатом.</Typography>
    {data.cars?.length?<TableContainer><Table size="small" aria-label="Статистика машин"><TableHead><TableRow>{['Машина','Выбрали','Доля выбора','Завершено','Победы','% побед'].map(h=><TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>{data.cars.map(car=><TableRow key={car.key}><TableCell>{carNames[car.key]??car.title}</TableCell><TableCell>{car.selections}</TableCell><TableCell>{car.share}%</TableCell><TableCell>{car.finished}</TableCell><TableCell>{car.wins}</TableCell><TableCell>{car.winRate===null?'—':`${car.winRate}%`}</TableCell></TableRow>)}</TableBody></Table></TableContainer>:<Typography color="text.secondary">Машины пока не выбирали.</Typography>}
    <Box className="matchmaking-condition-stats">
      {([['Трассы',data.tracks],['Погода',data.weather]] as const).map(([title,items])=><Box key={title}>
        <Typography variant="h6" sx={{mb:1}}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{mb:2}}>Частота выпадения среди всех подобранных пар.</Typography>
        {items?.length?<Stack spacing={2}>{items.map(item=><Box key={item.key}>
          <Stack direction="row" justifyContent="space-between" gap={2}><Typography variant="body2">{item.title}</Typography><Typography variant="body2" sx={{whiteSpace:'nowrap'}}>{item.matches} · {item.share}%</Typography></Stack>
          <Box className="matchmaking-outcome-track" sx={{mt:0.75}}><Box sx={{width:`${item.share}%`,height:'100%',bgcolor:'primary.main'}}/></Box>
        </Box>)}</Stack>:<Typography color="text.secondary">Данных пока нет.</Typography>}
      </Box>)}
    </Box>
    <Typography variant="h6" sx={{mb:2}}>Исходы матчей</Typography>
    {!total?<Typography color="text.secondary">Матчей пока нет. Статистика появится после первой подобранной пары.</Typography>:<Stack spacing={2}>
      {outcomes.map(([label,count])=><Box key={label} className="matchmaking-outcome">
        <Typography variant="body2">{label}</Typography>
        <Box className="matchmaking-outcome-track"><Box sx={{width:`${percent(count)}%`,height:'100%',bgcolor:'primary.main'}}/></Box>
        <Typography variant="body2" sx={{fontVariantNumeric:'tabular-nums',textAlign:'right'}}>{count} <Typography component="span" color="text.secondary" variant="caption">· {percent(count)}%</Typography></Typography>
      </Box>)}
    </Stack>}
  </Box>;
}
