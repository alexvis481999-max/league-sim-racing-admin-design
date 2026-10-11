export type PreviewTheme = 'dark' | 'light';

export type ThemeCardSettings = {
  surface: string;
  titleColor: string;
  metaColor: string;
  accentColor: string;
  outlineColor: string;
  dateTone: 'white' | 'light' | 'gray' | 'dark' | 'black';
  imageOverlayColor: string;
  imageOverlayOpacity: number;
  overlay: number;
  railOpacity: number;
  outlineOpacity: number;
};

export type EventCardStudioConfig = {
  previewTheme: PreviewTheme;
  showTitle: boolean;
  showOrganizer: boolean;
  showTrack: boolean;
  showDate: boolean;
  showDateLabel: boolean;
  showEventType: boolean;
  showStatus: boolean;
  showDetails: boolean;
  showRating: boolean;
  showImage: boolean;
  fontFamily: string;
  titleSize: number;
  bodySize: number;
  titleWeight: 700 | 800 | 900;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  imageBlur: number;
  imageContrast: number;
  themes: Record<PreviewTheme, ThemeCardSettings>;
};

export const defaultEventCardStudioConfig: EventCardStudioConfig = {
  previewTheme: 'dark',
  showTitle: true,
  showOrganizer: true,
  showTrack: true,
  showDate: true,
  showDateLabel: true,
  showEventType: true,
  showStatus: true,
  showDetails: true,
  showRating: true,
  showImage: true,
  fontFamily: 'Inter, sans-serif',
  titleSize: 24,
  bodySize: 13,
  titleWeight: 900,
  textAlign: 'left',
  verticalAlign: 'bottom',
  imageBlur: 0,
  imageContrast: 1.06,
  themes: {
    dark: {
      surface: '#111722',
      titleColor: '#ffffff',
      metaColor: '#e6ecf6',
      accentColor: '#ff5a1f',
      outlineColor: '#ffffff',
      dateTone: 'dark',
      imageOverlayColor: '#ffffff',
      imageOverlayOpacity: 0,
      overlay: 0.82,
      railOpacity: 1,
      outlineOpacity: 1,
    },
    light: {
      surface: '#f4f1eb',
      titleColor: '#202734',
      metaColor: '#4d5968',
      accentColor: '#1769ff',
      outlineColor: '#202734',
      dateTone: 'light',
      imageOverlayColor: '#ffffff',
      imageOverlayOpacity: 0,
      overlay: 0.46,
      railOpacity: 0.9,
      outlineOpacity: 1,
    },
  },
};

export function cloneEventCardStudioConfig(config: EventCardStudioConfig): EventCardStudioConfig {
  return {
    ...config,
    themes: {
      dark: { ...config.themes.dark },
      light: { ...config.themes.light },
    },
  };
}

export function normalizeEventCardStudioConfig(value: unknown): EventCardStudioConfig {
  const base = cloneEventCardStudioConfig(defaultEventCardStudioConfig);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const candidate = value as Partial<EventCardStudioConfig>;
  const candidateThemes = candidate.themes && typeof candidate.themes === 'object' ? candidate.themes : undefined;
  const normalized: EventCardStudioConfig = {
    ...base,
    ...candidate,
    previewTheme: candidate.previewTheme === 'light' ? 'light' : 'dark',
    themes: {
      dark: { ...base.themes.dark, ...(candidateThemes?.dark ?? {}) },
      light: { ...base.themes.light, ...(candidateThemes?.light ?? {}) },
    },
  };

  const lightTheme = normalized.themes.light;
  const hasLegacyLightWash = lightTheme.imageOverlayColor.toLowerCase() === '#ffffff'
    && Math.abs(lightTheme.imageOverlayOpacity - 0.28) < 0.001;
  if (hasLegacyLightWash) lightTheme.imageOverlayOpacity = 0;

  return normalized;
}
