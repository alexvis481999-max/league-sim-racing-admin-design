import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CarPoolSelect } from './CarPoolSelect';
import { FieldGroup } from '../../features/event-authoring/Fields';
import {
  TrackSelectionFields,
} from '../../features/event-authoring/CatalogFields';
import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { subscribeAdminRefresh } from '../../shared/realtime';
import { apiFetch } from '../../shared/api';
import { WeatherFields, type WeatherConfig } from '../../features/standalone/WeatherFields';
export type Pools = {
  version: 1;
  carIds: string[];
  carSetCode?: string;
  offerCount: 2 | 3 | 4 | 'all';
  readyTimeoutSeconds: number;
  minimumPilotLicense: 'D' | 'C' | 'B' | 'A';
  tiePolicy: 'double_loss' | 'omt';
  tracks: {
    key: string;
    title: string;
    code: string;
    layoutCode: string | null;
    enabled: boolean;
    weight: number;
    durationMinutes: number;
    carIds: string[];
    weatherKeys: string[];
  }[];
  weather: {
    key: string;
    title: string;
    enabled: boolean;
    weight: number;
    codes: string[];
    weather: WeatherConfig;
  }[];
};
export const newPools = (): Pools => ({
  version: 1,
  carIds: [],
  offerCount: 2,
  readyTimeoutSeconds: 120,
  minimumPilotLicense: 'D',
  tiePolicy: 'double_loss',
  tracks: [],
  weather: [],
});
type Item = {
  id: string;
  code: string;
  title: string;
  metadata?: {
    [key: string]: unknown;
    carIds?: string[];
    layouts?: { code: string; title?: string; name?: string }[];
  };
};
export function selectionProbability(weight: number, weights: number[]) {
  const total = weights.reduce(
    (sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0),
    0,
  );
  return total && Number.isFinite(weight) && weight > 0
    ? Math.round((weight / total) * 1000) / 10
    : 0;
}
/** Changing the global pool also removes dangling references, visibly leaving invalid short subpools for correction. */
export function changeCommonCars(value: Pools, carIds: string[], carSetCode?: string): Pools {
  return {
    ...value,
    carIds,
    carSetCode,
    tracks: value.tracks.map((t) => ({
      ...t,
      carIds: t.carIds.filter((id) => carIds.includes(id)),
    })),
  };
}
export function PoolFields({
  value,
  onChange,
  disabled,
  section = 'cars',
}: {
  value: Pools;
  onChange(value: Pools): void;
  disabled: boolean;
  section?: string;
}) {
  const [expandedTrack, setExpandedTrack] = useState<string | false>(false);
  const [expandedWeather, setExpandedWeather] = useState<string | false>(false);
  const [catalog, setCatalog] = useState<Item[][]>([[], [], [], []]),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true,
      revision = 0;
    const load = async () => {
      const request = ++revision;
      try {
        const rows = await Promise.all(
          ['cars', 'tracks', 'weather-presets', 'car-sets'].map((path) =>
            apiFetch<Item[]>(`/games/assetto_corsa/${path}`, {}, 'none'),
          ),
        );
        if (active && request === revision) {
          setCatalog(rows);
          setError('');
        }
      } catch (e) {
        if (active && request === revision) setError(String(e));
      }
    };
    void load();
    const off = subscribeAdminRefresh(['catalog'], load);
    return () => {
      active = false;
      off();
    };
  }, []);
  const [cars, tracks, weather, sets] = catalog;
  const patch = (next: Partial<Pools>) => onChange({ ...value, ...next });
  const updateTrack = (index: number, next: Partial<Pools['tracks'][number]>) =>
    patch({ tracks: value.tracks.map((t, i) => (i === index ? { ...t, ...next } : t)) });
  const updateWeather = (index: number, next: Partial<Pools['weather'][number]>) =>
    patch({ weather: value.weather.map((w, i) => (i === index ? { ...w, ...next } : w)) });
  const trackProbability = (track: Pools['tracks'][number]) =>
    track.enabled
      ? selectionProbability(
          track.weight,
          value.tracks.filter((t) => t.enabled).map((t) => t.weight),
        )
      : 0;
  const weatherProbability = (track: Pools['tracks'][number], key: string) => {
    const allowed = value.weather.filter((w) => w.enabled && track.weatherKeys.includes(w.key));
    return selectionProbability(
      allowed.find((w) => w.key === key)?.weight ?? 0,
      allowed.map((w) => w.weight),
    );
  };
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">Не удалось загрузить каталог: {error}</Alert>}
      <Stack
        spacing={2}
        role="tabpanel"
        id="editor-panel-cars"
        aria-labelledby="editor-tab-cars"
        sx={{ display: section === 'cars' ? 'flex' : 'none' }}
      >
        <FieldGroup title="Общий пул машин">
          <Autocomplete
            size="small"
            options={sets}
            disabled={disabled}
            value={sets.find((s) => s.code === value.carSetCode) ?? null}
            getOptionLabel={(item) => item.title}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            onChange={(_, set) => {
              const ids = set?.metadata?.carIds ?? [];
              const codes = ids
                .map((id) => cars.find((c) => c.id === id || c.code === id)?.code)
                .filter((id): id is string => !!id);
              if (set && codes.length !== ids.length) {
                setError('Часть машин набора недоступна');
                return;
              }
              setError('');
              onChange(changeCommonCars(value, set ? codes : value.carIds, set?.code));
            }}
            renderInput={(params) => <TextField {...params} label="Класс / набор машин" />}
          />
          <TextField
            size="small"
            select
            label="Машин на выбор обоим пилотам"
            value={value.offerCount}
            disabled={disabled}
            onChange={(e) =>
              patch({
                offerCount:
                  e.target.value === 'all' ? 'all' : (Number(e.target.value) as 2 | 3 | 4),
              })
            }
          >
            {[2, 3, 4, 'all'].map((n) => (
              <MenuItem key={n} value={n}>
                {n === 'all' ? 'Все машины трассы' : n}
              </MenuItem>
            ))}
          </TextField>
          <CarPoolSelect
            label="Машины общего пула"
            items={cars}
            value={value.carIds}
            disabled={disabled}
            onChange={(ids) => onChange(changeCommonCars(value, ids))}
            helperText="Удалённые машины также исключаются из подпулов трасс."
          />
          <Typography color="text.secondary">
            Выбрано машин: {value.carIds.length}. Для каждой трассы можно ограничить этот список.
          </Typography>
        </FieldGroup>
      </Stack>
      <Stack
        spacing={2}
        role="tabpanel"
        id="editor-panel-weather"
        aria-labelledby="editor-tab-weather"
        sx={{ display: section === 'weather' ? 'flex' : 'none' }}
      >
        <Typography color="text.secondary">
          Вероятность погоды рассчитывается отдельно для каждой трассы, среди разрешённых ей
          вариантов.
        </Typography>
        {!value.weather.length && (
          <Typography>Добавьте первый погодный вариант, затем назначьте его трассам.</Typography>
        )}
        {value.weather.map((w, index) => (
          <Accordion
            key={w.key}
            expanded={expandedWeather === w.key}
            onChange={(_, open) => setExpandedWeather(open ? w.key : false)}
            disableGutters
            elevation={0}
            sx={{ borderBottom: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack>
                <Typography fontWeight={600}>
                  {w.title || 'Новая погода'} · {w.enabled ? 'Включена' : 'Выключена'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {w.weather.mode === 'FIXED'
                    ? 'Постоянная'
                    : w.weather.mode === 'MANUAL'
                      ? 'Погодные слоты'
                      : 'Случайная'}{' '}
                  · Частота выбора: {w.weight}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <FieldGroup title="Погодный вариант">
                  <TextField
                    size="small"
                    label={`Название погоды ${index + 1}`}
                    value={w.title}
                    disabled={disabled}
                    onChange={(e) => updateWeather(index, { title: e.target.value })}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Частота выбора погоды"
                    helperText="Относительный вес: 20 выбирается вдвое чаще, чем 10."
                    value={w.weight}
                    disabled={disabled}
                    onChange={(e) => updateWeather(index, { weight: Number(e.target.value) })}
                  />
                  <FormControlLabel
                    label="Погода включена"
                    control={
                      <Checkbox
                        checked={w.enabled}
                        disabled={disabled}
                        onChange={(e) => updateWeather(index, { enabled: e.target.checked })}
                      />
                    }
                  />
                </FieldGroup>
                <WeatherFields
                  value={w.weather}
                  catalogCodes={w.codes}
                  items={weather}
                  disabled={disabled}
                  allowRandom={false}
                  onChange={(next, selectedCodes) => {
                    const codes =
                      next.mode === 'MANUAL'
                        ? next.slots.map((s) => s.presetCode)
                        : next.mode === 'FIXED'
                          ? [next.presetCode]
                          : next.presetCodes;
                    updateWeather(index, {
                      weather: next,
                      codes: selectedCodes ?? [...new Set(codes)],
                    });
                  }}
                />
                <Button
                  color="error"
                  sx={{ alignSelf: 'flex-start' }}
                  disabled={disabled}
                  onClick={() =>
                    patch({
                      weather: value.weather.filter((_, i) => i !== index),
                      tracks: value.tracks.map((t) => ({
                        ...t,
                        weatherKeys: t.weatherKeys.filter((key) => key !== w.key),
                      })),
                    })
                  }
                >
                  Удалить погоду
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
        <Button
          variant="outlined"
          sx={{ alignSelf: 'flex-start' }}
          disabled={disabled}
          onClick={() => {
            const preset = weather[0],
              key = crypto.randomUUID();
            patch({
              weather: [
                ...value.weather,
                {
                  key,
                  title: preset?.title ?? 'Погода',
                  enabled: true,
                  weight: 10,
                  codes: preset ? [preset.code] : [],
                  weather: {
                    mode: 'FIXED',
                    presetCode: String(preset?.metadata?.graphics ?? preset?.code ?? ''),
                    ambientTemperature: 22,
                    roadTemperature: 30,
                    ambientVariation: 2,
                    roadVariation: 3,
                  },
                },
              ],
            });
            setExpandedWeather(key);
          }}
        >
          Добавить погоду
        </Button>
      </Stack>
      <Stack
        spacing={2}
        role="tabpanel"
        id="editor-panel-tracks"
        aria-labelledby="editor-tab-tracks"
        sx={{ display: section === 'tracks' ? 'flex' : 'none' }}
      >
        <Typography color="text.secondary">
          Сначала выбирается трасса, затем один из разрешённых погодных вариантов. Раскройте строку
          для настройки.
        </Typography>
        {!value.tracks.length && (
          <Typography>Добавьте трассу и выберите доступные для неё машины и погоду.</Typography>
        )}
        {value.tracks.map((t, index) => (
          <Accordion
            key={t.key}
            expanded={expandedTrack === t.key}
            onChange={(_, open) => setExpandedTrack(open ? t.key : false)}
            disableGutters
            elevation={0}
            sx={{ borderBottom: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack>
                <Typography fontWeight={600}>
                  {t.title || 'Новая трасса'}
                  {t.layoutCode ? ` · ${t.layoutCode}` : ''} ·{' '}
                  {t.enabled ? 'Включена' : 'Выключена'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t.durationMinutes} мин · Машин: {t.carIds.length} · Погодных вариантов:{' '}
                  {t.weatherKeys.length} · Вероятность: {trackProbability(t)}%
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <FieldGroup title="Трасса и конфигурация">
                  <TrackSelectionFields
                    items={tracks}
                    value={{ code: t.code, layoutCode: t.layoutCode }}
                    disabled={disabled}
                    onChange={(next) =>
                      updateTrack(index, {
                        ...next,
                        title: tracks.find((row) => row.code === next.code)?.title ?? next.code,
                      })
                    }
                  />
                </FieldGroup>
                <FieldGroup title="Условия выбора">
                  <TextField
                    size="small"
                    type="number"
                    label="Частота выбора трассы"
                    value={t.weight}
                    helperText={`Вероятность среди включённых трасс: ${trackProbability(t)}%`}
                    disabled={disabled}
                    onChange={(e) => updateTrack(index, { weight: Number(e.target.value) })}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Длительность на этой трассе, минут"
                    value={t.durationMinutes}
                    disabled={disabled}
                    onChange={(e) =>
                      updateTrack(index, { durationMinutes: Number(e.target.value) })
                    }
                  />
                  <CarPoolSelect
                    label="Подпул машин трассы"
                    items={cars.filter((c) => value.carIds.includes(c.code))}
                    value={t.carIds}
                    disabled={disabled}
                    onChange={(carIds) => updateTrack(index, { carIds })}
                    error={
                      !t.carIds.length ||
                      (value.offerCount !== 'all' && t.carIds.length < value.offerCount)
                    }
                    helperText={
                      value.offerCount === 'all'
                        ? 'Пилотам будут доступны все выбранные машины'
                        : `Выбрано ${t.carIds.length}; необходимо не менее ${value.offerCount}.`
                    }
                  />
                  <CarPoolSelect
                    itemType="weather"
                    label="Допустимая погода трассы"
                    items={value.weather.map((w) => ({
                      code: w.key,
                      title: w.title + (w.enabled ? '' : ' (выключена)'),
                    }))}
                    value={t.weatherKeys}
                    disabled={disabled}
                    onChange={(weatherKeys) => updateTrack(index, { weatherKeys })}
                    helperText={
                      value.weather
                        .filter((w) => w.enabled && t.weatherKeys.includes(w.key))
                        .map((w) => `${w.title}: ${weatherProbability(t, w.key)}%`)
                        .join(' · ') || 'Выберите хотя бы один включённый вариант.'
                    }
                  />
                  <FormControlLabel
                    label="Трасса включена"
                    control={
                      <Checkbox
                        checked={t.enabled}
                        disabled={disabled}
                        onChange={(e) => updateTrack(index, { enabled: e.target.checked })}
                      />
                    }
                  />
                </FieldGroup>
                <Button
                  color="error"
                  sx={{ alignSelf: 'flex-start' }}
                  disabled={disabled}
                  onClick={() => patch({ tracks: value.tracks.filter((_, i) => i !== index) })}
                >
                  Удалить трассу
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
        <Button
          variant="outlined"
          sx={{ alignSelf: 'flex-start' }}
          disabled={disabled}
          onClick={() => {
            const key = crypto.randomUUID();
            patch({
              tracks: [
                ...value.tracks,
                {
                  key,
                  title: 'Трасса',
                  code: '',
                  layoutCode: null,
                  enabled: true,
                  weight: 10,
                  durationMinutes: 6,
                  carIds: [...value.carIds],
                  weatherKeys: value.weather.filter((w) => w.enabled).map((w) => w.key),
                },
              ],
            });
            setExpandedTrack(key);
          }}
        >
          Добавить трассу
        </Button>
      </Stack>
      <Stack spacing={2} sx={{ display: section === 'rules' ? 'flex' : 'none' }}>
        <FieldGroup title="Допуск и готовность">
          <TextField
            size="small"
            type="number"
            label="Время на выбор и готовность, секунд"
            helperText="От 120 до 3600 секунд. Повторное подтверждение не продлевает срок."
            value={value.readyTimeoutSeconds}
            disabled={disabled}
            onChange={(e) => patch({ readyTimeoutSeconds: Number(e.target.value) })}
          />
          <TextField
            size="small"
            select
            label="Минимальная лицензия PR"
            value={value.minimumPilotLicense}
            disabled={disabled}
            onChange={(e) =>
              patch({ minimumPilotLicense: e.target.value as Pools['minimumPilotLicense'] })
            }
          >
            {['D', 'C', 'B', 'A'].map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            select
            label="Правило ничьей"
            value={value.tiePolicy}
            disabled={disabled}
            onChange={(e) => patch({ tiePolicy: e.target.value as Pools['tiePolicy'] })}
          >
            <MenuItem value="double_loss">Поражение обоим</MenuItem>
            <MenuItem value="omt">Перезаезды OMT, затем поражение обоим</MenuItem>
          </TextField>
        </FieldGroup>
      </Stack>
    </Stack>
  );
}
