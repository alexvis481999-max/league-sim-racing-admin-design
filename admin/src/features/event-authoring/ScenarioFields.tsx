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
import { useContext } from 'react';
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
      <Stack direction="row" gap={1}>
        {['По времени', 'По кругам'].map((label, i) => (
          <Button
            key={label}
            disabled={props.disabled}
            variant={(r.laps !== null) === !!i ? 'contained' : 'outlined'}
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
          </Button>
        ))}
      </Stack>
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
      <Typography color="text.secondary">
        Всего мест: {Number(race.maxPlayersPerSession) * Number(race.maxSessions) || '—'}
      </Typography>
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
        <Stack direction="row" gap={0.5} flexWrap="wrap">
          {[30, 60, 120, 360, 720, 1440, 4320].map((n) => (
            <Button
              size="small"
              key={n}
              disabled={props.disabled}
              variant={
                read(props.value, 'registrationRules.durationMinutes') === n
                  ? 'contained'
                  : 'outlined'
              }
              onClick={() =>
                props.onChange(write(props.value, 'registrationRules.durationMinutes', n))
              }
            >
              {n < 60 ? n + ' мин' : n < 1440 ? n / 60 + ' ч' : n / 1440 + ' дн'}
            </Button>
          ))}
        </Stack>
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
  const changeRows = (v: Settings[]) => props.onChange(write(props.value, path, v));
  return (
    <Stack gap={2}>
      <RaceProgramFields {...props} prefix="common.race" />
      {weekly && <WeeklyScheduleEditor {...props} />}
      {!weekly && <Field {...props} path="firstDate" label="Начало чемпионата" type="date" />}
      <Typography variant="body2" color="text.secondary">{weekly?'Каждая неделя длится семь дней от даты начала серии. Гонки заполняют эти недели.':'Первый этап начинается в день начала чемпионата и заканчивается в день своей гонки. Следующий этап начинается на следующий день.'}</Typography>
      {rows.map((row, i) => {
        const prefix = path + '.' + i,
          common = read(props.value, 'common.game') as Settings,
          game = {
            ...common,
            track: row.track,
            environment: row.weather,
            catalogChoices: {
              ...(common.catalogChoices as Settings),
              weatherCodes: row.weatherCodes,
            },
          };
        return (
          <Accordion key={String(row._editorId)} defaultExpanded={i === 0}>
            <AccordionSummary>
              <Typography fontWeight={700}>
                {String(row.title || `${weekly ? 'Неделя' : 'Этап'} ${i + 1}`)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack gap={2}>
                <FieldGroup title={weekly ? 'Неделя' : 'Этап'}>
                  <Field {...props} prefix={prefix} path="title" label="Название" />
                  {!weekly && (
                    <Field
                      {...props}
                      prefix={prefix}
                      path="startsAt"
                      label="Старт гоночной сессии"
                      type="datetime-local"
                    />
                  )}
                </FieldGroup>
                <ContentSelectionFields
                  path={prefix}
                  organizerId={String(read(props.value, 'event.organizerId'))}
                  scope="stage"
                  value={game}
                  disabled={!!props.disabled}
                  onChange={(next) => {
                    let v = write(props.value, prefix + '.track', next.track);
                    v = write(v, prefix + '.weather', next.environment);
                    v = write(
                      v,
                      prefix + '.weatherCodes',
                      (next.catalogChoices as Settings).weatherCodes,
                    );
                    props.onChange(v);
                  }}
                />
                <Accordion>
                  <AccordionSummary>Отличия от общей программы</AccordionSummary>
                  <AccordionDetails>
                    <Stack gap={1}>
                      {['practice', 'qualifying', 'race']
                        .filter((key) => props.descriptor.raceOverrideFields.includes(key))
                        .map((key) => {
                          const overrides = row.raceOverrides as Settings;
                          return (
                            <Stack key={key} gap={1}>
                              <Typography>
                                {key === 'practice'
                                  ? 'Практика'
                                  : key === 'qualifying'
                                    ? 'Квалификация'
                                    : 'Гонка'}
                              </Typography>
                              {key in overrides ? (
                                <>
                                  <Field
                                    {...props}
                                    prefix={prefix + '.raceOverrides'}
                                    path={
                                      key +
                                      (key === 'race' && (overrides[key] as Settings).laps !== null
                                        ? '.laps'
                                        : '.durationMinutes')
                                    }
                                    label={
                                      key === 'race' && (overrides[key] as Settings).laps !== null
                                        ? 'Кругов'
                                        : 'Длительность, мин'
                                    }
                                    type="number"
                                  />
                                  <Button
                                    disabled={props.disabled}
                                    onClick={() => {
                                      const next = { ...overrides };
                                      delete next[key];
                                      props.onChange(
                                        write(props.value, prefix + '.raceOverrides', next),
                                      );
                                    }}
                                  >
                                    Вернуть общее значение
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  disabled={props.disabled}
                                  onClick={() =>
                                    props.onChange(
                                      write(
                                        props.value,
                                        prefix + '.raceOverrides.' + key,
                                        structuredClone(read(props.value, 'common.race.' + key)!),
                                      ),
                                    )
                                  }
                                >
                                  Изменить для {weekly ? 'недели' : 'этапа'}
                                </Button>
                              )}
                            </Stack>
                          );
                        })}
                      {props.descriptor.raceOverrideFields.includes('estimatedRaceMinutes') && (
                        <Stack gap={1}>
                          {'estimatedRaceMinutes' in (row.raceOverrides as Settings) ? (
                            <>
                              <Field
                                {...props}
                                prefix={prefix + '.raceOverrides'}
                                path="estimatedRaceMinutes"
                                label="Ожидаемая длительность гонки, мин"
                                type="number"
                              />
                              <Button
                                disabled={props.disabled}
                                onClick={() => {
                                  const next = { ...(row.raceOverrides as Settings) };
                                  delete next.estimatedRaceMinutes;
                                  props.onChange(
                                    write(props.value, prefix + '.raceOverrides', next),
                                  );
                                }}
                              >
                                Вернуть общую оценку
                              </Button>
                            </>
                          ) : (
                            <Button
                              disabled={props.disabled}
                              onClick={() =>
                                props.onChange(
                                  write(
                                    props.value,
                                    prefix + '.raceOverrides.estimatedRaceMinutes',
                                    read(props.value, 'common.race.estimatedRaceMinutes') ?? '',
                                  ),
                                )
                              }
                            >
                              Изменить оценку длительности
                            </Button>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
                {!weekly && (
                  <>
                    <Button
                      disabled={props.disabled || locked}
                      onClick={() =>
                        props.onChange(
                          write(
                            props.value,
                            prefix + '.practice',
                            row.practice
                              ? null
                              : {
                                  startsAt: row.startsAt,
                                  durationMinutes:
                                    props.descriptor.practiceDefaults.durationMinutes,
                                },
                          ),
                        )
                      }
                    >
                      {row.practice ? 'Убрать открытую практику' : 'Добавить открытую практику'}
                    </Button>
                    {!!row.practice && (
                      <FieldGroup title="Открытая практика этапа">
                        <Field
                          {...props}
                          prefix={prefix + '.practice'}
                          path="startsAt"
                          label="Начало"
                          type="datetime-local"
                        />
                        <Field
                          {...props}
                          prefix={prefix + '.practice'}
                          path="durationMinutes"
                          label="Длительность, мин"
                          type="number"
                        />
                      </FieldGroup>
                    )}
                  </>
                )}
                <Stack direction="row" gap={1}>
                  <Button
                    disabled={props.disabled || locked}
                    onClick={() =>
                      changeRows([
                        ...rows,
                        {
                          ...structuredClone(row),
                          _editorId: crypto.randomUUID(),
                          title: String(row.title) + ' — копия',
                          ...(!weekly ? { startsAt: new Date().toISOString() } : {}),
                        },
                      ])
                    }
                  >
                    Дублировать
                  </Button>
                  <Button
                    disabled={props.disabled || locked || rows.length === 1}
                    color="error"
                    onClick={() => changeRows(rows.filter((_, n) => n !== i))}
                  >
                    Удалить
                  </Button>
                </Stack>
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
      <Button
        disabled={props.disabled || locked}
        onClick={() =>
          changeRows([
            ...rows,
            {
              ...structuredClone((read(props.descriptor.defaults, path) as Settings[])[0]),
              _editorId: crypto.randomUUID(),
              title: (weekly ? 'Неделя ' : 'Этап ') + (rows.length + 1),
              ...(!weekly ? { startsAt: new Date().toISOString() } : {}),
            },
          ])
        }
      >
        Добавить {weekly ? 'неделю' : 'этап'}
      </Button>
    </Stack>
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
