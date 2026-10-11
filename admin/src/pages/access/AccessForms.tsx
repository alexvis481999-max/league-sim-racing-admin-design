import type { GrantConstraints, OrganizerSettings, AccessRole, OrganizerRecord } from '../../shared/access-types';
import { Checkbox, Field, Fields, FilterButtons, FormGroup, SelectField, TextArea, TextField } from '../../ui/v16';
import { localInput, localInstant } from '../events/current/event-time';
import { entryOptions, quotaFields, scopeNames, subtypeOptions, typeOptions, type GrantDraft, type OrganizerDraft } from './access-model';

export function OrganizerMainFields({ value, onChange, disabled }: { value: OrganizerDraft; onChange: (value: OrganizerDraft) => void; disabled: boolean }) {
  const patch = (change: Partial<OrganizerDraft>) => onChange({ ...value, ...change });
  return <div className="lsr-fields">
    <TextField label="Название" required disabled={disabled} value={value.name} onChange={e => patch({ name: e.target.value })} help="Обязательное поле" />
    {!value.presentationOnly && <TextField label="Код" required disabled={disabled} value={value.code} onChange={e => patch({ code: e.target.value })} help="Латинские буквы, цифры, дефис или подчёркивание, 2–64 символа" error={value.code && !/^[a-z0-9_-]{2,64}$/i.test(value.code.trim()) ? 'Недопустимый код' : undefined} />}
    {!value.presentationOnly && <SelectField label="Состояние" disabled={disabled} value={value.active ? 'active' : 'inactive'} onChange={e => patch({ active: e.target.value === 'active' })} options={[{ value: 'active', label: 'Активен' }, { value: 'inactive', label: 'Выключен' }]} />}
    <TextArea label="Описание" full disabled={disabled} value={value.description ?? ''} onChange={e => patch({ description: e.target.value || null })} />
  </div>;
}

export function OrganizerLinkFields({ value, onChange, disabled }: { value: OrganizerDraft; onChange: (value: OrganizerDraft) => void; disabled: boolean }) {
  const settings = (change: Partial<OrganizerSettings>) => onChange({ ...value, settings: { ...value.settings, ...change } });
  return <div className="lsr-fields">
    <TextField label="Сайт" disabled={disabled} value={value.settings.websiteUrl ?? ''} placeholder="https://" onChange={e => settings({ websiteUrl: e.target.value || null })} />
    <TextField label="Discord" disabled={disabled} value={value.settings.discordUrl ?? ''} placeholder="https://discord.gg/…" onChange={e => settings({ discordUrl: e.target.value || null })} />
  </div>;
}

export function OrganizerQuotaFields({ value, record, onChange, disabled }: { value: OrganizerDraft; record?: OrganizerRecord; onChange: (value: OrganizerDraft) => void; disabled: boolean }) {
  const settings = (change: Partial<OrganizerSettings>) => onChange({ ...value, settings: { ...value.settings, ...change } });
  return <>
    <FormGroup title="Квоты" description="Пустое поле — без ограничения. Использование и остаток приходят с сервера и показаны рядом с лимитом.">
      <div className="lsr-stack">
        <Field label="При превышении квоты"><FilterButtons label="При превышении квоты" disabled={disabled} value={value.settings.quotaEnforcementMode} onChange={quotaEnforcementMode => settings({ quotaEnforcementMode })} options={[{ value: 'block', label: 'Блокировать' }, { value: 'warn', label: 'Предупреждать' }]} /></Field>
        <div className="lsr-fields">
          {quotaFields.map(([key, label, usage]) => {
            const current = value.settings[key];
            const invalid = current !== null && !(Number.isSafeInteger(current) && current > 0);
            const used = record?.usage ? record.usage[usage] : null, left = record?.remaining?.[key];
            const hint = record ? `Использовано: ${used ?? '—'}${left != null ? ` · осталось ${left}` : ''}` : 'Пусто — без ограничения';
            return <TextField key={key} label={label} type="number" min={1} step={1} disabled={disabled} value={current ?? ''} placeholder="Без ограничения" error={invalid ? 'Целое число больше нуля или пусто' : undefined} help={hint} onChange={e => settings({ [key]: e.target.value === '' ? null : Number(e.target.value) })} />;
          })}
        </div>
      </div>
    </FormGroup>
    <FormGroup title="Что может создавать" description="Ничего не выбрано — без ограничения. Выбор ограничивает типы в конструкторе событий.">
      <ConstraintChoices value={value.settings} disabled={disabled} onChange={settings} />
    </FormGroup>
  </>;
}

