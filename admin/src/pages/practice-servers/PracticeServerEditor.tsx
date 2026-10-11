import { Button, Fields, Notice, Panel, SelectField, TextArea, TextField } from '../../ui/v16';
import { GameFields, OrganizerField } from '../../features/standalone/GameFields';
import { useUnsavedChanges } from '../../features/standalone/EditorSections';
import type { Config } from './practice-types';

const sectionIds: Record<string, string> = { general: 'practice-general', session: 'practice-session', conditions: 'practice-conditions' };

export function practiceIssues(config: Config) {
  const issues: { section: string; message: string }[] = [];
  if (!config.title.trim() || !config.organizerId)
    issues.push({ section: 'general', message: 'Укажите название и организатора.' });
  if (
    !Number.isFinite(config.sessionDurationMinutes) ||
    config.sessionDurationMinutes < 1 ||
    config.sessionDurationMinutes > 1440
  )
    issues.push({ section: 'session', message: 'Длительность сессии: от 1 до 1440 минут.' });
  if (!Number.isInteger(config.practice.maxParticipants) || config.practice.maxParticipants < 1)
    issues.push({
      section: 'session',
      message: 'Количество мест должно быть положительным целым числом.',
    });
  if (
    !Number.isSafeInteger(config.extraDelaySeconds) ||
    config.extraDelaySeconds < 0 ||
    config.extraDelaySeconds > 86400
  )
    issues.push({
      section: 'session',
      message: 'Дополнительная задержка: от 0 до 86400 целых секунд.',
    });
  if (!config.game.track.code) issues.push({ section: 'conditions', message: 'Выберите трассу.' });
  if (!config.game.cars.allowedCarIds.length)
    issues.push({ section: 'conditions', message: 'Выберите машины для тренировки.' });
  return issues;
}

const numberValue = (value: string) => (value === '' ? Number.NaN : Number(value));
const shown = (value: number) => (Number.isFinite(value) ? value : '');

/**
 * Practice config form in the v16 module layout: one page of panels, actions at the bottom.
 * The server applies a saved config to the next cycle; the running session is not stopped.
 */
export function PracticeServerEditor({
  config,
  onChange,
  editing,
  disabled,
  dirty,
  onSave,
  onCancel,
}: {
  config: Config;
  onChange(config: Config): void;
  editing: boolean;
  disabled: boolean;
  dirty: boolean;
  onSave(): void;
  onCancel(): void;
}) {
  useUnsavedChanges(dirty);
  const patch = (value: Partial<Config>) => onChange({ ...config, ...value });
  const issues = practiceIssues(config);
  const durationBad = !Number.isFinite(config.sessionDurationMinutes) || config.sessionDurationMinutes < 1 || config.sessionDurationMinutes > 1440;
  const maxBad = !Number.isInteger(config.practice.maxParticipants) || config.practice.maxParticipants < 1;
  const delayBad = !Number.isSafeInteger(config.extraDelaySeconds) || config.extraDelaySeconds < 0 || config.extraDelaySeconds > 86400;
  const delay = Number.isFinite(config.extraDelaySeconds) ? config.extraDelaySeconds : 0;
  const jump = (section: string) => document.getElementById(sectionIds[section] ?? '')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="lsr-stack lsr-practice-form">
      <Notice>
        {editing
          ? 'Для действующего сервера изменения применяются со следующего цикла. Текущая сессия продолжит работу.'
          : 'Сервер будет создан остановленным. Запустите его после сохранения.'}
      </Notice>
      <Panel title="Основное" id={sectionIds.general}>
        <Fields>
          <TextField full label="Название" value={config.title} disabled={disabled} error={!config.title.trim() ? 'Укажите название' : undefined}
            onChange={(e) => patch({ title: e.target.value })} />
          <div className="lsr-field">
            <OrganizerField value={config.organizerId} disabled={disabled || editing} onChange={(organizerId) => patch({ organizerId })} />
            <small className="lsr-help">{editing ? 'Владелец не меняется после создания' : !config.organizerId ? 'Выберите организатора — владельца сервера' : 'После создания организатора изменить нельзя'}</small>
          </div>
          <SelectField label="Дисциплина" value={config.disciplineCode} disabled={disabled || editing} help={editing ? 'Не меняется после создания' : undefined}
            options={[{ value: 'circuit', label: 'Кольцевые гонки' }, { value: 'touge', label: 'Тоге' }]} onChange={(e) => patch({ disciplineCode: e.target.value })} />
          <TextArea full rows={3} label="Описание" value={config.description ?? ''} disabled={disabled} onChange={(e) => patch({ description: e.target.value || null })} />
        </Fields>
      </Panel>
      <Panel title="Тренировочная сессия" id={sectionIds.session}>
        <Fields>
          <TextField type="number" min={1} max={1440} label="Длительность цикла, мин" value={shown(config.sessionDurationMinutes)} disabled={disabled}
            help="1–1440 минут" error={durationBad ? 'Длительность сессии: от 1 до 1440 минут' : undefined}
            onChange={(e) => {
              const value = numberValue(e.target.value);
              patch({ sessionDurationMinutes: value, practice: { ...config.practice, durationMinutes: value } });
            }} />
          <TextField type="number" min={1} label="Максимум пилотов" value={shown(config.practice.maxParticipants)} disabled={disabled}
            error={maxBad ? 'Положительное целое число' : undefined}
            onChange={(e) => patch({ practice: { ...config.practice, maxParticipants: numberValue(e.target.value) } })} />
          <TextField type="number" min={0} max={86400} label="Дополнительная задержка, сек" value={shown(config.extraDelaySeconds)} disabled={disabled}
            help={`30 сек + это значение между циклами · итого ${30 + delay} сек до следующего цикла`} error={delayBad ? 'От 0 до 86400 целых секунд' : undefined}
            onChange={(e) => patch({ extraDelaySeconds: numberValue(e.target.value) })} />
        </Fields>
      </Panel>
      <section className="lsr-stack lsr-practice-game" id={sectionIds.conditions} aria-label="Трасса, машины и условия">
        <GameFields organizerId={config.organizerId} value={config.game} onChange={(game) => patch({ game })} disabled={disabled} />
      </section>
      <div className="lsr-practice-savebar">
        <div className="lsr-practice-savebar-status">
          <span role="status" className={dirty ? 'is-dirty' : undefined}>{dirty ? 'Есть несохранённые изменения' : 'Изменений нет'}</span>
          {!!issues.length && (
            <div className="lsr-practice-issues" role="group" aria-label="Нужно исправить">
              <span>Нужно исправить:</span>
              {issues.map((issue, i) => <button type="button" key={i} className="lsr-link is-sm" onClick={() => jump(issue.section)}>{issue.message}</button>)}
            </div>
          )}
        </div>
        <div className="lsr-hstack">
          <Button disabled={editing && !dirty} onClick={onCancel}>{editing ? 'Отменить изменения' : 'Отменить'}</Button>
          <Button variant="primary" disabled={disabled || issues.length > 0} onClick={onSave}>
            {editing ? 'Сохранить для следующего цикла' : 'Создать остановленный сервер'}
          </Button>
        </div>
      </div>
    </div>
  );
}
