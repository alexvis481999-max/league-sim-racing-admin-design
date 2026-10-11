import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CatalogMultiSelect, TrackSelectionFields } from './CatalogFields';
import { WeatherFields, type WeatherConfig } from '../standalone/WeatherFields';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useContext, useEffect, useRef, useState } from 'react';
import { FieldIssues } from './form-state';
import { apiFetch } from '../../shared/api';
import { EnvironmentFields, FieldGroup } from './Fields';
import type { Settings } from './types';
import { CatalogPresetFields } from '../../shared/catalog/CatalogPresetFields';
type Item = {
  id: string;
  code: string;
  title: string;
  currentVersionId: string;
  metadata: Settings;
};
type Catalog = { cars: Item[]; tracks: Item[]; sets: Item[]; plugins: Item[]; weather: Item[] };
export function ContentSelectionFields({
  value,
  onChange,
  disabled,
  organizerId,
  path = 'game',
  scope = 'all',
  requiredTouge = false,
  disableTrackLimits = false,
  standalone = false,
  onlyRules = false,
  allowRandomWeather = true,
}: {
  value: Settings;
  onChange(v: Settings): void;
  disabled: boolean;
  organizerId: string;
  path?: string;
  scope?: 'all' | 'common' | 'stage';
  requiredTouge?: boolean;
  disableTrackLimits?: boolean;
  standalone?: boolean;
  onlyRules?: boolean;
  allowRandomWeather?: boolean;
}) {
  const issues = useContext(FieldIssues);
  const fieldProps = (field: string) => {
    const address = path + '.' + field,
      issue = issues.find((x) => x.path === address);
    return { 'data-field-path': address, error: !!issue, helperText: issue?.message };
  };
  const [catalog, setCatalog] = useState<Catalog>({
      cars: [],
      tracks: [],
      sets: [],
      plugins: [],
      weather: [],
    }),
    [error, setError] = useState('');
  const [editor, setEditor] = useState<{
      kind: 'car_set' | 'weather_preset';
      title: string;
      metadata: Settings;
    } | null>(null),
    [saving, setSaving] = useState(false);
  const pending = useRef<{ body: string; key: string } | null>(null),
    creationCode = useRef('');
  useEffect(() => {
    let alive = true;
    void Promise.all(
      ['cars', 'tracks', 'car-sets', 'catalog/plugin', 'weather-presets'].map((p) =>
        apiFetch<Item[]>('/games/assetto_corsa/' + p, {}, 'none'),
      ),
    )
      .then(([cars, tracks, sets, plugins, weather]) => {
        if (alive) setCatalog({ cars, tracks, sets, plugins, weather });
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  const choices = (value.catalogChoices ?? {}) as Settings,
    track = value.track as Settings,
    cars = value.cars as Settings;
  const set = catalog.sets.find((x) => x.code === choices.carSetCode),
    weather = catalog.weather.find(
      (x) => x.code === (choices.weatherCodes as string[] | undefined)?.[0],
    );

  const selectClass = (item: Item | null) => {
    const ids = (item?.metadata.carIds ?? []) as string[],
      selected = ids.map((id) => catalog.cars.find((c) => c.id === id || c.code === id));
    if (selected.some((c) => !c)) {
      setError('Класс содержит недоступную машину');
      return;
    }
    const codes = selected.map((c) => c!.code),
      next = { ...choices };
    if (item) next.carSetCode = item.code;
    else delete next.carSetCode;
    onChange({
      ...value,
      catalogChoices: next,
      cars: { allowedCarIds: codes, defaultCarId: codes[0] ?? '' },
    });
  };
  const selectWeather = (item: Item | null) => {
    const environment = value.environment as Settings;
    if (!item) {
      onChange({ ...value, catalogChoices: { ...choices, weatherCodes: [] } });
      return;
    }
    const m = item.metadata;
    for (const k of [
      'graphics',
      'ambientTemperature',
      'roadTemperature',
      'ambientVariation',
      'roadVariation',
    ])
      if (m[k] === undefined) {
        setError('Пресет не содержит параметр ' + k);
        return;
      }
    onChange({
      ...value,
      catalogChoices: { ...choices, weatherCodes: [item.code] },
      environment: {
        ...environment,
        weather: {
          mode: 'FIXED',
          presetCode: m.graphics,
          ambientTemperature: m.ambientTemperature,
          roadTemperature: m.roadTemperature,
          ambientVariation: m.ambientVariation,
          roadVariation: m.roadVariation,
        },
      },
    });
  };
  const create = (kind: 'car_set' | 'weather_preset', source?: Item) => {
    pending.current = null;
    creationCode.current = 'preset-' + crypto.randomUUID();
    setError('');
    setEditor({
      kind,
      title: source ? source.title + ' — копия' : '',
      metadata: source
        ? structuredClone(source.metadata)
        : kind === 'car_set'
          ? { carIds: [] }
          : {
              graphics: '3_clear',
              ambientTemperature: 22,
              roadTemperature: 30,
              ambientVariation: 2,
              roadVariation: 3,
              windSpeed: 0,
            },
    });
  };
  async function save() {
    if (!editor || saving) return;
    setSaving(true);
    setError('');
    try {
      const body = JSON.stringify({
        kind: editor.kind,
        code: creationCode.current,
        title: editor.title.trim(),
        metadata: editor.metadata,
        gameCode: 'assetto_corsa',
        ownerType: 'organizer',
        ownerId: organizerId,
        sourceType: 'mod',
        status: 'active',
        tags: ['ac'],
        description: null,
        archiveAssetId: null,
        primaryImageAssetId: null,
        carBrandCode: null,
        officialDlcCode: null,
      });
      if (!pending.current || pending.current.body !== body)
        pending.current = { body, key: crypto.randomUUID() };
      const item = await apiFetch<Item>('/admin/catalog/items', {
        method: 'POST',
        body: pending.current.body,
        headers: { 'Idempotency-Key': pending.current.key },
      });
      setCatalog((c) => ({
        ...c,
        [editor.kind === 'car_set' ? 'sets' : 'weather']: [
          ...c[editor.kind === 'car_set' ? 'sets' : 'weather'],
          item,
        ],
      }));
      if (editor.kind === 'car_set') selectClass(item);
      else selectWeather(item);
      setEditor(null);
      pending.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Stack gap={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {!onlyRules && scope !== 'common' && (
        <FieldGroup title="Трасса">
          <TrackSelectionFields
            path={path + '.track'}
            items={catalog.tracks}
            value={{
              code: String(track.code ?? ''),
              layoutCode: track.layoutCode as string | null,
            }}
            disabled={disabled}
            error={issues.find((issue) => issue.path === path + '.track.code')?.message}
            onChange={(next) => onChange({ ...value, track: next })}
          />
        </FieldGroup>
      )}
      {!onlyRules && scope !== 'stage' && (
        <FieldGroup title="Класс машин">
          <Stack gap={1}>
            <Autocomplete
              disabled={disabled}
              options={catalog.sets}
              value={set ?? null}
              getOptionLabel={(x) => x.title}
              onChange={(_, x) => selectClass(x)}
              renderInput={(p) => (
                <TextField
                  {...p}
                  {...fieldProps('catalogChoices.carSetCode')}
                  size="small"
                  label="Класс машин"
                />
              )}
            />
            {choices.carSetCode && !set && (
              <Alert severity="error">Выбранный класс недоступен</Alert>
            )}
            <Typography color="text.secondary" variant="body2">
              {(cars.allowedCarIds as string[])
                .filter(Boolean)
                .map((code) => catalog.cars.find((c) => c.code === code)?.title ?? code)
                .join(', ')}
            </Typography>
          </Stack>
          {standalone && (
            <CatalogMultiSelect
              label="Разрешённые машины"
              items={catalog.cars}
              value={cars.allowedCarIds as string[]}
              disabled={disabled}
              onChange={(ids) => {
                const next = { ...choices };
                delete next.carSetCode;
                onChange({
                  ...value,
                  catalogChoices: next,
                  cars: {
                    allowedCarIds: ids,
                    defaultCarId: ids.includes(String(cars.defaultCarId))
                      ? cars.defaultCarId
                      : (ids[0] ?? ''),
                  },
                });
              }}
            />
          )}
          <Stack direction="row" gap={1}>
            <Button disabled={disabled} onClick={() => create('car_set')}>
              Создать класс
            </Button>
            {set && (
              <Button disabled={disabled} onClick={() => create('car_set', set)}>
                Создать на основе
              </Button>
            )}
          </Stack>
        </FieldGroup>
      )}
      {!onlyRules && scope !== 'common' && (
        <FieldGroup title="Погода">
          <Stack gap={1}>
            <Autocomplete
              disabled={disabled}
              options={catalog.weather}
              value={weather ?? null}
              getOptionLabel={(x) => x.title}
              onChange={(_, x) => selectWeather(x)}
              renderInput={(p) => (
                <TextField
                  {...p}
                  {...fieldProps(
                    scope === 'stage' ? 'weatherCodes' : 'catalogChoices.weatherCodes',
                  )}
                  size="small"
                  label="Пресет погоды"
                />
              )}
            />
            {weather && (
              <Typography color="text.secondary">
                Воздух {String(weather.metadata.ambientTemperature)} °C · трасса{' '}
                {String(weather.metadata.roadTemperature)} °C
              </Typography>
            )}
          </Stack>
          {standalone && (
            <Accordion disableGutters elevation={0} sx={{ gridColumn: '1 / -1' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>Параметры погоды</AccordionSummary>
              <AccordionDetails>
                <WeatherFields
                  value={(value.environment as Settings).weather as unknown as WeatherConfig}
                  items={catalog.weather}
                  catalogCodes={(choices.weatherCodes ?? []) as string[]}
                  disabled={disabled}
                  allowRandom={allowRandomWeather}
                  onChange={(next, codes) =>
                    onChange({
                      ...value,
                      environment: { ...(value.environment as Settings), weather: next },
                      catalogChoices: { ...choices, weatherCodes: codes ?? [] },
                    })
                  }
                />
              </AccordionDetails>
            </Accordion>
          )}
          <Stack direction="row" gap={1}>
            <Button disabled={disabled} onClick={() => create('weather_preset')}>
              Создать пресет
            </Button>
            {weather && (
              <Button disabled={disabled} onClick={() => create('weather_preset', weather)}>
                Создать на основе
              </Button>
            )}
          </Stack>
        </FieldGroup>
      )}
      {scope !== 'stage' && (
        <>
          <EnvironmentFields
            disableTrackLimits={disableTrackLimits || requiredTouge}
            value={value}
            onChange={onChange}
            disabled={disabled}
            standalone={standalone}
          />
          <FieldGroup title="Плагины">
            {requiredTouge && (
              <Typography variant="body2" color="text.secondary">
                Touge HUD обязателен. Без доступного архива плагина событие нельзя опубликовать.
              </Typography>
            )}
            <Autocomplete
              multiple
              disabled={disabled}
              options={catalog.plugins}
              value={catalog.plugins.filter((p) =>
                ((choices.pluginCodes ?? []) as string[]).includes(p.code),
              )}
              getOptionLabel={(x) => x.title}
              getOptionDisabled={(x) => requiredTouge && x.code === 'touge_hud'}
              onChange={(_, items) =>
                onChange({
                  ...value,
                  catalogChoices: {
                    ...choices,
                    pluginCodes: [
                      ...new Set([
                        ...items.map((x) => x.code),
                        ...(requiredTouge ? ['touge_hud'] : []),
                      ]),
                    ],
                  },
                })
              }
              renderInput={(p) => <TextField {...p} size="small" label="Плагины" />}
            />
          </FieldGroup>
        </>
      )}
      <Dialog open={!!editor} onClose={() => !saving && setEditor(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {editor?.kind === 'car_set' ? 'Новый класс машин' : 'Новый пресет погоды'}
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {editor && (
              <>
                <TextField
                  label="Название"
                  value={editor.title}
                  disabled={saving}
                  onChange={(e) => {
                    pending.current = null;
                    setEditor({ ...editor, title: e.target.value });
                  }}
                />
                <CatalogPresetFields
                  kind={editor.kind}
                  metadata={editor.metadata}
                  cars={catalog.cars}
                  disabled={saving}
                  onChange={(metadata) => {
                    pending.current = null;
                    setEditor({ ...editor, metadata });
                  }}
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setEditor(null)}>
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={saving || !editor?.title.trim()}
            onClick={() => void save()}
          >
            Сохранить и выбрать
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
