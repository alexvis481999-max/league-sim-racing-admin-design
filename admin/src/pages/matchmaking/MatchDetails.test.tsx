// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MatchRounds } from './MatchDetails';
import type { Match } from './matchmaking-model';
afterEach(cleanup);
const base = { id: '1', status: 'FINISHED', failure: null, condition: { key: 'k', title: 'T', trackTitle: 'Akina', weatherTitle: 'Ясно' }, players: [{ id: 'a', name: 'Alice', ready: true }, { id: 'b', name: 'Bob', ready: true }], resultId: '20' } as unknown as Match;
it('shows actual leader/chaser roles of every heat', () => {
  render(<MatchRounds match={{ ...base, result: { winnerId: 'a', rounds: [{ roundNumber: 1, kind: 'REGULAR', winnerId: 'a', heats: [{ heatNumber: 1, attemptNumber: 1, leaderId: 'b', chaserId: 'a', winnerId: 'a', status: 'COMPLETED', adjustedGapMs: 842 }] }] } }} />);
  expect(screen.getByText('Лидер').parentElement?.textContent).toContain('Bob');
  expect(screen.getByText('Догоняющий').parentElement?.textContent).toContain('Alice');
  expect(screen.getByText(/0\.842 с/)).toBeTruthy();
});
it('distinguishes a missing result from a result without rounds', () => {
  const { rerender } = render(<MatchRounds match={{ ...base, result: null }} />);
  expect(screen.getByText('Результат матча пока отсутствует.')).toBeTruthy();
  rerender(<MatchRounds match={{ ...base, result: { winnerId: 'a', rounds: [] } }} />);
  expect(screen.getByText(/Проведённые раунды не зафиксированы/)).toBeTruthy();
});
