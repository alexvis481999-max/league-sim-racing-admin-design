import type { PublicEvent } from '../../../../shared/public-event';
import {
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cloneEventCardStudioConfig,
  defaultEventCardStudioConfig,
  type EventCardStudioConfig,
  type PreviewTheme,
  type ThemeCardSettings,
} from './eventCardConfig';
import type { EventDetails } from '../../shared/types';

export type CardMode = 'single' | 'weekly' | 'championship' | 'tournament' | 'time_attack' | 'practice';

type StatusKey = 'draft' | 'upcoming' | 'registration_open' | 'preparing' | 'live' | 'waiting_results' | 'finished' | 'completed_without_competitive_result' | 'failed' | 'cancelled';

type CardTemplate = {
  id: string;
  label: string;
  mode: CardMode;
  size: 3 | 4 | 6;
};

const ALL_TEMPLATES: CardTemplate[] = [
  { id: 'time_attack', label: 'Тайм-аттак', mode: 'time_attack', size: 4 },
  { id: 'practice', label: 'Практика', mode: 'practice', size: 3 },
  { id: 'single', label: 'Одиночная гонка', mode: 'single', size: 4 },
  { id: 'championship', label: 'Чемпионат', mode: 'championship', size: 4 },
  { id: 'weekly', label: 'Weekly', mode: 'weekly', size: 4 },
  { id: 'tournament', label: 'Турнир', mode: 'tournament', size: 6 },
];

export const FONT_OPTIONS = [
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet' },
  { value: 'Georgia, serif', label: 'Georgia' },
];

const STATUS_CONFIG: Record<StatusKey, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: '#64748b' },
  upcoming: { label: 'Скоро', color: '#0891b2' },
  registration_open: { label: 'Регистрация', color: '#16a34a' },
  preparing: { label: 'Подготовка', color: '#d69b36' },
  live: { label: 'Идёт', color: '#dc2626' },
  waiting_results: { label: 'Результаты', color: '#ca8a04' },
  finished: { label: 'Завершен', color: '#64748b' },
  completed_without_competitive_result: { label: 'Завершен', color: '#64748b' },
  failed: { label: 'Ошибка', color: '#b91c1c' },
  cancelled: { label: 'Отменен', color: '#7f1d1d' },
};

const MODE_LABELS: Record<CardMode, string> = {
  single: 'Одиночная гонка',
  weekly: 'Weekly',
  championship: 'Чемпионат',
  tournament: 'Турнир',
  time_attack: 'Тайм-аттак',
  practice: 'Практика',
};

const MODE_COLORS: Record<CardMode, string> = {
  single: '#1769ff',
  weekly: '#28b7c8',
  championship: '#ff5a1f',
  tournament: '#9b5cff',
  time_attack: '#e1b72f',
  practice: '#3dbb73',
};

const PUBLIC_PREVIEW_WIDTH = {
  events: 1280,
  home: 1280,
} as const;

export type EventCardStudioSource = {
  title: string;
  organizer: string;
  track: string;
  startLabel: string;
  periodLabel: string;
  statusKey: StatusKey;
  eventMode: CardMode;
  details: string[];
  image: string;
  ctaLabel: string;
  eventDetails?: EventDetails;
  publicEvent?: PublicEvent;
};

type EventCardStudioPanelProps = {
  source: EventCardStudioSource;
  title?: string;
  showAllTemplates?: boolean;
  compact?: boolean;
  value?: EventCardStudioConfig;
  onChange?: (config: EventCardStudioConfig) => void;
  showEditor?: boolean;
  previewVariants?: Array<'events' | 'home'>;
  eventDetails?: EventDetails;
  publicEvent?: PublicEvent;
  stackPreviews?: boolean;
};

