import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicationAction, PublicationPlacementCode } from '../../shared/types';
import type {
  ContentAppearanceConfig,
  ContentPreviewTheme,
  ContentSurfaceKind,
  ContentSurfaceSettings,
  ContentThemeSettings,
} from './contentAppearance';
import { cloneContentAppearance } from './contentAppearance';

const surfaceLabels: Record<ContentSurfaceKind, string> = {
  card: 'Карточка новости',
  slider: 'Слайдер',
  articleHero: 'Шапка новости',
};

const placementPreviewMeta: Record<PublicationPlacementCode, { label: string; width: number; height: number }> = {
  'home.hero': { label: 'Главная · большой слайдер', width: 1280, height: 460 },
  'home.promo': { label: 'Главная · дополнительный слайдер', width: 352, height: 390 },
  'home.feed': { label: 'Главная · новостная лента', width: 380, height: 170 },
  'touge.featured_news': { label: 'Touge · главный блок новостей', width: 658.8, height: 300 },
  'touge.feed': { label: 'Touge · новостная лента', width: 380, height: 330 },
};

type PreviewContentProps = {
  placementCode: PublicationPlacementCode;
  image: string;
  title: string;
  summary: string;
  eyebrow: string;
  actions: PublicationAction[];
};

type StudioProps = PreviewContentProps & {
  value: ContentAppearanceConfig;
  onChange: (value: ContentAppearanceConfig) => void;
  surfaces: ContentSurfaceKind[];
};

