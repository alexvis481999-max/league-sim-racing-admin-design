import { WeeklyScheduleEditor } from './WeeklyScheduleEditor';
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { useContext, useState } from 'react';
import type { Descriptor, Settings } from './types';
import { Field, FieldGroup, type FieldsProps } from './Fields';
import { EditingRestrictions, read, write } from './form-state';
import { ContentSelectionFields } from './ContentSelectionFields';
type Props = FieldsProps & {
  descriptor: Descriptor;
  previewBlocks?: { key: string; schedule: { startsAt: string } }[];
};
function Content(props: FieldsProps & { scope?: 'all' | 'common' | 'stage' }) {
  const path = props.prefix ?? 'game',
    game = read(props.value, path) as Settings;
  return game ? (
    <ContentSelectionFields
      path={path}
      organizerId={String(read(props.value, 'event.organizerId'))}
      scope={props.scope}
      value={game}
      requiredTouge={read(props.value,'event.gameCode')==='assetto_corsa'&&(!!props.value.timeAttack||!!props.value.bracketSize&&read(props.value,'event.disciplineCode')==='touge')}
      disabled={!!props.disabled}
      onChange={(next) => props.onChange(write(props.value, path, next))}
    />
  ) : null;
}
export function RaceProgramFields({ descriptor, prefix = 'race', ...props }: Props) {
  const race = read(props.value, prefix) as Settings,
    r = race.race as Settings;
  return (
    <FieldGroup title="Гоночная сессия">
      <Field
        {...props}
        prefix={prefix}
        path="format"
        label="Формат"
        options={descriptor.options.raceFormats}
      />
      {['practice', 'qualifying'].map((phase, i) => (
        <Field
          key={phase}
          {...props}
          prefix={prefix}
          path={phase + '.durationMinutes'}
          label={(i ? 'Квалификация' : 'Практика') + ', мин · 0 — без фазы'}
          type="number"
        />
      ))}
      <div className="lsr-field">
        <span className="lsr-field-label">Длительность основной гонки</span>
        <div className="lsr-filterbar" role="group" aria-label="Длительность основной гонки">
          {['По времени', 'По кругам'].map((label, i) => (
            <button
              type="button"
              key={label}
              disabled={props.disabled}
              aria-pressed={(r.laps !== null) === !!i}
              className={`lsr-pillbtn is-lg${(r.laps !== null) === !!i ? ' is-active' : ''}`}
              onClick={() =>
                props.onChange(
                  write(
                    props.value,
                    prefix + '.race',
                    i
                      ? { laps: descriptor.constraints.laps.minimum!, durationMinutes: null }
                      : structuredClone(descriptor.raceDefaults!.race),
                  ),
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Field
        {...props}
        prefix={prefix}
        path={'race.' + (r.laps === null ? 'durationMinutes' : 'laps')}
        label={r.laps === null ? 'Гонка, мин' : 'Кругов'}
        type="number"
      />
      {r.laps !== null && (
        <Field
          {...props}
          prefix={prefix}
          path="estimatedRaceMinutes"
          label="Ожидаемая длительность, мин"
          type="number"
        />
      )}
      <Field
        {...props}
        prefix={prefix}
        path="maxPlayersPerSession"
        label="Участников на сервере"
        type="number"
      />
      <Field {...props} prefix={prefix} path="maxSessions" label="Сплитов" type="number" />
      <div className="lsr-field"><span className="lsr-field-label">Всего мест</span><div className="lsr-infopill" style={{ alignSelf: 'flex-start' }}>{Number(race.maxPlayersPerSession) * Number(race.maxSessions) || '—'}</div></div>
      {race.format === 'REVERSE_GRID_DOUBLE_RACE' && (
        <Field
          {...props}
          prefix={prefix}
          path="reverseGridPositions"
          label="Позиций реверса"
          type="number"
        />
      )}
    </FieldGroup>
  );
}
export function RegistrationPeriodFields(props: Props) {
  return (
    <FieldGroup title="Период регистрации">
      <Stack gap={1}>
        <Field
          {...props}
          path="registrationRules.durationMinutes"
          label="Длительность регистрации, мин"
          type="number"
        />
        <div className="lsr-filterbar" role="group" aria-label="Быстрый выбор длительности">
          {[30, 60, 120, 360, 720, 1440, 4320].map((n) => (
            <button
              type="button"
              key={n}
              disabled={props.disabled}
              aria-pressed={read(props.value, 'registrationRules.durationMinutes') === n}
              className={`lsr-pillbtn${read(props.value, 'registrationRules.durationMinutes') === n ? ' is-active' : ''}`}
              onClick={() => props.onChange(write(props.value, 'registrationRules.durationMinutes', n))}
            >
              {n < 60 ? n + ' мин' : n < 1440 ? n / 60 + ' ч' : n / 1440 + ' дн'}
            </button>
          ))}
        </div>
      </Stack>
      <Field
        {...props}
        path="registrationRules.closesBeforeMinutes"
        label="Закрыть до старта, мин"
        type="number"
      />
    </FieldGroup>
  );
}
export function TimeAttackFields(props: FieldsProps & { qualification?: boolean }) {
  return (
    <FieldGroup title="Попытка">
      <Field
        {...props}
        path="attemptDurationMinutes"
        label="Длительность попытки, мин"
        type="number"
      />
      <Field
        {...props}
        path="attemptLimit"
        label="Попыток на пилота · пусто без лимита"
        type="number"
        nullable
      />
    </FieldGroup>
  );
}
function WindowFields(props: FieldsProps) {
  return (
    <FieldGroup title="Окно попыток">
      <Field {...props} path="startsAt" label="Начало" type="datetime-local" />
      <Field {...props} path="endsAt" label="Окончание" type="datetime-local" />
    </FieldGroup>
  );
}
export function ConditionsFields(props: Props) {
  const series = ['weekly', 'championship'].includes(props.descriptor.code);
  return (
    <Content
      {...props}
      prefix={series ? 'common.game' : 'game'}
      scope={series ? 'common' : 'all'}
    />
  );
}
export function ProgramFields(props: Props) {
  const code = props.descriptor.code;
  return (
    <Stack gap={2}>
      <Typography color="text.secondary" variant="body2">
        Время указано по вашему часовому поясу
      </Typography>
      {code === 'circuit_single_race' && (
        <>
          <Field
            {...props}
            path="raceStartsAt"
            label="Старт гоночной сессии"
            type="datetime-local"
          />
          <RaceProgramFields {...props} />
        </>
      )}
      {code === 'practice' && (
        <FieldGroup title="Практика">
          <Field
            {...props}
            path="availability.startsAt"
            label="Начало практики"
            type="datetime-local"
          />
          <Field
            {...props}
            path="practice.durationMinutes"
            label="Длительность, мин"
            type="number"
          />
          <Field
            {...props}
            path="practice.maxParticipants"
            label="Участников на сервере"
            type="number"
          />
        </FieldGroup>
      )}
      {code === 'time_attack' && (
        <>
          <WindowFields {...props} prefix="availability" />
          <TimeAttackFields {...props} prefix="timeAttack" />
        </>
      )}
      {['weekly', 'championship'].includes(code) && <SeriesFields {...props} />}
      {code === 'double_elimination_tournament' && (
        <>
          <FieldGroup title="Турнирная сетка">
            <Field {...props} path="bracketSize" label="Размер сетки" type="number" />
            <Field
              {...props}
              path="elimination"
              label="Выбывание"
              options={props.descriptor.options.elimination}
            />
            <Field
              {...props}
              path="initialPairing"
              label="Посев"
              options={props.descriptor.options.pairing}
            />
            <Field
              {...props}
              path="schedule.firstBlockStartsAt"
              label="Первый раунд"
              type="datetime-local"
            />
          </FieldGroup>
          <FieldGroup title="Дуэль">
            {[
              ['match.winsTo', 'Побед в паре'],
              ['match.maximumOmtRounds', 'Максимум перезаездов'],
              ['match.runtimeTimeLimitMinutes', 'Лимит заезда, мин'],
            ].map(([path, label]) => (
              <Field {...props} key={path} path={path} label={label} type="number" />
            ))}
            {props.value.elimination === 'DOUBLE' && (
              <Field
                {...props}
                path="resetGrandFinalIfLowerBracketWins"
                label="Повтор финала при победе нижней сетки"
                type="boolean"
              />
            )}
          </FieldGroup>
          <Alert severity="info">
            Все пары раунда запускаются параллельно. Серверы определяются размером и структурой
            сетки.
          </Alert>
        </>
      )}
    </Stack>
  );
}
function SeriesFields(props: Props) {
  const weekly = props.descriptor.code === 'weekly',
    path = weekly ? 'weekly.weeks' : 'stages',
    rows = read(props.value, path) as Settings[],
    locked = useContext(EditingRestrictions)?.structureLocked;
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, rows.length - 1));
  const changeRows = (v: Settings[]) => props.onChange(write(props.value, path, v));
  const unit = weekly ? 'Неделя' : 'Этап';
  return (
    <div className="lsr-stack">
      <RaceProgramFields {...props} prefix="common.race" />
      {weekly ? <WeeklyScheduleEditor {...props} /> : (
        <FieldGroup title="Календарь чемпионата" description="Первый этап начинается в день начала чемпионата и заканчивается в день своей гонки. Следующий этап начинается на следующий день.">
          <Field {...props} path="firstDate" label="Начало чемпионата" type="date" />
        </FieldGroup>
      )}
      <section className="lsr-formgroup">
        <h3>{weekly ? 'Недели серии' : 'Этапы чемпионата'}</h3>
        <p>{weekly ? 'Каждая неделя длится семь дней от даты начала серии; гонки заполняют эти недели. Выберите неделю слева, чтобы изменить её трассу, погоду и отличия от общей программы.' : 'Выберите этап слева, чтобы изменить его дату, трассу, погоду и отличия от общей программы.'}</p>
        <div className="lsr-split" style={{ border: '1px solid var(--lsr-line)', borderRadius: 10, overflow: 'hidden', gap: 0 }}>
          <div style={{ borderRight: '1px solid var(--lsr-line)', background: '#fbfcfe' }}>
            <div className="lsr-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--lsr-line2)' }}>
              <b style={{ fontSize: 12 }}>{rows.length} {weekly ? 'нед.' : 'эт.'}</b>
              <button type="button" className="lsr-btn is-soft is-sm" disabled={props.disabled || locked}
                onClick={() => { changeRows([...rows, { ...structuredClone((read(props.descriptor.defaults, path) as Settings[])[0]), _editorId: crypto.randomUUID(), title: unit + ' ' + (rows.length + 1), ...(!weekly ? { startsAt: new Date().toISOString() } : {}) }]); setSelected(rows.length); }}>
                ＋ Добавить {weekly ? 'неделю' : 'этап'}
              </button>
            </div>
            <div className="lsr-sidelist">
              {rows.map((row, i) => (
                <button key={String(row._editorId ?? i)} type="button" className={`lsr-sideitem${i === index ? ' is-active' : ''}`} aria-pressed={i === index} onClick={() => setSelected(i)}>
                  <span style={{ minWidth: 0 }}><b>{i + 1}. {String(row.title || `${unit} ${i + 1}`)}</b><small>{String((row.track as Settings | undefined)?.code || 'трасса не выбрана')}{!weekly && row.startsAt ? ' · ' + new Date(String(row.startsAt)).toLocaleDateString('ru-RU') : ''}</small></span>
                  <span className="lsr-chev">›</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 18, minWidth: 0 }}>
            {rows[index] && <SeriesRowEditor {...props} index={index} onRemoved={() => setSelected(Math.max(0, index - 1))} onDuplicated={() => setSelected(rows.length)} />}
          </div>
        </div>
      </section>
    </div>
  );
}

const overrideLabels: Record<string, string> = { practice: 'Практика', qualifying: 'Квалификация', race: 'Основная гонка' };
/** Editor of one week (weekly) or stage (championship). Also used by the week settings page of an event. */
export function SeriesRowEditor(props: Props & { index: number; onRemoved?: () => void; onDuplicated?: () => void; standalone?: boolean }) {
  const weekly = props.descriptor.code === 'weekly',
    path = weekly ? 'weekly.weeks' : 'stages',
    rows = read(props.value, path) as Settings[],
    row = rows[props.index],
    prefix = path + '.' + props.index,
    locked = useContext(EditingRestrictions)?.structureLocked;
  const changeRows = (v: Settings[]) => props.onChange(write(props.value, path, v));
  const common = read(props.value, 'common.game') as Settings,
    game = { ...common, track: row.track, environment: row.weather, catalogChoices: { ...(common.catalogChoices as Settings), weatherCodes: row.weatherCodes } };
  const overrides = (row.raceOverrides ?? {}) as Settings;
  const commonRace = (read(props.value, 'common.race') ?? {}) as Settings;
  const commonValue = (key: string) => {
    if (key === 'estimatedRaceMinutes') return commonRace.estimatedRaceMinutes == null ? '—' : `${commonRace.estimatedRaceMinutes} мин`;
    const v = commonRace[key] as Settings | undefined;
    if (!v) return '—';
    return v.laps != null ? `${v.laps} кругов` : v.durationMinutes != null ? `${v.durationMinutes} мин` : '—';
  };
  const keys = [...['practice', 'qualifying', 'race'].filter((key) => props.descriptor.raceOverrideFields.includes(key)), ...(props.descriptor.raceOverrideFields.includes('estimatedRaceMinutes') ? ['estimatedRaceMinutes'] : [])];
  return (
    <div className="lsr-stack">
      {!props.standalone && (
        <div className="lsr-between" style={{ alignItems: 'flex-start' }}>
          <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>{weekly ? 'Неделя' : 'Этап'} {props.index + 1}</h3>{weekly && <div className="lsr-muted">Неделя {props.index + 1} календаря серии</div>}</div>
          <div className="lsr-hstack" style={{ gap: 8 }}>
            <button type="button" className="lsr-btn is-sm" disabled={props.disabled || locked}
              onClick={() => { changeRows([...rows, { ...structuredClone(row), _editorId: crypto.randomUUID(), title: String(row.title) + ' — копия', ...(!weekly ? { startsAt: new Date().toISOString() } : {}) }]); props.onDuplicated?.(); }}>Дублировать</button>
            <button type="button" className="lsr-btn is-sm is-danger" disabled={props.disabled || locked || rows.length === 1}
              onClick={() => { changeRows(rows.filter((_, n) => n !== props.index)); props.onRemoved?.(); }}>Удалить</button>
          </div>
        </div>
      )}
      <div className="lsr-fields">
        <Field {...props} prefix={prefix} path="title" label="Название" />
        {!weekly && <Field {...props} prefix={prefix} path="startsAt" label="Старт гоночной сессии" type="datetime-local" />}
      </div>
      <ContentSelectionFields
        path={prefix}
        organizerId={String(read(props.value, 'event.organizerId'))}
        scope="stage"
        value={game}
        disabled={!!props.disabled}
        onChange={(next) => {
          let v = write(props.value, prefix + '.track', next.track);
          v = write(v, prefix + '.weather', next.environment);
          v = write(v, prefix + '.weatherCodes', (next.catalogChoices as Settings).weatherCodes);
          props.onChange(v);
        }}
      />
      {!!keys.length && (
        <div>
          <div className="lsr-eyebrow" style={{ marginBottom: 9 }}>Отличия от общей программы</div>
          <div className="lsr-stack is-tight" style={{ gap: 9 }}>
            {keys.map((key) => {
              const overridden = key in overrides;
              const lapsMode = key === 'race' && overridden && (overrides[key] as Settings).laps !== null;
              return (
                <div className="lsr-override" key={key}>
                  <div><label>{overrideLabels[key] ?? 'Ожидаемая длительность'}</label><div className="lsr-inherit">Общее значение: {commonValue(key)}</div></div>
                  <div>{overridden ? (
                    <Field {...props} prefix={prefix + '.raceOverrides'} path={key === 'estimatedRaceMinutes' ? key : key + (lapsMode ? '.laps' : '.durationMinutes')} label={key === 'estimatedRaceMinutes' ? 'Ожидаемая, мин' : lapsMode ? 'Кругов' : 'Длительность, мин'} type="number" />
                  ) : <span className="lsr-inherit">Наследуется ({commonValue(key)})</span>}</div>
                  {overridden ? (
                    <button type="button" className="lsr-btn is-sm" disabled={props.disabled} onClick={() => { const next = { ...overrides }; delete next[key]; props.onChange(write(props.value, prefix + '.raceOverrides', next)); }}>Вернуть общее</button>
                  ) : (
                    <button type="button" className="lsr-btn is-sm" disabled={props.disabled}
                      onClick={() => props.onChange(write(props.value, prefix + '.raceOverrides.' + key, key === 'estimatedRaceMinutes' ? (read(props.value, 'common.race.estimatedRaceMinutes') ?? '') : structuredClone(read(props.value, 'common.race.' + key)!)))}>Переопределить</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!weekly && (
        <div className="lsr-stack is-tight">
          <div className="lsr-between">
            <div className="lsr-eyebrow">Открытая практика этапа</div>
            <button type="button" className="lsr-btn is-sm" disabled={props.disabled || locked}
              onClick={() => props.onChange(write(props.value, prefix + '.practice', row.practice ? null : { startsAt: row.startsAt, durationMinutes: props.descriptor.practiceDefaults.durationMinutes }))}>
              {row.practice ? 'Убрать открытую практику' : 'Добавить открытую практику'}
            </button>
          </div>
          {!!row.practice && (
            <div className="lsr-fields">
              <Field {...props} prefix={prefix + '.practice'} path="startsAt" label="Начало" type="datetime-local" />
              <Field {...props} prefix={prefix + '.practice'} path="durationMinutes" label="Длительность, мин" type="number" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export function ParticipantFields(props: Props) {
  const { descriptor, value } = props,
    code = descriptor.code;
  const registrationPath =
    code === 'circuit_single_race'
      ? 'registration'
      : code === 'weekly'
        ? 'raceRegistration'
        : code === 'championship'
          ? 'admission.registration'
          : 'entry.registration';
  const qualified =
    code === 'championship'
      ? read(value, 'admission.type') === 'TIME_ATTACK_QUALIFICATION'
      : read(value, 'entry.type') === 'TIME_ATTACK_QUALIFICATION';
  const hasRegistration =
    !['practice', 'time_attack'].includes(code) &&
    !(code === 'championship' && read(value, 'admission.type') === 'OPEN');
  return (
    <Stack gap={2}>
      {code === 'championship' && (
        <>
          <Field
            {...props}
            path="admission.type"
            label="Допуск в чемпионат"
            options={descriptor.admissionTypes}
          />
          <Field
            {...props}
            path="carChangePolicy"
            label="Смена машины"
            options={descriptor.carChangePolicies}
          />
        </>
      )}
      {code === 'double_elimination_tournament' && (
        <Field
          {...props}
          path="entry.type"
          label="Отбор в турнир"
          options={descriptor.entryTypes}
        />
      )}
      {qualified && (
        <Box sx={{ border: 1, borderColor: 'divider', p: 2, borderRadius: 1 }}>
          <Typography variant="h6">Предквалификация</Typography>
          <WindowFields
            {...props}
            prefix={
              code === 'championship'
                ? 'admission.availability'
                : 'entry.qualification.availability'
            }
          />
          <Content
            {...props}
            prefix={code === 'championship' ? 'admission.game' : 'entry.qualification.game'}
          />
          <TimeAttackFields
            {...props}
            qualification
            prefix={
              code === 'championship' ? 'admission.settings' : 'entry.qualification.timeAttack'
            }
          />
        </Box>
      )}
      {hasRegistration && (
        <>
          <Field
            {...props}
            prefix={registrationPath}
            path="mode"
            label="Способ регистрации"
            options={descriptor.options.registration}
          />
        </>
      )}
      {!['practice', 'time_attack'].includes(code) && <RegistrationPeriodFields {...props} />}
      {descriptor.minimumParticipantsPath && (
        <Field
          {...props}
          path={descriptor.minimumParticipantsPath}
          label="Минимум участников для запуска гонки"
          type="number"
        />
      )}
      <FieldGroup title="Требования к участнику">
        <Field
          {...props}
          path="participantAdmission.minimumPilotLicense"
          label="Лицензия PR"
          options={descriptor.licenses}
        />
        <Field
          {...props}
          path="participantAdmission.minimumSafetyLicense"
          label="Лицензия SR"
          options={descriptor.licenses}
        />
      </FieldGroup>
      {descriptor.components.includes('scoring') && (
        <FieldGroup title="Очки">
          <Field
            {...props}
            path="scoring.mode"
            label="Начисление"
            options={descriptor.options.scoring}
          />
          {read(value, 'scoring.mode') !== 'none' &&
            Object.keys((read(value, 'scoring.points') as Settings) ?? {}).map((place) => (
              <Field
                {...props}
                key={place}
                path={'scoring.points.' + place}
                label={'Место ' + place}
                type="number"
              />
            ))}
        </FieldGroup>
      )}
      {descriptor.components.includes('rating') && (
        <FieldGroup title="Рейтинг">
          <Field
            {...props}
            path="rating.mode"
            label="Начисление"
            options={descriptor.options.rating}
          />
          {read(value, 'rating.mode') !== 'none' && (
            <>
              <Field {...props} path="rating.pilotMultiplier" label="Множитель PR" type="number" />
              <Field {...props} path="rating.safetyMultiplier" label="Множитель SR" type="number" />
            </>
          )}
        </FieldGroup>
      )}
    </Stack>
  );
}
