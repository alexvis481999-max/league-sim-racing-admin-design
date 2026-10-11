import { Button, Stack, TextField, Typography } from '@mui/material';
export function TrackLayoutFields({ metadata, onChange }: { metadata: string; onChange(value: string): void }) {
  const value = JSON.parse(metadata) as { layouts?: { code: string; title?: string; pitboxes?: number; isDefault?: boolean; tougeZones?: unknown }[] }, layouts = value.layouts ?? [];
  const save = (next: typeof layouts) => onChange(JSON.stringify({ ...value, layouts: next }, null, 2));
  return <Stack spacing={1}><Typography variant="subtitle2">Конфигурации трассы</Typography><Typography variant="caption">Для архива конфигурации определяются по ui_track.json. Для официальной трассы укажите их здесь; пустой код — основная конфигурация.</Typography>
    {layouts.map((layout, i) => <Stack direction={{xs:'column',md:'row'}} spacing={1} key={i} alignItems="flex-start">
      <TextField label={`Код конфигурации ${i + 1}`} value={layout.code} onChange={e => save(layouts.map((l, n) => n === i ? { ...l, code: e.target.value, isDefault: !e.target.value } : l))} />
      <TextField label={`Название конфигурации ${i + 1}`} value={layout.title ?? ''} onChange={e => save(layouts.map((l, n) => n === i ? { ...l, title: e.target.value } : l))} />
      <TextField label="Количество мест" type="number" value={layout.pitboxes ?? ''} slotProps={{htmlInput:{min:1,step:1,'aria-label':`Количество мест конфигурации ${i+1}`}}} error={layout.pitboxes!==undefined&&(!Number.isSafeInteger(layout.pitboxes)||layout.pitboxes<1)} helperText={layout.pitboxes!==undefined&&(!Number.isSafeInteger(layout.pitboxes)||layout.pitboxes<1)?'Введите целое число больше нуля':'Пит-боксы. Необходимо для создания заезда.'} onChange={e=>save(layouts.map((l,n)=>n===i?{...l,pitboxes:e.target.value===''?undefined:Number(e.target.value)}:l))}/>
      <Button onClick={() => save(layouts.filter((_, n) => n !== i))}>Убрать</Button>
    </Stack>)}
    <Button onClick={() => save([...layouts, { code: layouts.length ? `layout_${layouts.length + 1}` : '', title: '', isDefault: !layouts.length }])}>Добавить конфигурацию</Button>
  </Stack>;
}
