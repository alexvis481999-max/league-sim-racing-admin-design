// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EventCardFields } from './EventCardFields';
import type { Settings } from './event-api';

afterEach(cleanup);
it('shows two site frames and sends edited appearance together with current event data', () => {
  const value: Settings = { event: { title: 'Гонка клуба', startsAt: '2027-04-01T12:00:00Z', presentation: { coverUrl: '/race.jpg', subtitle: 'Описание' } } };
  const change = vi.fn();
  const { container, rerender } = render(<EventCardFields displaySchedule={null} value={value} onChange={change} disabled={false} scenarioCode="weekly" />);
  expect(container.querySelectorAll('iframe')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Настроить оформление карточек' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /^Название$/ }));
  const next = change.mock.lastCall![0];
  expect(next.event.presentation).toMatchObject({ coverUrl: '/race.jpg', subtitle: 'Описание', cardAppearance: { showTitle: false } });
  rerender(<EventCardFields displaySchedule={null} value={next} onChange={change} disabled={false} scenarioCode="weekly" />);
  const frame = screen.getByTitle('Карточка на странице событий') as HTMLIFrameElement;
  const send = vi.spyOn(frame.contentWindow!, 'postMessage');
  fireEvent.load(frame);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'lsr-event-card-preview', config: expect.objectContaining({ showTitle: false }), publicEvent: expect.objectContaining({ title: 'Гонка клуба', scenarioCode: 'weekly' }) }), 'http://localhost:5174');
});


it('preserves default site styling until custom appearance is actually saved', () => {
  const value: Settings = { event: { title: 'Практика', startsAt: '2027-04-01T12:00:00Z', presentation: { coverUrl: null, subtitle: null } } };
  render(<EventCardFields displaySchedule={null} value={value} onChange={vi.fn()} disabled={false} scenarioCode="practice" />);
  const frame = screen.getByTitle('Карточка на странице событий') as HTMLIFrameElement;
  const send = vi.spyOn(frame.contentWindow!, 'postMessage');
  fireEvent.load(frame);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ publicEvent: expect.objectContaining({ presentation: expect.objectContaining({ cardAppearance: null }) }) }), 'http://localhost:5174');
  fireEvent.click(screen.getByRole('button', { name: 'Настроить оформление карточек' }));
  fireEvent.load(frame);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ publicEvent: expect.objectContaining({ presentation: expect.objectContaining({ cardAppearance: null }) }) }), 'http://localhost:5174');
});
