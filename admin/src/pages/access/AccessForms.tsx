import { Box, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { GrantConstraints, OrganizerSettings, AccessRole, AccessGrantRecord, OrganizerRecord } from '../../shared/access-types';
import { FieldGrid, FormCell, FilterButtons } from '../../shared/ui';
import { localInput, localInstant } from '../events/current/event-time';

export const defaultSettings: OrganizerSettings = { maxEvents: null, maxRaceEvents: null, maxConcurrentEvents: null, maxConcurrentRaces: null, quotaEnforcementMode: 'block', allowedEventRuntimeTypes: [], allowedTougeSubtypes: [], allowedTougeDuelEntryModes: [], theme: null, websiteUrl: null, discordUrl: null };
export type OrganizerDraft = Pick<OrganizerRecord, 'code' | 'name' | 'description' | 'active' | 'settings'> & { id?: string; version?: string; presentationOnly?: boolean };
export type GrantDraft = Omit<AccessGrantRecord, 'id' | 'version' | 'revokedAt' | 'status'> & { id?: string; version?: string };
export const scopeNames = { platform: 'Вся платформа', organizer: 'Организатор', event: 'Событие' };
export const statusNames = { active: 'Действует', scheduled: 'Запланирован', expired: 'Истёк', revoked: 'Отозван' };
export const quotaFields = [
  ['maxEvents', 'Всего событий', 'events'], ['maxRaceEvents', 'Всего гонок', 'raceEvents'],
  ['maxConcurrentEvents', 'Одновременно событий', 'activeEvents'], ['maxConcurrentRaces', 'Одновременно гонок', 'activeRaces'],
] as const;
const typeOptions = [{ value: 'single', label: 'Разовая гонка' }, { value: 'championship', label: 'Чемпионат' }, { value: 'weekly', label: 'Викли' }, { value: 'practice', label: 'Практика' }, { value: 'time_attack', label: 'Тайм-аттак' }, { value: 'touge', label: 'Тоге' }];
const subtypeOptions = [{ value: 'time_attack', label: 'Тайм-аттак' }, { value: 'duel', label: 'Дуэль' }, { value: 'tournament', label: 'Турнир' }];
const entryOptions = [{ value: 'manual', label: 'Ручные дуэли' }, { value: 'matchmaking', label: 'Матчмейкинг' }];
export const eventTypeName = (value: string) => typeOptions.find(option => option.value === value)?.label ?? value;
export function dateLabel(value: string | null) { return value ? new Date(value).toLocaleString('ru-RU', {  dateStyle: 'short', timeStyle: 'short' }) : 'Без ограничения'; }

export function OrganizerEditor({ value, onChange, disabled }: { value: OrganizerDraft; onChange: (value: OrganizerDraft) => void; disabled: boolean }) {
  const patch = (change: Partial<OrganizerDraft>) => onChange({ ...value, ...change });
  const settings = (change: Partial<OrganizerSettings>) => patch({ settings: { ...value.settings, ...change } });
  return <Stack spacing={2}>
    <FieldGrid>
      {!value.presentationOnly && <FormCell><TextField label="Код" required disabled={disabled} value={value.code} onChange={e => patch({ code: e.target.value })} helperText="Латинские буквы, цифры, дефис или подчёркивание" /></FormCell>}
      <FormCell><TextField label="Название" required disabled={disabled} value={value.name} onChange={e => patch({ name: e.target.value })} /></FormCell>
      {!value.presentationOnly && <FormCell><FormControlLabel label="Активен" control={<Checkbox disabled={disabled} checked={value.active} onChange={e => patch({ active: e.target.checked })} />} /></FormCell>}
      <FormCell wide><TextField label="Описание" multiline minRows={2} disabled={disabled} value={value.description ?? ''} onChange={e => patch({ description: e.target.value || null })} /></FormCell>
      <FormCell><TextField label="Сайт" disabled={disabled} value={value.settings.websiteUrl ?? ''} onChange={e => settings({ websiteUrl: e.target.value || null })} /></FormCell>
      <FormCell><TextField label="Discord" disabled={disabled} value={value.settings.discordUrl ?? ''} onChange={e => settings({ discordUrl: e.target.value || null })} /></FormCell>
    </FieldGrid>
    {!value.presentationOnly && <>
      <Typography variant="subtitle2" fontWeight={800}>Квоты</Typography>
      <FilterButtons label="При превышении квоты" value={value.settings.quotaEnforcementMode} disabled={disabled} onChange={quotaEnforcementMode => settings({ quotaEnforcementMode })} options={[{ value: 'block', label: 'Блокировать' }, { value: 'warn', label: 'Предупреждать' }]} />
      <FieldGrid>{quotaFields.map(([key, label]) => <FormCell key={key}><TextField label={label} type="number" disabled={disabled} value={value.settings[key] ?? ''} inputProps={{ min: 1, step: 1 }} helperText="Пусто — без ограничения" onChange={e => settings({ [key]: e.target.value === '' ? null : Number(e.target.value) })} /></FormCell>)}</FieldGrid>
      <Typography variant="subtitle2" fontWeight={800}>Что может создавать</Typography>
      <ConstraintChoices value={value.settings} disabled={disabled} onChange={settings} />
    </>}
  </Stack>;
}

export function GrantEditor({ value, onChange, roles, organizers, disabled }: { value: GrantDraft; onChange: (value: GrantDraft) => void; roles: AccessRole[]; organizers: OrganizerRecord[]; disabled: boolean }) {
  const role = roles.find(item => item.code === value.roleCode);
  const patch = (change: Partial<GrantDraft>) => onChange({ ...value, ...change });
  return <Stack spacing={2}>
    <FieldGrid>
      <FormCell><TextField select required label="Роль" value={value.roleCode} disabled={disabled} onChange={e => { const next = roles.find(item => item.code === e.target.value)!; patch({ roleCode: next.code, scopeType: next.scopeTypes[0], scopeId: null }); }}><MenuItem value="" disabled>Выберите роль</MenuItem>{roles.map(item => <MenuItem key={item.code} value={item.code}>{item.title}</MenuItem>)}</TextField></FormCell>
      {role && <FormCell><TextField select label="Область" value={value.scopeType} disabled={disabled || role.scopeTypes.length === 1} onChange={e => patch({ scopeType: e.target.value as GrantDraft['scopeType'], scopeId: null })}>{role.scopeTypes.map(type => <MenuItem key={type} value={type}>{scopeNames[type]}</MenuItem>)}</TextField></FormCell>}
      {value.scopeType === 'organizer' && <FormCell><TextField select label="Организатор" required value={value.scopeId ?? ''} disabled={disabled} onChange={e => patch({ scopeId: e.target.value })}><MenuItem value="" disabled>Выберите организатора</MenuItem>{organizers.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField></FormCell>}
      {value.scopeType === 'event' && <FormCell><TextField required label="ID события" disabled={disabled} value={value.scopeId ?? ''} onChange={e => patch({ scopeId: e.target.value || null })} /></FormCell>}
    </FieldGrid>
    {role && <Typography variant="body2" color="text.secondary">{role.description}</Typography>}
    <Typography variant="subtitle2" fontWeight={800}>Срок действия</Typography>
    <FieldGrid>{(['validFrom', 'validTo'] as const).map(key => <FormCell key={key}><TextField type="datetime-local" label={key === 'validFrom' ? 'Действует с,' : 'Действует до,'} value={localInput(value[key] ?? '')} disabled={disabled} slotProps={{ inputLabel: { shrink: true } }} helperText="Пусто — без ограничения" onChange={e => patch({ [key]: e.target.value ? localInstant(e.target.value) : null })} /></FormCell>)}</FieldGrid>
    <Box component="details"><Box component="summary" sx={{ cursor: 'pointer', fontSize: 14, color: 'text.secondary' }}>Ограничения роли</Box><Stack spacing={1.5} sx={{ mt: 1.5 }}>
      <ConstraintChoices value={value.constraints ?? {}} disabled={disabled} onChange={change => patch({ constraints: { ...value.constraints, ...change } })} />
      <TextField label="Максимальная длительность события, часов" type="number" inputProps={{ min: 1, step: 1 }} disabled={disabled} value={value.constraints?.mustEndWithinHours ?? ''} onChange={e => { const { mustEndWithinHours: _hours, ...rest } = value.constraints ?? {}; patch({ constraints: { ...rest, ...(e.target.value ? { mustEndWithinHours: Number(e.target.value) } : {}) } }); }} />
    </Stack></Box>
  </Stack>;
}
function ConstraintChoices({ value, onChange, disabled }: { value: GrantConstraints; onChange: (change: GrantConstraints) => void; disabled: boolean }) {
  return <>{([['allowedEventRuntimeTypes', 'Типы событий', typeOptions], ['allowedTougeSubtypes', 'Режимы Тоге', subtypeOptions], ['allowedTougeDuelEntryModes', 'Парные заезды Тоге', entryOptions]] as const).map(([key, label, options]) => <OptionGroup key={key} label={label} options={options} value={value[key] ?? []} disabled={disabled} onChange={next => onChange({ [key]: next })} />)}</>;
}
function OptionGroup({ label, options, value, onChange, disabled }: { label: string; options: readonly { value: string; label: string }[]; value: string[]; onChange: (value: string[]) => void; disabled: boolean }) {
  const allOptions = [...options, ...value.filter(item => !options.some(option => option.value === item)).map(item => ({ value: item, label: item }))];
  return <Stack gap={0.5}><Typography variant="caption" color="text.secondary">{label} · ничего не выбрано — без ограничения</Typography><Stack direction="row" useFlexGap flexWrap="wrap" gap={0.5}>{allOptions.map(option => <FormControlLabel key={option.value} label={option.label} control={<Checkbox size="small" disabled={disabled} checked={value.includes(option.value)} onChange={() => onChange(value.includes(option.value) ? value.filter(item => item !== option.value) : [...value, option.value])} />} />)}</Stack></Stack>;
}
