// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MatchmakingAnalytics } from './MatchmakingAnalytics';
afterEach(cleanup);
it('shows an empty state without invented percentages',()=>{
  render(<MatchmakingAnalytics data={{matches:0}}/>);
  expect(screen.getByText(/Матчей пока нет/)).toBeTruthy();
  expect(screen.queryByText('NaN%')).toBeNull();
});
it('calculates the completion share and shows each outcome',()=>{
  render(<MatchmakingAnalytics data={{matches:10,finished:6,failed:1,cancelled:2,uniquePilots:8}}/>);
  expect(screen.getByText('60%')).toBeTruthy();
  expect(screen.getByText('В процессе')).toBeTruthy();
  expect(screen.getByText('Технические ошибки')).toBeTruthy();
});
