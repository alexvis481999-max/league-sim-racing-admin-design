import {draftDisplayStatus} from '../../../../../shared/event-status';
import { EventCardStudioPanel, type EventCardStudioSource } from '../../card-studio/EventCardStudio';
import { normalizeEventCardStudioConfig } from '../../card-studio/eventCardConfig';
import type { PublicEvent } from '../../../../../shared/public-event';
import { Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { PhotoCatalogDialog } from '../../../shared/RichContent';
import type { Settings, Value } from './event-api';
export function EventCardFields({
  value,
  displaySchedule,
  onChange,
  disabled,
  scenarioCode = 'circuit_single_race',
}: {
  value: Settings;
  displaySchedule: PublicEvent['displaySchedule'];
  onChange(value: Settings): void;
  disabled: boolean;
  scenarioCode?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingAppearance, setEditingAppearance] = useState(false);
  const event = value.event as Record<string, Value>,
    presentation = (event.presentation ?? { coverUrl: null, subtitle: null }) as Record<
      string,
      Value
    >;
  const change = (key: string, next: string) =>
    onChange({
      ...value,
      event: { ...event, presentation: { ...presentation, [key]: next || null } },
    });
  const source = eventCardSource({
    displaySchedule, id: 'draft-preview', organizerId: String(event.organizerId ?? ''), scenarioCode,
    title: String(event.title || 'Название события'), description: null,
    timezone: String(event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone), startsAt: String(event.startsAt || ''), endsAt: '',
    gameCode: String(event.gameCode || 'assetto_corsa'), disciplineCode: String(event.disciplineCode || 'circuit'), status: 'DRAFT', displayStatus:draftDisplayStatus, observedAt:draftDisplayStatus.observedAt,
    presentation: { cardAppearance: presentation.cardAppearance as Record<string, unknown> | null ?? null, coverUrl: typeof presentation.coverUrl === 'string' ? presentation.coverUrl : null, subtitle: typeof presentation.subtitle === 'string' ? presentation.subtitle : null },
  });
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Карточка события</Typography>
      <TextField
        label="Короткое описание карточки"
        value={presentation.subtitle ?? ''}
        disabled={disabled}
        inputProps={{ maxLength: 240 }}
        onChange={(e) => change('subtitle', e.target.value)}
      />
      <Button disabled={disabled} onClick={() => setPickerOpen(true)}>
        Выбрать фото из каталога
      </Button>
      <PhotoCatalogDialog
        open={pickerOpen}
        title="Обложка события"
        ownerOrganizerId={String(event.organizerId ?? '')}
        gameCode={String(event.gameCode ?? '')}
        onClose={() => setPickerOpen(false)}
        onSelect={(photo) => {
          change('coverUrl', `/content-assets/${encodeURIComponent(photo.assetId)}/file`);
          setPickerOpen(false);
        }}
      />
      <TextField
        label="Обложка — адрес изображения"
        value={presentation.coverUrl ?? ''}
        disabled={disabled}
        helperText="HTTPS-адрес или путь к изображению на сайте"
        onChange={(e) => change('coverUrl', e.target.value)}
      />
      {!disabled && <Button onClick={() => setEditingAppearance(open => !open)}>{editingAppearance ? 'Скрыть настройки оформления' : 'Настроить оформление карточек'}</Button>}
      <EventCardStudioPanel source={source} title="Карточки на сайте" value={normalizeEventCardStudioConfig(presentation.cardAppearance)}
        showEditor={!disabled && editingAppearance} stackPreviews
        onChange={cardAppearance => onChange({ ...value, event: { ...event, presentation: { ...presentation, cardAppearance } } })} />
    </Stack>
  );
}

/** Preview data follows the same API projection consumed by the site. */
export function eventCardSource(event: PublicEvent): EventCardStudioSource {
  const eventMode = event.scenarioCode === 'double_elimination_tournament' ? 'tournament' : (['weekly', 'championship', 'time_attack', 'practice'].includes(event.scenarioCode) ? event.scenarioCode : 'single') as EventCardStudioSource['eventMode'];
  return { title: event.title, organizer: '', track: '', startLabel: '', periodLabel: '', statusKey: 'draft', eventMode, details: [], image: event.presentation?.coverUrl ?? '', ctaLabel: 'Открыть событие', publicEvent: event };
}
