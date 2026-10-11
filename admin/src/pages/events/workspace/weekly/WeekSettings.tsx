import { useScenarioBuilder } from '../../../../features/event-authoring/useScenarioBuilder';
import { SeriesRowEditor } from '../../../../features/event-authoring/ScenarioFields';
import { EditingRestrictions, FieldCapabilities, FieldIssues, read } from '../../../../features/event-authoring/form-state';
import type { Document, Settings } from '../../../../features/event-authoring/types';
import { Button, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Panel, usePageChrome } from '../../../../ui/v16';
import { useWorkspace, useWorkspaceNav } from '../context';
import { useEditForm } from '../common/editForm';
import { groupProgram } from '../program';
import { groupHeading } from './WeeklyOverview';

/** Settings of one week: weekly.weeks[N-1] of the event settings, where N comes from the server group key week-N. */
export function WeekSettings({ weekKey }: { weekKey: string }) {
  const { eventId, summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const group = groupProgram(summary.program).find((g) => g.key === weekKey);
  const heading = group ? groupHeading(group) : weekKey;
  const number = Number(/^week-(\d+)$/.exec(weekKey)?.[1] ?? NaN);
  usePageChrome({ variant: 'event', back: { label: 'Назад', to: `/events/${eventId}?week=${weekKey}` }, crumbs: [{ label: summary.event.title, to: `/events/${eventId}` }, { label: 'Недели', to: `/events/${eventId}?section=weeks` }, { label: heading, to: `/events/${eventId}?week=${weekKey}` }, { label: 'Настройки' }] });
  const edit = useEditForm(eventId, true);
  const header = (actions?: React.ReactNode) => <PageHeader title={`Настройки: ${heading}`} description="Редактирование только параметров недели. Повторяющееся расписание и общие правила — в настройках события." actions={actions} />;
  const cancel = <Button onClick={() => nav.week(weekKey)}>Отмена</Button>;
  if (edit.error) return <>{header(cancel)}<ErrorState error={edit.error.message} status={edit.error.status} onRetry={edit.retry} /></>;
  if (!edit.form) return <>{header(cancel)}<Panel><LoadingBlock rows={6} /></Panel></>;
  const weeks = (read(edit.form.settings ?? {}, 'weekly.weeks') ?? []) as Settings[];
  if (!edit.v2 || !edit.form.settings || !Number.isFinite(number) || !weeks[number - 1]) {
    return <>{header(cancel)}<EmptyState title="Настройки недели недоступны">{!edit.v2 ? 'Событие создано старым редактором; параметры недель меняются только через описание.' : `В настройках события нет недели №${Number.isFinite(number) ? number : '?'}: группа «${weekKey}» сформирована сервером по датам гонок.`}</EmptyState></>;
  }
  return <WeekEditor key={edit.form.version} index={number - 1} heading={heading} header={header} cancel={cancel} version={edit.form.version}
    initial={{ contractVersion: 1, scenarioCode: summary.event.scenarioCode, settings: edit.form.settings, pendingImages: [] }} onSaved={() => { edit.reset(); nav.week(weekKey); }} />;
}

function WeekEditor({ index, heading, header, cancel, version, initial, onSaved }: { index: number; heading: string; header: (a?: React.ReactNode) => React.ReactNode; cancel: React.ReactNode; version: string; initial: Document; onSaved: () => void }) {
  const { eventId, summary, reload } = useWorkspace();
  const builder = useScenarioBuilder({ edit: { eventId, expectedVersion: version }, initialDocument: initial, onEdited: () => { void reload(); onSaved(); } });
  const editable = summary.editableFields.includes('settings');
  const path = `weekly.weeks.${index}`;
  const dirty = JSON.stringify(read(builder.document.settings, path)) !== JSON.stringify(read(initial.settings, path));
  const week = (read(builder.document.settings, path) ?? {}) as Settings;
  const weather = ((week.weather as Settings | undefined)?.weather ?? {}) as Settings;
  const overrides = Object.keys((week.raceOverrides ?? {}) as Settings);
  const errors = builder.resolution?.issues.filter((i) => i.severity === 'error') ?? [];
  return (
    <FieldIssues.Provider value={builder.resolution?.issues ?? []}>
      <EditingRestrictions.Provider value={builder.editRestrictions}>
        <FieldCapabilities.Provider value={builder.descriptor}>
          {header(<>
            <Button variant="primary" disabled={!editable || !dirty || builder.busy || !builder.resolution?.canPublish} onClick={() => void builder.save(false)}>{builder.busy ? 'Сохранение…' : 'Сохранить неделю'}</Button>
            {cancel}
          </>)}
          <div className="lsr-stack is-tight" style={{ marginBottom: 16 }}>
            {!editable && <Notice tone="warning">Сервер сейчас не разрешает менять настройки события (событие уже началось или завершено). Параметры недели показаны только для просмотра.</Notice>}
            {builder.error && <Notice tone="danger" actions={<Button size="sm" onClick={() => builder.setError('')}>Скрыть</Button>}>{builder.error}</Notice>}
            {dirty && builder.resolution && !builder.resolution.canPublish && <Notice tone="warning">Сохранение недоступно: {errors.map((e) => e.message).join('; ') || 'в настройках события есть ошибки'}.</Notice>}
          </div>
          {!builder.descriptor ? <Panel><LoadingBlock rows={5} label="Загружаем описание сценария" /></Panel> : (
            <div className="lsr-cols-settings">
              <section className="lsr-formgroup">
                <h3>{heading} · параметры недели</h3>
                <p>Название, трасса, погода и отличия этой недели от общей гоночной программы.</p>
                <SeriesRowEditor value={builder.document.settings} onChange={builder.settings} disabled={!editable || builder.busy} descriptor={builder.descriptor} index={index} standalone />
              </section>
              <aside className="lsr-stack lsr-sticky">
                <Panel title="Итоговые параметры">
                  <div className="lsr-eyebrow">Только эта неделя</div>
                  <h3 style={{ margin: '6px 0 10px', fontSize: 16 }}>{String(week.title ?? heading)}</h3>
                  <div className="lsr-mutedline">{String((week.track as Settings | undefined)?.code ?? 'трасса не выбрана')} · {String(weather.ambientTemperature ?? "—")}°C / {String(weather.roadTemperature ?? "—")}°C</div>
                  <hr className="lsr-rule" />
                  <div className="lsr-mutedline">{overrides.length ? `Переопределено: ${overrides.join(', ')}` : 'Программа полностью наследуется от события.'}</div>
                  <div style={{ marginTop: 12 }}><Notice>Перенос времени уже созданной гонки — отдельное действие на странице гонки, а не изменение шаблона недели.</Notice></div>
                </Panel>
              </aside>
            </div>
          )}
        </FieldCapabilities.Provider>
      </EditingRestrictions.Provider>
    </FieldIssues.Provider>
  );
}
