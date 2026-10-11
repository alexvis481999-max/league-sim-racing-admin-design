import { useState } from 'react';
import { TrackSelectionFields } from '../../features/event-authoring/CatalogFields';
import { WeatherFields } from '../../features/standalone/WeatherFields';
import { Button, Checkbox, EmptyState, Fields, Notice, Panel, SelectField, Table, TextField, clickableRow } from '../../ui/v16';
import { CarPoolSelect } from './CarPoolSelect';
import { layoutTitle, type PoolCatalog } from './pool-catalog';
import {
  changeCommonCars, subpoolShort, trackProbability, weatherProbability,
  type Pools, type PoolTrack, type PoolWeather,
} from './matchmaking-model';

export type PoolSection = 'cars' | 'weather' | 'tracks';
const offerOptions = [
  { value: '2', label: '2 машины' },
  { value: '3', label: '3 машины' },
  { value: '4', label: '4 машины' },
  { value: 'all', label: 'Все машины подпула трассы' },
];

/** Pool editor of the matchmaking configurator: common car pool, weather variants and tracks with their subpools. */
export function PoolFields({ section, value, onChange, disabled, catalog, onCatalogError, onSectionChange }: {
  section: PoolSection;
  onSectionChange(section: PoolSection): void;
  value: Pools;
  onChange(value: Pools): void;
  disabled: boolean;
  catalog: PoolCatalog;
  onCatalogError(message: string): void;
}) {
  const [trackKey, setTrackKey] = useState<string | null>(null);
  const [weatherKey, setWeatherKey] = useState<string | null>(null);
  const patch = (next: Partial<Pools>) => onChange({ ...value, ...next });
  const updateTrack = (key: string, next: Partial<PoolTrack>) => patch({ tracks: value.tracks.map((t) => (t.key === key ? { ...t, ...next } : t)) });
  const updateWeather = (key: string, next: Partial<PoolWeather>) => patch({ weather: value.weather.map((w) => (w.key === key ? { ...w, ...next } : w)) });
  const carTitle = (code: string) => catalog.cars.find((c) => c.code === code)?.title ?? `${code} (недоступна)`;

  if (section === 'cars') {
    return (
      <>
        <Panel shadow title="Общий пул машин">
          <Notice>Задаёт доступные автомобили всей очереди. Для каждой трассы выбирается собственный подпул <strong>только из этих машин</strong>.</Notice>
          <CarPoolSelect
            label="Машины общего пула"
            items={catalog.cars}
            value={value.carIds}
            disabled={disabled}
            onChange={(ids) => onChange(changeCommonCars(value, ids, value.carSetCode))}
            helperText="Удалённые машины также исключаются из подпулов трасс."
          />
          <div className="lsr-mm-divider" />
          <Fields>
            <SelectField
              label="Класс / набор машин"
              help="Выбор набора заменяет общий пул машинами набора."
              value={value.carSetCode ?? ''}
              disabled={disabled}
              options={[
                { value: '', label: 'Без набора' },
                ...(value.carSetCode && !catalog.sets.some((s) => s.code === value.carSetCode) ? [{ value: value.carSetCode, label: `${value.carSetCode} (недоступен)` }] : []),
                ...catalog.sets.map((s) => ({ value: s.code, label: s.title })),
              ]}
              onChange={(e) => {
                const set = catalog.sets.find((s) => s.code === e.target.value);
                if (!set) {
                  onChange(changeCommonCars(value, value.carIds, undefined));
                  return;
                }
                const ids = set.metadata?.carIds ?? [];
                const codes = ids.map((id) => catalog.cars.find((c) => c.id === id || c.code === id)?.code).filter((id): id is string => !!id);
                if (codes.length !== ids.length) {
                  onCatalogError('Часть машин набора недоступна');
                  return;
                }
                onCatalogError('');
                onChange(changeCommonCars(value, codes, set.code));
              }}
            />
            <SelectField
              label="Машин на выбор обоим пилотам"
              value={String(value.offerCount)}
              disabled={disabled}
              options={offerOptions}
              onChange={(e) => patch({ offerCount: e.target.value === 'all' ? 'all' : (Number(e.target.value) as 2 | 3 | 4) })}
            />
          </Fields>
        </Panel>
        <Panel shadow title="Подпулы по трассам" sub="Откройте строку, чтобы изменить подпул трассы." body={false}>
          {value.tracks.length ? (
            <Table variant="module" label="Подпулы по трассам">
              <thead><tr><th>Трасса</th><th>Машин</th><th>Предложение</th><th>Состояние</th></tr></thead>
              <tbody>
                {value.tracks.map((t) => (
                  <tr key={t.key} {...clickableRow(() => { setTrackKey(t.key); onSectionChange('tracks'); })} aria-label={`Открыть трассу ${t.title}`}>
                    <td><div className="lsr-mm-cell-title">{t.title || 'Новая трасса'}</div><div className="lsr-minor">{layoutTitle(catalog.tracks, t.code, t.layoutCode)}{t.enabled ? '' : ' · выключена'}</div></td>
                    <td className="lsr-num">{t.carIds.length}</td>
                    <td>{value.offerCount === 'all' ? 'Все' : value.offerCount}</td>
                    <td>{subpoolShort(value, t) ? <span className="lsr-mm-error">Не хватает машин</span> : 'Готово'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState compact>Трассы ещё не добавлены.</EmptyState>
          )}
        </Panel>
      </>
    );
  }

  if (section === 'weather') {
    const w = value.weather.find((x) => x.key === weatherKey) ?? value.weather[0];
    return (
      <div className="lsr-split">
        <Panel shadow title="Погодные варианты">
          {value.weather.length ? (
            <div className="lsr-mm-stack">
              {value.weather.map((x) => (
                <button key={x.key} type="button" aria-pressed={x.key === w?.key} className={`lsr-mm-entry${x.key === w?.key ? ' is-active' : ''}`} onClick={() => setWeatherKey(x.key)}>
                  <strong>{x.title || 'Новая погода'}</strong>
                  <small>{x.enabled ? 'Включена' : 'Выключена'} · Вес {x.weight} · {value.tracks.filter((t) => t.weatherKeys.includes(x.key)).length} трасс</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="lsr-muted lsr-mm-none">Добавьте первый погодный вариант, затем назначьте его трассам.</p>
          )}
          <div className="lsr-form-actions">
            <Button
              disabled={disabled}
              onClick={() => {
                const preset = catalog.weather[0], key = crypto.randomUUID();
                patch({
                  weather: [...value.weather, {
                    key, title: preset?.title ?? 'Погода', enabled: true, weight: 10, codes: preset ? [preset.code] : [],
                    weather: { mode: 'FIXED', presetCode: String(preset?.metadata?.graphics ?? preset?.code ?? ''), ambientTemperature: 22, roadTemperature: 30, ambientVariation: 2, roadVariation: 3 },
                  }],
                });
                setWeatherKey(key);
              }}
            >
              ＋ Добавить погоду
            </Button>
          </div>
        </Panel>
        {w ? (
          <Panel shadow title="Условия погоды" sub={w.title || 'Новая погода'}>
            <Fields>
              <TextField label="Название" value={w.title} disabled={disabled} onChange={(e) => updateWeather(w.key, { title: e.target.value })} />
              <TextField
                type="number"
                label="Вес выбора"
                help="Относительный вес: 20 выбирается вдвое чаще, чем 10. Вероятность считается внутри списка погоды каждой трассы."
                value={w.weight}
                disabled={disabled}
                onChange={(e) => updateWeather(w.key, { weight: Number(e.target.value) })}
              />
            </Fields>
            <div className="lsr-mm-inline">
              <Checkbox label="Вариант включён" checked={w.enabled} disabled={disabled} onChange={(enabled) => updateWeather(w.key, { enabled })} />
              <Button
                variant="danger"
                disabled={disabled}
                onClick={() => {
                  patch({ weather: value.weather.filter((x) => x.key !== w.key), tracks: value.tracks.map((t) => ({ ...t, weatherKeys: t.weatherKeys.filter((key) => key !== w.key) })) });
                  setWeatherKey(null);
                }}
              >
                Удалить вариант
              </Button>
            </div>
            <div className="lsr-mm-divider" />
            <h3 className="lsr-mm-heading">Параметры погоды</h3>
            <WeatherFields
              value={w.weather}
              catalogCodes={w.codes}
              items={catalog.weather}
              disabled={disabled}
              allowRandom={false}
              onChange={(next, selectedCodes) => {
                const codes = next.mode === 'MANUAL' ? next.slots.map((s) => s.presetCode) : next.mode === 'FIXED' ? [next.presetCode] : next.presetCodes;
                updateWeather(w.key, { weather: next, codes: selectedCodes ?? [...new Set(codes)] });
              }}
            />
          </Panel>
        ) : (
          <Panel shadow title="Условия погоды"><EmptyState compact>Добавьте погодный вариант.</EmptyState></Panel>
        )}
      </div>
    );
  }

  const t = value.tracks.find((x) => x.key === trackKey) ?? value.tracks[0];
  const pickable = value.carIds;
  const enabledAllowed = t ? value.weather.filter((w) => w.enabled && t.weatherKeys.includes(w.key)) : [];
  return (
    <div className="lsr-split">
      <Panel shadow title="Трассы в ротации">
        {value.tracks.length ? (
          <div className="lsr-mm-stack">
            {value.tracks.map((x) => (
              <button key={x.key} type="button" aria-pressed={x.key === t?.key} className={`lsr-mm-entry${x.key === t?.key ? ' is-active' : ''}`} onClick={() => setTrackKey(x.key)}>
                <strong>{x.title || 'Новая трасса'}{x.enabled ? '' : ' · выключена'}</strong>
                <small>
                  {layoutTitle(catalog.tracks, x.code, x.layoutCode)} · {x.durationMinutes} мин · Вероятность {trackProbability(value, x)}% · Машин {x.carIds.length}
                  {subpoolShort(value, x) && <span className="lsr-mm-error"> · не хватает машин</span>}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="lsr-muted lsr-mm-none">Добавьте трассу и выберите доступные для неё машины и погоду.</p>
        )}
        <div className="lsr-form-actions">
          <Button
            disabled={disabled}
            onClick={() => {
              const key = crypto.randomUUID();
              patch({ tracks: [...value.tracks, { key, title: 'Трасса', code: '', layoutCode: null, enabled: true, weight: 10, durationMinutes: 6, carIds: [...value.carIds], weatherKeys: value.weather.filter((w) => w.enabled).map((w) => w.key) }] });
              setTrackKey(key);
            }}
          >
            ＋ Добавить трассу
          </Button>
        </div>
      </Panel>
      {t ? (
        <Panel shadow title="Настройки выбранной трассы" sub={`${t.title || 'Новая трасса'} · ${layoutTitle(catalog.tracks, t.code, t.layoutCode)}`}>
          <Fields>
            <TrackSelectionFields
              items={catalog.tracks}
              value={{ code: t.code, layoutCode: t.layoutCode }}
              disabled={disabled}
              onChange={(next) => updateTrack(t.key, { ...next, title: catalog.tracks.find((row) => row.code === next.code)?.title ?? next.code })}
            />
            <TextField
              type="number"
              label="Частота выпадения (вес)"
              help={`Сейчас вероятность ${trackProbability(value, t)}% среди включённых трасс`}
              value={t.weight}
              disabled={disabled}
              onChange={(e) => updateTrack(t.key, { weight: Number(e.target.value) })}
            />
            <TextField type="number" label="Длительность заезда, мин" value={t.durationMinutes} disabled={disabled} onChange={(e) => updateTrack(t.key, { durationMinutes: Number(e.target.value) })} />
          </Fields>
          <div className="lsr-mm-inline">
            <Checkbox label="Трасса включена" checked={t.enabled} disabled={disabled} onChange={(enabled) => updateTrack(t.key, { enabled })} />
            <Button variant="danger" disabled={disabled} onClick={() => { patch({ tracks: value.tracks.filter((x) => x.key !== t.key) }); setTrackKey(null); }}>Удалить трассу</Button>
          </div>
          <div className="lsr-mm-divider" />
          <div className="lsr-mm-group">
            <h3 className="lsr-mm-heading">Подпул машин трассы · {t.carIds.length}</h3>
            <div className="lsr-muted">Только машины из общего пула, которые могут выпасть на этой трассе.</div>
            {pickable.length || t.carIds.length ? (
              <div className="lsr-mm-chipset" role="group" aria-label="Подпул машин трассы">
                {[...pickable, ...t.carIds.filter((id) => !pickable.includes(id))].map((code) => {
                  const picked = t.carIds.includes(code);
                  return (
                    <button key={code} type="button" className={`lsr-mm-chip${picked ? ' is-picked' : ''}`} aria-pressed={picked} disabled={disabled} title={code}
                      onClick={() => updateTrack(t.key, { carIds: picked ? t.carIds.filter((id) => id !== code) : [...t.carIds, code] })}>
                      {picked ? '✓ ' : ''}{carTitle(code)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="lsr-mm-error">Общий пул машин пуст — сначала добавьте машины во вкладке «Пул машин».</div>
            )}
            <small className={subpoolShort(value, t) ? 'lsr-mm-error' : 'lsr-help'}>
              {value.offerCount === 'all' ? 'Пилотам будут доступны все выбранные машины.' : `Выбрано ${t.carIds.length}; необходимо не менее ${value.offerCount}.`}
            </small>
          </div>
          <div className="lsr-mm-divider" />
          <div className="lsr-mm-group">
            <h3 className="lsr-mm-heading">Допустимая погода</h3>
            <div className="lsr-muted">Отметьте варианты, доступные именно на этой трассе. Вероятности учитывают их веса.</div>
            {value.weather.length ? (
              <div className="lsr-mm-chipset" role="group" aria-label="Допустимая погода трассы">
                {value.weather.map((w) => {
                  const picked = t.weatherKeys.includes(w.key);
                  return (
                    <button key={w.key} type="button" className={`lsr-mm-chip${picked ? ' is-picked' : ''}`} aria-pressed={picked} disabled={disabled}
                      onClick={() => updateTrack(t.key, { weatherKeys: picked ? t.weatherKeys.filter((key) => key !== w.key) : [...t.weatherKeys, w.key] })}>
                      {picked ? '✓ ' : ''}{w.title || 'Новая погода'}{!w.enabled ? ' · выкл.' : picked ? ` · ${weatherProbability(value, t, w.key)}%` : ''}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="lsr-mm-error">Погодные варианты не созданы — добавьте их во вкладке «Погода».</div>
            )}
            {!enabledAllowed.length && <small className="lsr-mm-error">Выберите хотя бы один включённый вариант.</small>}
          </div>
        </Panel>
      ) : (
        <Panel shadow title="Настройки выбранной трассы"><EmptyState compact>Добавьте трассу в ротацию.</EmptyState></Panel>
      )}
    </div>
  );
}
