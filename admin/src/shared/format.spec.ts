import { describe, expect, it, vi } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
  it('renders compact admin dates without month words for the current year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T12:00:00.000+03:00'));

    expect(formatDate('2026-07-22T23:35:00.000+03:00')).toBe('22.07 23:35');

    vi.useRealTimers();
  });

  it('keeps the year only when it differs from the current year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T12:00:00.000+03:00'));

    expect(formatDate('2027-07-22T23:35:00.000+03:00')).toBe('22.07.2027 23:35');

    vi.useRealTimers();
  });

  it('does not leak Invalid Date to the UI', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
});
