import { Autocomplete, Button, Stack, TextField } from '@mui/material';

export function TagEditor({ options, value, onChange, label = 'Теги', placeholder, requiredTags = [] }: { options: string[]; value: string[]; onChange: (value: string[]) => void; label?: string; placeholder?: string; requiredTags?: string[] }) {
  const normalizedRequired = requiredTags.map(normalizeTag);
  const normalize = (items: readonly string[]) => Array.from(new Set([...normalizedRequired, ...items.map(normalizeTag).filter(Boolean)]));
  const selected = normalize(value);
  const selectedSet = new Set(selected);
  const available = options.map(normalizeTag).filter((tag) => tag && !selectedSet.has(tag)).slice(0, 24);
  return <Stack spacing={1}>
    <Autocomplete multiple freeSolo size="small" options={options} value={selected} onChange={(_, next) => onChange(normalize(next))} getOptionDisabled={(option) => normalizedRequired.includes(normalizeTag(option))} renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />} />
    {available.length ? <Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap">{available.map((tag) => <Button key={tag} size="small" variant="outlined" onClick={() => onChange(normalize([...selected, tag]))} sx={{ minHeight: 24, py: .25 }}>{tag}</Button>)}</Stack> : null}
  </Stack>;
}

function normalizeTag(value: string) { return String(value ?? '').trim().toLowerCase(); }
