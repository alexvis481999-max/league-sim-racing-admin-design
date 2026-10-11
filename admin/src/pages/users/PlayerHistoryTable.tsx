import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { apiFetch } from '../../shared/api';

export type HistoryRow = Record<string, unknown>;
export const field = (row: HistoryRow, path: string): unknown => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as HistoryRow)[key] : undefined, row);
export const display = (value: unknown): string => value === null || value === undefined || value === '' ? '—' : typeof value === 'object' ? '—' : String(value);
export const date = (value: unknown) => value && Number.isFinite(Date.parse(String(value))) ? new Date(String(value)).toLocaleString('ru') : '—';
const labels: Record<string,string> = { ACCEPTED:'Принят',PENDING:'Ожидает',REJECTED:'Отклонён',WITHDRAWN:'Снялся',REMOVED:'Удалён',QUEUED:'В очереди',MATCHED:'Матч найден',LEFT:'Вышел',COMPLETED:'Завершено',FAILED:'Ошибка',CANCELLED:'Отменено',READY_CHECK:'Проверка готовности',STARTING:'Запуск',RUNNING:'Идёт',FINISHED:'Завершено',CLASSIFIED:'Финиш',DNF:'Не финишировал',DSQ:'Дисквалификация',DISCONNECTED:'Отключился',CONNECTED:'Подключился',active:'Активно',revoked:'Отозвано',expired:'Истекло',submitted:'Подана',under_review:'Рассматривается',needs_info:'Нужны сведения',resolved:'Решена',rejected:'Отклонена',withdrawn:'Отозвана',duplicate:'Повторная',public_chat_mute:'Мут общего чата',global_chat_mute:'Мут всех чатов',event_ban:'Запрет участия в событии',organizer_ban:'Запрет у организатора',matchmaking_ban:'Запрет матчмейкинга',competition_ban:'Запрет соревнований',available:'Доступен',inactive:'Неактивен',blocked:'Заблокирован',deleted:'Удалён',user:'Сайт',admin:'Админка',APPLIED:'Начисление',REVERSED:'Отмена начисления',CORRECTION:'Коррекция' };
export const status = (value: unknown) => labels[String(value)] ?? display(value);
export type Column = { title:string; key?:string; render?(row:HistoryRow):ReactNode };

/** One visible page per request; switching resource remounts this component. */
export function PlayerHistoryTable({url,columns,paging='cursor',caption,summary}:{url:string;columns:Column[];paging?:'cursor'|'page'|'sequence';caption?:string;summary?(data:HistoryRow):ReactNode}) {
  const [cursors,setCursors]=useState(['']),[data,setData]=useState<HistoryRow|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const index=cursors.length-1;
  useEffect(()=>{let live=true;setData(null);setError('');
    const query=new URLSearchParams(url.split('?')[1]??'');
    if(paging==='page')query.set('page',String(index+1));else if(cursors[index])query.set(paging==='sequence'?'afterSequence':url.startsWith('/admin/audit')?'cursor':'afterId',cursors[index]);
    const path=url.split('?')[0]+(query.size?'?'+query:'');
    void apiFetch<HistoryRow|unknown[]>(path).then(value=>{if(live)setData(Array.isArray(value)?{items:value}:value);}).catch(e=>{if(live)setError(e.status===403?'Недостаточно прав для просмотра этого раздела.':e.message??'Не удалось загрузить данные.');});
    return()=>{live=false;};
  },[url,index,cursors,retry,paging]);
  const rows=Array.isArray(data?.items)?data.items as HistoryRow[]:[];
  const next=data?.nextAfterId??data?.nextCursor??data?.nextAfterSequence;
  const hasMore=paging==='page'?Boolean(data?.hasMore)||Number(field(data??{},'pagination.totalPages'))>index+1:next!==null&&next!==undefined;
  return <Box>{caption&&<Typography variant="body2" color="text.secondary" sx={{mb:2}}>{caption}</Typography>}
    {error?<Alert severity="error" action={<Button onClick={()=>setRetry(v=>v+1)}>Повторить</Button>}>{error}</Alert>:<>
      {data&&summary?.(data)}
      <TableContainer><Table size="small"><TableHead><TableRow>{columns.map(c=><TableCell key={c.title}>{c.title}</TableCell>)}</TableRow></TableHead><TableBody>
        {!data?Array.from({length:5},(_,i)=><TableRow key={i}>{columns.map(c=><TableCell key={c.title}><Skeleton height={28}/></TableCell>)}</TableRow>):rows.map((row,i)=><TableRow key={String(row.id??i)} hover>{columns.map(c=><TableCell key={c.title} sx={{py:1.5,overflowWrap:'anywhere'}}>{c.render?c.render(row):display(field(row,c.key??''))}</TableCell>)}</TableRow>)}
        {data&&!rows.length&&<TableRow><TableCell colSpan={columns.length} sx={{py:4}}>Записей пока нет.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
      <Stack direction="row" spacing={1} alignItems="center" sx={{mt:2}}><Button disabled={!index||!data} onClick={()=>setCursors(v=>v.slice(0,-1))}>Назад</Button><Typography variant="body2">Страница {index+1}</Typography><Button disabled={!data||!hasMore} onClick={()=>setCursors(v=>[...v,String(next??index+1)])}>Далее</Button><Button disabled={!data} onClick={()=>setRetry(v=>v+1)}>Обновить</Button></Stack>
    </>}
  </Box>;
}