export function EventCardStudioPanel({
  source,
  title = 'Превью карточки события',
  showAllTemplates = false,
  compact: requestedCompact = false,
  value,
  onChange,
  showEditor = true,
  previewVariants = ['events', 'home'],
  eventDetails,
  publicEvent,
  stackPreviews = false,
}: EventCardStudioPanelProps) {
  // Read-only previews must use the site's real card viewport. Compact sizing
  // changes the iframe breakpoint and no longer represents the public card.
  const compact = requestedCompact && showEditor;
  const [localConfig, setLocalConfig] = useState<EventCardStudioConfig>(() => cloneEventCardStudioConfig(defaultEventCardStudioConfig));
  const [readOnlyPreviewTheme, setReadOnlyPreviewTheme] = useState<PreviewTheme>(value?.previewTheme ?? 'dark');
  const config = value ?? localConfig;
  const activeTemplate = useMemo(() => ALL_TEMPLATES.find((template) => template.mode === source.eventMode) ?? ALL_TEMPLATES[0], [source.eventMode]);
  const previewModes = useMemo(() => (
    showAllTemplates ? ALL_TEMPLATES.map((template) => template.mode) : [activeTemplate.mode]
  ), [activeTemplate.mode, showAllTemplates]);
  const displayedPreviewTheme = showEditor ? config.previewTheme : readOnlyPreviewTheme;

  function setConfig(next: EventCardStudioConfig) {
    if (onChange) onChange(next);
    else setLocalConfig(next);
  }

  function update<K extends keyof EventCardStudioConfig>(key: K, value: EventCardStudioConfig[K]) {
    setConfig({ ...config, [key]: value });
  }

  function updateTheme<K extends keyof ThemeCardSettings>(key: K, value: ThemeCardSettings[K]) {
    setConfig({
      ...config,
      themes: {
        ...config.themes,
        [config.previewTheme]: {
          ...config.themes[config.previewTheme],
          [key]: value,
        },
      },
    });
  }

  return (
    <Stack spacing={compact ? 1.25 : 2}>
      <Stack direction={compact || showAllTemplates || !showEditor || stackPreviews ? 'column' : { xs: 'column', lg: 'row' }} spacing={1.5} alignItems="stretch">
        {showEditor ? <EditorPanel config={config} update={update} updateTheme={updateTheme} /> : null}
        <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
            <Typography variant="h6" sx={{ fontWeight: 850 }}>{title}</Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={displayedPreviewTheme}
              onChange={(_, nextTheme: PreviewTheme | null) => {
                if (!nextTheme) return;
                if (showEditor) update('previewTheme', nextTheme);
                else setReadOnlyPreviewTheme(nextTheme);
              }}
            >
              <ToggleButton value="dark">Dark</ToggleButton>
              <ToggleButton value="light">Light</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction={showAllTemplates || !showEditor || stackPreviews ? 'column' : { xs: 'column', md: 'row' }} spacing={1.5} alignItems="flex-start" useFlexGap flexWrap="wrap">
            {previewVariants.map((variant) => (
              <Stack
                key={variant}
                spacing={0.75}
                sx={{
                  flex: compact || !showEditor ? '0 0 auto' : 1,
                  width: compact ? variant === 'home' ? 255 : 360 : 'auto',
                  maxWidth: '100%',
                  minWidth: 0,
                }}
              >
                {showEditor || previewVariants.length > 1 ? (
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {variant === 'events' ? 'Страница событий' : 'Главная'}
                  </Typography>
                ) : null}
                <Box
                  sx={{
                    display: 'block',
                    p: compact ? 0 : 1.5,
                    borderRadius: 2,
                    bgcolor: compact ? 'transparent' : displayedPreviewTheme === 'dark' ? '#070a0f' : '#f4f1eb',
                    border: compact ? 0 : '1px solid',
                    borderColor: displayedPreviewTheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#d8dedf',
                    maxWidth: compact ? '100%' : PUBLIC_PREVIEW_WIDTH[variant] + 26,
                    mx: compact ? 0 : 'auto',
                    width: '100%',
                    overflowX: 'auto',
                  }}
                >
                  <PublicEventCardPreview
                    variant={variant}
                    source={source}
                    config={{ ...config, previewTheme: displayedPreviewTheme }}
                    modes={previewModes}
                    compact={compact}
                    eventDetails={eventDetails ?? source.eventDetails}
                    publicEvent={publicEvent ?? source.publicEvent}
                  />
                </Box>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
}

export function PublicEventCardPreview({
  variant,
  source,
  config,
  modes,
  compact,
  eventDetails,
  publicEvent,
}: {
  variant: 'events' | 'home';
  source: EventCardStudioSource;
  config: EventCardStudioConfig;
  modes: CardMode[];
  compact: boolean;
  eventDetails?: EventDetails;
  publicEvent?: PublicEvent;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(variant === 'home' ? 696 : 900);
  const siteUrl = String(import.meta.env.VITE_SITE_URL || 'http://localhost:5174').replace(/\/$/, '');
  const frameUrl = `${siteUrl}/event-card-preview?variant=${variant}&modes=${encodeURIComponent(modes.join(','))}`;

  const sendPreview = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({
      type: 'lsr-event-card-preview',
      source,
      config,
      modes,
      eventDetails,
      publicEvent: publicEvent ? { ...publicEvent, presentation: { ...publicEvent.presentation, coverUrl: publicEvent.presentation?.coverUrl ?? null, subtitle: publicEvent.presentation?.subtitle ?? null, cardAppearance: publicEvent.presentation?.cardAppearance ? config : null } } : undefined,
    }, new URL(siteUrl).origin);
  }, [config, eventDetails, publicEvent, modes, siteUrl, source]);

  useEffect(() => {
    sendPreview();
  }, [sendPreview]);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== new URL(siteUrl).origin || event.source !== frameRef.current?.contentWindow || !event.data || typeof event.data !== 'object') return;
      const message = event.data as { type?: unknown; height?: unknown };
      if (message.type === 'lsr-event-card-preview-ready') sendPreview();
      if (message.type === 'lsr-event-card-preview-size' && Number.isFinite(Number(message.height))) {
        setHeight(Math.max(280, Math.min(1400, Number(message.height))));
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [compact, sendPreview, variant, siteUrl]);

  const naturalWidth = PUBLIC_PREVIEW_WIDTH[variant];

  const frame = <Box
      component="iframe"
      ref={frameRef}
      src={frameUrl}
      title={variant === 'events' ? 'Карточка на странице событий' : 'Карточка на главной'}
      onLoad={sendPreview}
      sx={{
        display: 'block',
        width: naturalWidth,
        maxWidth: 'none',
        height,
        border: 0,
        bgcolor: 'transparent',
      }}
    />;

  if (!compact) return frame;
  const targetWidth = variant === 'home' ? 255 : 360;
  const scale = targetWidth / naturalWidth;
  return <Box sx={{ width: targetWidth, height: height * scale, overflow: 'hidden' }}>
    <Box sx={{ width: naturalWidth, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{frame}</Box>
  </Box>;
}

function EditorPanel({
  config,
  update,
  updateTheme,
}: {
  config: EventCardStudioConfig;
  update: <K extends keyof EventCardStudioConfig>(key: K, value: EventCardStudioConfig[K]) => void;
  updateTheme: <K extends keyof ThemeCardSettings>(key: K, value: ThemeCardSettings[K]) => void;
}) {
  const theme = config.themes[config.previewTheme];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 1,
        width: '100%',
        flexShrink: 0,
        '& .MuiInputBase-root': { minHeight: 36 },
        '& .MuiSelect-select': { py: '7px' },
        '& .MuiInputLabel-root': { fontSize: 14, fontWeight: 400 },
      }}
    >
      <Stack spacing={0.8}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography sx={{ fontWeight: 850 }}>Настройки карточки</Typography>
          <Chip size="small" label="Для всех карточек" />
        </Stack>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Компоненты</Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.25} sx={{ mt: 0.5 }}>
            <SectionCheckbox label="Тип события" checked={config.showEventType} onChange={() => update('showEventType', !config.showEventType)} />
            <SectionCheckbox label="Бренд" checked={config.showOrganizer} onChange={() => update('showOrganizer', !config.showOrganizer)} />
            <SectionCheckbox label="Название" checked={config.showTitle} onChange={() => update('showTitle', !config.showTitle)} />
            <SectionCheckbox label="Трасса" checked={config.showTrack} onChange={() => update('showTrack', !config.showTrack)} />
            <SectionCheckbox label="Дата" checked={config.showDate} onChange={() => update('showDate', !config.showDate)} />
            <SectionCheckbox label="Подпись даты" checked={config.showDateLabel} onChange={() => update('showDateLabel', !config.showDateLabel)} />
            <SectionCheckbox label="Статус" checked={config.showStatus} onChange={() => update('showStatus', !config.showStatus)} />
            <SectionCheckbox label="Детали" checked={config.showDetails} onChange={() => update('showDetails', !config.showDetails)} />
            <SectionCheckbox label="Рейтинг" checked={config.showRating} onChange={() => update('showRating', !config.showRating)} />
            <SectionCheckbox label="Фото" checked={config.showImage} onChange={() => update('showImage', !config.showImage)} />
          </Stack>
        </Box>

        <Divider />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(280px, max-content))' },
            gap: 2,
            alignItems: 'stretch',
          }}
        >
          <SettingGroup title="Текст">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '124px 92px' }, gap: 0.65, alignItems: 'center' }}>
            <FormControl size="small">
              <InputLabel>Шрифт</InputLabel>
              <Select label="Шрифт" value={config.fontFamily} onChange={(event) => update('fontFamily', event.target.value)}>
                {FONT_OPTIONS.map((font) => (
                  <MenuItem key={font.value} value={font.value}>{font.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel>Толщина</InputLabel>
              <Select
                label="Толщина"
                value={String(config.titleWeight)}
                onChange={(event) => update('titleWeight', Number(event.target.value) as EventCardStudioConfig['titleWeight'])}
              >
                {[700, 800, 900].map((weight) => (
                  <MenuItem key={weight} value={String(weight)}>{weight}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <SettingRow
            left={<SettingLabel>Горизонталь</SettingLabel>}
            right={
              <MiniToggleGroup
                value={config.textAlign}
                onChange={(value) => update('textAlign', value as EventCardStudioConfig['textAlign'])}
                options={[
                  { value: 'left', label: 'Лево' },
                  { value: 'center', label: 'Центр' },
                  { value: 'right', label: 'Право' },
                ]}
              />
            }
          />
          <SettingRow
            left={<SettingLabel>Вертикаль</SettingLabel>}
            right={
              <MiniToggleGroup
                value={config.verticalAlign}
                onChange={(value) => update('verticalAlign', value as EventCardStudioConfig['verticalAlign'])}
                options={[
                  { value: 'top', label: 'Верх' },
                  { value: 'center', label: 'Центр' },
                  { value: 'bottom', label: 'Низ' },
                ]}
              />
            }
          />

          <SettingRow
            left={<ColorField label="Название" value={theme.titleColor} onChange={(value) => updateTheme('titleColor', value)} />}
            right={<MiniSliderRow label="Размер" value={config.titleSize} min={18} max={30} onChange={(value) => update('titleSize', value)} suffix="px" />}
          />
          <SettingRow
            left={<ColorField label="Текст" value={theme.metaColor} onChange={(value) => updateTheme('metaColor', value)} />}
            right={<MiniSliderRow label="Размер" value={config.bodySize} min={11} max={15} onChange={(value) => update('bodySize', value)} suffix="px" />}
          />
          </SettingGroup>

          <SettingGroup title="Карточка">
          <SettingRow left={<ColorField label="Фон" value={theme.surface} onChange={(value) => updateTheme('surface', value)} />} />
          <SettingRow
            left={<ColorField label="Акцент" value={theme.accentColor} onChange={(value) => updateTheme('accentColor', value)} />}
            right={<MiniSliderRow label="Полоса" value={theme.railOpacity} min={0} max={1} step={0.05} onChange={(value) => updateTheme('railOpacity', value)} />}
          />
          <SettingRow
            left={<ColorField label="Рамка" value={theme.outlineColor} onChange={(value) => updateTheme('outlineColor', value)} />}
            right={<MiniSliderRow label="Рамка" value={theme.outlineOpacity} min={0} max={1} step={0.05} onChange={(value) => updateTheme('outlineOpacity', value)} />}
          />
          <SettingRow
            left={
              <FormControl size="small" sx={{ width: 136 }}>
                <InputLabel>Дата</InputLabel>
                <Select label="Дата" value={theme.dateTone} onChange={(event) => updateTheme('dateTone', event.target.value as ThemeCardSettings['dateTone'])}>
                  <MenuItem value="white">Белая</MenuItem>
                  <MenuItem value="light">Светло-серая</MenuItem>
                  <MenuItem value="gray">Серая</MenuItem>
                  <MenuItem value="dark">Темная</MenuItem>
                  <MenuItem value="black">Черная</MenuItem>
                </Select>
              </FormControl>
            }
          />
          </SettingGroup>

          <SettingGroup title="Фото">
          <SettingRow
            left={<ColorField label="Слой" value={theme.imageOverlayColor} onChange={(value) => updateTheme('imageOverlayColor', value)} />}
            right={<MiniSliderRow label="Слой" value={theme.imageOverlayOpacity} min={0} max={0.85} step={0.05} onChange={(value) => updateTheme('imageOverlayOpacity', value)} />}
          />
          <SettingRow
            left={<SettingLabel>Фильтр</SettingLabel>}
            right={<MiniSliderRow label="Сила" value={theme.overlay} min={0.15} max={0.9} step={0.05} onChange={(value) => updateTheme('overlay', value)} />}
          />
          <SettingRow
            left={<SettingLabel>Размытие</SettingLabel>}
            right={<MiniSliderRow label="Blur" value={config.imageBlur} min={0} max={3} step={0.25} onChange={(value) => update('imageBlur', value)} suffix="px" />}
          />
          <SettingRow
            left={<SettingLabel>Контраст</SettingLabel>}
            right={<MiniSliderRow label="Контраст" value={config.imageContrast} min={0.9} max={1.25} step={0.01} onChange={(value) => update('imageContrast', value)} />}
          />
          </SettingGroup>
        </Box>
      </Stack>
    </Paper>
  );
}

function SectionCheckbox({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <FormControlLabel
      sx={{ m: 0, mr: 0.25, '& .MuiFormControlLabel-label': { fontSize: 12 } }}
      control={<Checkbox checked={checked} onChange={onChange} disabled={disabled} size="small" sx={{ p: 0.45 }} />}
      label={label}
    />
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="caption" color="text.primary" sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, textTransform: 'none' }}>
      {children}
    </Typography>
  );
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack
      spacing={0.85}
      sx={{
        minWidth: 280,
        height: '100%',
        pr: 2,
        borderRight: { xs: 0, md: '1px solid' },
        borderColor: 'divider',
        '&:last-child': {
          borderRight: 0,
          pr: 0,
        },
      }}
    >
      <Box sx={{ mb: 0.35 }}>
        <SectionTitle>{title}</SectionTitle>
      </Box>
      {children}
    </Stack>
  );
}

function SettingRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '136px 132px' }, gap: 0.75, alignItems: 'center' }}>
      {left}
      {right ?? <Box />}
    </Box>
  );
}

