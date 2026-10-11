import { initialSettings } from './initial-settings';
import { BackAction } from '../../shared/ui';
import { useRef, useState } from 'react';
import { ScenarioHelpPanel } from './ScenarioHelpPanel';
import { useScenarioBuilder } from './useScenarioBuilder';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { RichDescriptionEditor } from '../../shared/RichContent';
import { EventCardFields } from '../../pages/events/current/EventCardFields';
import type { Document, Draft, Settings } from './types';
import { Field } from './Fields';
import {
  EditingRestrictions,
  FieldCapabilities,
  FieldFocus,
  FieldIssues,
  read,
  write,
} from './form-state';
import { ParticipantFields, ProgramFields, ConditionsFields } from './ScenarioFields';
const sections = [
  ['program', 'Программа'],
  ['participants', 'Участники'],
  ['conditions', 'Условия'],
  ['description', 'Описание и оформление'],
  ['review', 'Проверка'],
] as const;
const help: Record<string, string> = {
  format:
    'Выберите организатора и формат. Доступные варианты определяет сервер с учётом прав и ограничений.',
  program:
    'Соберите программу заездов. Практика и квалификация перед гонкой — фазы одной сессии. В чемпионате список машин общий.',
  participants:
    'Допуск в чемпионат и запись на отдельный этап — разные действия. Здесь задаются правила участия и зачёта.',
  conditions: 'Выберите класс машин и погоду из каталога или создайте свои. Помощники и плагины серии задаются один раз.',
  description:
    'Добавьте описание, ссылки, таблицы и изображения. Обложка и описание сохраняются отдельно. Черновик доступен только вам.',
  review:
    'Проверьте программу перед публикацией. Черновик можно сохранить незаполненным. Публикация станет доступна после полной проверки.',
};
export interface ScenarioBuilderProps {
  descriptionOnly?: boolean;
  edit?: { eventId: string; expectedVersion: string };
  onEdited?: () => void;
  draftId?: string;
  initialDocument?: Document;
  onSaved?: (draft: Draft) => void;
  onPublished?: (eventId: string) => void;
  onClose?: () => void;
}
export function ScenarioBuilder({
  descriptionOnly = false,
  draftId,
  initialDocument,
  onSaved,
  onPublished,
  onClose,
  edit,
  onEdited,
}: ScenarioBuilderProps) {
  const scenarioInputs = useRef(new Map<string, Settings>());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const {
    publicationPending,
    editRestrictions,
    document,
    draft,
    catalog,
    organizers,
    section,
    setSection,
    resolution,
    error,
    setError,
    notice,
    busy,
    loading,
    uploads,
    current,
    update,
    settings,
    organizerId,
    descriptor,
    save,
  } = useScenarioBuilder({
    draftId,
    initialDocument,
    onSaved,
    onPublished,
    edit,
    onEdited,
    descriptionOnly,
  });
  const visible = sections.filter(([id]) =>
    descriptionOnly
      ? ['description', 'review'].includes(id)
      : !descriptor || descriptor.sections.includes(id),
  );
  const ready = !!descriptor && !!organizerId;
  const activeSection = visible.some(([id]) => id === section)
    ? section
    : (visible[0]?.[0] ?? 'program');
  const visit = (id: string) => {
    setSection(id);
    setVisited((previous) => new Set([...previous, id]));
  };
  const props = {
    value: document.settings,
    onChange: settings,
    disabled: busy || publicationPending,
  };
  return (
    <FieldFocus.Provider value={focusPath}>
      <FieldIssues.Provider value={resolution?.issues ?? []}>
        <EditingRestrictions.Provider value={editRestrictions}>
          <FieldCapabilities.Provider value={descriptor}>
            <Stack spacing={2}>
              {onClose && <Box className="admin-page-back"><BackAction label={edit?'К событию':'К событиям'} disabled={busy||publicationPending} onClick={onClose}/></Box>}
              <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                <Typography variant="h5" sx={{ flex: 1 }}>
                  Конструктор события
                </Typography>
                <Button
                  variant="outlined"
                  disabled={
                    busy ||
                    publicationPending ||
                    loading ||
                    !!draft?.publishedEventId ||
                    (!!edit && !resolution?.canPublish)
                  }
                  onClick={() => void save(false)}
                >
                  {edit ? 'Сохранить изменения' : 'Сохранить черновик'}
                </Button>
                {!edit && (
                  <Button
                    variant="contained"
                    disabled={
                      busy ||
                      loading ||
                      (!resolution?.canPublish && !publicationPending) ||
                      !catalog ||
                      !!draft?.publishedEventId
                    }
                    onClick={() => void save(true)}
                  >
                    {publicationPending ? 'Проверить публикацию' : 'Опубликовать'}
                  </Button>
                )}
              </Stack>
              {error && (
                <Alert severity="error" onClose={() => setError('')}>
                  {error}
                </Alert>
              )}
              {notice && (
                <Typography role="status" color="text.secondary">
                  {notice}
                </Typography>
              )}
              {!descriptionOnly && (
                <>
                  <TextField
                    select
                    label="Организатор"
                    data-field-path="event.organizerId"
                    value={organizerId}
                    disabled={busy || publicationPending || !!edit}
                    onChange={(e) =>
                      settings(write(document.settings, 'event.organizerId', e.target.value))
                    }
                  >
                    <MenuItem value="">Не выбран</MenuItem>
                    {organizers.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Typography>
                    Игра: {catalog?.games.map((item) => item.title).join(', ') ?? 'Загрузка…'}
                  </Typography>
                  <Stack direction="row" gap={1} flexWrap="wrap" data-field-path="scenarioCode">
                    {catalog?.items.map((item) => (
                      <Button
                        key={item.code}
                        variant={item.code === document.scenarioCode ? 'contained' : 'outlined'}
                        disabled={busy || publicationPending || !!edit || !item.enabled}
                        title={item.reason ?? undefined}
                        onClick={() => {
                          if (document.scenarioCode === item.code) return;
                          if (document.scenarioCode)
                            scenarioInputs.current.set(
                              document.scenarioCode,
                              structuredClone(document.settings),
                            );
                          const next = structuredClone(
                            scenarioInputs.current.get(item.code) ?? initialSettings(item),
                          );
                          next.event = {
                            ...(next.event as Settings),
                            ...((document.settings.event ?? {}) as Settings),
                            gameCode: item.gameCode,
                            disciplineCode: (item.defaults.event as Settings).disciplineCode,
                          };
                          setVisited(new Set());
                          setSection('program');
                          update({ ...document, scenarioCode: item.code, settings: next });
                        }}
                      >
                        {item.title}
                      </Button>
                    ))}
                  </Stack>
                  {catalog?.items
                    .filter((item) => !item.enabled)
                    .map((item) => (
                      <Typography key={item.code} variant="caption">
                        {item.title}: {item.reason}
                      </Typography>
                    ))}
                </>
              )}

              {ready && (
                <>
                  <Tabs
                    value={activeSection}
                    onChange={(_, next) => visit(next)}
                    variant="scrollable"
                    scrollButtons="auto"
                    aria-label="Разделы конструктора"
                  >
                    {visible.map(([id, label]) => {
                      const issues =
                        id === 'review'
                          ? (resolution?.issues ?? [])
                          : (resolution?.issues.filter((issue) => issue.sectionId === id) ?? []);
                      const checked = visited.has(id) && !!resolution;
                      const hasError =
                        checked && issues.some((issue) => issue.severity === 'error');
                      const complete =
                        checked && !issues.length && (id !== 'review' || resolution?.canPublish);
                      const color = hasError
                        ? 'error.main'
                        : complete
                          ? 'success.main'
                          : 'warning.dark';
                      const status = hasError
                        ? 'Нужно исправить или заполнить поля'
                        : complete
                          ? 'Раздел заполнен'
                          : 'Раздел ещё не проверен';
                      return (
                        <Tab
                          key={id}
                          value={id}
                          onClick={() => visit(id)}
                          label={label}
                          title={status}
                          aria-description={status}
                          icon={
                            <Box
                              component="span"
                              aria-hidden="true"
                              sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color }}
                            />
                          }
                          iconPosition="start"
                          sx={{ color, '&.Mui-selected': { color } }}
                        />
                      );
                    })}
                  </Tabs>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) 280px' },
                      gap: 3,
                    }}
                  >
                    <Box
                      component="main"
                      sx={{ minWidth: 0 }}
                      onChangeCapture={() =>
                        setVisited((previous) => new Set([...previous, activeSection]))
                      }
                    >
                      {loading ? (
                        <Typography>Загружаем черновик…</Typography>
                      ) : (
                        <Stack spacing={2}>
                          {descriptor && activeSection === 'program' && (
                            <ProgramFields
                              {...props}
                              descriptor={descriptor}
                              previewBlocks={resolution?.preview?.blocks}
                            />
                          )}
                          {descriptor && activeSection === 'participants' && (
                            <ParticipantFields {...props} descriptor={descriptor} />
                          )}
                          {descriptor && activeSection === 'conditions' && <ConditionsFields {...props} descriptor={descriptor}/>}
                          {descriptor && activeSection === 'description' && (
                            <>
                              <Field
                                {...props}
                                disabled={busy || publicationPending || descriptionOnly}
                                path="event.title"
                                label="Название события"
                              />
                              {document.pendingImages.map((name, index) => (
                                <Alert
                                  key={index}
                                  severity="warning"
                                  action={
                                    <Button
                                      disabled={
                                        busy || publicationPending || uploads.current.has(name)
                                      }
                                      onClick={() => {
                                        if (
                                          !window.confirm(
                                            'Отменить незавершённую вставку? Если загрузка ещё идёт, дождитесь её завершения.',
                                          )
                                        )
                                          return;
                                        update({
                                          ...document,
                                          pendingImages: document.pendingImages.filter(
                                            (_, i) => i !== index,
                                          ),
                                        });
                                      }}
                                    >
                                      Убрать
                                    </Button>
                                  }
                                >
                                  Незавершённая загрузка: {name}. Если файл не загрузился, вставьте
                                  его снова.
                                </Alert>
                              ))}
                              <Box
                                component="fieldset"
                                data-field-path="event.description"
                                disabled={busy || publicationPending}
                                sx={{ border: 0, p: 0 }}
                              >
                                <RichDescriptionEditor
                                  disabled={busy || publicationPending}
                                  value={String(read(document.settings, 'event.description') ?? '')}
                                  onChange={(html) =>
                                    update({
                                      ...current.current,
                                      settings: write(
                                        current.current.settings,
                                        'event.description',
                                        html,
                                      ),
                                    })
                                  }
                                  onImagePending={(name, pending, failed) => {
                                    if (pending) uploads.current.add(name);
                                    else uploads.current.delete(name);
                                    update({
                                      ...current.current,
                                      pendingImages: pending
                                        ? [...current.current.pendingImages, name]
                                        : failed
                                          ? current.current.pendingImages
                                          : current.current.pendingImages.filter(
                                              (item) => item !== name,
                                            ),
                                    });
                                  }}
                                  ownerOrganizerId={organizerId}
                                  gameCode={descriptor.gameCode}
                                />
                              </Box>
                              <EventCardFields
                                displaySchedule={resolution?.preview?.displaySchedule ?? null}
                                value={document.settings}
                                onChange={settings}
                                disabled={busy || publicationPending || descriptionOnly}
                                scenarioCode={descriptor.code}
                              />
                            </>
                          )}
                          {activeSection === 'review' && (
                            <>
                              <Typography variant="h6">Программа события</Typography>
                              {!resolution ? (
                                <Typography>Проверяем текущую конфигурацию…</Typography>
                              ) : (
                                <>
                                  {resolution.issues.map((issue, i) => (
                                    <Alert key={i} severity={issue.severity}>
                                      <Button
                                        color="inherit"
                                        onClick={() => {
                                          if (issue.sectionId !== 'format') visit(issue.sectionId);
                                          setFocusPath(issue.path);
                                          requestAnimationFrame(() => {
                                            const el = window.document.querySelector<HTMLElement>(
                                              '[data-field-path="' + CSS.escape(issue.path) + '"]',
                                            );
                                            el?.scrollIntoView?.({ block: 'center' });
                                            el?.querySelector<HTMLElement>(
                                              'input,button,select,textarea',
                                            )?.focus();
                                          });
                                        }}
                                      >
                                        {issue.message}
                                      </Button>
                                    </Alert>
                                  ))}
                                  {resolution.preview?.blocks.map((block) => (
                                    <Box
                                      key={block.key}
                                      sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
                                    >
                                      <Typography fontWeight={700}>{block.title}</Typography>
                                      <Typography>
                                        {new Date(block.schedule.startsAt).toLocaleString('ru-RU', {
                                          
                                        })}{' '}
                                        —{' '}
                                        {block.schedule.estimatedEndsAt
                                          ? new Date(block.schedule.estimatedEndsAt).toLocaleString(
                                              'ru-RU',
                                              {
                                                
                                              },
                                            )
                                          : 'до завершения'}
                                      </Typography>
                                    </Box>
                                  ))}
                                  {resolution.warnings?.map((warning) => (
                                    <Alert key={warning.code} severity="warning">
                                      {warning.message ?? warning.code}
                                    </Alert>
                                  ))}
                                  {!!resolution.preview?.registrations?.length && (
                                    <Typography variant="h6">Регистрация</Typography>
                                  )}
                                  {resolution.preview?.registrations?.map((registration, index) => (
                                    <Box
                                      key={registration.key}
                                      sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
                                    >
                                      <Typography fontWeight={700}>
                                        Регистрация {index + 1}
                                        {registration.config.capacity !== null
                                          ? ' · мест: ' + registration.config.capacity
                                          : ''}
                                      </Typography>
                                      <Typography>
                                        Открытие:{' '}
                                        {registration.config.opensAt
                                          ? new Date(registration.config.opensAt).toLocaleString(
                                              'ru-RU',
                                              {
                                                
                                              },
                                            )
                                          : 'Без ограничений'}
                                        . Закрытие:{' '}
                                        {new Date(registration.config.closesAt).toLocaleString(
                                          'ru-RU',
                                          {
                                            
                                          },
                                        )}{' '}
                                        
                                      </Typography>
                                    </Box>
                                  ))}
                                  {resolution.canPublish && (
                                    <Alert severity="success">
                                      Конфигурация готова к публикации
                                    </Alert>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </Stack>
                      )}
                    </Box>
                    <ScenarioHelpPanel
                      preview={resolution?.preview ?? null}
                      text={help[activeSection]}
                      issues={
                        resolution?.issues.filter((issue) => issue.sectionId === activeSection) ??
                        []
                      }
                    />
                  </Box>
                </>
              )}
            </Stack>
          </FieldCapabilities.Provider>
        </EditingRestrictions.Provider>
      </FieldIssues.Provider>
    </FieldFocus.Provider>
  );
}
