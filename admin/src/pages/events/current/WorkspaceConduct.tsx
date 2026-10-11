import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useWorkspaceData } from './workspace-data';
import type { Workspace } from './event-api';
import { WorkspaceAction } from './EventWorkspacePage';
import { WorkspaceConditions } from './WorkspaceConditions';
import {
  Details,
  Frame,
  More,
  workspacePath,
  type WorkspaceProps,
  type PageData,
} from './workspace-ui';
import { LocalDateTimeField } from '../../../features/event-authoring/LocalDateTimeField';
import { displayDateTime } from '../../../../../shared/presentation';
import type { ProgressView } from '../../../../../shared/event-status';
type Stage = Workspace['state']['blocks'][number] & {
  id: string;
  type: string;
  resultIds: string[];
};
type Schedule = PageData<Stage> & {
  registrations: {
    key: string;
    config: { opensAt: string; closesAt: string; withdrawalClosesAt: string };
    displayStatus: { label: string };
  }[];
  dependencies: unknown;
};
export function WorkspaceConduct(p: WorkspaceProps) {
  const [q, setQ] = useSearchParams(),
    r = useWorkspaceData<Schedule>(workspacePath(p.eventId, 'schedule'), p.active);
  const selected = q.get('stage') ?? (p.summary.counts.stages === 1 ? r.data?.items[0]?.key : null);
  const select = (key: string | null) =>
    setQ((old) => {
      const next = new URLSearchParams(old);
      if (key) next.set('stage', key);
      else next.delete('stage');
      return next;
    });
  return (
    <Frame resource={r}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: p.summary.counts.stages > 1 ? 'minmax(200px,1fr) minmax(0,2.7fr)' : '1fr',
          },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {p.summary.counts.stages > 1 && (
          <Stack
            component="nav"
            aria-label="Этапы события"
            spacing={0.5}
            sx={{
              display: { xs: selected ? 'none' : 'flex', lg: 'flex' },
              maxHeight: { lg: 'calc(100vh - 320px)' },
              overflowY: { lg: 'auto' },
              pr: { lg: 1 },
            }}
          >
            <Typography variant="overline" color="text.secondary">
              Программа
            </Typography>
            {r.data?.items.map((stage) => (
              <Button
                key={stage.key}
                onClick={() => select(stage.key)}
                aria-pressed={stage.key === selected}
                sx={{
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: stage.key === selected ? 'action.selected' : 'transparent',
                  color: 'text.primary',
                }}
              >
                <Stack>
                  <Typography fontWeight={stage.key === selected ? 700 : 500}>
                    {stage.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {displayDateTime(stage.plannedStartsAt)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stage.displayStatus.label}
                  </Typography>
                </Stack>
              </Button>
            ))}
            <More resource={r} />
          </Stack>
        )}
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          {selected ? (
            <>
              <Button
                sx={{
                  display: { xs: p.summary.counts.stages > 1 ? 'inline-flex' : 'none', lg: 'none' },
                  alignSelf: 'flex-start',
                }}
                onClick={() => select(null)}
              >
                ← Все этапы
              </Button>
              <StageDetail key={selected} {...p} stageKey={selected} />
            </>
          ) : (
            <Typography color="text.secondary">
              {r.data?.items.length
                ? 'Выберите этап, чтобы увидеть условия и исполнение.'
                : 'Этапов пока нет.'}
            </Typography>
          )}
          {!!r.data?.registrations.length && (
            <Box component="details">
              <Typography component="summary">Окна регистрации</Typography>
              <Stack spacing={2}>
                {r.data.registrations.map((reg) => (
                  <Stack key={reg.key}>
                    <Typography fontWeight={600}>{reg.displayStatus.label}</Typography>
                    <Typography variant="body2">
                      Приём заявок: {displayDateTime(reg.config.opensAt)} —{' '}
                      {displayDateTime(reg.config.closesAt)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Снятие до {displayDateTime(reg.config.withdrawalClosesAt)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
          <Details value={r.data?.dependencies} />
        </Stack>
      </Box>
    </Frame>
  );
}
function StageDetail(p: WorkspaceProps & { stageKey: string }) {
  const r = useWorkspaceData<Schedule>(
      workspacePath(p.eventId, 'schedule') + `?stageKey=${encodeURIComponent(p.stageKey)}`,
      p.active,
    ),
    stage = r.data?.items[0];
  const [editing, setEditing] = useState(false),
    [date, setDate] = useState('');
  return (
    <Frame resource={r}>
      {stage && (
        <>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={2}
            flexWrap="wrap"
          >
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="h6">{stage.title}</Typography>
              <Chip size="small" label={stage.displayStatus.label} variant="outlined" />
            </Stack>
            <WorkspaceAction
              action={p.summary.actions.find((a) => a.code === 'reschedule')}
              disabled={p.busy}
              onClick={() => {
                setDate(stage.plannedStartsAt);
                setEditing(true);
              }}
            >
              Перенести
            </WorkspaceAction>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' },
              gap: 2,
            }}
          >
            {[
              ['По плану', stage.plannedStartsAt],
              ['Началось', stage.startedAt],
              ['Завершилось', stage.finishedAt],
            ].map(([label, date]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2">
                  {date ? displayDateTime(date) : 'Не зафиксировано'}
                </Typography>
              </Box>
            ))}
          </Box>
          <WorkspaceConditions eventId={p.eventId} stageKey={stage.key} active={p.active} />
          {!!stage.progress.length && (
            <Box>
              <Typography fontWeight={600} sx={{ mb: 1 }}>
                Ход этапа
              </Typography>
              <StageProgress nodes={stage.progress} eventId={p.eventId} />
            </Box>
          )}
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {stage.sessions
              .filter((session) => !progressSessions(stage.progress).has(session.id))
              .map((session) => (
                <Button
                  key={session.id}
                  component={Link}
                  to={`/runtime?sessionId=${session.id}&eventId=${p.eventId}`}
                >
                  Запуск №{session.id} · {session.displayStatus.label} ↗
                </Button>
              ))}
            {stage.resultIds.map((id) => (
              <Button key={id} component={Link} to={`?section=results&resultId=${id}`}>
                Результат этапа ↗
              </Button>
            ))}
          </Stack>
          {stage.type === 'TIME_ATTACK' && (
            <Attempts eventId={p.eventId} blockId={stage.id} active={p.active} />
          )}
          <Dialog
            open={editing}
            onClose={() => !p.busy && setEditing(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Перенести «{stage.title}»</DialogTitle>
            <DialogContent sx={{ pt: '16px !important' }}>
              <LocalDateTimeField label="Новое начало" value={date} onChange={setDate} />
            </DialogContent>
            <DialogActions>
              <Button disabled={p.busy} onClick={() => setEditing(false)}>
                Назад
              </Button>
              <WorkspaceAction
                action={p.summary.actions.find((a) => a.code === 'reschedule')}
                disabled={p.busy || !date}
                onClick={() =>
                  void p
                    .execute('/reschedule', {
                      expectedVersion: p.summary.version,
                      changes: [{ target: { type: 'block', blockKey: stage.key }, startsAt: date }],
                    })
                    .then((ok) => {
                      if (ok) {
                        setEditing(false);
                        void r.load();
                      }
                    })
                }
              >
                Перенести
              </WorkspaceAction>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Frame>
  );
}
function Attempts({
  eventId,
  blockId,
  active,
}: {
  eventId: string;
  blockId: string;
  active: boolean;
}) {
  const [open, setOpen] = useState(false),
    r = useWorkspaceData<PageData<ProgressView & { id: string }>>(
      workspacePath(eventId, 'attempts') + `?blockId=${blockId}`,
      active && open,
    );
  return (
    <Box component="details" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <Typography component="summary">Попытки</Typography>
      <Frame resource={r}>
        {!r.data?.items.length && <Typography>Попыток пока нет.</Typography>}
        <StageProgress nodes={r.data?.items ?? []} eventId={eventId} />
        <More resource={r} />
      </Frame>
    </Box>
  );
}

function progressSessions(nodes: ProgressView[]): Set<string> {
  return new Set(
    nodes.flatMap((node) => [
      ...(node.runtimeSessionId ? [node.runtimeSessionId] : []),
      ...progressSessions(node.children),
    ]),
  );
}
function StageProgress({
  nodes,
  eventId,
  parentSession,
}: {
  nodes: ProgressView[];
  eventId: string;
  parentSession?: string | null;
}) {
  return (
    <Stack spacing={1}>
      {nodes.map((node) => {
        const title = (
          <>
            <Typography component="span" variant="body2" fontWeight={600}>
              {node.title}
            </Typography>
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
              {node.displayStatus.label}
            </Typography>
          </>
        );
        const context = (
          <Stack spacing={0.75} sx={{ py: 1 }}>
            {!!node.participants.length && (
              <Stack direction="row" gap={1} flexWrap="wrap">
                {node.participants.map((person) => (
                  <Typography key={person.participantId} variant="body2">
                    <Link to={`?section=participants&participantId=${person.participantId}`}>
                      {person.displayName}
                    </Link>
                  </Typography>
                ))}
              </Stack>
            )}
            {node.displayStatus.reason && (
              <Typography variant="body2" color="text.secondary">
                {node.displayStatus.reason.message}
              </Typography>
            )}
            {node.runtimeSessionId && node.runtimeSessionId !== parentSession && (
              <Button
                sx={{ alignSelf: 'flex-start', p: 0 }}
                component={Link}
                to={`/runtime?sessionId=${node.runtimeSessionId}&eventId=${eventId}`}
              >
                Запуск №{node.runtimeSessionId} ↗
              </Button>
            )}
          </Stack>
        );
        return (
          <Box key={node.key} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1 }}>
            {node.children.length ? (
              <Box component="details">
                <Box component="summary">{title}</Box>
                {context}
                <Box sx={{ pl: 2 }}>
                  <StageProgress
                    nodes={node.children}
                    eventId={eventId}
                    parentSession={node.runtimeSessionId ?? parentSession}
                  />
                </Box>
              </Box>
            ) : (
              <>
                <Box>{title}</Box>
                {context}
              </>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
