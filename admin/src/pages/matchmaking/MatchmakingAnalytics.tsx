import { EmptyState, Kpis, Panel, Table } from '../../ui/v16';
import type { CatalogItem } from './pool-catalog';
import type { ConditionStats, MatchmakingAnalyticsData } from './matchmaking-model';

function Bars({ items }: { items: ConditionStats[] | undefined }) {
  if (!items?.length) return <EmptyState compact>Данных пока нет.</EmptyState>;
  return (
    <div className="lsr-mm-bars">
      {items.map((item) => (
        <div key={item.key} className="lsr-mm-barrow">
          <div className="lsr-between"><span>{item.title}</span><span className="lsr-num">{item.matches} · {item.share}%</span></div>
          <div className="lsr-mm-bar"><span style={{ width: `${Math.min(100, Math.max(0, item.share))}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/** All-time statistics of the queue. Shares and win rates are percentages calculated by the server. */
export function MatchmakingAnalytics({ data, cars }: { data: MatchmakingAnalyticsData; cars: CatalogItem[] }) {
  const total = data.matches ?? 0;
  const finished = data.finished ?? 0, failed = data.failed ?? 0, cancelled = data.cancelled ?? 0;
  const outcomes = [['Завершено', finished], ['Технические ошибки', failed], ['Отменено', cancelled], ['В процессе', Math.max(0, total - finished - failed - cancelled)]] as const;
  const percent = (value: number) => (total ? Math.round((value / total) * 100) : 0);
  const carTitle = (key: string, title: string) => cars.find((c) => c.code === key)?.title ?? title;
  return (
    <div className="lsr-stack">
      <Kpis items={[
        { label: 'Всего пар', value: total, foot: 'За всё время' },
        { label: 'Уникальных пилотов', value: data.uniquePilots ?? 0 },
        { label: 'Завершённых матчей', value: total ? `${percent(finished)}%` : '—', foot: total ? `${finished} из ${total}` : undefined },
        { label: 'С ошибкой', value: failed, problem: failed > 0, foot: failed > 0 ? 'Требует диагностики' : undefined },
      ]} />
      <Panel shadow title="Исходы матчей" sub="Доля от всех подобранных пар." body={false}>
        {!total ? (
          <EmptyState compact>Матчей пока нет. Статистика появится после первой подобранной пары.</EmptyState>
        ) : (
          <div className="lsr-mm-outcomes">
            {outcomes.map(([label, value]) => (
              <div key={label} className="lsr-mm-outcome">
                <b>{label}</b>
                <div className="lsr-mm-bar"><span style={{ width: `${percent(value)}%` }} /></div>
                <span className="lsr-num">{value} <small>· {percent(value)}%</small></span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel shadow title="Выбор машин и победы" sub="Последний сохранённый выбор каждого пилота в паре. Процент побед — среди завершённых участий с опубликованным результатом." body={false}>
        {data.cars?.length ? (
          <Table variant="module" label="Статистика машин">
            <thead><tr><th>Машина</th><th>Выбрали</th><th>Доля выбора</th><th>Завершено</th><th>Победы</th><th>% побед</th></tr></thead>
            <tbody>
              {data.cars.map((car) => (
                <tr key={car.key}>
                  <td className="lsr-primary">{carTitle(car.key, car.title)}</td>
                  <td className="lsr-num">{car.selections}</td>
                  <td className="lsr-num">{car.share}%</td>
                  <td className="lsr-num">{car.finished}</td>
                  <td className="lsr-num">{car.wins}</td>
                  <td className="lsr-num">{car.winRate === null ? '—' : `${car.winRate}%`}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState compact>Машины пока не выбирали.</EmptyState>
        )}
      </Panel>
      <div className="lsr-cols-equal">
        <Panel shadow title="Трассы" sub="Частота выпадения среди всех подобранных пар."><Bars items={data.tracks} /></Panel>
        <Panel shadow title="Погода" sub="Частота выпадения среди всех подобранных пар."><Bars items={data.weather} /></Panel>
      </div>
    </div>
  );
}