export function GrantEditor({ value, onChange, roles, organizers, disabled }: { value: GrantDraft; onChange: (value: GrantDraft) => void; roles: AccessRole[]; organizers: OrganizerRecord[]; disabled: boolean }) {
  const role = roles.find(item => item.code === value.roleCode);
  const patch = (change: Partial<GrantDraft>) => onChange({ ...value, ...change });
  const inverted = !!value.validFrom && !!value.validTo && Date.parse(value.validFrom) > Date.parse(value.validTo);
  return <div className="lsr-stack">
    <FormGroup title="Роль и область" description={role?.description ?? 'Роль определяет набор разрешений, область — где они действуют.'}>
      <div className="lsr-fields">
        <SelectField label="Роль" required value={value.roleCode} disabled={disabled} onChange={e => { const next = roles.find(item => item.code === e.target.value); if (next) patch({ roleCode: next.code, scopeType: next.scopeTypes[0], scopeId: null }); }} options={[{ value: '', label: 'Выберите роль' }, ...roles.map(item => ({ value: item.code, label: item.title }))]} />
        {role && <SelectField label="Область" value={value.scopeType} disabled={disabled || role.scopeTypes.length === 1} onChange={e => patch({ scopeType: e.target.value as GrantDraft['scopeType'], scopeId: null })} options={role.scopeTypes.map(type => ({ value: type, label: scopeNames[type] }))} />}
        {value.scopeType === 'organizer' && role && <SelectField label="Организатор" required value={value.scopeId ?? ''} disabled={disabled} onChange={e => patch({ scopeId: e.target.value || null })} options={[{ value: '', label: 'Выберите организатора' }, ...organizers.map(item => ({ value: item.id, label: item.name + (item.active ? '' : ' · выключен') }))]} />}
        {value.scopeType === 'event' && role && <TextField required label="ID события" disabled={disabled} value={value.scopeId ?? ''} inputMode="numeric" onChange={e => patch({ scopeId: e.target.value || null })} error={value.scopeId && !/^[1-9]\d*$/.test(value.scopeId) ? 'Числовой ID события' : undefined} />}
      </div>
    </FormGroup>
    <FormGroup title="Срок действия" description="Время московское. Пустое поле — без ограничения.">
      <Fields>
        {(['validFrom', 'validTo'] as const).map(key => <TextField key={key} type="datetime-local" label={key === 'validFrom' ? 'Действует с' : 'Действует до'} value={localInput(value[key] ?? '')} disabled={disabled} error={key === 'validTo' && inverted ? 'Окончание раньше начала' : undefined} onChange={e => patch({ [key]: e.target.value ? localInstant(e.target.value) : null })} />)}
      </Fields>
    </FormGroup>
    <details className="lsr-access-details lsr-formgroup">
      <summary>Ограничения роли · {value.constraints && Object.values(value.constraints).some(item => Array.isArray(item) ? item.length : item != null) ? 'заданы' : 'не заданы'}</summary>
      <div className="lsr-stack" style={{ marginTop: 12 }}>
        <ConstraintChoices value={value.constraints ?? {}} disabled={disabled} onChange={change => patch({ constraints: { ...value.constraints, ...change } })} />
        <div className="lsr-fields"><TextField label="Максимальная длительность события, часов" type="number" min={1} step={1} disabled={disabled} value={value.constraints?.mustEndWithinHours ?? ''} onChange={e => { const { mustEndWithinHours: _hours, ...rest } = value.constraints ?? {}; patch({ constraints: { ...rest, ...(e.target.value ? { mustEndWithinHours: Number(e.target.value) } : {}) } }); }} /></div>
      </div>
    </details>
  </div>;
}

function ConstraintChoices({ value, onChange, disabled }: { value: GrantConstraints; onChange: (change: GrantConstraints) => void; disabled: boolean }) {
  return <div className="lsr-stack is-tight">{([['allowedEventRuntimeTypes', 'Типы событий', typeOptions], ['allowedTougeSubtypes', 'Режимы Тоге', subtypeOptions], ['allowedTougeDuelEntryModes', 'Парные заезды Тоге', entryOptions]] as const).map(([key, label, options]) => <OptionGroup key={key} label={label} options={options} value={value[key] ?? []} disabled={disabled} onChange={next => onChange({ [key]: next })} />)}</div>;
}
function OptionGroup({ label, options, value, onChange, disabled }: { label: string; options: readonly { value: string; label: string }[]; value: string[]; onChange: (value: string[]) => void; disabled: boolean }) {
  const allOptions = [...options, ...value.filter(item => !options.some(option => option.value === item)).map(item => ({ value: item, label: item }))];
  return <div className="lsr-access-options" role="group" aria-label={label}>
    <div className="lsr-field-label">{label} <span className="lsr-muted">· {value.length ? `выбрано ${value.length}` : 'без ограничения'}</span></div>
    <div className="lsr-access-checks">{allOptions.map(option => <Checkbox key={option.value} label={option.label} disabled={disabled} checked={value.includes(option.value)} onChange={() => onChange(value.includes(option.value) ? value.filter(item => item !== option.value) : [...value, option.value])} />)}</div>
  </div>;
}
