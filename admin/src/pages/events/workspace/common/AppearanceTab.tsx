import { useState } from 'react';
import { useScenarioBuilder } from '../../../../features/event-authoring/useScenarioBuilder';
import { read, write } from '../../../../features/event-authoring/form-state';
import type { Document } from '../../../../features/event-authoring/types';
import { PhotoCatalogDialog } from '../../../../shared/RichContent';
import { FONT_OPTIONS, PublicEventCardPreview } from '../../../card-studio/EventCardStudio';
import { normalizeEventCardStudioConfig, type EventCardStudioConfig, type ThemeCardSettings } from '../../../card-studio/eventCardConfig';
import { eventCardSource } from '../../current/EventCardFields';
import type { Settings } from '../../current/event-api';
import { Button, Checkbox, ErrorState, Fields, LoadingBlock, Notice, PageHeader, Panel, SelectField, TextArea, TextField } from '../../../../ui/v16';
import { useWorkspace, useWorkspaceNav } from '../context';
import { useEditForm } from './editForm';
import type { PublicEvent } from '../../../../../../shared/public-event';

const visibility: [keyof EventCardStudioConfig, string][] = [
  ['showTitle', 'Название'], ['showOrganizer', 'Организатор'], ['showTrack', 'Трасса'], ['showDate', 'Дата'], ['showDateLabel', 'Подпись даты'],
  ['showEventType', 'Тип события'], ['showStatus', 'Статус'], ['showDetails', 'Описание'], ['showRating', 'Рейтинг'], ['showImage', 'Изображение'],
];

