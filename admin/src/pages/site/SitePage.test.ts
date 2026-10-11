import { describe, expect, it } from 'vitest';
import { emptyForm, emptyPlacement, placementPayload, validatePublication } from './publicationForm';

describe('publication placement schedule', () => {
  const publishAt = '2026-08-10T18:00';
  const sliderEndsAt = '2026-08-17T18:00';

  it('uses one publication date for every placement', () => {
    const feed = placementPayload('home.feed', emptyPlacement(), publishAt, sliderEndsAt);
    const slider = placementPayload('home.hero', emptyPlacement(), publishAt, sliderEndsAt);

    expect(feed.startsAt).toBe(new Date(publishAt).toISOString());
    expect(slider.startsAt).toBe(new Date(publishAt).toISOString());
  });

  it('uses one end date for every selected placement', () => {
    const expected = new Date(sliderEndsAt).toISOString();

    expect(placementPayload('home.feed', emptyPlacement(), publishAt, sliderEndsAt).endsAt).toBe(expected);
    expect(placementPayload('home.hero', emptyPlacement(), publishAt, sliderEndsAt).endsAt).toBe(expected);
    expect(placementPayload('touge.featured_news', emptyPlacement(), publishAt, sliderEndsAt).endsAt).toBe(expected);
  });

  it('starts a new publication in immediate indefinite mode', () => {
    expect(emptyForm()).toMatchObject({ timingMode: 'now', publishStartsAt: '', publishEndsAt: '' });
  });

  it('allows an incomplete draft once it has a title', () => {
    const form = emptyForm();
    form.title = 'Черновик';
    expect(validatePublication(form, 'draft')).toMatchObject({ valid: true, blockers: [] });
  });

  it('blocks publishing an empty form and explains every required field', () => {
    const validation = validatePublication(emptyForm(), 'publish');

    expect(validation.valid).toBe(false);
    expect(validation.fieldErrors).toMatchObject({
      title: 'Укажите заголовок',
      summary: 'Добавьте краткое описание',
      body: 'Добавьте основной текст публикации',
      placements: 'Выберите хотя бы одно место размещения',
    });
  });

  it('allows publishing when required content and a feed placement are filled', () => {
    const form = emptyForm();
    form.title = 'Новая новость';
    form.summary = 'Короткое описание';
    form.body = 'Основной текст';
    form.placements['home.feed'].enabled = true;

    expect(validatePublication(form, 'publish')).toMatchObject({ valid: true, blockers: [] });
  });

  it('requires a start date for delayed publishing', () => {
    const form = emptyForm();
    form.title = 'Новая новость';
    form.summary = 'Короткое описание';
    form.body = 'Основной текст';
    form.placements['home.feed'].enabled = true;

    form.timingMode = 'scheduled';
    expect(validatePublication(form, 'publish').fieldErrors.scheduledPublishAt).toBe('Укажите дату начала публикации');
  });

  it('requires a future publication date for scheduling', () => {
    const form = emptyForm();
    form.title = 'Новая новость';
    form.summary = 'Короткое описание';
    form.body = 'Основной текст';
    form.timingMode = 'scheduled';
    form.publishStartsAt = '2020-01-01T12:00';
    form.placements['home.feed'].enabled = true;

    expect(validatePublication(form, 'publish').fieldErrors.scheduledPublishAt).toBe('Дата отложенной публикации должна быть в будущем');
  });

  it('requires a valid end after the start for period mode', () => {
    const form = emptyForm();
    Object.assign(form, {
      title: 'Новая новость', summary: 'Короткое описание', body: 'Основной текст',
      timingMode: 'period', publishStartsAt: '2027-08-10T18:00', publishEndsAt: '2027-08-09T18:00',
    });
    form.placements['home.feed'].enabled = true;
    expect(validatePublication(form, 'publish').fieldErrors.sliderEndsAt).toBe('Дата окончания должна быть позже даты начала');
  });
});
