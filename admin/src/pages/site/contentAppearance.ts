export type ContentPreviewTheme = 'dark' | 'light';
export type ContentSurfaceKind = 'card' | 'slider' | 'articleHero';
export type ContentLayout = 'overlay' | 'panel' | 'minimal';

export type ContentThemeSettings = {
  surface: string;
  titleColor: string;
  textColor: string;
  accentColor: string;
  borderColor: string;
  overlayColor: string;
  overlayOpacity: number;
};

export type ContentSurfaceSettings = {
  layout: ContentLayout;
  showImage: boolean;
  showEyebrow: boolean;
  showSummary: boolean;
  showDate: boolean;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  titleSize: number;
  imagePosition: 'top' | 'center' | 'bottom';
  themes: Record<ContentPreviewTheme, ContentThemeSettings>;
};

export type ContentAppearanceConfig = {
  version: 1;
  previewTheme: ContentPreviewTheme;
  card: ContentSurfaceSettings;
  slider: ContentSurfaceSettings;
  articleHero: ContentSurfaceSettings;
};

const darkTheme: ContentThemeSettings = {
  surface: '#111722', titleColor: '#ffffff', textColor: '#c7d0dc', accentColor: '#ff5a1f',
  borderColor: '#303a49', overlayColor: '#070a0f', overlayOpacity: 0.78,
};
const lightTheme: ContentThemeSettings = {
  surface: '#f4f1eb', titleColor: '#101722', textColor: '#4d5968', accentColor: '#ff5a1f',
  borderColor: '#c9c5bc', overlayColor: '#f4f1eb', overlayOpacity: 0.58,
};

function surface(input: Partial<ContentSurfaceSettings>): ContentSurfaceSettings {
  return {
    layout: 'overlay', showImage: true, showEyebrow: true, showSummary: true, showDate: true,
    textAlign: 'left', verticalAlign: 'bottom', titleSize: 24, imagePosition: 'center',
    themes: { dark: { ...darkTheme }, light: { ...lightTheme } }, ...input,
  };
}

export const defaultContentAppearance: ContentAppearanceConfig = {
  version: 1,
  previewTheme: 'dark',
  card: surface({ titleSize: 22 }),
  slider: surface({ titleSize: 52 }),
  articleHero: surface({ titleSize: 48 }),
};

export function cloneContentAppearance(config: ContentAppearanceConfig): ContentAppearanceConfig {
  return {
    ...config,
    card: cloneSurface(config.card),
    slider: cloneSurface(config.slider),
    articleHero: cloneSurface(config.articleHero),
  };
}

export function normalizeContentAppearance(value: unknown): ContentAppearanceConfig {
  const base = cloneContentAppearance(defaultContentAppearance);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const candidate = value as Partial<ContentAppearanceConfig>;
  return {
    version: 1,
    previewTheme: candidate.previewTheme === 'light' ? 'light' : 'dark',
    card: normalizeSurface(candidate.card, base.card),
    slider: normalizeSurface(candidate.slider, base.slider),
    articleHero: normalizeSurface(candidate.articleHero, base.articleHero),
  };
}

function cloneSurface(value: ContentSurfaceSettings): ContentSurfaceSettings {
  return { ...value, themes: { dark: { ...value.themes.dark }, light: { ...value.themes.light } } };
}

function normalizeSurface(value: unknown, base: ContentSurfaceSettings): ContentSurfaceSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return cloneSurface(base);
  const candidate = value as Partial<ContentSurfaceSettings>;
  const { radius: _legacyRadius, ...withoutLegacyRadius } = candidate as Partial<ContentSurfaceSettings> & { radius?: unknown };
  const themes = candidate.themes && typeof candidate.themes === 'object' ? candidate.themes : undefined;
  return {
    ...base,
    ...withoutLegacyRadius,
    layout: ['overlay', 'panel', 'minimal'].includes(String(candidate.layout)) ? candidate.layout as ContentLayout : base.layout,
    themes: {
      dark: { ...base.themes.dark, ...(themes?.dark ?? {}) },
      light: { ...base.themes.light, ...(themes?.light ?? {}) },
    },
  };
}
