import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, SearchInput, StatusBadge, Table, Toolbar, clickableRow, shortDateTime } from '../../ui/v16';
import { matchOutcome, matchPlayers, matchStatusLabel, matchTone, waitClock, type Match, type Ticket } from './matchmaking-model';

/** Matches of the queue (live or journal page). The whole row opens the match card. */
export function MatchRecords({ items, timeZone, onOpen, label, empty }: { items: Match[]; timeZone?: string; onOpen(match: Match): void; label: string; empty: string }) {
  if (!items.length) return <EmptyState compact>{empty}</EmptyState>;
  return (
    <Table variant="module" label={label}>
      <thead>
        <tr><th>Матч</th><th>Участники</th><th className="lsr-hide-sm">Трасса</th><th className="lsr-hide-md">Начало</th><th className="lsr-hide-md">Окончание</th><th>Состояние</th></tr>
      </thead>
      <tbody>
        {items.map((match) => (
          <tr key={match.id} {...clickableRow(() => onOpen(match))} aria-label={`Открыть матч №${match.id}`}>
            <td className="lsr-primary lsr-nowrap">№{match.id}</td>
            <td>
              <div className="lsr-mm-cell-title">{matchPlayers(match)}</div>
              <div className="lsr-minor">{matchOutcome(match)}</div>
            </td>
            <td className="lsr-hide-sm">{match.condition.trackTitle}<div className="lsr-minor">{[match.condition.weatherTitle, match.condition.pool ? `${match.condition.pool.durationMinutes} мин` : null].filter(Boolean).join(' · ')}</div></td>
            <td className="lsr-hide-md lsr-num lsr-nowrap">{shortDateTime(match.startedAt ?? match.createdAt, timeZone)}</td>
            <td className="lsr-hide-md lsr-num lsr-nowrap">{shortDateTime(match.finishedAt, timeZone)}</td>
            <td><StatusBadge variant="badge" status={{ code: match.status, label: matchStatusLabel(match) }} tone={matchTone(match)} /></td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Pilots currently searching for a pair. The API returns participant ids only (no names or rating). */
export function QueueTable({ tickets, timeZone, enabled }: { tickets: Ticket[]; timeZone?: string; enabled: boolean }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = q ? tickets.filter((t) => t.participantId.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) : tickets;
  return (
    <>
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Поиск по ID пилота или заявки" label="Поиск в очереди" wide />
      </Toolbar>
      {rows.length ? (
        <Table variant="module" label="Участники в очереди">
          <thead><tr><th>Заявка</th><th>Пилот</th><th>В очереди с</th><th>Ожидание</th></tr></thead>
          <tbody>
            {rows.map((ticket) => (
              <tr key={ticket.id}>
                <td className="lsr-primary">№{ticket.id}</td>
                <td><Link className="lsr-link is-sm" to={`/users?userId=${encodeURIComponent(ticket.participantId)}`}>Пилот №{ticket.participantId}</Link></td>
                <td className="lsr-num">{shortDateTime(ticket.queuedAt, timeZone)}</td>
                <td className="lsr-num">{waitClock(ticket.waitingSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState compact title={tickets.length ? 'Ничего не найдено' : 'Очередь пуста'}>
          {tickets.length ? 'Измените запрос поиска.' : enabled ? 'Сейчас никто не ищет пару.' : 'Поиск выключен — новые заявки не принимаются.'}
        </EmptyState>
      )}
    </>
  );
}
