import { WorkspaceConduct } from './WorkspaceConduct';
import { WorkspaceParticipants } from './WorkspaceParticipants';
import {
  Frame,
  More,
  Details,
  workspacePath as path,
  type WorkspaceProps as Props,
  type PageData as Page,
} from './workspace-ui';
type Status = { code: string; label: string };
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useWorkspaceData } from './workspace-data';
import type { Value } from './event-api';
import { displayDateTime } from '../../../../../shared/presentation';
import { EventResultTable } from './EventResultTable';
import { GameJournal } from './GameJournal';
import { AuditPage } from '../../audit/AuditPage';
import { ChatsPage } from '../../chats/ChatsPage';
import { OfficiatingPage } from '../../officiating/OfficiatingPage';
export function WorkspaceSection(p: Props) {
  if (p.section === 'execution') return <Execution {...p} />;
  if (p.section === 'participants') return <WorkspaceParticipants {...p} />;
  if (p.section === 'results') return <Results {...p} />;
  if (p.section === 'history') return <History {...p} />;
  return null;
}
function Execution(p: Props) {
  const [q, setQ] = useSearchParams(),
    view = q.get('view') ?? 'program';
  return (
    <Stack spacing={3}>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {[
          ['program', 'Программа'],
          ['servers', 'Все серверы события'],
          ['presence', 'Подключения'],
        ].map(([key, label]) => (
          <Button
            key={key}
            disableElevation
            variant={view === key ? 'contained' : 'text'}
            onClick={() =>
              setQ((old) => {
                const next = new URLSearchParams(old);
                next.set('view', key);
                return next;
              })
            }
          >
            {label}
          </Button>
        ))}
      </Stack>
      <Box hidden={view !== 'program'}>
        <WorkspaceConduct {...p} active={p.active && view === 'program'} />
      </Box>
      <Box hidden={view !== 'servers'}>
        <Runtime {...p} active={p.active && view === 'servers'} />
      </Box>
      <Box hidden={view !== 'presence'}>
        <Presence {...p} active={p.active && view === 'presence'} />
      </Box>
    </Stack>
  );
}
function Runtime(p: Props) {
  const [group, setGroup] = useState(
    p.summary.activity.runtime.uncertain
      ? 'uncertain'
      : p.summary.activity.runtime.active
        ? 'active'
        : 'finished',
  );
  const r = useWorkspaceData<{
    items: {
      id: string;
      serverId: string | null;
      displayStatus: Status;
      requestedAt: string;
      startedAt: string | null;
      stoppedAt: string | null;
      connectedPlayers: number | null;
      startIssuedAt: string | null;
      connectionLostAt: string | null;
      recoveryDeadlineAt: string | null;
      stopCause: string | null;
    }[];
    nextAfterId: string | null;
    reservations: {
      stageTitle: string | null;
      id: string;
      startsAt: string;
      estimatedEndsAt: string;
      serverCount: number;
      status: string;
    }[];
  }>(path(p.eventId, 'runtime') + `?stateGroup=${group}`, p.active);
  return (
    <Frame resource={r}>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {[
          ['uncertain', 'Нет связи'],
          ['active', 'Незавершённые'],
          ['finished', 'Завершённые'],
        ].map(([id, label]) => (
          <Button
            key={id}
            size="small"
            disableElevation
            variant={group === id ? 'contained' : 'text'}
            onClick={() => setGroup(id)}
          >
            {label}
          </Button>
        ))}
      </Stack>
      {!r.data?.items.length && (
        <Typography color="text.secondary">В этой группе запусков нет.</Typography>
      )}
      {r.data?.items.map((s) => (
        <Box
          key={s.id}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(180px,1fr) minmax(0,2fr)' },
            gap: 2,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack spacing={0.75}>
            <Typography fontWeight={650}>
              <Link to={`/runtime?sessionId=${s.id}&eventId=${p.eventId}`}>Сессия №{s.id} ↗</Link>
            </Typography>
            <Typography variant="body2">{s.displayStatus.label}</Typography>
            <Typography variant="body2" color="text.secondary">
              Сервер: {s.serverId ?? 'Не назначен'}
            </Typography>
            <Typography variant="body2">
              Онлайн: {s.connectedPlayers ?? 'Нет подтверждённых данных'}
            </Typography>
          </Stack>
          <Stack spacing={1}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' },
                gap: 2,
              }}
            >
              {[
                ['Запрошено', s.requestedAt],
                ['Начало', s.startedAt],
                ['Остановка', s.stoppedAt],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2">{displayDateTime(value)}</Typography>
                </Box>
              ))}
            </Box>
            {s.connectionLostAt && (
              <Alert severity="warning">
                Связь потеряна {displayDateTime(s.connectionLostAt)}. Проверка до{' '}
                {displayDateTime(s.recoveryDeadlineAt)}.
              </Alert>
            )}
            {s.stopCause && (
              <Typography variant="body2">Причина остановки: {s.stopCause}</Typography>
            )}
            <Details value={s} />
          </Stack>
        </Box>
      ))}
      <More resource={r} />
      <Box component="details">
        <Typography component="summary">Плановый резерв серверов</Typography>{' '}
        <Stack spacing={1}>
          <Typography variant="h6">Плановый резерв серверов</Typography>
          <Typography variant="body2" color="text.secondary">
            Сохранённые резервы менеджера серверов на указанные окна. Назначение конкретного сервера
            показано в запусках ниже.
          </Typography>
        </Stack>
        {!r.data?.reservations.length ? (
          <Typography color="text.secondary">Сохранённых резервов нет.</Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Этап</TableCell>
                  <TableCell>Серверов</TableCell>
                  <TableCell>Окно резерва</TableCell>
                  <TableCell>Состояние</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {r.data.reservations.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>
                      {x.stageTitle ?? 'Название не сохранено'}
                      <Typography variant="caption" component="div" color="text.secondary">
                        Резерв №{x.id}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{x.serverCount}</TableCell>
                    <TableCell>
                      {displayDateTime(x.startsAt)}
                      <Typography variant="caption" component="div" color="text.secondary">
                        до {displayDateTime(x.estimatedEndsAt)} · плановое окончание
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {
                        (
                          {
                            SCHEDULED: 'Запланирован',
                            ACTIVE: 'Действует',
                            COMPLETED: 'Завершён',
                            RELEASED: 'Освобождён',
                            CANCELLED: 'Отменён',
                          } as Record<string, string>
                        )[x.status]
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Box>
    </Frame>
  );
}

function RuntimeHistory(p: Props) {
  const r = useWorkspaceData<
    Page<{
      id: string;
      sessionId: string;
      type: string;
      occurredAt: string;
      reason: string | null;
      phase: string | null;
      acknowledged: boolean;
    }>
  >(path(p.eventId, 'runtime-history'), p.active);
  const labels: Record<string, string> = {
    WAITING: 'Ожидание мощности',
    STARTED: 'Запуск подтверждён',
    PHASE_CHANGED: 'Смена фазы',
    STOPPED: 'Остановка подтверждена',
    FAILED: 'Сбой',
    OUTPUT: 'Получен результат',
    PARTICIPANTS_PRESENT: 'Состав обновлён',
    CONNECTION_LOST: 'Потеря связи',
    CONNECTION_RESTORED: 'Связь восстановлена',
  };
  return (
    <Frame resource={r}>
      <Typography variant="h6">История исполнения серверов</Typography>
      {!r.data?.items.length && <Typography>Фактов исполнения нет.</Typography>}
      {r.data?.items.map((x) => (
        <Stack key={x.id}>
          <Typography>
            {displayDateTime(x.occurredAt)} · {labels[x.type] ?? 'Событие сервера'} ·{' '}
            <Link to={`/runtime?sessionId=${x.sessionId}&eventId=${p.eventId}`}>
              Сессия {x.sessionId}
            </Link>
          </Typography>
          {x.reason && <Typography color="text.secondary">{x.reason}</Typography>}
          <Typography color="text.secondary">
            {x.acknowledged ? 'Обработано владельцем события' : 'Ожидает обработки'}
          </Typography>
          <Details value={x} />
        </Stack>
      ))}
      <More resource={r} />
    </Frame>
  );
}
function Presence(p: Props) {
  const [q] = useSearchParams(),
    participant = q.get('participantId');
  const r = useWorkspaceData<
    Page<{
      id: string;
      sessionId: string;
      participantId: string | null;
      name: string | null;
      kind: string;
      occurredAt: string;
      reason: string | null;
    }>
  >(
    path(p.eventId, 'presence') +
      (participant ? `?participantId=${encodeURIComponent(participant)}` : ''),
    p.active,
  );
  return (
    <Frame resource={r}>
      <Typography variant="h6">
        Фактические подключения{participant && ` · пилот ${participant}`}
      </Typography>
      {!r.data?.items.length && <Typography>Подключения не зафиксированы.</Typography>}
      {r.data?.items.map((x) => (
        <Typography key={x.id}>
          {displayDateTime(x.occurredAt)} · {x.name ?? x.participantId ?? 'Неизвестный участник'} ·{' '}
          {
            (
              {
                CONNECTED: 'Подключился',
                DISCONNECTED: 'Отключился',
                REJECTED: 'Вход отклонён',
              } as Record<string, string>
            )[x.kind]
          }{' '}
          ·{' '}
          <Link to={`/runtime?sessionId=${x.sessionId}&eventId=${p.eventId}`}>
            Сессия {x.sessionId}
          </Link>
          {x.reason && ` · ${x.reason}`}
        </Typography>
      ))}
      <More resource={r} />
    </Frame>
  );
}
type Result = {
  id: string;
  title: string;
  definition: { key: string; type: string };
  displayStatus: Status;
  currentRevisionId: string | null;
  currentRevisionNumber: number;
};
function Results(p: Props) {
  const r = useWorkspaceData<Page<Result>>(path(p.eventId, 'results'), p.active),
    [q, setQ] = useSearchParams(),
    selected = q.get('resultId') ?? p.summary.primaryResultId;
  const [rating, setRating] = useState(false);
  const selectedHead = useWorkspaceData<Page<Result>>(
    path(p.eventId, 'results') + `?resultId=${selected ?? ''}`,
    p.active && !!selected && !!r.data && !r.data.items.some((x) => x.id === selected),
  );
  const options = [
    ...(r.data?.items ?? []),
    ...(selectedHead.data?.items ?? []).filter(
      (x) => x.id === selected && !r.data?.items.some((y) => y.id === x.id),
    ),
  ];
  return (
    <Frame resource={r}>
      {!r.data?.items.length ? (
        <Typography>Результаты для этого события не предусмотрены.</Typography>
      ) : (
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          <TextField
            select
            size="small"
            label="Результат"
            value={options.some((x) => x.id === selected) ? selected : ''}
            sx={{ minWidth: 260, maxWidth: '100%' }}
            onChange={(e) =>
              setQ((old) => {
                const next = new URLSearchParams(old);
                next.set('resultId', e.target.value);
                return next;
              })
            }
          >
            {options.map((x) => (
              <MenuItem key={x.id} value={x.id}>
                {x.title} · {x.displayStatus.label}
              </MenuItem>
            ))}
          </TextField>
          <More resource={r} />
        </Stack>
      )}
      {selected ? (
        <ResultDetails key={selected} eventId={p.eventId} resultId={selected} active={p.active} />
      ) : (
        <Typography color="text.secondary">Выберите результат.</Typography>
      )}
      <Divider />
      <Box component="details" open={rating} onToggle={(e) => setRating(e.currentTarget.open)}>
        <Typography component="summary">История начислений PR / SR</Typography>
        <Rating {...p} active={p.active && rating} />
      </Box>
    </Frame>
  );
}
export function ResultDetails({
  eventId,
  resultId,
  active,
}: {
  eventId: string;
  resultId: string;
  active: boolean;
}) {
  const r = useWorkspaceData<
    Page<{ id: string; number: number; createdAt: string; source: string }>
  >(path(eventId, 'revisions') + `?resultId=${resultId}`, active);
  const [chosen, setChosen] = useState<string | null>(null),
    revision = chosen ?? r.data?.items[0]?.id;
  return (
    <Frame resource={r}>
      {r.data?.items.length ? (
        <TextField
          select
          size="small"
          label="Версия результата"
          value={revision ?? ''}
          sx={{ maxWidth: 400 }}
          onChange={(e) => setChosen(e.target.value)}
        >
          {r.data.items.map((v) => (
            <MenuItem key={v.id} value={v.id}>
              Ревизия {v.number} · {displayDateTime(v.createdAt)}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <Typography>Опубликованных ревизий пока нет.</Typography>
      )}
      <More resource={r} />
      {revision && (
        <Revision
          key={revision}
          eventId={eventId}
          resultId={resultId}
          revisionId={revision}
          active={active}
        />
      )}
      <Button
        sx={{ alignSelf: 'flex-start' }}
        component={Link}
        to={`/events/${encodeURIComponent(eventId)}?section=history&source=reports&resultId=${resultId}`}
      >
        Протесты и судейские решения
      </Button>
    </Frame>
  );
}
function Revision(p: { eventId: string; resultId: string; revisionId: string; active: boolean }) {
  const r = useWorkspaceData<{
    payload: Value;
    source: string;
    decisions: { id: string; reason: string; status: string }[];
  }>(path(p.eventId, 'result') + `?resultId=${p.resultId}&revisionId=${p.revisionId}`, p.active);
  return (
    <Frame resource={r}>
      <EventResultTable value={r.data?.payload ?? null} eventId={p.eventId} />
      <Typography>Источник ревизии: {r.data?.source}</Typography>
      {r.data?.decisions.map((d) => (
        <Typography key={d.id}>
          Решение №{d.id}: {d.reason} · {d.status}
        </Typography>
      ))}
      <Details value={r.data?.payload} />
    </Frame>
  );
}
function Rating(p: Props) {
  const [q] = useSearchParams(),
    participant = q.get('participantId');
  type Metric = { before: number; delta: number; after: number };
  const r = useWorkspaceData<
    Page<{
      id: string;
      status: string;
      appliedAt: string;
      source: { id: string; version: string | null };
      supersedesApplicationId: string | null;
      changes: { participantId: string; pilot: Metric | null; safety: Metric | null }[];
    }> & { identities: { participantId: string; displayName: string }[] }
  >(path(p.eventId, 'rating') + (participant ? `?participantId=${participant}` : ''), p.active);
  return (
    <Frame resource={r}>
      <Typography variant="h6">Изменения PR / SR</Typography>
      {!r.data?.items.length && <Typography>Начислений нет.</Typography>}
      {r.data?.items.map((a) => (
        <Stack key={a.id}>
          <Typography>
            {displayDateTime(a.appliedAt)} ·{' '}
            {(
              {
                APPLIED: 'Начислено',
                REVERSED: 'Начисление отменено',
                FAILED: 'Ошибка расчёта',
              } as Record<string, string>
            )[a.status] ?? a.status}
            {a.supersedesApplicationId && ` · Пересчёт начисления №${a.supersedesApplicationId}`}
          </Typography>
          <Button component={Link} to={`?section=results&resultId=${a.source.id}`}>
            Источник: результат {a.source.id}, версия {a.source.version}
          </Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Пилот</TableCell>
                <TableCell>PR: до / изменение / после</TableCell>
                <TableCell>SR: до / изменение / после</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {a.changes.map((c) => (
                <TableRow key={c.participantId}>
                  <TableCell>
                    <Link to={`?section=participants&participantId=${c.participantId}`}>
                      {r.data?.identities.find((i) => i.participantId === c.participantId)
                        ?.displayName ?? c.participantId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {c.pilot
                      ? `${c.pilot.before} / ${c.pilot.delta} / ${c.pilot.after}`
                      : 'Не рассчитывался'}
                  </TableCell>
                  <TableCell>
                    {c.safety
                      ? `${c.safety.before} / ${c.safety.delta} / ${c.safety.after}`
                      : 'Не рассчитывался'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      ))}
      <More resource={r} />
    </Frame>
  );
}
function StateHistory(p: Props) {
  const r = useWorkspaceData<
    Page<{
      id: string;
      fromStatus: string | null;
      toStatus: string;
      reason: string;
      effectiveAt: string;
      observedAt: string;
    }>
  >(path(p.eventId, 'history'), p.active);
  const states: Record<string, string> = {
    DRAFT: 'Черновик',
    PUBLISHED: 'Опубликовано',
    RUNNING: 'Началось',
    COMPLETED: 'Завершено',
    CANCELLED: 'Отменено',
    FAILED: 'Не состоялось',
  };
  return (
    <Frame resource={r}>
      <Typography variant="h6">Переходы состояния события</Typography>
      {r.data?.items.map((x) => (
        <Stack key={x.id}>
          <Typography>
            {displayDateTime(x.effectiveAt)} · {states[x.toStatus]}
          </Typography>
          <Typography color="text.secondary">{x.reason}</Typography>
          <Details value={x} />
        </Stack>
      ))}
      <More resource={r} />
    </Frame>
  );
}
function History(p: Props) {
  const [q, setQ] = useSearchParams(),
    tab = q.get('source') ?? 'states';
  const [visited, setVisited] = useState(new Set([tab]));
  const tabs = [
    ['states', 'Состояния'],
    ['audit', 'Действия'],
    ['runtime', 'Серверы'],
    ['game', 'Игровой журнал'],
    ['reports', 'Судейство'],
    ['chat', 'Чат'],
    ['notifications', 'Уведомления'],
  ];
  return (
    <Stack spacing={2}>
      <Stack direction="row" gap={0.5} flexWrap="wrap">
        {tabs.map(([id, label]) => (
          <Button
            key={id}
            size="small"
            disableElevation
            variant={tab === id ? 'contained' : 'text'}
            onClick={() => {
              setVisited((old) => new Set([...old, id]));
              setQ((old) => {
                const next = new URLSearchParams(old);
                next.set('source', id);
                return next;
              });
            }}
          >
            {label}
          </Button>
        ))}
      </Stack>
      {tabs
        .filter(([id]) => visited.has(id) || id === tab)
        .map(([id]) => (
          <Box key={id} hidden={id !== tab}>
            {id === 'states' ? (
              <StateHistory {...p} active={p.active && tab === id} />
            ) : id === 'runtime' ? (
              <RuntimeHistory {...p} active={p.active && tab === id} />
            ) : id === 'audit' ? (
              <AuditPage eventId={p.eventId} active={p.active && tab === id} />
            ) : id === 'game' ? (
              <GameJournal eventId={p.eventId} active={p.active && tab === id} />
            ) : id === 'reports' ? (
              <OfficiatingPage initialEventId={p.eventId} visible={p.active && tab === id} />
            ) : id === 'chat' ? (
              <ChatsPage eventId={p.eventId} active={p.active && tab === id} />
            ) : (
              <Notifications {...p} active={p.active && tab === id} />
            )}
          </Box>
        ))}
    </Stack>
  );
}
function Notifications(p: Props) {
  const r = useWorkspaceData<
    Page<{
      id: string;
      recipientId: string;
      title: string;
      body: string;
      status: string;
      createdAt: string;
      readAt: string | null;
      dismissedAt: string | null;
    }>
  >(path(p.eventId, 'notifications'), p.active);
  return (
    <Frame resource={r}>
      <Typography color="text.secondary">
        Показаны сохранённые уведомления во входящих. Отдельного подтверждения доставки нет.
      </Typography>
      {!r.data?.items.length && <Typography>Связанных уведомлений нет.</Typography>}
      {r.data?.items.map((x) => (
        <Stack key={x.id}>
          <Typography variant="h6">{x.title}</Typography>
          <Typography>{x.body}</Typography>
          <Typography>
            Получатель:{' '}
            <Link to={`/users?userId=${x.recipientId}&eventId=${p.eventId}`}>{x.recipientId}</Link>{' '}
            · Создано: {displayDateTime(x.createdAt)} ·{' '}
            {x.dismissedAt
              ? `Скрыто ${displayDateTime(x.dismissedAt)}`
              : x.readAt
                ? `Прочитано ${displayDateTime(x.readAt)}`
                : 'Не прочитано'}
          </Typography>
        </Stack>
      ))}
      <More resource={r} />
    </Frame>
  );
}