function SettingLabel({ children }: { children: string }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ width: 136, fontSize: 13, fontWeight: 900, lineHeight: 1 }}>
      {children}
    </Typography>
  );
}

function MiniToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_, next: string | null) => next && onChange(next)}
      sx={{ width: 132, '& .MuiToggleButton-root': { flex: 1, py: 0.35, px: 0.35, fontSize: 10.5 } }}
    >
      {options.map((option) => (
        <ToggleButton key={option.value} value={option.value}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function MiniSliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Box sx={{ width: 132, minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, lineHeight: 1 }}>
          {value}{suffix}
        </Typography>
      </Stack>
      <Slider
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(_, next) => onChange(Array.isArray(next) ? next[0] : next)}
        sx={{ py: 0.25, '& .MuiSlider-thumb': { width: 12, height: 12 } }}
      />
    </Box>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    if (commitTimerRef.current) return;
    draftRef.current = value;
    setDraft(value);
  }, [value]);
  useEffect(() => () => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
  }, []);

  const queueCommit = (next: string) => {
    draftRef.current = next;
    setDraft(next);
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      onChangeRef.current(draftRef.current);
    }, 180);
  };

  const flushCommit = () => {
    if (!commitTimerRef.current) return;
    clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
    onChangeRef.current(draftRef.current);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 136, minWidth: 136, gap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 13, fontWeight: 900, lineHeight: 1 }}>
        {label}
      </Typography>
      <TextField
        type="color"
        value={draft}
        onChange={(event) => queueCommit(event.target.value)}
        onBlur={flushCommit}
        inputProps={{ 'aria-label': label }}
        sx={{
          width: 56,
          '& .MuiInputBase-root': { height: 26 },
          '& input[type="color"]': { height: 20, p: '2px 4px' },
        }}
      />
    </Box>
  );
}

