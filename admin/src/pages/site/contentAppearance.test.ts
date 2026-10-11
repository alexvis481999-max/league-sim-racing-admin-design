import { describe, expect, it } from 'vitest';
import { cloneContentAppearance, defaultContentAppearance, normalizeContentAppearance } from './contentAppearance';

describe('content appearance configuration', () => {
  it('restores missing values from the current defaults', () => {
    const config = normalizeContentAppearance({
      previewTheme: 'light',
      slider: { titleSize: 64, themes: { dark: { accentColor: '#abcdef' } } },
    });

    expect(config.previewTheme).toBe('light');
    expect(config.slider.titleSize).toBe(64);
    expect(config.slider.themes.dark.accentColor).toBe('#abcdef');
    expect(config.slider.themes.light.surface).toBe(defaultContentAppearance.slider.themes.light.surface);
  });

  it('clones nested palettes before editing a new publication', () => {
    const copy = cloneContentAppearance(defaultContentAppearance);
    copy.card.themes.dark.accentColor = '#000000';

    expect(defaultContentAppearance.card.themes.dark.accentColor).not.toBe('#000000');
  });

  it('falls back from an unsupported layout', () => {
    const config = normalizeContentAppearance({ card: { layout: 'broken' } });

    expect(config.card.layout).toBe(defaultContentAppearance.card.layout);
  });
});
