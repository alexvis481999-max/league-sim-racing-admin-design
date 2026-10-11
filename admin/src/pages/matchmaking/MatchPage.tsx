import { Link } from 'react-router-dom';
import { displayRuntimeStatus } from '../../../../shared/presentation';
import { Button, EmptyState, ErrorState, Kpis, LoadingBlock, Notice, PageHeader, Panel, RowItem, StatusBadge, dateTime, shortDateTime, usePageChrome } from '../../ui/v16';
import { MatchRounds } from './MatchDetails';
import type { CatalogItem } from './pool-catalog';
import { conditionLine, durationText, matchPlayers, matchScore, matchStatusLabel, matchTone, matchWinner, type Match } from './matchmaking-model';
import type { Failure } from './useMatchmaking';

/** Match card. There is no single-match read in the API: the match is taken from the live list or the journal page it was opened from. */
export function MatchPage({ matchId, match, loading, error, onRetry, page, queueId, timeZone, cars }: {
  matchId: string;
  match: Match | null;
  loading: boolean;
  error: Failure | null;
  onRetry(): void;
  page: number;
  queueId: string | undefined;
  timeZone?: string;
  cars: CatalogItem[];
}) {
  const back = `/matchmaking?tab=matches${page > 1 ? `&page=${page}` : ''}`;
  usePageChrome({ crumbs: [{ label: 'Матчмейкинг', to: '/matchmaking' }, { label: `Матч №${matchId}` }], back: { label: 'К списку', to: back } });
  if (!match) {
    return (
      <>
        <PageHeader overline="Матчмейкинг" title={`Матч №${matchId}`} />
        {error ? <ErrorState error={error.message} status={error.status} onRetry={onRetry} />
          : loading ? <LoadingBlock label="Загрузка матча" />
          : <div className="lsr-card"><EmptyState title="Матч не найден" action={<Button to={back}>Вернуться к журналу</Button>}>Матча №{matchId} нет среди активных матчей и на странице {page} журнала. Откройте его из журнала матчей.</EmptyState></div>}
      </>
    );
  }
  const status = { code: match.status, label: matchStatusLabel(match) };
  const score = matchScore(match), winner = matchWinner(match);
  const carTitle = (code: string) => cars.find((c) => c.code === code || c.id === code)?.title ?? code;
  const readyCount = match.players.filter((p) => p.ready).length;
  return (
    <>
      <PageHeader overline={`Матч №${match.id}`} title={matchPlayers(match)} description={conditionLine(match)} actions={<StatusBadge variant="badge" status={status} tone={matchTone(match)} />} />
      <Kpis items={[
        { label: 'Состояние', value: status.label, problem: match.status === 'FAILED' },
        { label: 'Старт', value: shortDateTime(match.startedAt, timeZone) },
        { label: 'Финиш', value: shortDateTime(match.finishedAt, timeZone) },
        { label: 'Результат', value: score ?? (winner ? 'Есть победитель' : match.result ? 'Без победителя' : '—'), foot: winner ? `Победа: ${winner}` : match.resultId ? `Результат №${match.resultId}` : 'Результата нет' },
      ]} />
      <div className="lsr-cols-module">
        <Panel shadow title="Ход матча">
          <div className="lsr-mm-versus">
            {match.players.map((player, index) => (
              <div key={player.id} className={`lsr-mm-player${index === 1 ? ' is-right' : ''}`}>
                <Link className="lsr-mm-player-name" to={`/users?userId=${encodeURIComponent(player.id)}`}>{player.name}</Link>
                <div className="lsr-muted">{player.selection?.carId ? carTitle(player.selection.carId) : 'Машина не выбрана'}</div>
                <div className="lsr-muted">{player.ready ? 'Готов' : 'Не готов'}{player.selection?.skinId ? ` · скин №${player.selection.skinId}` : ''}</div>
                {match.result?.winnerId === player.id && <div className="lsr-mm-win">Победа</div>}
              </div>
            ))}
            <div className="lsr-mm-score"><b>{score ?? '—'}</b><small>{score ? 'По раундам' : 'Без счёта'}</small></div>
          </div>
          <div className="lsr-mm-divider" />
          <div className="lsr-mm-steps">
            <div className="lsr-mm-step"><b>Создание матча</b>{dateTime(match.createdAt, timeZone)}</div>
            <div className="lsr-mm-step"><b>Выбор машин и готовность</b>Готовы {readyCount} из {match.players.length}{match.readyDeadlineAt ? ` · срок до ${dateTime(match.readyDeadlineAt, timeZone)}` : ''}</div>
            <div className="lsr-mm-step"><b>Игровая сессия</b>{match.runtimeSessionId ? `Сессия №${match.runtimeSessionId}${match.runtimeStatus ? ` · ${displayRuntimeStatus(match.runtimeStatus)}` : ''}` : match.runtimeStatus === 'WAITING_CAPACITY' ? 'Ожидает свободный сервер' : 'Не запускалась'}</div>
            <div className="lsr-mm-step"><b>Завершение</b>{match.finishedAt ? dateTime(match.finishedAt, timeZone) : 'Матч не завершён'}</div>
          </div>
          <div className="lsr-mm-divider" />
          <h3 className="lsr-mm-heading">Раунды и заезды</h3>
          <MatchRounds match={match} />
        </Panel>
        <Panel shadow title="Результат и диагностика" body={false}>
          <div className="lsr-panel-body lsr-stack is-tight">
            {match.status === 'READY_CHECK' && <Notice>Готовность до {dateTime(match.readyDeadlineAt, timeZone)}</Notice>}
            {(match.failure || match.runtimeFailure) && (
              <Notice tone={match.status === 'FAILED' ? 'danger' : 'warning'}>
                {match.failure && <div>Матч прерван: {match.failure}</div>}
                {match.runtimeFailure && <div>{match.runtimeFailure.message ?? match.runtimeFailure.code}</div>}
              </Notice>
            )}
            <Notice>Статус и итог относятся только к этому матчу. История и рейтинг пилотов хранятся отдельно.</Notice>
          </div>
          <RowItem title="Результат" aside={<span>{match.resultId ? `№${match.resultId}` : 'Нет результата'}</span>} />
          <RowItem title="Победитель" aside={<span>{winner ?? '—'}</span>} />
          <RowItem title="Сервер" aside={<span>{match.serverId ?? 'Не назначен'}</span>} />
          <RowItem title="Состояние Runtime" aside={<span>{match.runtimeStatus ? displayRuntimeStatus(match.runtimeStatus) : '—'}</span>} />
          <RowItem title="Длительность" aside={<span>{durationText(match) ?? '—'}</span>} />
          <div className="lsr-panel-body lsr-hstack">
            {match.resultId && <Button variant="primary" to={`/officiating?matchmakingId=${queueId}&matchId=${match.id}&resultId=${match.resultId}`}>Решения по заезду</Button>}
            <Button to={`/runtime?matchmakingId=${queueId}&matchId=${match.id}`}>Журнал игры</Button>
            {match.runtimeSessionId && <Button to={`/runtime?sessionId=${match.runtimeSessionId}`}>Сессия №{match.runtimeSessionId}</Button>}
            <Button to={`/audit?q=${encodeURIComponent(`matchmaking ${match.id}`)}`}>Аудит</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
