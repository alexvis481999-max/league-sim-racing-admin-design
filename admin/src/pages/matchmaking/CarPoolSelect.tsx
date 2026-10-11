import { useState } from 'react';
import { Autocomplete, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import type { CatalogOption } from '../../features/event-authoring/CatalogFields';

export function CarPoolSelect({label,items,value,onChange,disabled=false,helperText,error=false,itemType='car'}:{
  label:string;items:CatalogOption[];value:string[];onChange(value:string[]):void;disabled?:boolean;helperText?:string;error?:boolean;itemType?:'car'|'weather';
}) {
  const [draft,setDraft]=useState<CatalogOption|null>(null);
  const available=items.filter(car=>!value.includes(car.code));
  const selected=draft&&available.find(car=>car.code===draft.code)||null;
  return <Box sx={{gridColumn:'1 / -1',minWidth:0}} role="group" aria-label={label}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap" sx={{mb:1}}>
      <Typography variant="subtitle2">{label} · {value.length}</Typography>
      <Stack direction="row" gap={1}>
        <Button size="small" disabled={disabled||!available.length} onClick={()=>onChange([...new Set([...value,...items.map(car=>car.code)])])}>Выбрать все</Button>
        <Button size="small" disabled={disabled||!value.length} onClick={()=>onChange([])}>Очистить</Button>
      </Stack>
    </Stack>
    <Stack direction="row" gap={1} sx={{mb:1.5,maxWidth:600}}>
      <Autocomplete size="small" sx={{flex:1,minWidth:0}} options={available} value={selected} disabled={disabled}
        getOptionLabel={car=>car.title} isOptionEqualToValue={(a,b)=>a.code===b.code}
        filterOptions={(options,{inputValue})=>options.filter(car=>`${car.title} ${car.code}`.toLowerCase().includes(inputValue.toLowerCase()))}
        onChange={(_,car)=>setDraft(car)} noOptionsText={itemType==='weather'?'Доступных вариантов погоды не найдено':'Доступных машин не найдено'}
        renderInput={params=><TextField {...params} label={`${itemType==='weather'?'Добавить погоду':'Добавить машину'} — ${label.toLowerCase()}`} placeholder="Название или код"/>}/>
      <Button variant="outlined" disabled={disabled||!selected} onClick={()=>{if(selected){onChange([...value,selected.code]);setDraft(null);}}}>Добавить</Button>
    </Stack>
    <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
      {value.map(code=>{const car=items.find(car=>car.code===code);return <Chip key={code} label={car?.title??`${code} (недоступен)`} title={code} variant="outlined" disabled={disabled} onDelete={()=>onChange(value.filter(id=>id!==code))} sx={{height:34,maxWidth:'100%'}}/>;})}
      {!value.length&&<Typography variant="body2" color="text.secondary">{itemType==='weather'?'Погода не выбрана.':'Машины не выбраны.'}</Typography>}
    </Stack>
    {helperText&&<Typography variant="caption" color={error?'error':'text.secondary'} sx={{display:'block',mt:1}}>{helperText}</Typography>}
  </Box>;
}
