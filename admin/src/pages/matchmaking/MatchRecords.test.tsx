// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { MatchRecords, QueueTable } from './MatchRecords';
import { MatchPage } from './MatchPage';
import type { Match } from './matchmaking-model';
afterEach(cleanup);
const match = { id: '12', status: 'FAILED', failure: 'SESSION_FAILED', condition: { key: 'k', title: 'T', trackTitle: 'Ikawa', weatherTitle: 'Ясно' }, players: [{ id: '1', name: 'Alice', ready: true, selection: { carId: 'car_a', skinId: '20' } }, { id: '2', name: 'Bob', ready: true }], resultId: '40', result: { winnerId: '1', rounds: [] }, runtimeSessionId: '13', serverId: 'server-2', startedAt: '2026-10-08T18:00:00Z' } as Match;
const page = (m: Match | null) => render(
  <MemoryRouter><MatchPage matchId="12" match={m} loading={false} error={null} onRetry={() => {}} page={1} queueId="7" cars={[{ code: 'car_a', title: 'Car A' }]} /></MemoryRouter>,
);

it('keeps the list compact: the whole row opens the match from keyboard and mouse', async () => {
  const onOpen = vi.fn();
  render(<MemoryRouter><MatchRecords items={[match]} label="Журнал матчей" empty="Пусто" onOpen={onOpen} /></MemoryRouter>);
  expect(screen.queryByText('SESSION_FAILED')).toBeNull();
  expect(screen.getByText('Alice vs Bob')).toBeTruthy();
  expect(screen.getByText('Ошибка запуска или заезда')).toBeTruthy();
  const row = screen.getByRole('row', { name: 'Открыть матч №12' });
  row.focus();
  await userEvent.keyboard('{Enter}');
  await userEvent.click(within(row).getByText('Ikawa'));
  expect(onOpen).toHaveBeenCalledTimes(2);
});
it('shows the empty journal as an explicit state', () => {
  render(<MemoryRouter><MatchRecords items={[]} label="Журнал матчей" empty="Матчей пока нет." onOpen={() => {}} /></MemoryRouter>);
  expect(screen.getByText('Матчей пока нет.')).toBeTruthy();
});
it('match card shows the failure, server and links of existing records only', () => {
  page(match);
  expect(screen.getByText(/Матч прерван: SESSION_FAILED/)).toBeTruthy();
  expect(screen.getByText('Car A')).toBeTruthy();
  expect(screen.getByText('server-2')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Решения по заезду' }).getAttribute('href')).toBe('/officiating?matchmakingId=7&matchId=12&resultId=40');
  expect(screen.getByRole('link', { name: 'Сессия №13' }).getAttribute('href')).toBe('/runtime?sessionId=13');
  expect(screen.getByRole('link', { name: 'Журнал игры' }).getAttribute('href')).toBe('/runtime?matchmakingId=7&matchId=12');
});
it('does not offer result or session actions when they do not exist', () => {
  page({ ...match, result: null, resultId: null, runtimeSessionId: null });
  expect(screen.queryByRole('link', { name: 'Решения по заезду' })).toBeNull();
  expect(screen.queryByRole('link', { name: /Сессия №/ })).toBeNull();
  expect(screen.getByRole('link', { name: 'Журнал игры' })).toBeTruthy();
});
it('a match missing from the loaded lists is reported, not shown as empty data', () => {
  page(null);
  expect(screen.getByText('Матч не найден')).toBeTruthy();
});
it('queue search filters tickets by pilot or ticket id', async () => {
  render(<MemoryRouter><QueueTable enabled tickets={[{ id: '1', participantId: '701', queuedAt: '2026-10-08T18:00:00Z', waitingSeconds: 138 }, { id: '2', participantId: '815', queuedAt: '2026-10-08T18:01:00Z', waitingSeconds: 5 }]} /></MemoryRouter>);
  expect(screen.getByText('2:18')).toBeTruthy();
  await userEvent.type(screen.getByRole('searchbox'), '815');
  expect(screen.queryByText('Пилот №701')).toBeNull();
  expect(screen.getByRole('link', { name: 'Пилот №815' }).getAttribute('href')).toBe('/users?userId=815');
});
