import { LocalDateTimeField } from './LocalDateTimeField';
import { FieldCapabilities, FieldIssues, EditingRestrictions, read, write } from './form-state';
import { useContext } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Settings, Value } from './types';
export interface FieldsProps {
  value: Settings;
  onChange: (value: Settings) => void;
  disabled?: boolean;
  prefix?: string;
}
export function Field({
  value,
  onChange,
  disabled,
  prefix = '',
  path,
  label,
  type = 'text',
  options,
  nullable = false,
}: {
  path: string;
  label: string;
  type?: 'text' | 'number' | 'datetime-local' | 'date' | 'time' | 'boolean';
  options?: readonly string[];
  nullable?: boolean;
} & FieldsProps) {
  const capabilities = useContext(FieldCapabilities);
  const issues = useContext(FieldIssues);
  const constraint = capabilities?.constraints[path.split('.').at(-1)!];
  const key = prefix ? prefix + '.' + path : path,
    current = read(value, key);
  const restrictions = useContext(EditingRestrictions);
  const inactive =
    disabled ||
    restrictions?.paths.some((pattern) => {
      const parts = pattern.split('.');
      const address = key.split('.');
      return parts.every((part, i) => part === '*' || part === address[i]);
    });
  const issue = issues.find((issue) => issue.path === key);
  const change = (next: Value) => onChange(write(value, key, next));
  if (options && options.length <= 6)
    return (
      <div className="lsr-field" data-field-path={key}>
        <span className="lsr-field-label">{label}</span>
        <div className="lsr-filterbar" role="group" aria-label={label}>
          {options.map((option) => (
            <button
              type="button"
              key={option}
              disabled={inactive}
              aria-pressed={String(current) === option}
              className={`lsr-pillbtn is-lg${String(current) === option ? ' is-active' : ''}`}
              onClick={() => change(type === 'number' ? Number(option) : option)}
            >
              {optionLabels[option] ?? option}
            </button>
          ))}
        </div>
        {issue && <small role="alert" style={{ color: '#ae4743' }}>{issue.message}</small>}
      </div>
    );
  if (type === 'boolean')
    return (
      <FormControlLabel
        label={label}
        control={
          <Checkbox
            disabled={inactive}
            checked={current === true}
            onChange={(e) => change(e.target.checked)}
          />
        }
      />
    );
  if (type === 'datetime-local')
    return (
      <Box data-field-path={key}>
        <LocalDateTimeField
          value={String(current ?? '')}
          onChange={change}
          label={label}
          disabled={inactive}
          error={issue?.message}
        />
      </Box>
    );
  const display = current ?? '';
  return (
    <TextField
      error={!!issue}
      helperText={
        issue?.message ??
        (type === 'number' && constraint
          ? (constraint.integer ? 'Целое число' : 'Число') +
            (constraint.minimum !== undefined
              ? ' от ' + constraint.minimum
              : constraint.exclusiveMinimum !== undefined
                ? ' больше ' + constraint.exclusiveMinimum
                : '')
          : undefined)
      }
      fullWidth
      size="small"
      data-field-path={key}
      placeholder={type === 'date' ? 'ГГГГ-ММ-ДД' : type === 'time' ? 'ЧЧ:ММ' : undefined}
      name={key}
      label={label}
      select={!!options}
      disabled={inactive}
      value={display}
      type={type === 'number' ? 'text' : type}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { inputMode: type === 'number' ? 'decimal' : undefined },
      }}
      onChange={(e) => {
        const text = e.target.value;
        change(
          type === 'number'
            ? text === ''
              ? nullable
                ? null
                : ''
              : /^-?\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text))
                ? Number(text)
                : text
            : text,
        );
      }}
    >
      {options?.map((option) => (
        <MenuItem key={option} value={option}>
          {optionLabels[option] ?? option}
        </MenuItem>
      ))}
    </TextField>
  );
}
const optionLabels: Record<string, string> = {
  '0': 'Запрещено',
  '1': 'Заводская настройка',
  '2': 'Разрешено',
  SINGLE_RACE: 'Одна гонка',
  REVERSE_GRID_DOUBLE_RACE: 'Две гонки с реверсом',
  SINGLE: 'После одного поражения',
  DOUBLE: 'После двух поражений',
  SEEDED: 'По посеву',
  RANDOM: 'Случайный',
  open_until_capacity: 'Свободная запись',
  application_review: 'Рассмотрение заявок',
  locked_roster: 'Состав организатора',
  none: 'Без начисления',
  result: 'По результатам',
  classic_top_10: 'Очки за первые десять мест',
  OPEN: 'Без общей заявки',
  EVENT_REGISTRATION: 'Общая заявка',
  TIME_ATTACK_QUALIFICATION: 'Предквалификация',
  DIRECT_REGISTRATION: 'Прямая регистрация',
  reset_points: 'С обнулением очков',
  free: 'Без потери очков',
};
export function FieldGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="lsr-formgroup authoring-group">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      <div className="lsr-fields authoring-field-grid" style={description ? undefined : { marginTop: 13 }}>{children}</div>
    </section>
  );
}
export function EnvironmentFields({
  standalone = false,
  disableTrackLimits = false,
  ...props
}: FieldsProps & { standalone?: boolean; disableTrackLimits?: boolean }) {
  const capabilities = useContext(FieldCapabilities);
  const groups = [
    [
      'Состояние трассы',
      [
        ['environment.sunAngle', 'Положение солнца'],
        ['environment.dynamicTrack.sessionStart', 'Начальное сцепление'],
        ['environment.dynamicTrack.randomness', 'Случайное изменение'],
        ['environment.dynamicTrack.sessionTransfer', 'Перенос сцепления'],
        ['environment.dynamicTrack.lapGain', 'Рост сцепления'],
      ],
    ],
    [
      'Правила симуляции',
      [
        ['simulation.tyreWearRatePercent', 'Износ шин, %'],
        ['simulation.fuelRatePercent', 'Расход топлива, %'],
        ['simulation.damageMultiplierPercent', 'Повреждения, %'],
        ['simulation.allowedTyresOut', 'Шин вне трассы'],
      ],
    ],
    [
      'Завершение заезда',
      [
        ['finishRules.qualifyingMaximumWaitPercent', 'Ожидание квалификации, %'],
        ['finishRules.raceOverTimeSeconds', 'Ожидание после финиша, сек'],
      ],
    ],
  ] as const;
  return (
    <Stack gap={2}>
      <FieldGroup title="Помощники">
        <Field
          {...props}
          path="assists.absAllowed"
          label="ABS"
          type="number"
          options={capabilities?.options.assists ?? ['0', '1', '2']}
        />
        <Field
          {...props}
          path="assists.tractionControlAllowed"
          label="Контроль тяги"
          type="number"
          options={capabilities?.options.assists ?? ['0', '1', '2']}
        />
        <Field {...props} path="assists.stabilityAllowed" label="Стабилизация" type="boolean" />
        <Field
          {...props}
          path="assists.forceVirtualMirror"
          label="Виртуальное зеркало"
          type="boolean"
        />
        {standalone && (
          <>
            <Field
              {...props}
              path="assists.autoClutchAllowed"
              label="Автосцепление"
              type="boolean"
            />
            <Field
              {...props}
              path="assists.tyreBlanketsAllowed"
              label="Грелки шин"
              type="boolean"
            />
          </>
        )}
      </FieldGroup>
      {groups
        .filter(([title]) => !standalone || title !== 'Завершение заезда')
        .map(([title, fields]) => (
          <FieldGroup key={title} title={title}>
            {fields.filter(([path])=>!disableTrackLimits||path!=='simulation.allowedTyresOut').map(([path, label]) => (
              <Field {...props} key={path} path={path} label={label} type="number" />
            ))}
          </FieldGroup>
        ))}
    </Stack>
  );
}