export function CardTemplateRenderer({
  template,
  event,
  config,
  theme,
  compact,
  variant,
}: {
  template: CardTemplate;
  event: EventCardStudioSource;
  config: EventCardStudioConfig;
  theme: ThemeCardSettings;
  compact: boolean;
  variant: 'events' | 'home';
}) {
  const status = STATUS_CONFIG[event.statusKey] ?? STATUS_CONFIG.draft;
  const imageUrl = event.image || '/assets/lsr-porsche-hero.png';
  const modeAccent = MODE_COLORS[event.eventMode];
  const layout = getModeLayout(event.eventMode);
  const details = getDetails(event, template.mode);
  const focus = getFocusMeta(event, template.mode);
  const palette = getModePalette(template.mode, config.previewTheme, theme);
  const textColor = palette.title;
  const metaColor = palette.meta;

  return (
    <Paper
      variant="outlined"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        flex: compact
          ? variant === 'home' ? '0 0 min(100%, 255px)' : '0 0 min(100%, 360px)'
          : variant === 'home' ? 'none' : getMosaicFlex(template.size),
        width: compact ? variant === 'home' ? 'min(100%, 255px)' : 'min(100%, 360px)' : '100%',
        minWidth: 0,
        height: variant === 'home' ? 342 : 292,
        p: '12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: '8px',
        border: '0 !important',
        bgcolor: palette.surface,
        boxShadow: palette.shadow,
        color: metaColor,
        textAlign: config.textAlign,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 8,
          borderRadius: '8px',
          border: `1px solid ${palette.border}`,
          pointerEvents: 'none',
        }}
      />
      <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, bgcolor: theme.accentColor, opacity: theme.railOpacity, zIndex: 2 }} />
      {renderModeImage(template.mode, imageUrl, config, theme)}

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ position: 'relative', zIndex: 3, width: '100%' }}>
        {config.showEventType ? <ChipLabel label={MODE_LABELS[event.eventMode]} color={modeAccent} /> : null}
        {config.showStatus ? <ChipLabel label={status.label} color={status.color} /> : null}
      </Stack>

      <Box
        sx={{
          position: 'relative',
          zIndex: 3,
          width: layout.copyWidth,
          ml: layout.copyMarginLeft,
          ...getVerticalCopySx(config.verticalAlign),
          alignSelf: layout.copyAlignSelf,
        }}
      >
        <Stack spacing={0.7} sx={getCopySx(template.mode, config.previewTheme, theme)}>
          {config.showOrganizer ? (
            <Typography sx={{ color: metaColor, fontSize: config.bodySize, fontWeight: 950, textTransform: 'uppercase', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.organizer}
            </Typography>
          ) : null}
          {config.showTitle ? (
            <Typography
              variant="h3"
              sx={{
                color: textColor,
                fontFamily: config.fontFamily,
                fontSize: getTitleSize(template.mode, config.titleSize),
                fontWeight: config.titleWeight,
                lineHeight: 1,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                letterSpacing: 0,
              }}
            >
              {event.title}
            </Typography>
          ) : null}
          {config.showTrack ? (
            <Typography sx={{ color: metaColor, fontSize: config.bodySize + 1, fontWeight: 900, lineHeight: 1.16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.track}
            </Typography>
          ) : null}
          {config.showDetails && details.length > 0 ? (
            <Stack spacing={0.55} sx={{ pt: 0.45 }}>
              {details.map((item) => (
                <Box key={`${template.id}-${item.value}`} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1, minWidth: 0 }}>
                  <Typography component="strong" sx={{ color: metaColor, fontSize: config.bodySize + 1, fontWeight: 950, lineHeight: 1.12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : null}
          {config.showRating ? (
            <Typography sx={{ color: metaColor, fontSize: config.bodySize + 1, fontWeight: 950, lineHeight: 1.12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getRatingLabel(template.mode)}
            </Typography>
          ) : null}
        </Stack>
      </Box>

      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ position: 'relative', zIndex: 3, width: '100%', pt: 1, borderTop: template.mode === 'single' ? 0 : `1px solid ${alpha(metaColor, 0.25)}` }}>
        {config.showDate || config.showDateLabel ? (
          <>
            {config.showDateLabel && focus.label ? (
              <MetaPill tone={theme.dateTone}>
                {focus.label}
              </MetaPill>
            ) : <span />}
            {config.showDate ? (
              <MetaPill tone={theme.dateTone} align="right">
                {focus.value}
              </MetaPill>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}

function getDetails(event: EventCardStudioSource, mode: CardMode): Array<{ value: string }> {
  const [first = event.track, second = 'Слоты уточняются'] = event.details;
  if (mode === 'weekly') return [{ value: event.periodLabel }];
  if (mode === 'championship') return [{ value: event.periodLabel }];
  if (mode === 'tournament') return [{ value: first }, { value: second }];
  return [];
}

function getRatingLabel(mode: CardMode) {
  if (mode === 'time_attack' || mode === 'tournament') return 'PR: C';
  return 'PR: D / SR: A';
}

function getFocusMeta(event: EventCardStudioSource, mode: CardMode): { label: string; value: string } {
  if (mode === 'weekly') return { label: 'Ближайшая гонка', value: event.startLabel };
  if (mode === 'championship') return { label: 'Следующий заезд', value: event.startLabel };
  if (mode === 'tournament') return { label: 'Старт турнира', value: event.startLabel };
  if (mode === 'time_attack') return { label: 'Time Attack', value: event.periodLabel };
  if (mode === 'practice') return { label: 'Время старта', value: event.startLabel };
  return { label: 'Старт', value: event.startLabel };
}

function renderModeImage(mode: CardMode, imageUrl: string, config: EventCardStudioConfig, theme: ThemeCardSettings) {
  if (!config.showImage) {
    return <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${alpha(theme.accentColor, 0.36)}, ${theme.surface})` }} />;
  }

  const common = {
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: `blur(${config.imageBlur}px) contrast(${config.imageContrast})`,
  };
  const overlayLayer = imageOverlayLayer(theme);

  if (mode === 'single') {
    return (
      <>
        <Box sx={{ position: 'absolute', inset: '0 0 0 42%', bgcolor: theme.surface }} />
        <Box sx={{ position: 'absolute', inset: '0 auto 0 0', width: '42%', height: 'auto', borderRadius: 0, opacity: 1, boxShadow: 'none', backgroundImage: `linear-gradient(90deg, transparent 58%, ${alpha(theme.surface, theme.overlay)}), ${overlayLayer}, url("${imageUrl}")`, ...common }} />
      </>
    );
  }

  if (mode === 'weekly') {
    return (
      <>
        <Box sx={{ position: 'absolute', inset: '0 43% 0 0', bgcolor: theme.surface }} />
        <Box sx={{ position: 'absolute', inset: '0 0 0 auto', width: '43%', opacity: 0.96, backgroundImage: `linear-gradient(90deg, ${alpha(theme.surface, Math.min(0.72, theme.overlay))}, ${alpha(theme.surface, 0.04)}), ${overlayLayer}, url("${imageUrl}")`, ...common }} />
      </>
    );
  }

  if (mode === 'championship') {
    return <Box sx={{ position: 'absolute', inset: 0, width: 'auto', opacity: 0.86, backgroundImage: `linear-gradient(90deg, ${alpha('#07101a', theme.overlay)} 0%, ${alpha('#07101a', Math.max(0.24, theme.overlay - 0.22))} 45%, ${alpha('#07101a', 0.08)} 100%), ${overlayLayer}, url("${imageUrl}")`, ...common, backgroundPosition: '72% center' }} />;
  }

  if (mode === 'practice') {
    return <Box sx={{ position: 'absolute', inset: '0 0 auto 0', height: 132, backgroundImage: `linear-gradient(180deg, rgba(7, 10, 15, 0.06), rgba(7, 10, 15, ${theme.overlay})), ${overlayLayer}, url("${imageUrl}")`, ...common, filter: `saturate(1.06) contrast(${config.imageContrast}) blur(${config.imageBlur}px)` }} />;
  }

  if (mode === 'time_attack') {
    return <Box sx={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(180deg, rgba(7, 10, 15, 0.08), rgba(7, 10, 15, ${theme.overlay})), linear-gradient(32deg, ${alpha(theme.accentColor, 0.58)}, transparent 54%), ${overlayLayer}, url("${imageUrl}")`, ...common }} />;
  }

  return <Box sx={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(90deg, rgba(7, 10, 15, ${theme.overlay}), rgba(7, 10, 15, 0.34)), linear-gradient(120deg, ${alpha(theme.accentColor, 0.46)}, transparent 58%), ${overlayLayer}, url("${imageUrl}")`, ...common }} />;
}

function getModeLayout(mode: CardMode) {
  if (mode === 'single') return { copyWidth: '56%', copyMarginLeft: '43%', copyMarginTop: 'auto', copyAlignSelf: 'stretch' };
  if (mode === 'weekly') return { copyWidth: '56%', copyMarginLeft: 0, copyMarginTop: 'auto', copyAlignSelf: 'stretch' };
  if (mode === 'championship') return { copyWidth: '68%', copyMarginLeft: 0, copyMarginTop: 'auto', copyAlignSelf: 'stretch' };
  if (mode === 'practice') return { copyWidth: '100%', copyMarginLeft: 0, copyMarginTop: 'auto', copyAlignSelf: 'stretch' };
  return { copyWidth: '100%', copyMarginLeft: 0, copyMarginTop: 'auto', copyAlignSelf: 'stretch' };
}

function getVerticalCopySx(verticalAlign: EventCardStudioConfig['verticalAlign']) {
  if (verticalAlign === 'top') return { mt: 1.25, mb: 'auto' };
  if (verticalAlign === 'center') return { mt: 'auto', mb: 'auto' };
  return { mt: 'auto', mb: 0 };
}

function imageOverlayLayer(theme: ThemeCardSettings) {
  return `linear-gradient(0deg, ${alpha(theme.imageOverlayColor, theme.imageOverlayOpacity)}, ${alpha(theme.imageOverlayColor, theme.imageOverlayOpacity)})`;
}

function getTitleSize(mode: CardMode, base: number) {
  if (mode === 'weekly') return Math.min(base, 26);
  if (mode === 'championship') return Math.min(base + 2, 30);
  if (mode === 'practice') return Math.min(base, 22);
  if (mode === 'time_attack') return Math.min(base + 3, 30);
  return base;
}

function getMosaicFlex(size: 3 | 4 | 6) {
  if (size === 3) return '0 1 calc((100% - var(--mosaic-column-gap) * 3) / 4)';
  if (size === 4) return '0 1 calc((100% - var(--mosaic-column-gap) * 2) / 3)';
  return '0 1 calc((100% - var(--mosaic-column-gap)) / 2)';
}

function getModePalette(mode: CardMode, previewTheme: PreviewTheme, theme: ThemeCardSettings) {
  const title = theme.titleColor;
  const meta = theme.metaColor;
  const outline = alpha(theme.outlineColor, theme.outlineOpacity);
  const darkShadow = `0 18px 48px rgba(0, 0, 0, 0.28), 0 0 22px ${alpha(theme.accentColor, 0.24)}`;

  if (mode === 'championship') {
    return {
      title,
      meta,
      surface: previewTheme === 'dark' ? '#e5e8ec' : '#e5e8ec',
      border: outline,
      shadow: previewTheme === 'dark' ? darkShadow : `0 18px 48px rgba(20, 28, 38, 0.14), 0 0 24px ${alpha(theme.accentColor, 0.16)}`,
    };
  }

  if (mode === 'weekly') {
    return {
      title,
      meta,
      surface: `linear-gradient(90deg, ${alpha(theme.accentColor, previewTheme === 'dark' ? 0.46 : 0.68)} 0 57%, transparent 57%), ${theme.surface}`,
      border: outline,
      shadow: darkShadow,
    };
  }

  if (mode === 'single') {
    return {
      title,
      meta,
      surface: `linear-gradient(90deg, ${alpha(theme.accentColor, 0.18)} 0 4px, transparent 4px), linear-gradient(180deg, ${alpha(theme.surface, 0.98)}, ${theme.surface})`,
      border: outline,
      shadow: darkShadow,
    };
  }

  return {
    title,
    meta,
    surface: mode === 'practice' ? theme.surface : '#111722',
    border: outline,
    shadow: darkShadow,
  };
}

function getCopySx(mode: CardMode, previewTheme: PreviewTheme, theme: ThemeCardSettings) {
  if (mode !== 'practice') return undefined;
  return {
    mt: 0.25,
    p: '8px 10px',
    borderRadius: '10px',
    bgcolor: alpha(theme.surface, previewTheme === 'dark' ? 0.76 : 0.82),
    backdropFilter: 'blur(8px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
  };
}

function ChipLabel({ label, color }: { label: string; color: string }) {
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        width: 'auto',
        minWidth: 64,
        maxWidth: 'none',
        height: 22,
        minHeight: 22,
        maxHeight: 22,
        borderRadius: '6px',
        bgcolor: alpha(color, 0.88),
        border: `1px solid ${alpha('#fff', 0.24)}`,
        color: '#fff',
        fontSize: '0.68rem',
        fontWeight: 850,
        textTransform: 'uppercase',
        backdropFilter: 'blur(8px)',
        '& .MuiChip-label': { px: '7px', overflow: 'visible', textOverflow: 'clip', whiteSpace: 'nowrap' },
      }}
    />
  );
}

function MetaPill({
  children,
  tone,
  align = 'left',
}: {
  children: string;
  tone: ThemeCardSettings['dateTone'];
  align?: 'left' | 'right';
}) {
  const colors = getDatePillColors(tone);

  return (
    <Typography
      variant="caption"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        minWidth: 0,
        maxWidth: align === 'right' ? '68%' : '42%',
        px: '6px',
        py: '2px',
        borderRadius: '4px',
        bgcolor: colors.bg,
        color: colors.fg,
        fontSize: '0.86rem',
        fontWeight: 900,
        lineHeight: 1.18,
        textAlign: align,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textShadow: colors.shadow,
        boxShadow: colors.boxShadow,
        backdropFilter: 'blur(6px)',
        ml: align === 'right' ? 'auto' : 0,
      }}
    >
      {children}
    </Typography>
  );
}

function getDatePillColors(tone: ThemeCardSettings['dateTone']) {
  const tones: Record<ThemeCardSettings['dateTone'], { bg: string; fg: string; shadow: string; boxShadow: string }> = {
    white: {
      bg: 'rgba(255,255,255,0.86)',
      fg: '#0f172a',
      shadow: '0 1px 0 rgba(255,255,255,0.6)',
      boxShadow: '0 0 14px rgba(244,247,250,0.78), 0 0 2px rgba(255,255,255,0.9)',
    },
    light: {
      bg: 'rgba(244,247,250,0.66)',
      fg: '#111827',
      shadow: '0 1px 0 rgba(255,255,255,0.6)',
      boxShadow: '0 0 14px rgba(244,247,250,0.68), 0 0 2px rgba(255,255,255,0.8)',
    },
    gray: {
      bg: 'rgba(148,163,184,0.62)',
      fg: '#0f172a',
      shadow: '0 1px 0 rgba(255,255,255,0.25)',
      boxShadow: '0 0 14px rgba(100,116,139,0.34), 0 0 2px rgba(255,255,255,0.32)',
    },
    dark: {
      bg: 'rgba(7,10,15,0.42)',
      fg: '#ffffff',
      shadow: '0 1px 6px rgba(0,0,0,0.58)',
      boxShadow: '0 0 14px rgba(7,10,15,0.42), 0 0 2px rgba(255,255,255,0.16)',
    },
    black: {
      bg: 'rgba(0,0,0,0.72)',
      fg: '#ffffff',
      shadow: '0 1px 6px rgba(0,0,0,0.72)',
      boxShadow: '0 0 14px rgba(0,0,0,0.42), 0 0 2px rgba(255,255,255,0.1)',
    },
  };
  return tones[tone];
}

export function toEventCardSourceFromForm(params: {
  title: string;
  organizer: string;
  track: string;
  startsAtLabel: string;
  endsAtLabel: string;
  eventMode: CardMode;
  image: string;
  details?: string[];
  ctaLabel?: string;
  statusKey?: StatusKey;
}): EventCardStudioSource {
  const starts = params.startsAtLabel || 'Скоро объявим';
  const ends = params.endsAtLabel && params.endsAtLabel !== starts ? params.endsAtLabel : '';
  const period = ends ? `${starts} / ${ends}` : starts;

  return {
    title: params.title.trim() || 'Событие',
    organizer: params.organizer.trim() || 'Организатор',
    track: params.track.trim() || 'Трасса не указана',
    startLabel: starts,
    periodLabel: period,
    statusKey: params.statusKey ?? 'upcoming',
    eventMode: params.eventMode,
    image: params.image,
    details: params.details?.filter(Boolean).slice(0, 3) ?? [],
    ctaLabel: params.ctaLabel || 'Подробнее',
  };
}

export function formatCardDate(value?: string | null) {
  if (!value) return 'Нет даты';
  const date = new Date(value);
  const dateParts = new Intl.DateTimeFormat('ru-RU', {  day: '2-digit', month: '2-digit' }).formatToParts(date);
  const timeParts = new Intl.DateTimeFormat('ru-RU', {  hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const day = dateParts.find((part) => part.type === 'day')?.value ?? '';
  const month = dateParts.find((part) => part.type === 'month')?.value ?? '';
  const hour = Number(timeParts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute} ${day}.${month} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
}
