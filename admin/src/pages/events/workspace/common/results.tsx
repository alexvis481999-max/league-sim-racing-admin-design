import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../../../shared/api';
import { AsyncView, Details, EmptyState, Notice, Panel, PillButtons, Table, TextLink, lapTime, shortDateTime } from '../../../../ui/v16';
import { useWorkspaceData } from '../../current/workspace-data';
import { workspacePath } from '../../current/workspace-ui';
import type { Value } from '../../current/event-api';

type Row = Record<string, Value>;
const row = (v: Value | undefined): Row => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const list = (v: Value | undefined): Row[] => (Array.isArray(v) ? v.map(row) : []);
const text = (v: Value | undefined) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '—');

let carsRequest: Promise<{ code: string; title: string }[]> | null = null;
/** Car titles for result rows that carry only a catalog code. */
function useCarTitles(enabled: boolean) {
  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    carsRequest ??= apiFetch<{ code: string; title: string }[]>('/games/assetto_corsa/cars', {}, 'none').catch(() => { carsRequest = null; return []; });
    void carsRequest.then((cars) => { if (alive) setTitles(Object.fromEntries(cars.map((c) => [c.code, c.title]))); });
    return () => { alive = false; };
  }, [enabled]);
  return titles;
}

const finishLabels: Record<string, string> = { FINISHED: 'Финишировал', DNF: 'Не финишировал', DNS: 'Не стартовал', DSQ: 'Дисквалифицирован' };

