import { useState } from 'react';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { FieldGroup } from '../../features/event-authoring/Fields';
import { GameFields, OrganizerField } from '../../features/standalone/GameFields';
import {
  EditorPanel,
  EditorSections,
  ReviewIssues,
} from '../../features/standalone/EditorSections';
import type { Config } from './PracticeServersPage';

const sections = [
  ['general', 'Основное'],
  ['session', 'Сессия'],
  ['conditions', 'Условия'],
  ['review', 'Проверка'],
] as const;
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

export function PracticeServerEditor({
  config,
  onChange,
  editing,
  disabled,
  dirty,
  onSave,
}: {
  config: Config;
  onChange(config: Config): void;
  editing: boolean;
  disabled: boolean;
  dirty: boolean;
  onSave(): void;
}) {
  const [section, setSection] = useState('general');
  const patch = (value: Partial<Config>) => onChange({ ...config, ...value });
  const issues = practiceIssues(config);
  return (
    <EditorSections
      sections={sections}
      value={section}
      onChange={setSection}
      dirty={dirty}
      actions={
        <>
          <Button variant="contained" disabled={disabled || issues.length > 0} onClick={onSave}>
            {editing ? 'Сохранить для следующего цикла' : 'Создать остановленный сервер'}
          </Button>
        </>
      }
    >
      <Typography color="text.secondary">
        {editing
          ? 'Изменения применятся к следующему циклу. Текущая сессия продолжит работу.'
          : 'Сервер будет создан остановленным. Запустите его после сохранения.'}
      </Typography>
      <EditorPanel id="general" active={section}>
        <FieldGroup title="Основное">
          <TextField
            size="small"
            label="Название"
            value={config.title}
            disabled={disabled}
            onChange={(e) => patch({ title: e.target.value })}
          />
          <OrganizerField
            value={config.organizerId}
            disabled={disabled || editing}
            onChange={(organizerId) => patch({ organizerId })}
          />
          <TextField
            size="small"
            select
            label="Дисциплина"
            value={config.disciplineCode}
            disabled={disabled || editing}
            onChange={(e) => patch({ disciplineCode: e.target.value })}
          >
            <MenuItem value="touge">Тоге</MenuItem>
            <MenuItem value="circuit">Кольцевые гонки</MenuItem>
          </TextField>
          <TextField
            size="small"
            multiline
            minRows={3}
            label="Описание"
            value={config.description ?? ''}
            disabled={disabled}
            onChange={(e) => patch({ description: e.target.value || null })}
          />
        </FieldGroup>
      </EditorPanel>
      <EditorPanel id="session" active={section}>
        <FieldGroup title="Тренировочная сессия">
          <TextField
            size="small"
            type="number"
            label="Длительность цикла, минут"
            value={config.sessionDurationMinutes}
            disabled={disabled}
            helperText="От 1 до 1440 минут"
            onChange={(e) =>
              patch({
                sessionDurationMinutes: Number(e.target.value),
                practice: { ...config.practice, durationMinutes: Number(e.target.value) },
              })
            }
          />
          <TextField
            size="small"
            type="number"
            label="Максимум пилотов"
            value={config.practice.maxParticipants}
            disabled={disabled}
            onChange={(e) =>
              patch({ practice: { ...config.practice, maxParticipants: Number(e.target.value) } })
            }
          />
          <TextField
            size="small"
            type="number"
            label="Дополнительная задержка, секунд"
            value={config.extraDelaySeconds}
            disabled={disabled}
            onChange={(e) => patch({ extraDelaySeconds: Number(e.target.value) })}
          />
          <Typography color="text.secondary">
            После освобождения сервера: 30 секунд + {config.extraDelaySeconds || 0} секунд задержки.
            Итого {30 + (config.extraDelaySeconds || 0)} секунд до следующего цикла.
          </Typography>
        </FieldGroup>
      </EditorPanel>
      <EditorPanel id="conditions" active={section}>
        <GameFields
          organizerId={config.organizerId}
          value={config.game}
          onChange={(game) => patch({ game })}
          disabled={disabled}
        />
      </EditorPanel>
      <EditorPanel id="review" active={section}>
        <Stack spacing={2}>
          <FieldGroup title={config.title || 'Тренировочный сервер'}>
            <Typography>
              Сессия: {config.sessionDurationMinutes} мин · {config.practice.maxParticipants} мест
            </Typography>
            <Typography>
              Трасса: {config.game.track.code || 'Не выбрана'}
              {config.game.track.layoutCode ? ` · ${config.game.track.layoutCode}` : ''}
            </Typography>
            <Typography>Машин: {config.game.cars.allowedCarIds.length}</Typography>
            <Typography>Пауза после освобождения: {30 + config.extraDelaySeconds} сек</Typography>
          </FieldGroup>
          <ReviewIssues issues={issues} onSelect={setSection} />
          <Alert severity="info">
            {editing
              ? 'Сохранение не остановит текущую сессию.'
              : 'После создания сервер можно запустить из списка тренировочных серверов.'}
          </Alert>
        </Stack>
      </EditorPanel>
      {issues.length > 0 && section !== 'review' && (
        <Button sx={{ alignSelf: 'flex-start' }} onClick={() => setSection('review')}>
          Проверить настройки · {issues.length}
        </Button>
      )}
    </EditorSections>
  );
}