export function ContentAppearanceStudio({
  value, onChange, placementCode, image, title, summary, eyebrow, actions, surfaces,
}: StudioProps) {
  const [surface, setSurface] = useState<ContentSurfaceKind>(surfaces[0] ?? 'card');
  const [draftValue, setDraftValue] = useState<ContentAppearanceConfig>(() => cloneContentAppearance(value));
  const draftRef = useRef(draftValue);
  const commitTimerRef = useRef<number | null>(null);
  const activeSurface = surfaces.includes(surface) ? surface : surfaces[0] ?? 'card';
  const settings = draftValue[activeSurface];
  const theme = settings.themes[draftValue.previewTheme];

  useEffect(() => {
    const next = cloneContentAppearance(value);
    draftRef.current = next;
    setDraftValue(next);
  }, [value]);

  useEffect(() => () => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
  }, []);

  function setAppearance(next: ContentAppearanceConfig, commit = true) {
    draftRef.current = next;
    setDraftValue(next);
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    if (commit) {
      commitTimerRef.current = null;
      onChange(next);
      return;
    }
    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = null;
      onChange(draftRef.current);
    }, 300);
  }

  function commitDraft() {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
    onChange(draftRef.current);
  }

  function updateSurface(patch: Partial<ContentSurfaceSettings>, commit = true) {
    setAppearance({ ...draftValue, [activeSurface]: { ...settings, ...patch } }, commit);
  }

  function updateTheme(patch: Partial<ContentThemeSettings>, commit = true) {
    setAppearance({
      ...draftValue,
      [activeSurface]: {
        ...settings,
        themes: { ...settings.themes, [draftValue.previewTheme]: { ...theme, ...patch } },
      },
    }, commit);
  }

  return (
    <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5} mb={1.5}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 850 }}>Предпросмотр и оформление</Typography>
          <Typography variant="body2" color="text.secondary">
            Превью повторяет пропорции и композицию выбранного блока сайта.
          </Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={draftValue.previewTheme}
          onChange={(_, next: ContentPreviewTheme | null) => next && setAppearance({ ...draftValue, previewTheme: next })}
        >
          <ToggleButton value="dark">Тёмная тема</ToggleButton>
          <ToggleButton value="light">Светлая тема</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {surfaces.length > 1 ? (
        <Tabs
          value={activeSurface}
          onChange={(_, next: ContentSurfaceKind) => setSurface(next)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2 }}
        >
          {surfaces.map((item) => <Tab key={item} value={item} label={surfaceLabels[item]} />)}
        </Tabs>
      ) : null}

      <ContentAppearancePreview
        placementCode={placementCode}
        appearance={draftValue}
        image={image}
        title={title}
        summary={summary}
        eyebrow={eyebrow}
        actions={actions}
      />

      <Paper
        variant="outlined"
        sx={{
          mt: 1.25,
          p: 1,
          borderRadius: 1,
          '& .MuiInputBase-root': { minHeight: 36 },
          '& .MuiSelect-select': { py: '7px' },
          '& .MuiInputLabel-root': { fontSize: 14 },
          '& .MuiToggleButton-root': { minHeight: 32, py: 0.35, px: 0.8, fontSize: 11 },
          '& .MuiFormControlLabel-root': { mr: 0.75, my: -0.25 },
          '& .MuiFormControlLabel-label': { fontSize: 12 },
        }}
      >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(3,minmax(0,1fr))' }, gap: 1.5, alignItems: 'start' }}>
        <Stack spacing={0.7}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Композиция</Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 0.65 }}>
            <FormControl size="small">
              <InputLabel>Макет текста</InputLabel>
              <Select label="Макет текста" value={settings.layout} onChange={(event) => updateSurface({ layout: event.target.value as ContentSurfaceSettings['layout'] })}>
                <MenuItem value="overlay">Поверх фотографии</MenuItem>
                <MenuItem value="panel">На контрастной подложке</MenuItem>
                <MenuItem value="minimal">Без фотографии</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel>Кадрирование фотографии</InputLabel>
              <Select label="Кадрирование фотографии" value={settings.imagePosition} onChange={(event) => updateSurface({ imagePosition: event.target.value as ContentSurfaceSettings['imagePosition'] })}>
                <MenuItem value="top">По верхнему краю</MenuItem>
                <MenuItem value="center">По центру</MenuItem>
                <MenuItem value="bottom">По нижнему краю</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <ToggleButtonGroup exclusive size="small" value={settings.textAlign} onChange={(_, next) => next && updateSurface({ textAlign: next })} fullWidth>
            <ToggleButton value="left">Текст слева</ToggleButton>
            <ToggleButton value="center">По центру</ToggleButton>
            <ToggleButton value="right">Текст справа</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup exclusive size="small" value={settings.verticalAlign} onChange={(_, next) => next && updateSurface({ verticalAlign: next })} fullWidth>
            <ToggleButton value="top">Сверху</ToggleButton>
            <ToggleButton value="center">По центру</ToggleButton>
            <ToggleButton value="bottom">Снизу</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Stack spacing={0.45} sx={{ borderLeft: { xl: '1px solid' }, borderColor: { xl: 'divider' }, pl: { xl: 1.5 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Содержимое</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1 }}>
            <Check label="Фото" value={settings.showImage} onChange={(showImage) => updateSurface({ showImage })} />
            <Check label="Рубрика" value={settings.showEyebrow} onChange={(showEyebrow) => updateSurface({ showEyebrow })} />
            <Check label="Описание" value={settings.showSummary} onChange={(showSummary) => updateSurface({ showSummary })} />
            <Check label="Дата" value={settings.showDate} onChange={(showDate) => updateSurface({ showDate })} />
          </Box>
          <NumberSlider label="Размер заголовка" value={settings.titleSize} min={16} max={activeSurface === 'card' ? 38 : 76} suffix="px" onChange={(titleSize) => updateSurface({ titleSize }, false)} onCommit={commitDraft} />
        </Stack>

        <Stack spacing={0.7} sx={{ borderLeft: { xl: '1px solid' }, borderColor: { xl: 'divider' }, pl: { xl: 1.5 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Цвета · {draftValue.previewTheme === 'dark' ? 'тёмная тема' : 'светлая тема'}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 0.65 }}>
            <ColorInput label="Фон" value={theme.surface} onChange={(surface) => updateTheme({ surface }, false)} onCommit={commitDraft} />
            <ColorInput label="Акцент" value={theme.accentColor} onChange={(accentColor) => updateTheme({ accentColor }, false)} onCommit={commitDraft} />
            <ColorInput label="Заголовок" value={theme.titleColor} onChange={(titleColor) => updateTheme({ titleColor }, false)} onCommit={commitDraft} />
            <ColorInput label="Текст" value={theme.textColor} onChange={(textColor) => updateTheme({ textColor }, false)} onCommit={commitDraft} />
            <ColorInput label="Рамка" value={theme.borderColor} onChange={(borderColor) => updateTheme({ borderColor }, false)} onCommit={commitDraft} />
            <ColorInput label="Затемнение" value={theme.overlayColor} onChange={(overlayColor) => updateTheme({ overlayColor }, false)} onCommit={commitDraft} />
          </Box>
          <NumberSlider label="Плотность затемнения" value={theme.overlayOpacity} min={0} max={0.95} step={0.05} onChange={(overlayOpacity) => updateTheme({ overlayOpacity }, false)} onCommit={commitDraft} />
        </Stack>
      </Box>
      </Paper>
    </Box>
  );
}

