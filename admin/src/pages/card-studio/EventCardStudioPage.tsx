import { Page, Section } from '../../shared/ui';
import {
  EventCardStudioPanel,
  formatCardDate,
  toEventCardSourceFromForm,
} from './EventCardStudio';

export function EventCardStudioPage() {
  const preview = toEventCardSourceFromForm({
    title: 'Grand Prix of Siberia',
    organizer: 'LSR League',
    track: 'Nurburgring Grand Prix',
    startsAtLabel: formatCardDate('2026-07-15T12:00:00.000Z'),
    endsAtLabel: formatCardDate('2026-07-15T14:30:00.000Z'),
    eventMode: 'single',
    image: '/assets/lsr-porsche-hero.png',
    details: [
      'Europe / Open',
      '24 / 24',
    ],
    statusKey: 'upcoming',
    ctaLabel: '',
  });

  return (
    <Page
      title="Карточки событий"
    >
      <Section>
        <EventCardStudioPanel source={preview} showAllTemplates />
      </Section>
    </Page>
  );
}
