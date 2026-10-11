import type { ReactNode } from 'react';
import { ScenarioBuilder } from '../../../../features/event-authoring/ScenarioBuilder';
import { ActionButton, Button, ErrorState, LoadingBlock, Notice, PageHeader, Panel, TextArea } from '../../../../ui/v16';
import { action, useWorkspace, useWorkspaceNav } from '../context';
import { useEditForm } from './editForm';

/** Event settings: the scenario editor (authoring v2) or the compatible description edit for older events. */
export function SettingsTab({ active, tabs }: { active: boolean; tabs?: ReactNode }) {
  const { eventId, summary, reload, execute, blocked } = useWorkspace();
  const nav = useWorkspaceNav();
  const { form, setForm, error, retry, reset, v2 } = useEditForm(eventId, active);
  const edit = action(summary, 'edit');
  const terminal = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(summary.event.status);
  const settingsEditable = summary.editableFields.includes('settings');
  const descriptionEditable = summary.editableFields.includes('description');
  const close = () => { reset(); void reload(); nav.section('overview'); };
  const title = 'Настройки события';
  const description = `Редактор: ${summary.event.title}. Доступные поля и ограничения определяет сервер; изменения проверяются перед сохранением.`;
  const cancel = <Button onClick={() => nav.section('overview')}>Отмена</Button>;
  const notices = (
    <div className="lsr-stack is-tight" style={{ marginBottom: 14 }}>
      {terminal && <Notice tone="neutral">Событие завершено — настройки доступны только для просмотра.</Notice>}
      {!terminal && !edit?.enabled && <Notice tone="warning">{edit?.reason?.message ?? 'Редактирование недоступно.'}</Notice>}
      {!terminal && edit?.enabled && !settingsEditable && descriptionEditable && <Notice>Сервер разрешает менять только описание и название: событие уже началось или создано старым редактором. Программа, условия и расписание заблокированы.</Notice>}
      {form && form.version !== summary.version && <Notice tone="warning">Событие изменилось после открытия формы. Ваши правки сохранены в форме; сверьте их с актуальной версией перед сохранением.</Notice>}
    </div>
  );
  if (form && v2 && form.settings) {
    return (
      <ScenarioBuilder
        key={form.version}
        descriptionOnly={!settingsEditable}
        initialDocument={{ contractVersion: 1, scenarioCode: summary.event.scenarioCode, settings: form.settings, pendingImages: [] }}
        edit={{ eventId, expectedVersion: form.version }}
        onEdited={close}
        heading={{ title, description, extraActions: cancel, below: <>{tabs}{notices}</> }}
      />
    );
  }
  return (
    <>
      <PageHeader title={title} description={description} actions={cancel} />
      {tabs}
      {notices}
      {error ? <ErrorState error={error.message} status={error.status} onRetry={retry} />
        : !form ? <Panel><LoadingBlock rows={6} /></Panel>
        : (
          <Panel title="Описание события" sub="Совместимая правка описания">
            <TextArea label="Описание" rows={8} value={form.description} disabled={!descriptionEditable || blocked} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="lsr-form-actions">
              <Button onClick={() => nav.section('overview')}>Отмена</Button>
              <ActionButton variant="primary" action={edit} disabled={blocked || !descriptionEditable}
                onClick={() => void execute('', { expectedVersion: form.version, patch: { description: form.description } }, 'PATCH').then((ok) => { if (ok) close(); })}>Сохранить описание</ActionButton>
            </div>
          </Panel>
        )}
    </>
  );
}