type StandalonePreviewProps = PreviewContentProps & {
  appearance: ContentAppearanceConfig;
};

export function ContentAppearancePreview({
  placementCode, appearance, image, title, summary, eyebrow, actions,
}: StandalonePreviewProps) {
  const meta = placementPreviewMeta[placementCode];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1} mb={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{meta.label}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          Viewport сайта: {meta.width} × {meta.height}
        </Typography>
      </Stack>
      <PublicationPreviewFrame
        placementCode={placementCode}
        appearance={appearance}
        image={image}
        title={title}
        summary={summary}
        eyebrow={eyebrow}
        actions={actions}
      />
    </Box>
  );
}

function PublicationPreviewFrame({ placementCode, appearance, image, title, summary, eyebrow, actions }: StandalonePreviewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const meta = placementPreviewMeta[placementCode];
  const [availableWidth, setAvailableWidth] = useState(meta.width);
  const [contentHeight, setContentHeight] = useState(meta.height);
  const siteUrl = String(import.meta.env.VITE_SITE_URL || 'http://localhost:5174').replace(/\/$/, '');
  const frameUrl = `${siteUrl}/publication-preview.html`;

  const sendPreview = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({
      type: 'lsr-publication-preview', placementCode, appearance, image, title, summary, eyebrow, actions,
    }, new URL(siteUrl).origin);
  }, [actions, appearance, eyebrow, image, placementCode, siteUrl, summary, title]);

  useEffect(() => { sendPreview(); }, [sendPreview]);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== new URL(siteUrl).origin || event.source !== frameRef.current?.contentWindow || !event.data || typeof event.data !== 'object') return;
      const message = event.data as { type?: unknown; height?: unknown };
      if (message.type === 'lsr-publication-preview-ready') sendPreview();
      if (message.type === 'lsr-publication-preview-size' && Number.isFinite(Number(message.height))) {
        setContentHeight(Math.max(meta.height, Math.min(4000, Number(message.height))));
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [meta.height, sendPreview, siteUrl]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateWidth = () => setAvailableWidth(viewport.clientWidth || meta.width);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    updateWidth();
    return () => observer.disconnect();
  }, [meta.width]);

  const scale = Math.min(1, availableWidth / meta.width);
  return <Box ref={viewportRef} sx={{ width: '100%', overflow: 'hidden', borderRadius: 1.5, bgcolor: appearance.previewTheme === 'light' ? '#e7e3da' : '#070a0f', border: '1px solid', borderColor: 'divider' }}>
    <Box sx={{ width: meta.width * scale, height: contentHeight * scale, mx: 'auto', overflow: 'hidden' }}>
      <Box sx={{ width: meta.width, height: contentHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <Box
          component="iframe"
          ref={frameRef}
          src={frameUrl}
          title={`Предпросмотр: ${meta.label}`}
          onLoad={sendPreview}
          sx={{ display: 'block', width: meta.width, height: contentHeight, border: 0, bgcolor: 'transparent' }}
        />
      </Box>
    </Box>
  </Box>;
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <FormControlLabel control={<Checkbox size="small" checked={value} onChange={(_, checked) => onChange(checked)} />} label={label} />;
}

function ColorInput({ label, value, onChange, onCommit }: { label: string; value: string; onChange: (value: string) => void; onCommit: () => void }) {
  return (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      InputProps={{
        startAdornment: (
          <Box component="input" type="color" value={validColor(value)} onChange={(event) => onChange(event.target.value)} sx={{ width: 22, height: 22, p: 0, mr: 0.75, border: 0, bgcolor: 'transparent' }} />
        ),
      }}
    />
  );
}

type NumberSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  onCommit: () => void;
};

function NumberSlider({ label, value, min, max, step = 1, suffix = '', onChange, onCommit }: NumberSliderProps) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption">{value}{suffix}</Typography>
      </Stack>
      <Slider size="small" value={value} min={min} max={max} step={step} onChange={(_, next) => onChange(Number(next))} onChangeCommitted={onCommit} sx={{ py: 0.5 }} />
    </Box>
  );
}

function validColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
}
