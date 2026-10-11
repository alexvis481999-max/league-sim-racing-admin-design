import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { PublicationAction, PublicationPlacementCode } from '../../shared/types';
import { Checkbox, Field, Fields, SelectField, SubTabs } from '../../ui/v16';
import type {
  ContentAppearanceConfig,
  ContentPreviewTheme,
  ContentSurfaceKind,
  ContentSurfaceSettings,
  ContentThemeSettings,
} from './contentAppearance';
import { cloneContentAppearance } from './contentAppearance';
import './site.v16.css';

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

type StudioProps = {
  value: ContentAppearanceConfig;
  onChange: (value: ContentAppearanceConfig) => void;
  surfaces: ContentSurfaceKind[];
};

/** Appearance controls of one placement (presentation of a revision placement). The live preview is rendered by the page. */
export function ContentAppearanceStudio({ value, onChange, surfaces }: StudioProps) {
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
    if (commitTimerRef.current === null) return;
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
    onChange(draftRef.current);
  }

  function updateSurface(patch: Partial<ContentSurfaceSettings>, commit = true) {
    setAppearance({ ...draftValue, [activeSurface]: { ...settings, ...patch } }, commit);
  }

  function updateTheme(patch: Partial<ContentThemeSettings>, commit = true) {
    setAppearance({
      ...draftValue,
      [activeSurface]: { ...settings, themes: { ...settings.themes, [draftValue.previewTheme]: { ...theme, ...patch } } },
    }, commit);
  }

  return (
    <div className="lsr-site-studio">
      {surfaces.length > 1 && <SubTabs label="Поверхность" value={activeSurface} onChange={setSurface} items={surfaces.map((key) => ({ key, label: surfaceLabels[key] }))} />}
      <div className="lsr-site-studio-group">
        <h4>Композиция</h4>
        <Fields>
          <SelectField label="Компоновка" value={settings.layout} onChange={(e) => updateSurface({ layout: e.target.value as ContentSurfaceSettings['layout'] })}
            options={[{ value: 'overlay', label: 'Текст поверх изображения' }, { value: 'panel', label: 'На контрастной подложке' }, { value: 'minimal', label: 'Минималистичная, без фото' }]} />
          <SelectField label="Кадрирование фотографии" value={settings.imagePosition} onChange={(e) => updateSurface({ imagePosition: e.target.value as ContentSurfaceSettings['imagePosition'] })}
            options={[{ value: 'top', label: 'По верхнему краю' }, { value: 'center', label: 'По центру' }, { value: 'bottom', label: 'По нижнему краю' }]} />
          <SelectField label="Выравнивание текста" value={settings.textAlign} onChange={(e) => updateSurface({ textAlign: e.target.value as ContentSurfaceSettings['textAlign'] })}
            options={[{ value: 'left', label: 'Слева' }, { value: 'center', label: 'По центру' }, { value: 'right', label: 'Справа' }]} />
          <SelectField label="Положение текста" value={settings.verticalAlign} onChange={(e) => updateSurface({ verticalAlign: e.target.value as ContentSurfaceSettings['verticalAlign'] })}
            options={[{ value: 'top', label: 'Сверху' }, { value: 'center', label: 'По центру' }, { value: 'bottom', label: 'Снизу' }]} />
          <RangeField label="Размер заголовка" value={settings.titleSize} min={16} max={activeSurface === 'card' ? 38 : 76} suffix="px" onChange={(titleSize) => updateSurface({ titleSize }, false)} onCommit={commitDraft} />
        </Fields>
        <div className="lsr-site-checks">
          <Checkbox label="Показывать фото" checked={settings.showImage} onChange={(showImage) => updateSurface({ showImage })} />
          <Checkbox label="Показывать рубрику" checked={settings.showEyebrow} onChange={(showEyebrow) => updateSurface({ showEyebrow })} />
          <Checkbox label="Показывать описание" checked={settings.showSummary} onChange={(showSummary) => updateSurface({ showSummary })} />
          <Checkbox label="Показывать дату" checked={settings.showDate} onChange={(showDate) => updateSurface({ showDate })} />
        </div>
      </div>
      <div className="lsr-site-studio-group">
        <div className="lsr-between">
          <h4>Цвета · {draftValue.previewTheme === 'dark' ? 'тёмная тема сайта' : 'светлая тема сайта'}</h4>
          <div className="lsr-site-segment" role="group" aria-label="Тема сайта">
            {(['dark', 'light'] as ContentPreviewTheme[]).map((key) => (
              <button key={key} type="button" aria-pressed={draftValue.previewTheme === key} className={draftValue.previewTheme === key ? 'is-active' : ''} onClick={() => setAppearance({ ...draftValue, previewTheme: key })}>
                {key === 'dark' ? 'Тёмная' : 'Светлая'}
              </button>
            ))}
          </div>
        </div>
        <div className="lsr-site-colors">
          <ColorInput label="Фон" value={theme.surface} onChange={(surface) => updateTheme({ surface }, false)} onCommit={commitDraft} />
          <ColorInput label="Акцент" value={theme.accentColor} onChange={(accentColor) => updateTheme({ accentColor }, false)} onCommit={commitDraft} />
          <ColorInput label="Заголовок" value={theme.titleColor} onChange={(titleColor) => updateTheme({ titleColor }, false)} onCommit={commitDraft} />
          <ColorInput label="Текст" value={theme.textColor} onChange={(textColor) => updateTheme({ textColor }, false)} onCommit={commitDraft} />
          <ColorInput label="Рамка" value={theme.borderColor} onChange={(borderColor) => updateTheme({ borderColor }, false)} onCommit={commitDraft} />
          <ColorInput label="Затемнение" value={theme.overlayColor} onChange={(overlayColor) => updateTheme({ overlayColor }, false)} onCommit={commitDraft} />
        </div>
        <Fields>
          <RangeField label="Плотность затемнения" value={theme.overlayOpacity} min={0} max={0.95} step={0.05} onChange={(overlayOpacity) => updateTheme({ overlayOpacity }, false)} onCommit={commitDraft} />
        </Fields>
      </div>
    </div>
  );
}

