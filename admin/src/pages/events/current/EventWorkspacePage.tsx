import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BackAction } from '../../../shared/ui';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Skeleton,
} from '@mui/material';
import { ApiError, apiFetch } from '../../../shared/api';
import { ScenarioBuilder } from '../../../features/event-authoring/ScenarioBuilder';
import { command, type Action, type Settings } from './event-api';
import { useWorkspaceData, type WorkspaceSummary } from './workspace-data';
import { WorkspaceSection } from './WorkspaceSections';
import { WorkspaceMaterials } from './WorkspaceOverview';
import { WorkspaceOverview } from './WorkspaceOperationalOverview';

const sections = [
  ['overview', 'Обзор'],
  ['execution', 'Проведение'],
  ['participants', 'Участники'],
  ['results', 'Результаты'],
  ['materials', 'Материалы'],
  ['history', 'История'],
];
export function EventWorkspacePage() {
  const { eventId = '' } = useParams();
  return <Content key={eventId} eventId={eventId} />;
}
function Content({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useSearchParams(),
    section = sections.some(([key]) => key === query.get('section'))
      ? query.get('section')!
      : 'overview';
  const resource = useWorkspaceData<WorkspaceSummary>(`/admin/events/${eventId}/workspace`),
    data = resource.data?.eventId === eventId ? resource.data : null;
  const [visited, setVisited] = useState(new Set([section]));
  useEffect(() => {
    setVisited((old) => (old.has(section) ? old : new Set([...old, section])));
  }, [section]);
  const [editor, setEditor] = useState<{
    settings: Settings | null;
    description: string;
    version: string;
  } | null>(null);
  const [menu, setMenu] = useState<HTMLElement | null>(null),
    [cancel, setCancel] = useState(false),
    [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const running = useRef(false),
    keys = useRef(new Map<string, string>());
  const [pending, setPending] = useState<{ path: string; body: object; method: string } | null>(
    null,
  );
  const choose = (value: string) => {
    setVisited((old) => new Set([...old, value]));
    setQuery((old) => {
      const next = new URLSearchParams(old);
      next.set('section', value);
      return next;
    });
  };
  async function execute(path: string, body: object, method = 'POST') {
    if (running.current) return false;
    const identity = JSON.stringify({ path, body, method });
    if (pending && JSON.stringify(pending) !== identity) return false;
    const key = keys.current.get(identity) ?? crypto.randomUUID();
    keys.current.set(identity, key);
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await command(`/admin/events/${eventId}${path}`, body, key, method);
      keys.current.delete(identity);
      setPending(null);
      if (method === 'PATCH') setEditor(null);
      await resource.load();
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        keys.current.delete(identity);
        setPending(null);
      } else setPending({ path, body, method });
      setError(e instanceof Error ? e.message : 'Не удалось выполнить действие');
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function edit() {
    if (!data || running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const form = await apiFetch<{
        settings: Settings | null;
        description: string | null;
        version: string;
      }>(`/admin/events/${eventId}/workspace/edit`);
      setEditor({ ...form, description: form.description ?? '' });
    } catch (e) {
      setError(String(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  if (!data) return resource.error?<Alert severity="error">{resource.error}</Alert>:<Stack spacing={2} aria-label="Загрузка события"><Skeleton width="55%" height={48}/><Skeleton width="75%" height={30}/><Skeleton variant="rounded" height={48}/><Skeleton variant="rounded" height={240}/></Stack>;
  const action = (code: string) => data.actions.find((a) => a.code === code);
  const terminal = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(data.event.status),
    blocked = busy || !!pending;
  return (
    <Stack
      spacing={2.5}
      sx={{
        minWidth: 0,
        '& a': { color: 'primary.main', textDecoration: 'none' },
        '& a:hover': { textDecoration: 'underline' },
        '& summary': { cursor: 'pointer', py: 1 },
        '& .MuiTableCell-root': { verticalAlign: 'top' },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" className="admin-page-back">
        <BackAction label="К событиям" onClick={()=>navigate('/events')}/>
        <Typography variant="body2" color="text.secondary">
          №{eventId}
          {editor ? ' / Редактирование' : ''}
        </Typography>
      </Stack>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        gap={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
            <Typography
              component="h1"
              sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 750, overflowWrap: 'anywhere' }}
            >
              {data.event.title}
            </Typography>
            <Chip size="small" variant="outlined" label={data.event.displayStatus.label} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {data.metadata.organizer?.name ?? 'Организатор не сохранён'} ·{' '}
            {data.event.gameCode === 'assetto_corsa' ? 'Assetto Corsa' : data.event.gameCode} ·{' '}
            {data.event.scenarioTitle}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ flexShrink: 0 }}>
          {editor ? (
            <Button disabled={busy} onClick={() => setEditor(null)}>
              Закрыть редактор
            </Button>
          ) : (
            <>
              {data.event.status === 'DRAFT' ? (
                <WorkspaceAction
                  primary
                  action={action('publish')}
                  disabled={blocked}
                  onClick={() => void execute('/publish', {})}
                >
                  Опубликовать
                </WorkspaceAction>
              ) : (
                !terminal && (
                  <WorkspaceAction
                    primary
                    action={action('edit')}
                    disabled={blocked}
                    onClick={() => void edit()}
                  >
                    Редактировать
                  </WorkspaceAction>
                )
              )}
              <Button component={Link} to={`/events/new?clone=${eventId}`} disabled={blocked || !action('copy')?.enabled}>
                Копировать событие
              </Button>
              <Button disabled={resource.busy} onClick={() => void resource.load()}>Обновить</Button>
              {!terminal && <Button aria-label="Другие действия" onClick={(e) => setMenu(e.currentTarget)}>Ещё ⋯</Button>}
            </>
          )}
        </Stack>
      </Stack>
      {data.event.displayStatus.reason && (
        <Alert severity={data.event.displayStatus.freshness === 'UNCERTAIN' ? 'warning' : 'info'}>
          {data.event.displayStatus.reason.message}
        </Alert>
      )}
      {(error || resource.error) && <Alert severity="error">{error || resource.error}</Alert>}
      {pending && (
        <Alert severity="warning">
          Ответ на команду не получен.{' '}
          <Button
            disabled={busy}
            onClick={() => void execute(pending.path, pending.body, pending.method)}
          >
            Повторить незавершённый запрос
          </Button>
        </Alert>
      )}
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        {data.event.status === 'DRAFT' && (
          <MenuItem
            disabled={blocked || !action('edit')?.enabled}
            onClick={() => {
              setMenu(null);
              void edit();
            }}
          >
            Редактировать
          </MenuItem>
        )}
        {!terminal && (
          <MenuItem
            disabled={blocked || !action('cancel')?.enabled}
            onClick={() => {
              setMenu(null);
              setCancel(true);
            }}
          >
            Отменить событие
          </MenuItem>
        )}
      </Menu>
      <Dialog open={cancel} onClose={() => !busy && setCancel(false)} fullWidth maxWidth="sm">
        <DialogTitle>Отменить «{data.event.title}»</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            multiline
            minRows={3}
            label="Причина отмены"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setCancel(false)}>
            Назад
          </Button>
          <WorkspaceAction
            action={action('cancel')}
            disabled={blocked || !cancelReason.trim()}
            onClick={() =>
              void execute('/cancel', { expectedVersion: data.version, reason: cancelReason }).then(
                (ok) => {
                  if (ok) setCancel(false);
                },
              )
            }
          >
            Отменить событие
          </WorkspaceAction>
        </DialogActions>
      </Dialog>
      {editor && (
        <Stack spacing={2}>
          {editor.version !== data.version && (
            <Alert severity="warning">
              Событие изменилось. Ваши правки сохранены в форме; сверяйте их с актуальной версией
              перед сохранением.
            </Alert>
          )}
          {editor.settings &&
          (editor.settings.authoring as Settings | undefined)?.editorVersion === 2 ? (
            <ScenarioBuilder
              descriptionOnly={!data.editableFields.includes('settings')}
              initialDocument={{
                contractVersion: 1,
                scenarioCode: data.event.scenarioCode,
                settings: editor.settings,
                pendingImages: [],
              }}
              edit={{ eventId, expectedVersion: editor.version }}
              onEdited={() => {
                setEditor(null);
                void resource.load();
              }}
            />
          ) : (
            <>
              <TextField
                label="Описание"
                multiline
                minRows={5}
                value={editor.description}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
              />
              <WorkspaceAction
                primary
                action={action('edit')}
                disabled={blocked}
                onClick={() =>
                  void execute(
                    '',
                    { expectedVersion: editor.version, patch: { description: editor.description } },
                    'PATCH',
                  )
                }
              >
                Сохранить описание
              </WorkspaceAction>
            </>
          )}
        </Stack>
      )}
      <Box hidden={!!editor}>
        <Tabs
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            mb: 3,
            '& .MuiTab-root': { minHeight: 44, minWidth: 0, px: 2 },
          }}
          value={section}
          variant="scrollable"
          onChange={(_, value) => choose(value)}
          aria-label="Разделы события"
        >
          {sections.map(([value, label]) => (
            <Tab key={value} value={value} label={label} />
          ))}
        </Tabs>
        <Box hidden={section !== 'overview'}>
          <WorkspaceOverview data={data} choose={choose} />
        </Box>
        {(visited.has('materials') || section === 'materials') && (
          <Box hidden={section !== 'materials'}>
            <WorkspaceMaterials data={data} />
          </Box>
        )}
        {sections
          .filter(
            ([key]) =>
              !['overview', 'materials'].includes(key) && (visited.has(key) || key === section),
          )
          .map(([key]) => (
            <Box key={key} hidden={section !== key}>
              <WorkspaceSection
                section={key}
                eventId={eventId}
                active={section === key && !editor}
                summary={data}
                busy={blocked}
                execute={execute}
              />
            </Box>
          ))}
      </Box>
    </Stack>
  );
}

export function WorkspaceAction({
  action,
  disabled,
  onClick,
  children,
  primary = false,
}: {
  primary?: boolean;
  action: Action | undefined;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={action?.reason?.message ?? ''}>
      <span>
        <Button
          variant={primary ? 'contained' : 'text'}
          disableElevation
          disabled={disabled || !action?.enabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </span>
    </Tooltip>
  );
}
