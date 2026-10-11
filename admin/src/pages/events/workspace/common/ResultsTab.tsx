import { useState } from 'react';
import type { DisplayStatus } from '../../../../../../shared/event-status';
import { AsyncView, EmptyState, LoadMore, Panel, StatusBadge, Table, TextLink, shortDateTime } from '../../../../ui/v16';
import { useWorkspaceData } from '../data';
import { workspacePath, type PageData } from '../data';
import { useWorkspace, useWorkspaceNav } from '../context';
import { ResultRevisions } from './results';

type ResultHead = { id: string; title: string; definition: { key: string; type: string; primaryForEvent?: boolean }; displayStatus: DisplayStatus; currentRevisionId: string | null; currentRevisionNumber: number };
const resultTypes: Record<string, string> = { RACE_CLASSIFICATION: 'Классификация гонки', SEASON_STANDINGS: 'Зачёт серии', TIME_ATTACK: 'Тайм-аттак', BRACKET: 'Турнирная сетка', DUEL_RESULT: 'Дуэль' };

/** Results of the event: list → revisions → payload, plus the PR / SR application history. */
export function ResultsTab({ active }: { active: boolean }) {
  const { eventId, summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const list = useWorkspaceData<PageData<ResultHead>>(workspacePath(eventId, 'results'), active);
  const selected = nav.params.get('resultId') ?? summary.primaryResultId;
  const outside = !!selected && !!list.data && !list.data.items.some((x) => x.id === selected);
  const head = useWorkspaceData<PageData<ResultHead>>(workspacePath(eventId, 'results') + `?resultId=${encodeURIComponent(selected ?? '')}`, active && outside);
  const items = [...(head.data?.items ?? []).filter((x) => outside && x.id === selected), ...(list.data?.items ?? [])];
  const current = items.find((x) => x.id === selected);
  const [rating, setRating] = useState(false);
  return (
    <div className="lsr-stack">
      <AsyncView resource={list} isEmpty={(d) => !d.items.length && !summary.counts.results} empty={<EmptyState title="Результатов нет">Для этого события результаты не предусмотрены или ещё не созданы.</EmptyState>}>
        {(data) => (
          <div className="lsr-split">
            <Panel title="Результаты события" sub={`${summary.counts.results} всего`} body={false}>
              <div className="lsr-sidelist">
                {items.map((x) => (
                  <button key={x.id} type="button" className={`lsr-sideitem${x.id === selected ? ' is-active' : ''}`} aria-pressed={x.id === selected} onClick={() => nav.setParam('resultId', x.id)}>
                    <span style={{ minWidth: 0 }}><b>{x.title}{x.definition.primaryForEvent && !/итог/i.test(x.title) ? ' · итог' : ''}</b><small>{resultTypes[x.definition.type] ?? x.definition.type} · ревизия {x.currentRevisionNumber || '—'}</small></span>
                    <StatusBadge status={x.displayStatus} small />
                  </button>
                ))}
              </div>
              <LoadMore hasMore={!!data.nextAfterId} busy={list.busy} onClick={() => void list.load(data.nextAfterId!)} />
            </Panel>
            <div className="lsr-stack">
              {!selected ? <Panel><EmptyState compact>Выберите результат.</EmptyState></Panel> : (
                <>
                  {current && (
                    <div className="lsr-between">
                      <div><h2 style={{ margin: 0, fontSize: 18, fontWeight: 750 }}>{current.title}</h2><div className="lsr-muted">{resultTypes[current.definition.type] ?? current.definition.type} · ключ {current.definition.key}</div></div>
                      <div className="lsr-hstack"><StatusBadge status={current.displayStatus} />{current.displayStatus.effectiveAt && <span className="lsr-muted">{shortDateTime(current.displayStatus.effectiveAt)}</span>}</div>
                    </div>
                  )}
                  {current?.displayStatus.reason && <div className="lsr-notice is-warning">{current.displayStatus.reason.message}</div>}
                  <ResultRevisions key={selected} eventId={eventId} resultId={selected} active={active} />
                </>
              )}
            </div>
          </div>
        )}
      </AsyncView>
      <Panel title="История начислений PR / SR" actions={<TextLink onClick={() => setRating(!rating)}>{rating ? 'Свернуть' : 'Показать'}</TextLink>} body={rating}>
        {rating && <RatingHistory active={active && rating} />}
      </Panel>
    </div>
  );
}

type Metric = { before: number; delta: number; after: number };
type Application = { id: string; status: string; appliedAt: string; source: { id: string; version: string | null }; supersedesApplicationId: string | null; changes: { participantId: string; pilot: Metric | null; safety: Metric | null }[] };
const ratingStatus: Record<string, string> = { APPLIED: 'Начислено', REVERSED: 'Начисление отменено', FAILED: 'Ошибка расчёта' };
const metric = (m: Metric | null) => (m ? `${m.before} → ${m.after} (${m.delta > 0 ? '+' : ''}${m.delta})` : 'Не рассчитывался');

function RatingHistory({ active }: { active: boolean }) {
  const { eventId } = useWorkspace();
  const nav = useWorkspaceNav();
  const participant = nav.params.get('participantId');
  const r = useWorkspaceData<PageData<Application> & { identities: { participantId: string; displayName: string }[] }>(workspacePath(eventId, 'rating') + (participant ? `?participantId=${encodeURIComponent(participant)}` : ''), active);
  return (
    <AsyncView resource={r} isEmpty={(d) => !d.items.length} empty={<div className="lsr-mutedline">Начислений нет.</div>}>
      {(data) => (
        <div className="lsr-stack">
          {data.items.map((a) => (
            <div key={a.id} className="lsr-stack is-tight">
              <div className="lsr-between">
                <div><b>{ratingStatus[a.status] ?? a.status}</b> <span className="lsr-muted">· {shortDateTime(a.appliedAt)}{a.supersedesApplicationId ? ` · пересчёт начисления №${a.supersedesApplicationId}` : ''}</span></div>
                <TextLink size="sm" onClick={() => nav.setParam('resultId', a.source.id)}>Источник: результат {a.source.id}, версия {a.source.version ?? '—'}</TextLink>
              </div>
              <Table label={`Начисление ${a.id}`}>
                <thead><tr><th>Пилот</th><th>PR</th><th>SR</th></tr></thead>
                <tbody>{a.changes.map((c) => <tr key={c.participantId}><td className="lsr-primary">{data.identities.find((i) => i.participantId === c.participantId)?.displayName ?? c.participantId}</td><td className="lsr-num">{metric(c.pilot)}</td><td className="lsr-num">{metric(c.safety)}</td></tr>)}</tbody>
              </Table>
            </div>
          ))}
          <LoadMore hasMore={!!data.nextAfterId} busy={r.busy} onClick={() => void r.load(data.nextAfterId!)} />
        </div>
      )}
    </AsyncView>
  );
}