type StandalonePreviewProps = PreviewContentProps & {
  appearance: ContentAppearanceConfig;
  label?: ReactNode;
  aside?: ReactNode;
};

/** Scaled render of the public site block (publication-preview.html on VITE_SITE_URL). */
export function ContentAppearancePreview({ label, aside, ...props }: StandalonePreviewProps) {
  const meta = placementPreviewMeta[props.placementCode];
  return (
    <div className="lsr-site-display">
      <div className="lsr-site-display-title"><span>{label ?? meta.label}</span>{aside}</div>
      <PublicationPreviewFrame {...props} />
      <div className="lsr-site-display-meta">Окно сайта {meta.width} × {meta.height}</div>
    </div>
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
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const updateWidth = () => setAvailableWidth(viewport.clientWidth || meta.width);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    updateWidth();
    return () => observer.disconnect();
  }, [meta.width]);

  const scale = Math.min(1, availableWidth / meta.width);
  return (
    <div ref={viewportRef} className={`lsr-site-frame${appearance.previewTheme === 'light' ? ' is-light' : ''}`}>
      <div style={{ width: meta.width * scale, height: contentHeight * scale, margin: '0 auto', overflow: 'hidden' }}>
        <div style={{ width: meta.width, height: contentHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <iframe ref={frameRef} src={frameUrl} title={`Предпросмотр: ${meta.label}`} onLoad={sendPreview} style={{ display: 'block', width: meta.width, height: contentHeight, border: 0, background: 'transparent' }} />
        </div>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange, onCommit }: { label: string; value: string; onChange: (value: string) => void; onCommit: () => void }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <div className="lsr-site-color">
        <input type="color" aria-label={`${label}: палитра`} value={validColor(value)} onChange={(event) => onChange(event.target.value)} onBlur={onCommit} />
        <input id={id} value={value} spellCheck={false} onChange={(event) => onChange(event.target.value)} onBlur={onCommit} />
      </div>
    </Field>
  );
}

type RangeFieldProps = { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void; onCommit: () => void };
function RangeField({ label, value, min, max, step = 1, suffix = '', onChange, onCommit }: RangeFieldProps) {
  const id = useId();
  return (
    <Field label={<span className="lsr-between"><span>{label}</span><span className="lsr-site-range-value">{value}{suffix}</span></span>} htmlFor={id}>
      <input id={id} className="lsr-site-range" type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} onBlur={onCommit} />
    </Field>
  );
}

function validColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
}
