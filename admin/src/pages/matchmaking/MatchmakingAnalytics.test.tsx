// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MatchmakingAnalytics } from './MatchmakingAnalytics';
afterEach(cleanup);
it('shows an empty state without invented percentages', () => {
  render(<MatchmakingAnalytics data={{ matches: 0 }} cars={[]} />);
  expect(screen.getByText(/Матчей пока нет/)).toBeTruthy();
  expect(screen.getByText('Машины пока не выбирали.')).toBeTruthy();
  expect(screen.queryByText('NaN%')).toBeNull();
  expect(screen.queryByText('0%')).toBeNull();
});
it('calculates the completion share, shows each outcome and flags failures', () => {
  const { container } = render(
    <MatchmakingAnalytics
      data={{ matches: 10, finished: 6, failed: 1, cancelled: 2, uniquePilots: 8, cars: [{ key: 'ae86', title: 'ae86', selections: 4, finished: 3, wins: 2, share: 40, winRate: null }] }}
      cars={[{ code: 'ae86', title: 'Toyota AE86' }]}
    />,
  );
  expect(screen.getByText('60%')).toBeTruthy();
  expect(screen.getByText('В процессе')).toBeTruthy();
  expect(screen.getByText('Технические ошибки')).toBeTruthy();
  expect(container.querySelector('.lsr-kpi.is-problem')?.textContent).toContain('С ошибкой');
  expect(screen.getByText('Toyota AE86')).toBeTruthy();
});
