import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../../../shared/api';
import { ScenarioBuilder } from '../../../../features/event-authoring/ScenarioBuilder';
import type { Settings } from '../../current/event-api';
import { ActionButton, Button, ErrorState, LoadingBlock, Notice, PageHeader, Panel, TextArea } from '../../../../ui/v16';
import { action, useWorkspace, useWorkspaceNav } from '../context';

type EditForm = { settings: Settings | null; description: string; version: string };

/** Event settings: the scenario editor (authoring v2) or the compatible description edit for older events. */
export function SettingsTab({ active }: { active: boolean }) {
  const { eventId, summary, reload, execute, blocked } = useWorkspace();
  const nav = useWorkspaceNav();
  const [form, setForm] = useState<EditForm | null>(null);
  const [error, setError] = useState<{ message: string; status: number | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const edit = action(summary, 'edit');
  const terminal = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(summary.event.status);
  useEffect(() => {
    if (!active || form) return;
    let alive = true;
    setError(null);
    apiFetch<{ settings: Settings | null; description: string | null; version: string }>(`/admin/events/${eventId}/workspace/edit`)
      .then((value) => { if (alive) setForm({ ...value, description: value.description ?? '' }); })
      .catch((e) => { if (alive) setError({ message: e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : null }); });
    return () => { alive = false; };
  }, [active, form, attempt, eventId]);
  const v2 = (form?.settings?.authoring as Settings | undefined)?.editorVersion === 2;
  const settingsEditable = summary.editableFields.includes('settings');
  const descriptionEditable = summary.editableFields.includes('description');
  const close = () => { setForm(null); void reload(); nav.section('overview'); };

  return (
    <>
      <PageHeader title="Настройки события" description={`Редактор: ${summary.event.title}. Доступные поля и ограничения определяет сервер; изменения проверяются перед сохранением.`}
        actions={<Button onClick={() => nav.section('overview')}>Отмена</Button>} />
      <div className="lsr-stack">
        {terminal && <Notice tone="neutral">Событие завершено — настройки доступны только для просмотра через историю и журнал.</Notice>}
        {!terminal && !edit?.enabled && <Notice tone="warning">{edit?.reason?.message ?? 'Редактирование недоступно.'}</Notice>}
        {!terminal && edit?.enabled && !settingsEditable && descriptionEditable && <Notice>Сервер разрешает менять только описание: событие уже началось или создано старым редактором. Программа, условия и расписание заблокированы.</Notice>}
        {form && form.version !== summary.version && <Notice tone="warning">Событие изменилось после открытия формы. Ваши правки сохранены в форме; сверьте их с актуальной версией перед сохранением.</Notice>}
        {error ? <ErrorState error={error.message} status={error.status} onRetry={() => setAttempt((n) => n + 1)} />
          : !form ? <Panel><LoadingBlock rows={6} /></Panel>
          : v2 && form.settings ? (
            <ScenarioBuilder
              key={form.version}
              descriptionOnly={!settingsEditable}
              initialDocument={{ contractVersion: 1, scenarioCode: summary.event.scenarioCode, settings: form.settings, pendingImages: [] }}
              edit={{ eventId, expectedVersion: form.version }}
              onEdited={close}
            />
          ) : (
            <Panel title="Описание" sub="Совместимая правка описания события">
              <TextArea label="Описание" rows={8} value={form.description} disabled={!descriptionEditable || blocked} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="lsr-form-actions">
                <Button onClick={() => nav.section('overview')}>Отмена</Button>
                <ActionButton variant="primary" action={edit} disabled={blocked || !descriptionEditable}
                  onClick={() => void execute('', { expectedVersion: form.version, patch: { description: form.description } }, 'PATCH').then((ok) => { if (ok) close(); })}>Сохранить описание</ActionButton>
              </div>
            </Panel>
          )}
      </div>
    </>
  );
}
