import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { ActionButton, Button, Dialog, Notice, StatusBadge, TextArea, clock, eventTone, shortDateTime } from '../../../ui/v16';
import { htmlToText } from '../current/event-labels';
import { action, useWorkspace } from './context';
import type { PendingCommand } from './useEventCommands';

/** Title, server status and the event-level commands allowed by WorkspaceSummary.actions. */
export function EventHeader({ primary, editLabel, onEdit, commands }: { primary?: ReactNode; editLabel: string; onEdit: () => void; commands: { error: string; pending: PendingCommand | null; busy: boolean; retry: () => void; dismissError: () => void } }) {
  const { summary, execute, blocked, reload, eventId, timezone } = useWorkspace();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const event = summary.event;
  const terminal = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(event.status);
  const description = htmlToText(event.description) || event.presentation?.subtitle || '';
  const site = String(import.meta.env.VITE_SITE_URL ?? '').replace(/\/$/, '');
  const copy = action(summary, 'copy'), cancel = action(summary, 'cancel');
  return (
    <>
      <div className="lsr-pagetop">
        <div className="lsr-pagetop-main">
          <h1 className="lsr-page-title">{event.title}</h1>
          {description && <p className="lsr-page-desc" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{description}</p>}
          <div className="lsr-hstack" style={{ marginTop: 12, gap: 9 }}>
            <StatusBadge status={event.displayStatus} tone={eventTone(event.displayStatus)} />
            {event.displayStatus.currentStage && <span className="lsr-muted">Сейчас: {event.displayStatus.currentStage.title}</span>}
            <span className="lsr-muted">Данные на {shortDateTime(summary.observedAt, timezone)} · версия {summary.version}</span>
          </div>
        </div>
        <div className="lsr-page-actions">
          {event.status === 'DRAFT' && (
            <ActionButton variant="primary" action={action(summary, 'publish')} disabled={blocked} onClick={() => void execute('/publish', {})}>Опубликовать</ActionButton>
          )}
          {primary}
          {!terminal && <ActionButton action={action(summary, 'edit')} disabled={blocked} onClick={onEdit}>{editLabel}</ActionButton>}
          <Button aria-label="Другие действия" aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}>⋯</Button>
        </div>
      </div>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem disabled={blocked || !copy?.enabled} title={copy?.reason?.message} onClick={() => { setMenu(null); navigate(`/events/new?clone=${eventId}`); }}>Копировать событие</MenuItem>
        <MenuItem onClick={() => { setMenu(null); void reload(); }}>Обновить данные</MenuItem>
        {event.status !== 'DRAFT' && site && <MenuItem component="a" href={`${site}/events/${eventId}`} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(null)}>Открыть на сайте ↗</MenuItem>}
        {!terminal && <MenuItem disabled={blocked || !cancel?.enabled} title={cancel?.reason?.message} sx={{ color: 'error.main' }} onClick={() => { setMenu(null); setCancelOpen(true); }}>Отменить событие…</MenuItem>}
      </Menu>
      <Dialog open={cancelOpen} onClose={() => !commands.busy && setCancelOpen(false)} title={`Отменить «${event.title}»`}
        description="Сервер остановит запущенные сессии. Если остановка ещё выполняется, событие перейдёт в отменённое после её завершения."
        actions={<>
          <Button disabled={commands.busy} onClick={() => setCancelOpen(false)}>Назад</Button>
          <ActionButton variant="danger-solid" action={cancel} disabled={blocked || !reason.trim()}
            onClick={() => void execute('/cancel', { expectedVersion: summary.version, reason }).then((ok) => { if (ok) setCancelOpen(false); })}>Отменить событие</ActionButton>
        </>}>
        <TextArea label="Причина отмены" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
      {(event.displayStatus.reason || summary.stop || commands.error || commands.pending) && <div className="lsr-stack is-tight" style={{ marginBottom: 16 }}>
        {event.displayStatus.reason && <Notice tone={event.displayStatus.freshness === 'UNCERTAIN' ? 'warning' : 'neutral'}>{event.displayStatus.reason.message}</Notice>}
        {summary.stop && <Notice tone="warning">Остановка запрошена {shortDateTime(summary.stop.requestedAt, timezone)}: {summary.stop.reason}</Notice>}
        {commands.error && <Notice tone="danger" actions={<Button size="sm" onClick={commands.dismissError}>Скрыть</Button>}>{commands.error}</Notice>}
        {commands.pending && (
          <Notice tone="warning" actions={<Button size="sm" disabled={commands.busy} onClick={commands.retry}>Повторить незавершённый запрос</Button>}>
            Ответ на команду не получен. Повтор отправит ту же команду с тем же ключом, другие действия недоступны до ответа.
          </Notice>
        )}
      </div>}
    </>
  );
}

/** Generic last-update footer used under event screens. */
export function ObservedFoot() {
  const { summary, timezone } = useWorkspace();
  return <p className="lsr-footnote">Время — в часовом поясе события ({timezone || 'не указан'}) · наблюдение {clock(summary.observedAt, timezone)}</p>;
}