/** Renders the result payload shapes the admin knows: race classification by split, generic rows, bracket matches and duels. */
export function ResultPayload({ value, eventId }: { value: Value; eventId: string }) {
  const payload = row(value);
  const hasCars = list(payload.splits).some((s) => list(s.classification).some((c) => c.carId || c.car));
  const cars = useCarTitles(hasCars);
  if (!value) return <EmptyState compact>Результат ещё не получен.</EmptyState>;
  const names = new Map([...list(payload.participants), ...list(payload.splits).flatMap((s) => list(s.participants))].map((p) => [text(p.participantId), text(p.displayName)]));
  const pilot = (id: Value | undefined, fallback?: string): ReactNode => {
    const label = fallback ?? names.get(text(id)) ?? `Пилот ${text(id)}`;
    return typeof id === 'string' ? <Link className="lsr-link" style={{ fontWeight: 600, color: 'var(--lsr-ink)' }} to={`/events/${eventId}?section=participants&participantId=${encodeURIComponent(id)}`}>{label}</Link> : label;
  };
  const known = payload.type === 'RACE_CLASSIFICATION' || Array.isArray(payload.rows) || Array.isArray(payload.matches) || payload.type === 'DUEL_RESULT';
  return (
    <div className="lsr-stack">
      {payload.type === 'RACE_CLASSIFICATION' && list(payload.splits).map((split) => {
        const rows = list(split.classification);
        const carColumn = rows.some((c) => c.carId || c.car);
        return (
          <Panel key={text(split.splitIndex)} title={`Сплит ${text(split.splitIndex)} · классификация`} body={false} foot="Позиции разных сплитов не объединяются: место указано внутри сплита.">
            {rows.length ? (
              <Table label={`Сплит ${text(split.splitIndex)}`}>
                <thead><tr><th>Позиция в сплите</th><th>Пилот</th>{carColumn && <th>Автомобиль</th>}<th>Лучший круг</th><th>Очки</th></tr></thead>
                <tbody>
                  {rows.map((c, i) => {
                    const car = row(c.car);
                    const status = typeof c.finishStatus === 'string' && c.finishStatus !== 'FINISHED' ? finishLabels[c.finishStatus] ?? c.finishStatus : null;
                    return (
                      <tr key={i}>
                        <td className="lsr-primary lsr-num">{text(c.splitPosition ?? c.position)}</td>
                        <td>{pilot(c.participantId, typeof row(c.participant).displayName === 'string' ? String(row(c.participant).displayName) : undefined)}</td>
                        {carColumn && <td>{typeof car.title === 'string' ? car.title : typeof c.carId === 'string' ? cars[c.carId] ?? c.carId : '—'}</td>}
                        <td className="lsr-num">{status ?? lapTime(row(c.timing).bestLapMs)}</td>
                        <td className="lsr-num">{text(row(c.points).total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : <EmptyState compact>Классификация сплита пуста.</EmptyState>}
          </Panel>
        );
      })}
      {Array.isArray(payload.rows) && (
        <Panel title="Классификация" body={false}>
          <Table label="Классификация">
            <thead><tr><th>Место</th><th>Пилот</th><th>Лучшее время</th><th>Очки</th></tr></thead>
            <tbody>{list(payload.rows).map((r, i) => <tr key={i}><td className="lsr-primary lsr-num">{text(r.position)}</td><td>{pilot(r.participantId)}</td><td className="lsr-num">{lapTime(r.bestAttemptMilliseconds)}</td><td className="lsr-num">{text(r.points)}</td></tr>)}</tbody>
          </Table>
        </Panel>
      )}
      {Array.isArray(payload.matches) && (
        <Panel title="Пары и победители" body={false}>
          <Table label="Пары">
            <thead><tr><th>Пара</th><th>Участники</th><th>Победитель</th></tr></thead>
            <tbody>{list(payload.matches).map((m, i) => <tr key={i}><td className="lsr-num">{i + 1}</td><td>{(Array.isArray(m.participantIds) ? m.participantIds : []).map((id, j) => <span key={j}>{j > 0 && ' / '}{pilot(id)}</span>)}</td><td>{m.winnerId ? pilot(m.winnerId) : 'Не определён'}</td></tr>)}</tbody>
          </Table>
        </Panel>
      )}
      {payload.type === 'DUEL_RESULT' && <Notice tone="neutral">Победитель дуэли: {payload.winnerId ? pilot(payload.winnerId) : 'не определён'}</Notice>}
      {!known && <Notice tone="warning">Формат результата «{text(payload.type)}» не поддерживается этим экраном. Исходные данные доступны в технических подробностях.</Notice>}
    </div>
  );
}

type Revision = { id: string; number: number; createdAt: string; source: string };
type Page<T> = { items: T[]; nextAfterId: string | null };
/** Result → revisions → selected revision payload with linked officiating decisions. */
export function ResultRevisions({ eventId, resultId, active }: { eventId: string; resultId: string; active: boolean }) {
  const revisions = useWorkspaceData<Page<Revision>>(workspacePath(eventId, 'revisions') + `?resultId=${encodeURIComponent(resultId)}`, active);
  const [chosen, setChosen] = useState<string | null>(null);
  const revision = chosen ?? revisions.data?.items[0]?.id ?? null;
  return (
    <AsyncView resource={revisions} isEmpty={(d) => !d.items.length} empty={<Notice tone="neutral">Опубликованных ревизий результата пока нет.</Notice>}>
      {(data) => (
        <div className="lsr-stack">
          {data.items.length > 1 && (
            <PillButtons label="Ревизия результата" value={revision ?? ''} onChange={setChosen} prefix="Ревизия:"
              options={data.items.map((r) => ({ value: r.id, label: `№${r.number} · ${shortDateTime(r.createdAt)}` }))} />
          )}
          {revision && <RevisionView key={revision} eventId={eventId} resultId={resultId} revisionId={revision} active={active} />}
          {data.nextAfterId && <TextLink onClick={() => void revisions.load(data.nextAfterId!)}>Показать более ранние ревизии</TextLink>}
        </div>
      )}
    </AsyncView>
  );
}
function RevisionView({ eventId, resultId, revisionId, active }: { eventId: string; resultId: string; revisionId: string; active: boolean }) {
  const r = useWorkspaceData<{ payload: Value; source: string; number?: number; createdAt?: string; decisions: { id: string; reason: string; status: string }[] }>(
    workspacePath(eventId, 'result') + `?resultId=${encodeURIComponent(resultId)}&revisionId=${encodeURIComponent(revisionId)}`, active);
  return (
    <AsyncView resource={r}>
      {(data) => (
        <div className="lsr-stack">
          <ResultPayload value={data.payload} eventId={eventId} />
          <div className="lsr-between">
            <span className="lsr-muted">Источник ревизии: {data.source}{data.createdAt ? ` · ${shortDateTime(data.createdAt)}` : ''}</span>
            <TextLink to={`/events/${encodeURIComponent(eventId)}?section=journal&source=reports&resultId=${encodeURIComponent(resultId)}`}>Протесты и судейские решения →</TextLink>
          </div>
          {!!data.decisions.length && (
            <Panel title="Судейские решения по результату" body={false}>
              <div className="lsr-rows">{data.decisions.map((d) => <div className="lsr-row-item" key={d.id}><div><b>Решение №{d.id}</b><small>{d.reason}</small></div><span className="lsr-badge">{d.status}</span></div>)}</div>
            </Panel>
          )}
          <Details value={data.payload} />
        </div>
      )}
    </AsyncView>
  );
}
