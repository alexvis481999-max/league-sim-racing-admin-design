import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  Typography,
} from '@mui/material';
import { Frame, More, workspacePath, type WorkspaceProps, type PageData } from './workspace-ui';
import { useWorkspaceData } from './workspace-data';
import { WorkspaceAction } from './EventWorkspacePage';
import { RosterFields } from './RosterFields';
import type { Action } from './event-api';
import { displayDateTime } from '../../../../../shared/presentation';
import { getApiBaseUrl } from '../../../shared/api';
type Item = { title: string | null; imageUrl: string | null };
type Entry = {
  id: string;
  registrationKey: string;
  participantId: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  withdrawnAt: string | null;
  removedAt: string | null;
  identity: { displayName: string } | null;
  car: Item | null;
  skin: Item | null;
  selection: unknown;
  reviews: { decidedAt: string; decision: string; reason?: string }[];
  actions: Action[];
};
const labels: Record<string, string> = {
  PENDING: 'На рассмотрении',
  ACCEPTED: 'Допущен',
  REJECTED: 'Отказано',
  WITHDRAWN: 'Снялся',
  REMOVED: 'Снят администратором',
  EXPIRED: 'Истекла',
};
function Picture({ item }: { item: Item | null }) {
  return item ? (
    <Stack direction="row" gap={1} alignItems="center">
      {item.imageUrl && (
        <Box
          component="img"
          src={new URL(item.imageUrl, getApiBaseUrl()).href}
          alt=""
          loading="lazy"
          sx={{ width: 80, height: 50, objectFit: 'contain' }}
        />
      )}
      <Typography variant="body2">{item.title ?? 'Название не сохранено'}</Typography>
    </Stack>
  ) : null;
}
export function WorkspaceParticipants(p: WorkspaceProps) {
  const [q, setQ] = useSearchParams(),
    participant = q.get('participantId'),
    [selectedTab, setTab] = useState(p.summary.activity.hasRegistration ? 'applications' : 'attendance');
  const tab = p.summary.activity.hasRegistration ? selectedTab : 'attendance';
  const r = useWorkspaceData<
    PageData<Entry> & {
      registrations: {
        id: string;
        key: string;
        displayStatus: { label: string };
        actions: Action[];
      }[];
    }
  >(
    workspacePath(p.eventId, 'participants') +
      (participant ? `?participantId=${encodeURIComponent(participant)}` : ''),
    p.active && tab === 'applications',
  );
  const selected = q.get('entryId');
  const setSelected = (id: string | null) =>
    setQ((old) => {
      const next = new URLSearchParams(old);
      if (id) next.set('entryId', id);
      else next.delete('entryId');
      return next;
    });
  const [adding, setAdding] = useState(false),
    [userId, setUser] = useState(''),
    [carId, setCar] = useState(''),
    [skinId, setSkin] = useState('');
  const entry = r.data?.items.find((e) => e.id === selected);
  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" gap={2} flexWrap="wrap">
        <Stack direction="row" gap={1}>
          {p.summary.activity.hasRegistration && (
            <Button
              variant={tab === 'applications' ? 'contained' : 'text'}
              disableElevation
              onClick={() => setTab('applications')}
            >
              Заявки
            </Button>
          )}
          <Button
            variant={tab === 'attendance' ? 'contained' : 'text'}
            disableElevation
            onClick={() => setTab('attendance')}
          >
            Фактическое участие
          </Button>
        </Stack>
        {tab === 'applications' &&
          r.data?.registrations.some((reg) =>
            reg.actions.some((a) => a.code === 'add' && a.enabled),
          ) && <Button onClick={() => setAdding(true)}>Добавить пилота</Button>}
      </Stack>
      {participant && (
        <Button
          sx={{ alignSelf: 'flex-start' }}
          onClick={() =>
            setQ((old) => {
              const next = new URLSearchParams(old);
              next.delete('participantId');
              return next;
            })
          }
        >
          Все участники
        </Button>
      )}
      <Box hidden={tab !== 'attendance'}>
        <Attendance {...p} active={p.active && tab === 'attendance'} />
      </Box>
      <Box hidden={tab !== 'applications'}>
        <Frame resource={r}>
          {!r.data?.items.length ? (
            <Typography>Заявок нет.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Пилот</TableCell>
                    <TableCell>Статус заявки</TableCell>
                    <TableCell>Машина / скин</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Подана</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {r.data?.items.map((e) => (
                    <TableRow key={e.id} hover>
                      <TableCell>
                        <Button
                          sx={{ p: 0, textAlign: 'left', justifyContent: 'flex-start' }}
                          onClick={() => setSelected(e.id)}
                        >
                          {e.identity?.displayName ?? `Пилот ${e.participantId}`}
                        </Button>
                      </TableCell>
                      <TableCell>{labels[e.status]}</TableCell>
                      <TableCell>
                        {e.car?.title ?? 'Не выбрана'}
                        {e.skin && (
                          <Typography variant="caption" component="div" color="text.secondary">
                            {e.skin.title ?? 'Название скина не сохранено'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell
                        sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'table-cell' } }}
                      >
                        {displayDateTime(e.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          <More resource={r} />
        </Frame>
      </Box>
      <Dialog open={!!entry} onClose={() => !p.busy && setSelected(null)} fullWidth maxWidth="sm">
        {entry && (
          <EntryDetails
            key={entry.id}
            {...p}
            entry={entry}
            refresh={() => r.load()}
            close={() => setSelected(null)}
          />
        )}
      </Dialog>
      <Dialog open={adding} onClose={() => !p.busy && setAdding(false)} fullWidth maxWidth="sm">
        <DialogTitle>Добавить пилота в состав</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {adding && (
              <RosterFields
                userId={userId}
                carId={carId}
                skinId={skinId}
                setUser={setUser}
                setCar={setCar}
                setSkin={setSkin}
                disabled={p.busy}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={p.busy} onClick={() => setAdding(false)}>
            Назад
          </Button>
          {r.data?.registrations.map((reg) => (
            <WorkspaceAction
              key={reg.id}
              action={reg.actions.find((a) => a.code === 'add')}
              disabled={p.busy || !userId}
              onClick={() =>
                void p
                  .execute(`/registrations/${reg.key}/roster`, {
                    expectedVersion: p.summary.version,
                    userId,
                    ...(carId ? { carId } : {}),
                    ...(skinId ? { skinId } : {}),
                  })
                  .then((ok) => {
                    if (ok) {
                      setAdding(false);
                      void r.load();
                    }
                  })
              }
            >
              Добавить · {reg.displayStatus.label}
            </WorkspaceAction>
          ))}
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
function EntryDetails(
  p: WorkspaceProps & { entry: Entry; refresh: () => Promise<void>; close: () => void },
) {
  const e = p.entry,
    [operation, setOperation] = useState<'REJECTED' | 'remove' | null>(null),
    [reason, setReason] = useState('');
  const act = (decision: 'ACCEPTED' | 'REJECTED' | 'remove') =>
    p
      .execute(
        `/registrations/${e.registrationKey}/entries/${e.id}/${decision === 'remove' ? 'remove' : 'review'}`,
        {
          expectedVersion: p.summary.version,
          ...(decision === 'remove' ? {} : { decision }),
          ...(decision === 'ACCEPTED' ? {} : { reason }),
        },
      )
      .then((ok) => {
        if (ok) {
          setOperation(null);
          setReason('');
          void p.refresh();
        }
      });
  return (
    <>
      <DialogTitle>{e.identity?.displayName ?? `Пилот ${e.participantId}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>
            {labels[e.status]} · заявка №{e.id}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Подана {displayDateTime(e.createdAt)}
          </Typography>
          <Picture item={e.car} />
          <Picture item={e.skin} />
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button component={Link} to={`/users?userId=${e.participantId}&eventId=${p.eventId}`}>
              Профиль ↗
            </Button>
            <Button
              component={Link}
              to={`?section=execution&view=presence&participantId=${e.participantId}`}
              onClick={p.close}
            >
              Подключения
            </Button>
            <Button
              component={Link}
              to={`?section=results&participantId=${e.participantId}`}
              onClick={p.close}
            >
              Результаты и рейтинг
            </Button>
          </Stack>
          <Box>
            <Typography fontWeight={600}>История заявки</Typography>
            {e.reviews.length ? (
              e.reviews.map((review, index) => (
                <Typography variant="body2" key={index}>
                  {displayDateTime(review.decidedAt)} · {labels[review.decision] ?? review.decision}{' '}
                  · {review.reason}
                </Typography>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                Решений администратора нет.
              </Typography>
            )}
            {e.withdrawnAt && <Typography>Снялся {displayDateTime(e.withdrawnAt)}</Typography>}
            {e.removedAt && <Typography>Снят {displayDateTime(e.removedAt)}</Typography>}
          </Box>
          {operation && (
            <TextField
              autoFocus
              label={operation === 'remove' ? 'Причина снятия' : 'Причина отказа'}
              multiline
              minRows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap' }}>
        <Button disabled={p.busy} onClick={p.close}>
          Закрыть
        </Button>
        {operation ? (
          <>
            <Button disabled={p.busy} onClick={() => setOperation(null)}>
              Назад
            </Button>
            <WorkspaceAction
              action={e.actions.find(
                (a) => a.code === (operation === 'remove' ? 'remove' : 'review'),
              )}
              disabled={p.busy || !reason.trim()}
              onClick={() => void act(operation)}
            >
              {operation === 'remove' ? 'Снять пилота' : 'Отклонить заявку'}
            </WorkspaceAction>
          </>
        ) : (
          <>
            {e.status === 'PENDING' && (
              <>
                <WorkspaceAction
                  action={e.actions.find((a) => a.code === 'review')}
                  disabled={p.busy}
                  onClick={() => setOperation('REJECTED')}
                >
                  Отклонить
                </WorkspaceAction>
                <WorkspaceAction
                  primary
                  action={e.actions.find((a) => a.code === 'review')}
                  disabled={p.busy}
                  onClick={() => void act('ACCEPTED')}
                >
                  Принять
                </WorkspaceAction>
              </>
            )}
            {e.status === 'ACCEPTED' && (
              <WorkspaceAction
                action={e.actions.find((a) => a.code === 'remove')}
                disabled={p.busy}
                onClick={() => setOperation('remove')}
              >
                Снять
              </WorkspaceAction>
            )}
          </>
        )}
      </DialogActions>
    </>
  );
}
function Attendance(p: WorkspaceProps) {
  const [q] = useSearchParams(),
    participant = q.get('participantId');
  const r = useWorkspaceData<
    PageData<{
      id: string;
      participantId: string;
      identity: { displayName: string } | null;
      stages: { key: string; title: string }[];
    }>
  >(
    workspacePath(p.eventId, 'attendance') +
      (participant ? `?participantId=${encodeURIComponent(participant)}` : ''),
    p.active,
  );
  return (
    <Frame resource={r}>
      <Typography variant="body2" color="text.secondary">
        Участие, зафиксированное этапами события. Подключения к серверу доступны отдельно.
      </Typography>
      {!r.data?.items.length ? (
        <Typography>Фактическое участие пока не зафиксировано.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Пилот</TableCell>
              <TableCell>Этапы</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {r.data?.items.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link to={`/users?userId=${e.participantId}&eventId=${p.eventId}`}>
                    {e.identity?.displayName ?? `Пилот ${e.participantId}`}
                  </Link>
                </TableCell>
                <TableCell>
                  {e.stages.map((stage) => (
                    <Typography variant="body2" key={stage.key}>
                      <Link to={`?section=execution&stage=${encodeURIComponent(stage.key)}`}>
                        {stage.title}
                      </Link>
                    </Typography>
                  ))}
                </TableCell>
                <TableCell>
                  <Link to={`?section=execution&view=presence&participantId=${e.participantId}`}>
                    Подключения
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <More resource={r} />
    </Frame>
  );
}
