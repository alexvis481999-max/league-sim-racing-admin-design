import { useState } from 'react';
import { GameFields } from '../../features/standalone/GameFields';
import { Button, Fields, Notice, Panel, SelectField, SubTabs, TextField, count } from '../../ui/v16';
import { PoolFields, type PoolSection } from './PoolFields';
import { usePoolCatalog } from './pool-catalog';
import { poolErrors } from './pool-validation';
import { configForSave, newPools, ratingEnabled, type Config, type Pools } from './matchmaking-model';
import type { MatchmakingState } from './useMatchmaking';

type Section = 'rules' | PoolSection | 'server';
const sections: { key: Section; label: string }[] = [
  { key: 'rules', label: 'Общие правила' },
  { key: 'cars', label: 'Пул машин' },
  { key: 'weather', label: 'Погода' },
  { key: 'tracks', label: 'Трассы' },
  { key: 'server', label: 'Игра и помощники' },
];
const isPoolSection = (section: Section): section is PoolSection => section === 'cars' || section === 'weather' || section === 'tracks';

/** Configurator of the touge queue: pools, duel rules, rating and server conditions. Saved as one versioned config. */
export function MatchmakingSettings({ mm, canWrite }: { mm: MatchmakingState; canWrite: boolean }) {
  const { config, setConfig, queue, dirty, busy, pending, remoteChanged } = mm;
  const [section, setSection] = useState<Section>('rules');
  const { catalog, error: catalogError } = usePoolCatalog();
  const [poolMessage, setPoolMessage] = useState('');
  const locked = busy || pending || !canWrite;
  const patch = (next: Partial<Config>) => setConfig((c) => ({ ...c, ...next }));
  /** The tie rule decides whether OMT rounds exist at all. */
  const changePools = (pools: Pools) =>
    setConfig((c) => ({ ...c, pools, duel: { ...c.duel, maximumOmtRounds: pools.tiePolicy === 'double_loss' ? 0 : Math.max(1, c.duel.maximumOmtRounds) } }));
  const pools = config.pools;
  const validation = poolErrors(pools);
  if (!config.title.trim() || !config.organizerId) validation.unshift('Не задан организатор League Sim Racing.');
  const rating = ratingEnabled(config);

  const rules = (
    <>
      <Panel shadow title="Допуск, готовность и условия дуэлей">
        <Fields>
          {pools && (
            <>
              <TextField
                type="number"
                label="Время на выбор и готовность, секунд"
                help="От 120 до 3600 секунд. Повторное подтверждение не продлевает срок."
                value={pools.readyTimeoutSeconds}
                disabled={locked}
                onChange={(e) => changePools({ ...pools, readyTimeoutSeconds: Number(e.target.value) })}
              />
              <SelectField
                label="Минимальная лицензия PR"
                value={pools.minimumPilotLicense}
                disabled={locked}
                options={['D', 'C', 'B', 'A'].map((v) => ({ value: v, label: v }))}
                onChange={(e) => changePools({ ...pools, minimumPilotLicense: e.target.value as Pools['minimumPilotLicense'] })}
              />
              <SelectField
                label="Правило ничьей"
                value={pools.tiePolicy}
                disabled={locked}
                options={[{ value: 'double_loss', label: 'Поражение обоим' }, { value: 'omt', label: 'Перезаезды OMT, затем поражение обоим' }]}
                onChange={(e) => changePools({ ...pools, tiePolicy: e.target.value as Pools['tiePolicy'] })}
              />
            </>
          )}
          <TextField type="number" label="Побед до победы в матче" value={config.duel.winsTo} disabled={locked} onChange={(e) => patch({ duel: { ...config.duel, winsTo: Number(e.target.value) } })} />
          {pools?.tiePolicy !== 'double_loss' && (
            <TextField type="number" label="Дополнительные раунды OMT" value={config.duel.maximumOmtRounds} disabled={locked} onChange={(e) => patch({ duel: { ...config.duel, maximumOmtRounds: Number(e.target.value) } })} />
          )}
        </Fields>
      </Panel>
      <Panel shadow title="Рейтинг">
        <Fields>
          <SelectField
            label="Рейтинговый режим"
            value={rating ? 'result' : 'none'}
            disabled={locked}
            options={[{ value: 'none', label: 'Без рейтинга' }, { value: 'result', label: 'По результату матча' }]}
            onChange={(e) => patch({ rating: e.target.value === 'result' ? { mode: 'result', pilotMultiplier: 1, safetyMultiplier: 1 } : { mode: 'none' } })}
          />
          {rating && (
            <>
              <TextField type="number" label="Множитель PR" value={config.rating.pilotMultiplier ?? ''} disabled={locked} onChange={(e) => patch({ rating: { ...config.rating, pilotMultiplier: Number(e.target.value) } })} />
              <TextField type="number" label="Множитель SR" value={config.rating.safetyMultiplier ?? ''} disabled={locked} onChange={(e) => patch({ rating: { ...config.rating, safetyMultiplier: Number(e.target.value) } })} />
            </>
          )}
        </Fields>
        <div className="lsr-mm-gap" />
        <Notice>Допуск, результаты дуэли и рейтинг не зависят от трассы, выпавшей паре.</Notice>
      </Panel>
    </>
  );

  const legacy = (
    <Panel shadow title="Переход к пулам">
      <div className="lsr-stack is-tight">
        <Notice tone="warning">
          Сохранена прежняя модель: {count(config.conditions.length, ['сочетание', 'сочетания', 'сочетаний'])}. Переход к пулам требует проверки весов и правил. Текущие пары сохранят свои условия.
        </Notice>
        {queue?.poolConversion?.issues.map((issue, index) => <Notice key={index} tone="neutral">{issue}</Notice>)}
        <div className="lsr-hstack">
          {queue?.poolConversion?.config && (
            <Button disabled={locked} onClick={() => setConfig(queue.poolConversion!.config!)}>Принять предложенное преобразование для редактирования</Button>
          )}
          <Button disabled={locked} onClick={() => patch({ pools: newPools(), conditions: [], game: config.conditions[0]?.game ?? config.game })}>Настроить пулы вручную</Button>
        </div>
      </div>
    </Panel>
  );

  return (
    <div className="lsr-mm-workspace">
      {!canWrite && <Notice tone="neutral">Только просмотр: изменение настроек очереди требует права управления матчмейкингом.</Notice>}
      {catalogError && <Notice tone="danger">Не удалось загрузить каталог: {catalogError}</Notice>}
      {poolMessage && <Notice tone="danger">{poolMessage}</Notice>}
      <div className="lsr-mm-topstats">
        {[
          ['Трассы', pools ? pools.tracks.filter((t) => t.enabled).length : '—'],
          ['Общие машины', pools ? pools.carIds.length : '—'],
          ['Погодные варианты', pools ? pools.weather.filter((w) => w.enabled).length : '—'],
          ['Проверка', validation.length ? count(validation.length, ['замечание', 'замечания', 'замечаний']) : 'Нет ошибок'],
        ].map(([label, value]) => (
          <div key={label}><small>{label}</small><strong className={label === 'Проверка' && validation.length ? 'lsr-mm-error' : undefined}>{value}</strong></div>
        ))}
      </div>
      <SubTabs items={sections} value={section} onChange={setSection} label="Разделы настроек" />
      <div className="lsr-mm-content" role="tabpanel" aria-label={sections.find((s) => s.key === section)?.label}>
        {!pools && legacy}
        {section === 'rules' && rules}
        {section === 'server' && (
          <GameFields organizerId={config.organizerId} onlyRules disableTrackLimits value={config.game} onChange={(game) => patch({ game })} disabled={locked} allowRandomWeather={false} />
        )}
        {isPoolSection(section) && pools && (
          <PoolFields section={section} onSectionChange={setSection} value={pools} onChange={changePools} disabled={locked} catalog={catalog} onCatalogError={setPoolMessage} />
        )}
      </div>
      <div className="lsr-mm-validation">
        {validation.length ? (
          <Notice tone="warning">
            <b>Проверка настройки</b>
            <ul>{validation.map((message) => <li key={message}>{message}</li>)}</ul>
          </Notice>
        ) : (
          <Notice>Настройки пулов согласованы. Все включённые трассы имеют достаточное количество машин и доступную погоду.</Notice>
        )}
        <div className="lsr-form-actions">
          {dirty && <span className="lsr-muted lsr-mm-dirty" role="status">Есть несохранённые изменения</span>}
          <Button
            variant="primary"
            disabled={locked || remoteChanged || validation.length > 0}
            onClick={() => void mm.send(queue ? `/admin/matchmaking/${queue.id}/config` : '/admin/matchmaking', { config: configForSave(config), ...(queue ? { version: queue.version } : {}) }, queue ? 'PUT' : 'POST')}
          >
            Сохранить конфигурацию
          </Button>
        </div>
      </div>
    </div>
  );
}
