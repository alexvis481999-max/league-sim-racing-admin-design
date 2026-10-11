import { useState, type ReactNode } from 'react';
import { getApiBaseUrl } from '../../../../shared/api';
import { AsyncView, Panel, SubTabs, Tag, type Resource } from '../../../../ui/v16';

/** Stage of GET …/workspace/conditions (event-workspace.service.ts, section "conditions"). */
export type CatalogRef = { title: string | null; imageUrl: string | null; code?: string; kind?: string };
export type Origin = { source: 'COMMON' | 'STAGE' | 'OVERRIDE'; baseline?: unknown };
type Obj = Record<string, unknown>;
export type ConditionsStage = {
  key: string; title: string; type: string;
  game: Obj; settings: Obj; admission: Obj | null; origins: Record<string, Origin>;
  track: CatalogRef | null; layoutTitle: string | null; cars: CatalogRef[]; carClass: CatalogRef | null;
  weatherPresets: CatalogRef[]; plugins: CatalogRef[]; content: (CatalogRef & { itemId: string; versionId: string })[];
};
export type ConditionsResponse = { stages: ConditionsStage[] | null; registrations: unknown; results: unknown; rating: unknown };

const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const weatherModes: Record<string, string> = { FIXED: 'Фиксированная', RANDOM: 'Случайная', MANUAL: 'По слотам' };
const originLabels: Record<string, string> = {
  'game.track': 'трасса', 'game.environment': 'погода', 'game.cars': 'машины', 'game.assists': 'помощники', 'game.simulation': 'симуляция', 'game.finishRules': 'финиш',
  'settings.practice': 'практика', 'settings.qualifying': 'квалификация', 'settings.race': 'гонка', 'settings.format': 'формат',
};
const title = (item: CatalogRef | null | undefined, fallback = 'Название не сохранено') => item?.title ?? (item?.code ? `${item.code} (нет в каталоге)` : fallback);

/** Display values from the stored stage conditions. Weather numbers come from game.environment, never from a preset name. */
export function conditionsSummary(stage: ConditionsStage) {
  const environment = obj(stage.game.environment), weather = obj(environment.weather), track = obj(stage.game.track);
  const ambient = num(weather.ambientTemperature), road = num(weather.roadTemperature);
  const presets = stage.weatherPresets.map((p) => title(p)).join(', ');
  return {
    track: title(stage.track, track.code ? String(track.code) : 'Трасса не выбрана'),
    layout: stage.layoutTitle ?? (track.layoutCode ? `${String(track.layoutCode)} (название не сохранено)` : 'Основная'),
    weather: [weatherModes[String(weather.mode)] ?? (weather.mode ? String(weather.mode) : null), presets || null].filter(Boolean).join(' · ') || 'Не задана',
    temperature: weather.mode === 'MANUAL' && Array.isArray(weather.slots) ? 'По слотам погоды' : ambient === null && road === null ? 'Не задана' : `воздух ${ambient ?? '—'}°C · трасса ${road ?? '—'}°C`,
    cars: stage.carClass ? `${title(stage.carClass)} · ${stage.cars.length}` : stage.cars.length ? stage.cars.map((c) => title(c)).join(', ') : 'Не выбраны',
    overrides: Object.entries(stage.origins).filter(([, o]) => o.source === 'OVERRIDE').map(([path]) => originLabels[path] ?? path),
  };
}

