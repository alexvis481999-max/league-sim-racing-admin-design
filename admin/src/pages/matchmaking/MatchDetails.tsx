import { EmptyState } from '../../ui/v16';
import { heatStatusLabels, playerName, type Match } from './matchmaking-model';

/** Rounds and heats of the official result with the actual leader/chaser roles of every heat. */
export function MatchRounds({ match }: { match: Match }) {
  const name = (id: string | null | undefined) => playerName(match, id);
  if (!match.result?.rounds?.length)
    return <EmptyState compact>{match.result ? 'Проведённые раунды не зафиксированы. Итог указан по официальному результату.' : 'Результат матча пока отсутствует.'}</EmptyState>;
  return (
    <div className="lsr-mm-rounds">
      {match.result.rounds.map((round, i) => (
        <section key={i} className="lsr-mm-round" aria-label={`Раунд ${round.roundNumber}`}>
          <div className="lsr-mm-round-head">
            <b>Раунд {round.roundNumber}{round.kind === 'OMT' ? ' · Дополнительный' : ''}</b>
            <span>{round.winnerId ? `Победитель: ${name(round.winnerId)}` : 'Без победителя'}</span>
          </div>
          {round.heats.map((heat, j) => (
            <div className="lsr-mm-heat" key={j}>
              <span className="lsr-mm-heat-num">Заезд {heat.heatNumber}{heat.attemptNumber > 1 ? ` · попытка ${heat.attemptNumber}` : ''}</span>
              <span><small>Лидер</small>{name(heat.leaderId)}</span>
              <span><small>Догоняющий</small>{name(heat.chaserId)}</span>
              <span>
                <small>Итог</small>
                {heat.winnerId ? `Победа: ${name(heat.winnerId)}` : heatStatusLabels[heat.status] ?? 'Нет итога'}
                {typeof heat.adjustedGapMs === 'number' ? ` · ${(heat.adjustedGapMs / 1000).toFixed(3)} с` : ''}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
