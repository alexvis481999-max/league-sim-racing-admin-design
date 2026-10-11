import { useState, type ReactNode } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useWorkspaceData } from './workspace-data';
import { Details, Frame, workspacePath } from './workspace-ui';
import { getApiBaseUrl } from '../../../shared/api';
type Item = { title: string | null; imageUrl: string | null; code?: string };
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectValue) : {};
type Origin = { source: 'COMMON' | 'STAGE' | 'OVERRIDE'; baseline?: unknown };
type Stage = {
  key: string;
  title: string;
  type: string;
  game: ObjectValue;
  settings: ObjectValue;
  admission: ObjectValue | null;
  origins: Record<string, Origin>;
  track: Item | null;
  layoutTitle: string | null;
  cars: Item[];
  carClass: Item | null;
  weatherPresets: Item[];
  plugins: Item[];
  content: (Item & { itemId: string; versionId: string })[];
};
function Value({ value }: { value: unknown }) {
  return (
    <>
      {value === null || value === undefined
        ? 'Не задано'
        : typeof value === 'boolean'
          ? value
            ? 'Да'
            : 'Нет'
          : Array.isArray(value)
            ? value.join(', ')
            : String(value)}
    </>
  );
}
function Source({ origin }: { origin: Origin | undefined }) {
  return origin && origin.source !== 'STAGE' ? (
    <Chip
      size="small"
      variant="outlined"
      label={origin.source === 'COMMON' ? 'Общее' : 'Изменено для этапа'}
    />
  ) : null;
}
function Group({
  title,
  children,
  origin,
}: {
  title: string;
  children: ReactNode;
  origin?: Origin;
}) {
  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
        <Typography fontWeight={650}>{title}</Typography>
        <Source origin={origin} />
      </Stack>
      {children}
      {origin?.source === 'OVERRIDE' && (
        <Box component="details">
          <Typography component="summary" variant="body2">
            Базовое значение
          </Typography>
          <Details value={origin.baseline} />
        </Box>
      )}
    </Stack>
  );
}
function Rows({ value, fields }: { value: unknown; fields: [string, string][] }) {
  const data = object(value);
  return (
    <Box component="dl" sx={{ m: 0 }}>
      {fields
        .filter(([key]) => key in data)
        .map(([key, label]) => (
          <Box
            key={key}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) minmax(80px,1fr)',
              gap: 2,
              py: 0.65,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography component="dt" variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              <Value value={data[key]} />
            </Typography>
          </Box>
        ))}
    </Box>
  );
}
function Picture({ item }: { item: Item | null }) {
  return (
    <Stack direction="row" gap={1.5} alignItems="center">
      {item?.imageUrl && (
        <Box
          component="img"
          loading="lazy"
          src={new URL(item.imageUrl, getApiBaseUrl()).href}
          alt=""
          sx={{ width: 88, height: 54, objectFit: 'contain' }}
        />
      )}
      <Typography variant="body2">{item?.title ?? 'Название не сохранено'}</Typography>
    </Stack>
  );
}
const grid = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' },
  gap: 3,
};
export function WorkspaceConditions({
  eventId,
  stageKey,
  active,
}: {
  eventId: string;
  stageKey: string;
  active: boolean;
}) {
  const r = useWorkspaceData<{
    stages: Stage[] | null;
    registrations: unknown;
    results: unknown;
    rating: unknown;
  }>(workspacePath(eventId, 'conditions') + `?stageKey=${encodeURIComponent(stageKey)}`, active);
  const [expanded, setExpanded] = useState(false),
    [topic, setTopic] = useState('weather');
  const stage = r.data?.stages?.[0],
    game = stage?.game ?? {},
    settings = stage?.settings ?? {},
    environment = object(game.environment),
    weather = object(environment.weather);
  const phase = (name: string) => {
    const value = object(settings[name]);
    return typeof value.durationMinutes === 'number'
      ? `${value.durationMinutes} мин`
      : name === 'race' && typeof value.laps === 'number'
        ? `${value.laps} кругов`
        : 'Нет';
  };
  return (
    <Frame resource={r}>
      {stage ? (
        <>
          <Box sx={grid}>
            <Group title="Трасса">
              <Picture item={stage.track} />
              {object(game.track).layoutCode != null && (
                <Typography variant="caption" color="text.secondary">
                  Конфигурация: {stage.layoutTitle ?? 'Название не сохранено'}
                </Typography>
              )}
            </Group>
            <Group title={stage.carClass?.title ?? 'Машины'} origin={stage.origins['game.cars']}>
              <Box component="details">
                <Typography component="summary" variant="body2">
                  Разрешено моделей: {stage.cars.length}
                </Typography>
                <Stack gap={1}>
                  {stage.cars.map((item, index) => (
                    <Picture key={index} item={item} />
                  ))}
                </Stack>
              </Box>
            </Group>
            <Group title="Программа заезда">
              {stage.type === 'RACE' ? (
                <Stack spacing={1}>
                  {[
                    ['practice', 'Практика'],
                    ['qualifying', 'Квалификация'],
                    ['race', 'Гонка'],
                  ].map(([key, label]) => (
                    <Stack key={key} direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2">
                        {label}: {phase(key)}
                      </Typography>
                      <Source origin={stage.origins['settings.' + key]} />
                      {stage.origins['settings.' + key]?.source === 'OVERRIDE' && (
                        <Details value={{ baseline: stage.origins['settings.' + key].baseline }} />
                      )}
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Rows
                  value={{
                    ...settings,
                    ...object(settings.match),
                    ...(settings.attemptLimit === null ? { attemptLimit: 'Без ограничений' } : {}),
                  }}
                  fields={[
                    ['durationMinutes', 'Длительность, мин'],
                    ['attemptDurationMinutes', 'Попытка, мин'],
                    ['attemptLimit', 'Попыток на пилота'],
                    ['winsTo', 'Побед для выигрыша'],
                    ['maximumOmtRounds', 'Дополнительных раундов'],
                    ['runtimeTimeLimitMinutes', 'Лимит заезда, мин'],
                    ['expectedParticipants', 'Участников в раунде'],
                  ]}
                />
              )}
              <Rows
                value={{
                  ...settings,
                  ...('format' in settings
                    ? {
                        format:
                          settings.format === 'SINGLE_RACE'
                            ? 'Одна гонка'
                            : settings.format === 'REVERSE_GRID_DOUBLE_RACE'
                              ? 'Две гонки с реверсом'
                              : settings.format,
                      }
                    : {}),
                }}
                fields={[
                  ['format', 'Формат'],
                  ['maxPlayersPerSession', 'Мест на сервере'],
                  ['maxParticipants', 'Мест'],
                  ['reverseGridPositions', 'Реверс позиций'],
                ]}
              />
            </Group>
            <Group title="Погода">
              <Typography variant="body2">
                {stage.weatherPresets.map((p) => p.title ?? 'Название не сохранено').join(', ') ||
                  'Название пресета не сохранено'}
              </Typography>
              <Rows
                value={weather}
                fields={[
                  ['ambientTemperature', 'Воздух, °C'],
                  ['roadTemperature', 'Асфальт, °C'],
                ]}
              />
            </Group>
          </Box>
          <Button
            sx={{ alignSelf: 'flex-start' }}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Свернуть условия' : 'Все условия'}
          </Button>
          <Box hidden={!expanded}>
            <Stack spacing={2.5}>
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                {[
                  ['weather', 'Погода и покрытие'],
                  ['assists', 'Помощники'],
                  ['rules', 'Правила и допуск'],
                  ['content', 'Контент'],
                ].map(([id, label]) => (
                  <Button
                    key={id}
                    size="small"
                    variant={topic === id ? 'contained' : 'text'}
                    disableElevation
                    onClick={() => setTopic(id)}
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
              {topic === 'weather' && (
                <Box sx={grid}>
                  <Group title="Погода">
                    <Rows
                      value={{
                        ...weather,
                        mode: (
                          {
                            FIXED: 'Постоянная',
                            RANDOM: 'Случайная',
                            MANUAL: 'По слотам',
                          } as Record<string, string>
                        )[String(weather.mode)],
                      }}
                      fields={[
                        ['mode', 'Режим'],
                        ['ambientVariation', 'Колебания воздуха, °C'],
                        ['roadVariation', 'Колебания асфальта, °C'],
                      ]}
                    />
                    {Array.isArray(weather.slots) &&
                      weather.slots.map((slot, i) => (
                        <Group key={i} title={`Слот ${i + 1}`}>
                          <Rows
                            value={slot}
                            fields={[
                              ['ambientTemperature', 'Воздух, °C'],
                              ['roadTemperature', 'Асфальт, °C'],
                              ['ambientVariation', 'Колебания воздуха, °C'],
                              ['roadVariation', 'Колебания асфальта, °C'],
                            ]}
                          />
                        </Group>
                      ))}
                    <Rows value={environment} fields={[['sunAngle', 'Положение солнца']]} />
                  </Group>
                  <Group title="Покрытие">
                    <Rows
                      value={environment.dynamicTrack}
                      fields={[
                        ['sessionStart', 'Начальное сцепление, %'],
                        ['randomness', 'Разброс'],
                        ['sessionTransfer', 'Перенос сцепления, %'],
                        ['lapGain', 'Улучшение за круг'],
                      ]}
                    />
                  </Group>
                </Box>
              )}
              {topic === 'assists' && (
                <Box sx={grid}>
                  <Group title="Помощники" origin={stage.origins['game.assists']}>
                    <Rows
                      value={{
                        ...object(game.assists),
                        ...Object.fromEntries(
                          ['absAllowed', 'tractionControlAllowed'].map((key) => [
                            key,
                            (
                              { 0: 'Выключен', 1: 'Заводской', 2: 'Разрешён' } as Record<
                                string,
                                string
                              >
                            )[String(object(game.assists)[key])],
                          ]),
                        ),
                      }}
                      fields={[
                        ['absAllowed', 'ABS'],
                        ['tractionControlAllowed', 'Контроль тяги'],
                        ['stabilityAllowed', 'Стабилизация'],
                        ['forceVirtualMirror', 'Виртуальное зеркало'],
                        ['autoClutchAllowed', 'Автосцепление'],
                        ['tyreBlanketsAllowed', 'Грелки шин'],
                      ]}
                    />
                  </Group>
                  <Group title="Симуляция" origin={stage.origins['game.simulation']}>
                    <Rows
                      value={game.simulation}
                      fields={[
                        ['tyreWearRatePercent', 'Износ шин, %'],
                        ['fuelRatePercent', 'Расход топлива, %'],
                        ['damageMultiplierPercent', 'Повреждения, %'],
                        ['allowedTyresOut', 'Колёс вне трассы'],
                        ['legalTyres', 'Шины'],
                      ]}
                    />
                  </Group>
                </Box>
              )}
              {topic === 'rules' && (
                <Box sx={grid}>
                  <Group title="Финиш" origin={stage.origins['game.finishRules']}>
                    <Rows
                      value={game.finishRules}
                      fields={[
                        ['qualifyingMaximumWaitPercent', 'Ожидание квалификации, %'],
                        ['raceOverTimeSeconds', 'Ожидание финиша, с'],
                      ]}
                    />
                  </Group>
                  <Group title="Допуск и зачёт">
                    <Rows
                      value={stage.admission}
                      fields={[
                        ['minimumPilotLicense', 'Минимальная лицензия PR'],
                        ['minimumSafetyLicense', 'Минимальная лицензия SR'],
                      ]}
                    />
                    <Scoring
                      stageKey={stage.key}
                      results={r.data?.results}
                      rating={r.data?.rating}
                    />
                    <Details
                      value={{
                        registration: r.data?.registrations,
                        results: r.data?.results,
                        rating: r.data?.rating,
                      }}
                    />
                  </Group>
                </Box>
              )}
              {topic === 'content' && (
                <Box sx={grid}>
                  <Group title="Плагины">
                    {stage.plugins.length ? (
                      stage.plugins.map((item, i) => (
                        <Typography key={i} variant="body2">
                          {item.title ?? 'Название не сохранено'}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2">Не выбраны</Typography>
                    )}
                  </Group>
                  <Group title="Закреплённые версии">
                    {stage.content.map((item) => (
                      <Stack
                        key={item.itemId}
                        direction="row"
                        justifyContent="space-between"
                        gap={2}
                      >
                        <Typography variant="body2">
                          {item.title ?? 'Название не сохранено'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Версия {item.versionId}
                        </Typography>
                      </Stack>
                    ))}
                  </Group>
                </Box>
              )}
              <Details value={stage} />
            </Stack>
          </Box>
        </>
      ) : (
        <Typography>Условия этапа не сохранены.</Typography>
      )}
    </Frame>
  );
}

function Scoring({
  stageKey,
  results,
  rating,
}: {
  stageKey: string;
  results: unknown;
  rating: unknown;
}) {
  const result = Array.isArray(results)
    ? results.map(object).find((r) => object(r.producer).key === stageKey)
    : undefined;
  const scoring = object(result?.scoring),
    points = object(scoring.points),
    definition = object(rating);
  return (
    <Stack spacing={1}>
      {result && (
        <Typography variant="body2">
          {scoring.mode === 'none'
            ? 'Очки за места не начисляются'
            : scoring.mode === 'classic_top_10'
              ? 'Очки за первые десять мест'
              : 'Правило очков не задано'}
        </Typography>
      )}
      {Object.keys(points).length > 0 && (
        <Box component="details">
          <Typography component="summary" variant="body2">
            Очки по местам
          </Typography>
          <Rows
            value={points}
            fields={Object.keys(points)
              .sort((a, b) => Number(a) - Number(b))
              .map((key) => [key, `Место ${key}`])}
          />
        </Box>
      )}
      {rating != null && (
        <>
          <Typography variant="body2">
            {definition.mode === 'result'
              ? 'Рейтинг по результату'
              : definition.mode === 'none'
                ? 'Рейтинг не начисляется'
                : 'Режим рейтинга не сохранён'}
          </Typography>
          <Rows
            value={definition.config}
            fields={[
              ['pilotMultiplier', 'Множитель PR'],
              ['safetyMultiplier', 'Множитель SR'],
            ]}
          />
        </>
      )}
    </Stack>
  );
}