function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <>Не задано</>;
  if (typeof value === 'boolean') return <>{value ? 'Да' : 'Нет'}</>;
  if (Array.isArray(value)) return <>{value.length ? value.join(', ') : 'Нет'}</>;
  return <>{String(value)}</>;
}
function Rows({ value, fields }: { value: unknown; fields: [string, string, ((v: unknown) => ReactNode)?][] }) {
  const data = obj(value);
  const visible = fields.filter(([key]) => key in data);
  if (!visible.length) return <div className="lsr-mutedline">Не сохранено</div>;
  return (
    <table className="lsr-quickdata" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {visible.map(([key, label, render]) => (
          <tr key={key}>
            <td style={{ padding: '9px 0', borderBottom: '1px solid var(--lsr-line2)', color: 'var(--lsr-sub)', width: '55%', fontSize: 13 }}>{label}</td>
            <td style={{ padding: '9px 0', borderBottom: '1px solid var(--lsr-line2)', fontSize: 13, fontWeight: 600 }}>{render ? render(data[key]) : <Value value={data[key]} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function OriginTag({ origin }: { origin?: Origin }) {
  if (!origin || origin.source === 'STAGE') return null;
  return <span title={origin.source === 'OVERRIDE' && origin.baseline !== undefined ? `Общее значение: ${JSON.stringify(origin.baseline)}` : undefined}><Tag>{origin.source === 'COMMON' ? 'Общее' : 'Изменено для этапа'}</Tag></span>;
}
function Group({ heading, origin, children }: { heading: string; origin?: Origin; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="lsr-hstack" style={{ gap: 8, marginBottom: 8 }}><div className="lsr-sectionlabel" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.65px', color: 'var(--lsr-sub)', fontWeight: 800 }}>{heading}</div><OriginTag origin={origin} /></div>
      {children}
    </div>
  );
}
function Picture({ item }: { item: CatalogRef | null }) {
  return (
    <div className="lsr-hstack" style={{ gap: 10 }}>
      {item?.imageUrl && <img loading="lazy" src={new URL(item.imageUrl, getApiBaseUrl()).href} alt="" style={{ width: 72, height: 44, objectFit: 'contain' }} />}
      <span style={{ fontWeight: 650 }}>{title(item)}</span>
    </div>
  );
}
const phase = (settings: Obj, name: string) => {
  const v = obj(settings[name]);
  if (!(name in settings) || settings[name] === null) return 'Нет';
  return num(v.durationMinutes) !== null ? `${v.durationMinutes} мин` : name === 'race' && num(v.laps) !== null ? `${v.laps} кругов` : 'Нет';
};
const formatLabels: Record<string, string> = { SINGLE_RACE: 'Одна гонка', REVERSE_GRID_DOUBLE_RACE: 'Две гонки с реверсом' };

/** Full stored conditions of one stage/race. Historical values are shown as saved; nothing is replaced by the current catalog. */
export function ConditionsPanel({ resource, heading = 'Условия гонки' }: { resource: Resource<ConditionsResponse>; heading?: string }) {
  const [topic, setTopic] = useState<'weather' | 'assists' | 'rules' | 'content'>('weather');
  return (
    <Panel title={heading} sub="Сохранённые условия этапа: трасса, машины, погода и игровые параметры">
      <AsyncView resource={resource} isEmpty={(d) => !d.stages?.length} empty={<div className="lsr-mutedline">Условия этапа не сохранены в плане события.</div>}>
        {(data) => {
          const stage = data.stages![0];
          const s = conditionsSummary(stage);
          const environment = obj(stage.game.environment), weather = obj(environment.weather), settings = stage.settings;
          return (
            <div className="lsr-stack">
              <div className="lsr-cols-equal">
                <Group heading="Трасса" origin={stage.origins['game.track']}>
                  <Picture item={stage.track} />
                  <div className="lsr-muted" style={{ marginTop: 4 }}>Конфигурация: {s.layout}</div>
                </Group>
                <Group heading={stage.carClass ? `Машины · ${title(stage.carClass)}` : 'Машины'} origin={stage.origins['game.cars']}>
                  <div className="lsr-chiplist">{stage.cars.length ? stage.cars.map((c, i) => <span className="lsr-infopill" style={{ padding: '4px 8px', fontSize: 12 }} key={i}>{title(c)}</span>) : <span className="lsr-mutedline">Не выбраны</span>}</div>
                </Group>
                <Group heading="Погода" origin={stage.origins['game.environment']}>
                  <div style={{ fontWeight: 650 }}>{s.weather}</div>
                  <div className="lsr-muted" style={{ marginTop: 4 }}>{s.temperature}</div>
                </Group>
                <Group heading="Программа сессий">
                  {stage.type === 'RACE' ? (
                    <div className="lsr-stack is-tight" style={{ gap: 6 }}>
                      {[['practice', 'Практика'], ['qualifying', 'Квалификация'], ['race', 'Гонка']].map(([key, label]) => (
                        <div className="lsr-hstack" style={{ gap: 8 }} key={key}><span>{label}: <b>{phase(settings, key)}</b></span><OriginTag origin={stage.origins['settings.' + key]} /></div>
                      ))}
                      <Rows value={settings} fields={[['format', 'Формат', (v) => formatLabels[String(v)] ?? String(v)], ['maxPlayersPerSession', 'Мест на сервере'], ['maxSessions', 'Максимум сплитов'], ['reverseGridPositions', 'Реверс позиций']]} />
                    </div>
                  ) : (
                    <Rows value={{ ...settings, ...obj(settings.match), ...(settings.attemptLimit === null ? { attemptLimit: 'Без ограничений' } : {}) }}
                      fields={[['durationMinutes', 'Длительность, мин'], ['attemptDurationMinutes', 'Попытка, мин'], ['attemptLimit', 'Попыток на пилота'], ['winsTo', 'Побед для выигрыша'], ['maximumOmtRounds', 'Дополнительных раундов'], ['runtimeTimeLimitMinutes', 'Лимит заезда, мин'], ['expectedParticipants', 'Участников в раунде'], ['maxParticipants', 'Мест']]} />
                  )}
                </Group>
              </div>
              <div>
                <SubTabs label="Все параметры условий" value={topic} onChange={setTopic} items={[{ key: 'weather', label: 'Погода и покрытие' }, { key: 'assists', label: 'Помощники и симуляция' }, { key: 'rules', label: 'Финиш и допуск' }, { key: 'content', label: 'Контент' }]} />
                {topic === 'weather' && (
                  <div className="lsr-cols-equal">
                    <Group heading="Погода">
                      <Rows value={{ ...weather, mode: weatherModes[String(weather.mode)] ?? weather.mode, sunAngle: environment.sunAngle }} fields={[['mode', 'Режим'], ['ambientTemperature', 'Воздух, °C'], ['roadTemperature', 'Трасса, °C'], ['ambientVariation', 'Разброс воздуха, °C'], ['roadVariation', 'Разброс трассы, °C'], ['sunAngle', 'Угол солнца, °']]} />
                      {Array.isArray(weather.slots) && weather.slots.map((slot, i) => <div key={i} style={{ marginTop: 10 }}><div className="lsr-muted">Слот {i + 1}</div><Rows value={slot} fields={[['ambientTemperature', 'Воздух, °C'], ['roadTemperature', 'Трасса, °C']]} /></div>)}
                    </Group>
                    <Group heading="Покрытие">
                      <Rows value={environment.dynamicTrack} fields={[['sessionStart', 'Сцепление в начале, %'], ['randomness', 'Случайность сцепления'], ['sessionTransfer', 'Перенос между сессиями, %'], ['lapGain', 'Прирост сцепления за круг']]} />
                    </Group>
                  </div>
                )}
                {topic === 'assists' && (
                  <div className="lsr-cols-equal">
                    <Group heading="Помощники" origin={stage.origins['game.assists']}>
                      <Rows value={stage.game.assists} fields={[['absAllowed', 'ABS', (v) => ({ 0: 'Выключен', 1: 'Заводской', 2: 'Разрешён' } as Record<string, string>)[String(v)] ?? String(v)], ['tractionControlAllowed', 'Контроль тяги', (v) => ({ 0: 'Выключен', 1: 'Заводской', 2: 'Разрешён' } as Record<string, string>)[String(v)] ?? String(v)], ['stabilityAllowed', 'Стабилизация'], ['forceVirtualMirror', 'Виртуальное зеркало'], ['autoClutchAllowed', 'Автосцепление'], ['tyreBlanketsAllowed', 'Грелки шин']]} />
                    </Group>
                    <Group heading="Симуляция" origin={stage.origins['game.simulation']}>
                      <Rows value={stage.game.simulation} fields={[['tyreWearRatePercent', 'Износ шин, %'], ['fuelRatePercent', 'Расход топлива, %'], ['damageMultiplierPercent', 'Повреждения, %'], ['allowedTyresOut', 'Колёс вне трассы'], ['legalTyres', 'Разрешённые шины']]} />
                    </Group>
                  </div>
                )}
                {topic === 'rules' && (
                  <div className="lsr-cols-equal">
                    <Group heading="Финиш" origin={stage.origins['game.finishRules']}>
                      <Rows value={stage.game.finishRules} fields={[['qualifyingMaximumWaitPercent', 'Ожидание квалификации, %'], ['raceOverTimeSeconds', 'Ожидание финиша, с']]} />
                    </Group>
                    <Group heading="Допуск">
                      <Rows value={stage.admission} fields={[['minimumPilotLicense', 'Минимальная лицензия PR'], ['minimumSafetyLicense', 'Минимальная лицензия SR']]} />
                      <Scoring stageKey={stage.key} results={data.results} rating={data.rating} />
                    </Group>
                  </div>
                )}
                {topic === 'content' && (
                  <div className="lsr-cols-equal">
                    <Group heading="Плагины">
                      {stage.plugins.length ? stage.plugins.map((p, i) => <div key={i} style={{ padding: '4px 0' }}>{title(p)}</div>) : <div className="lsr-mutedline">Не выбраны</div>}
                    </Group>
                    <Group heading="Закреплённые версии контента">
                      {stage.content.length ? stage.content.map((c) => <div className="lsr-between" key={c.itemId} style={{ padding: '6px 0', borderBottom: '1px solid var(--lsr-line2)' }}><span>{title(c)}</span><span className="lsr-muted">версия {c.versionId}</span></div>) : <div className="lsr-mutedline">Нет закреплённых версий</div>}
                    </Group>
                  </div>
                )}
              </div>
            </div>
          );
        }}
      </AsyncView>
    </Panel>
  );
}

function Scoring({ stageKey, results, rating }: { stageKey: string; results: unknown; rating: unknown }) {
  const result = Array.isArray(results) ? results.map(obj).find((r) => obj(r.producer).key === stageKey) : undefined;
  const scoring = obj(result?.scoring), points = obj(scoring.points), definition = obj(rating);
  return (
    <div style={{ marginTop: 12 }}>
      {result && <div className="lsr-mutedline">{scoring.mode === 'none' ? 'Очки за места не начисляются' : scoring.mode === 'classic_top_10' ? 'Очки за первые десять мест: ' + Object.keys(points).sort((a, b) => Number(a) - Number(b)).map((k) => points[k]).join(' · ') : 'Правило очков не задано'}</div>}
      {rating != null && <div className="lsr-mutedline">{definition.mode === 'result' ? `Рейтинг по результату · PR ×${obj(definition.config).pilotMultiplier ?? '—'} · SR ×${obj(definition.config).safetyMultiplier ?? '—'}` : definition.mode === 'none' ? 'Рейтинг не начисляется' : 'Режим рейтинга не сохранён'}</div>}
    </div>
  );
}