/** Public card appearance (settings.event.presentation). Saved through the authoring edit command like the rest of the event settings. */
export function AppearanceTab({ active, tabs }: { active: boolean; tabs?: React.ReactNode }) {
  const { eventId, summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const edit = useEditForm(eventId, active);
  const editable = summary.editableFields.includes('settings') && edit.v2;
  const header = (actions?: React.ReactNode) => <><PageHeader title="Внешний вид события" description="Настройка публичных карточек: обложка, подзаголовок, видимые элементы, темы и типографика." actions={actions} />{tabs}</>;
  if (edit.error) return <>{header()}<ErrorState error={edit.error.message} status={edit.error.status} onRetry={edit.retry} /></>;
  if (!edit.form) return <>{header()}<Panel><LoadingBlock rows={6} /></Panel></>;
  if (!editable || !edit.form.settings) {
    const presentation = summary.event.presentation;
    return (
      <>
        {header(<Button onClick={() => nav.section('overview')}>← К событию</Button>)}
        <Notice tone="neutral">{!edit.v2 ? 'Событие создано старым редактором: оформление карточки меняется только через описание.' : 'Сервер сейчас не разрешает менять настройки события (событие уже началось или завершено). Ниже — сохранённое оформление.'}</Notice>
        <div style={{ height: 16 }} />
        <AppearanceForm document={{ contractVersion: 1, scenarioCode: summary.event.scenarioCode, settings: { event: { ...(edit.form.settings?.event as Settings | undefined), presentation: presentation as unknown as Settings } }, pendingImages: [] }} disabled onChange={() => {}} publicEvent={summary.event as unknown as PublicEvent} />
      </>
    );
  }
  return <AppearanceEditor key={edit.form.version} initial={{ contractVersion: 1, scenarioCode: summary.event.scenarioCode, settings: edit.form.settings, pendingImages: [] }} version={edit.form.version} onSaved={edit.reset} header={header} />;
}

function AppearanceEditor({ initial, version, onSaved, header }: { initial: Document; version: string; onSaved: () => void; header: (actions?: React.ReactNode) => React.ReactNode }) {
  const { eventId, summary, reload } = useWorkspace();
  const builder = useScenarioBuilder({ edit: { eventId, expectedVersion: version }, initialDocument: initial, onEdited: () => { onSaved(); void reload(); } });
  const dirty = JSON.stringify(read(builder.document.settings, 'event.presentation')) !== JSON.stringify(read(initial.settings, 'event.presentation'));
  const blocking = builder.resolution?.issues.filter((i) => i.severity === 'error') ?? [];
  return (
    <>
      {header(<>
        <Button variant="primary" disabled={!dirty || builder.busy || !builder.resolution?.canPublish} onClick={() => void builder.save(false)}>{builder.busy ? 'Сохранение…' : 'Сохранить оформление'}</Button>
        <Button disabled={!dirty || builder.busy} onClick={() => builder.update(initial)}>Сбросить</Button>
      </>)}
      <div className="lsr-stack is-tight" style={{ marginBottom: 16 }}>
        {version !== summary.version && <Notice tone="warning">Событие изменилось после открытия формы. Сохранение проверит версию на сервере.</Notice>}
        {builder.error && <Notice tone="danger" actions={<Button size="sm" onClick={() => builder.setError('')}>Скрыть</Button>}>{builder.error}</Notice>}
        {builder.notice && <Notice tone="neutral" role="status">{builder.notice}</Notice>}
        {dirty && !builder.resolution && <Notice tone="neutral" role="status">Проверяем изменения на сервере…</Notice>}
        {dirty && builder.resolution && !builder.resolution.canPublish && <Notice tone="warning">Сохранение недоступно, пока в настройках события есть ошибки: {blocking.map((i) => i.message).join('; ') || 'см. раздел «Настройки»'}.</Notice>}
      </div>
      <AppearanceForm document={builder.document} disabled={builder.busy} onChange={builder.settings} publicEvent={summary.event as unknown as PublicEvent} />
    </>
  );
}

function AppearanceForm({ document, disabled, onChange, publicEvent }: { document: Document; disabled: boolean; onChange: (settings: Settings) => void; publicEvent: PublicEvent }) {
  const [picker, setPicker] = useState(false);
  const event = (document.settings.event ?? {}) as Settings;
  const presentation = (event.presentation ?? {}) as Settings;
  const config = normalizeEventCardStudioConfig(presentation.cardAppearance);
  const theme = config.themes[config.previewTheme];
  const setPresentation = (key: string, value: unknown) => onChange(write(document.settings, `event.presentation.${key}`, value as Settings[string]));
  const setConfig = (next: EventCardStudioConfig) => setPresentation('cardAppearance', next as unknown as Settings);
  const set = <K extends keyof EventCardStudioConfig>(key: K, value: EventCardStudioConfig[K]) => setConfig({ ...config, [key]: value });
  const setTheme = <K extends keyof ThemeCardSettings>(key: K, value: ThemeCardSettings[K]) => setConfig({ ...config, themes: { ...config.themes, [config.previewTheme]: { ...theme, [key]: value } } });
  const preview = eventCardSource({ ...publicEvent, presentation: { coverUrl: typeof presentation.coverUrl === 'string' ? presentation.coverUrl : null, subtitle: typeof presentation.subtitle === 'string' ? presentation.subtitle : null, cardAppearance: config as unknown as Record<string, unknown> } });
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || min));
  return (
    <div className="lsr-cols-2">
      <div className="lsr-stack">
        <Panel title="Контент карточки" sub="Поля event.presentation: подзаголовок и обложка">
          <Fields>
            <TextArea full label="Короткое описание (до 240 символов)" maxLength={240} rows={2} disabled={disabled} value={String(presentation.subtitle ?? '')} onChange={(e) => setPresentation('subtitle', e.target.value || null)} />
            <TextField label="URL обложки" help="HTTPS или /content-assets/…" disabled={disabled} value={String(presentation.coverUrl ?? '')} onChange={(e) => setPresentation('coverUrl', e.target.value || null)} />
            <div className="lsr-field"><span className="lsr-field-label">Источник изображения</span><Button disabled={disabled} onClick={() => setPicker(true)}>Выбрать из каталога →</Button><small>Фото из игрового каталога организатора</small></div>
          </Fields>
          <PhotoCatalogDialog open={picker} title="Обложка события" ownerOrganizerId={String(event.organizerId ?? publicEvent.organizerId ?? '')} gameCode={String(event.gameCode ?? publicEvent.gameCode ?? '')} onClose={() => setPicker(false)}
            onSelect={(photo) => { setPresentation('coverUrl', `/content-assets/${encodeURIComponent(photo.assetId)}/file`); setPicker(false); }} />
        </Panel>
        <Panel title="Элементы на карточке" sub="Что показывать посетителям сайта; состав зависит от шаблона события">
          <div className="lsr-checkgrid">{visibility.map(([key, label]) => <Checkbox key={key} label={label} disabled={disabled} checked={!!config[key]} onChange={(v) => set(key, v as never)} />)}</div>
        </Panel>
        <Panel title="Типографика и положение">
          <Fields>
            <SelectField label="Шрифт" disabled={disabled} value={config.fontFamily} options={FONT_OPTIONS} onChange={(e) => set('fontFamily', e.target.value)} />
            <SelectField label="Выравнивание" disabled={disabled} value={config.textAlign} options={[{ value: 'left', label: 'Слева' }, { value: 'center', label: 'По центру' }, { value: 'right', label: 'Справа' }]} onChange={(e) => set('textAlign', e.target.value as EventCardStudioConfig['textAlign'])} />
            <TextField label="Заголовок, px" type="number" min={16} max={40} disabled={disabled} value={config.titleSize} onChange={(e) => set('titleSize', num(e.target.value, 16, 40))} />
            <TextField label="Основной текст, px" type="number" min={10} max={18} disabled={disabled} value={config.bodySize} onChange={(e) => set('bodySize', num(e.target.value, 10, 18))} />
            <SelectField label="Вертикальное положение" disabled={disabled} value={config.verticalAlign} options={[{ value: 'top', label: 'Сверху' }, { value: 'center', label: 'По центру' }, { value: 'bottom', label: 'Снизу' }]} onChange={(e) => set('verticalAlign', e.target.value as EventCardStudioConfig['verticalAlign'])} />
            <SelectField label="Насыщенность заголовка" disabled={disabled} value={String(config.titleWeight)} options={[{ value: '700', label: '700' }, { value: '800', label: '800' }, { value: '900', label: '900' }]} onChange={(e) => set('titleWeight', Number(e.target.value) as EventCardStudioConfig['titleWeight'])} />
          </Fields>
        </Panel>
        <Panel title="Темы и цвета" sub="Значения задаются отдельно для тёмной и светлой темы сайта">
          <Fields>
            <SelectField label="Предпросмотр" disabled={disabled} value={config.previewTheme} options={[{ value: 'dark', label: 'Тёмная тема' }, { value: 'light', label: 'Светлая тема' }]} onChange={(e) => set('previewTheme', e.target.value as EventCardStudioConfig['previewTheme'])} />
            <TextField label="Акцент" type="color" disabled={disabled} value={theme.accentColor} onChange={(e) => setTheme('accentColor', e.target.value)} />
            <TextField label="Цвет заголовка" type="color" disabled={disabled} value={theme.titleColor} onChange={(e) => setTheme('titleColor', e.target.value)} />
            <TextField label="Цвет подписей" type="color" disabled={disabled} value={theme.metaColor} onChange={(e) => setTheme('metaColor', e.target.value)} />
            <TextField label="Затемнение, 0–1" type="number" step={0.05} min={0} max={1} disabled={disabled} value={theme.overlay} onChange={(e) => setTheme('overlay', Math.min(1, Math.max(0, Number(e.target.value) || 0)))} />
            <TextField label="Размытие фона, px" type="number" min={0} max={20} disabled={disabled} value={config.imageBlur} onChange={(e) => set('imageBlur', num(e.target.value, 0, 20))} />
          </Fields>
        </Panel>
      </div>
      <div className="lsr-stack lsr-sticky">
        <Panel title="Предпросмотр · карточка события" foot="Рендер публичного сайта (VITE_SITE_URL); без запущенного сайта область остаётся пустой.">
          <div style={{ borderRadius: 12, overflow: 'hidden', background: config.previewTheme === 'dark' ? '#070a0f' : '#f4f1eb' }}>
            <PublicEventCardPreview variant="events" source={preview} config={config} modes={[preview.eventMode]} compact publicEvent={preview.publicEvent} />
          </div>
        </Panel>
        <Panel title="Где используются карточки" body={false}>
          <div className="lsr-rows">
            <div className="lsr-row-item"><b>Каталог событий</b><span className="lsr-small-tag">публичный сайт</span></div>
            <div className="lsr-row-item"><b>Главная страница</b><span className="lsr-small-tag">публичный сайт</span></div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
