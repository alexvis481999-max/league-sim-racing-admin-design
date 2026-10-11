import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { apiFetch, jsonBody, patchJsonBody } from '../../shared/api';
import {TagEditor} from '../../shared/TagEditor';
import type { Skin } from './SkinsPage';
type Revision={metadataVersion:number;version:string;displayName:string;carCode:string;tags:string[];active:boolean;changedAt:string|null;actorId:string|null;archiveUrl:string|null};
type Details=Skin & {history?:Revision[]};
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString('ru-RU'):'Не сохранена при импорте';
export function SkinDetailsDialog({ skin, onClose, onSaved }: { skin: Skin | null; onClose: () => void; onSaved: (skin: Skin) => Promise<void>; onDeleted: () => Promise<void> }) {
 const [details,setDetails]=useState<Details|null>(null),[cars,setCars]=useState<{code:string;title:string}[]>([]);
 const [title,setTitle]=useState(''),[car,setCar]=useState(''),[tags,setTags]=useState<string[]>([]),[active,setActive]=useState(true),[visibility,setVisibility]=useState('private');
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;setDetails(skin);setError('');if(skin){void apiFetch<Details>(`/skins/admin/${skin.id}`).then(value=>{if(live)setDetails(value);}).catch(e=>{if(live)setError(String(e.message??e));});void apiFetch<{code:string;title:string}[]>(`/games/${skin.gameCode}/cars`).then(value=>{if(live)setCars(value);}).catch(e=>{if(live)setError(String(e.message??e));});}return()=>{live=false;};},[skin?.id,skin?.metadataVersion]);
 useEffect(()=>{setTitle(details?.displayName??'');setCar(details?.carCode??'');setTags(details?.tags??[]);setActive(details?.active??true);setVisibility(details?.visibility??'private');setReason('');},[details]);
 if(!skin||!details)return null;
 const editable=!!details.allowedActions?.edit&&!busy,creator=details.createdByUser;
 const creatorName=creator?([creator.firstName,creator.lastName].filter(Boolean).join(' ')||creator.steamName):null;
 async function save(){if(!details)return;setBusy(true);setError('');try{await onSaved(await apiFetch<Skin>(`/skins/admin/${details.id}`,patchJsonBody({expectedVersion:details.metadataVersion??1,patch:{displayName:title.trim(),carCode:car,tags,active,...(details.ownerType==='official'?{}:{visibility})}})));}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function moderate(){if(!details)return;setBusy(true);setError('');try{await onSaved(await apiFetch<Skin>(`/skins/admin/${details.id}/moderation`,jsonBody({expectedVersion:details.metadataVersion??1,blocked:!details.moderation?.blocked,reason})));}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <Dialog open onClose={()=>!busy&&onClose()} fullWidth maxWidth="md"><DialogTitle>{details.displayName}</DialogTitle><DialogContent><Stack spacing={2.5} sx={{pt:1}}>
  {details.previewUrl&&<Box component="img" src={details.previewUrl} alt={details.displayName} sx={{width:'100%',maxHeight:320,objectFit:'contain',bgcolor:'action.hover',borderRadius:1}}/>}
  <Stack direction="row" gap={1} flexWrap="wrap"><Chip label={`ID ${details.id}`} size="small"/><Chip label={`Архив v${details.version}`} size="small"/><Chip label={`Редакция ${details.metadataVersion??1}`} size="small"/><Chip label={details.active?'Активен':'Отключён'} size="small" color={details.active?'success':'default'}/></Stack>
  <Box sx={{display:'grid',gridTemplateColumns:'minmax(120px, 1fr) 3fr',gap:1}}>
   <Typography color="text.secondary">Добавил</Typography><Typography>{creatorName?`${creatorName} · ID ${creator!.id}`:details.createdByUserId?`ID ${details.createdByUserId}`:'Не указан'}</Typography>
   <Typography color="text.secondary">Добавлен</Typography><Typography>{date(details.createdAt)}</Typography>
   <Typography color="text.secondary">Изменён</Typography><Typography>{date(details.updatedAt)}</Typography>
   <Typography color="text.secondary">Папка</Typography><Typography sx={{overflowWrap:'anywhere'}}>{details.folderName}</Typography>
   <Typography color="text.secondary">Владелец</Typography><Typography>{({official:'Официальный',platform:'Платформа',organizer:'Организатор',user:'Игрок'})[details.ownerType]}{details.ownerId?` · ID ${details.ownerId}`:''}</Typography>
  </Box>
  {details.deletedAt&&<Alert severity="info">Владелец удалил скин из нового выбора.</Alert>}
  {details.moderation?.blocked&&<Alert severity="warning">Заблокирован: {details.moderation.reason}</Alert>}
  <Divider/><Typography variant="h6">Параметры скина</Typography>
  <TextField label="Название" value={title} disabled={!editable} onChange={e=>setTitle(e.target.value)}/>
  <Autocomplete options={cars} value={cars.find(c=>c.code===car)??(car?{code:car,title:car}:null)} isOptionEqualToValue={(a,b)=>a.code===b.code} getOptionLabel={c=>c.title} disabled={!editable} onChange={(_,value)=>setCar(value?.code??'')} renderInput={params=><TextField {...params} label="Машина" required/>}/>
  <Box component="fieldset" disabled={!editable} sx={{border:0,p:0,m:0}}><TagEditor value={tags} options={Array.from(new Set(['ac','acc','iracing',...tags]))} onChange={setTags}/></Box>
  {details.ownerType!=='official'&&<TextField select label="Доступ" value={visibility} disabled={!editable} onChange={e=>setVisibility(e.target.value)}><MenuItem value="private">Только владельцу</MenuItem><MenuItem value="public">Для всех</MenuItem></TextField>}
  <FormControlLabel control={<Switch checked={active} disabled={!editable} onChange={(_,checked)=>setActive(checked)}/>} label="Доступен для нового выбора"/>
  {details.archiveUrl&&<Button component="a" href={details.archiveUrl} target="_blank" rel="noreferrer" sx={{alignSelf:'flex-start'}}>Скачать текущий ZIP</Button>}
  <Divider/><Typography variant="h6">История изменений</Typography>
  {details.history?.length?<Box sx={{overflowX:'auto'}}><Table size="small"><TableHead><TableRow>{['Редакция / архив','Дата','Название и машина','Теги','Состояние'].map(label=><TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{details.history.map(row=><TableRow key={row.metadataVersion}><TableCell>{row.metadataVersion} / v{row.version}{row.archiveUrl&&<Button component="a" href={row.archiveUrl} size="small" target="_blank" rel="noreferrer">ZIP</Button>}</TableCell><TableCell>{date(row.changedAt)}{row.actorId&&<Typography variant="caption" display="block">Изменил ID {row.actorId}</Typography>}</TableCell><TableCell>{row.displayName}<Typography variant="caption" display="block">{cars.find(c=>c.code===row.carCode)?.title??row.carCode}</Typography></TableCell><TableCell>{row.tags.join(', ')||'—'}</TableCell><TableCell>{row.active?'Активен':'Отключён'}</TableCell></TableRow>)}</TableBody></Table></Box>:<Typography color="text.secondary">Загрузка истории…</Typography>}
  {details.allowedActions?.moderate&&<><Divider/><Typography variant="h6">Модерация</Typography><TextField label="Причина решения модератора" multiline value={reason} onChange={e=>setReason(e.target.value)}/><Button color="warning" disabled={busy||!reason.trim()} onClick={()=>void moderate()}>{details.moderation?.blocked?'Снять блокировку':'Заблокировать для новых выборов'}</Button></>}
  {error&&<Alert severity="error">{error}</Alert>}
 </Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={busy}>Закрыть</Button><Button variant="contained" disabled={!editable||!title.trim()||!car} onClick={()=>void save()}>Сохранить</Button></DialogActions></Dialog>;
}
