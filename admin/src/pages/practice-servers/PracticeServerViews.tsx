import {ListRecord} from '../../shared/ui';
import { Button, Chip, Typography, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Alert } from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { Link } from 'react-router-dom';
import { displayDateTime, displayRuntimeStatus } from '../../../../shared/presentation';
import { FixedTablePagination } from '../../shared/table';
import { practiceServerStatus, type Server, type Cycle } from './practice-types';

export function ServerPower({ server, locked, onCommand }: { server: Server; locked: boolean; onCommand(action: string): void }) {
  const stopping = server.currentCycle?.resourceState === 'STOPPING';
  const on = server.status === 'ACTIVE' || (!!server.currentCycle && server.status !== 'STOPPED');
  const action = on ? 'stop' : 'start';
  return <Button variant="contained" color={on ? 'success' : 'inherit'} startIcon={<PowerSettingsNewIcon />}
    aria-label={on ? 'Остановить сервер' : 'Запустить сервер'} aria-pressed={on}
    disabled={locked || stopping || !server.allowedActions[action]} onClick={() => onCommand(action)}>
    {stopping ? 'Останавливается…' : on ? 'Сервер включён' : 'Сервер выключен'}
  </Button>;
}

export function ServerStatus({ server }: { server: Server }) {
  const status = practiceServerStatus(server);
  return <Chip size="small" variant="outlined" label={status.label} color={status.color as 'default' | 'success' | 'warning' | 'error'} />;
}

export function ServerFacts({ server }: { server: Server }) {
  const c = server.config;
  return <dl className="practice-facts">
    <div><dt>Трасса</dt><dd>{c.game.track.code || 'Не выбрана'}{c.game.track.layoutCode && ` · ${c.game.track.layoutCode}`}</dd></div>
    <div><dt>Сессия</dt><dd>{c.sessionDurationMinutes} мин</dd></div>
    <div><dt>Мест</dt><dd>{c.practice.maxParticipants}</dd></div>
    <div><dt>Машин</dt><dd>{c.game.cars.allowedCarIds.length}</dd></div>
  </dl>;
}

export function ServerCard({ server, locked, onCommand }: { server: Server; locked: boolean; onCommand(action: string): void }) {
  return <ListRecord id={server.id} title={<span className="practice-card-heading">{server.config.title}<ServerStatus server={server}/></span>}
    to={`/practice-servers/${server.id}`} openLabel={`Открыть ${server.config.title}`}
    meta={`${server.config.gameCode==='assetto_corsa'?'Assetto Corsa':server.config.gameCode} · ${server.config.disciplineCode==='touge'?'Тоге':'Кольцевые гонки'}`}
    actions={<ServerPower server={server} locked={locked} onCommand={onCommand}/>}><ServerFacts server={server}/></ListRecord>;
}

export function ServerLive({ server, locked, onCommand }: { server: Server; locked: boolean; onCommand(action: string): void }) {
  const cycle = server.currentCycle;
  return <div className="practice-live">
    {server.config.description && <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{server.config.description}</Typography>}
    <ServerFacts server={server} />
    <div className="practice-live-heading"><Typography variant="h6">Текущая сессия</Typography><ServerStatus server={server} /></div>
    {cycle ? <>
      <dl className="practice-facts">
        <div><dt>Запуск</dt><dd>{cycle.startedAt ? displayDateTime(cycle.startedAt) : 'Ожидание запуска'}</dd></div>
        <div><dt>Состояние</dt><dd>{displayRuntimeStatus(cycle.resourceState ?? cycle.state)}</dd></div>
        <div><dt>Сессия</dt><dd>{cycle.runtimeSessionId ? `№${cycle.runtimeSessionId}` : 'Не назначена'}</dd></div>
        <div><dt>Автозапуск</dt><dd>{server.status === 'ACTIVE' ? 'Включён' : server.status === 'PAUSED' ? 'На паузе' : 'Выключен'}</dd></div>
      </dl>
      {cycle.connectionLostAt && <Alert severity="warning">Связь с сервером потеряна {displayDateTime(cycle.connectionLostAt)}. Состояние уточняется.</Alert>}
      {cycle.failure && <Alert severity="error">Ошибка сессии: {cycle.failure.code}</Alert>}
    </> : <Typography color="text.secondary">Сейчас нет активной сессии.</Typography>}
    {server.nextEligibleAt && <Typography color="text.secondary">Следующий запуск не раньше {displayDateTime(server.nextEligibleAt)}</Typography>}
    {!cycle && server.lastCycle?.failure && <Alert severity="warning">Последняя сессия: {server.lastCycle.failure.code}</Alert>}
    <div className="practice-live-actions">
      <Button disabled={locked || !server.allowedActions.pause} onClick={() => onCommand('pause')}>Пауза после сессии</Button>
      <Button disabled={locked || !server.allowedActions.restart} onClick={() => onCommand('restart')}>Перезапуск</Button>
      <Button component={Link} to={`/service-journal?practiceServerId=${server.id}`}>Журнал игры</Button>
    </div>
  </div>;
}

export function ServerHistory({ history, page, onPage }: { history: { items: Cycle[]; total: number } | null; page: number; onPage(page: number): void }) {
  if (!history) return <Typography color="text.secondary">Загрузка сессий…</Typography>;
  if (!history.total) return <Typography color="text.secondary">Сессий пока нет. Они появятся после первого запуска сервера.</Typography>;
  return <><TableContainer><Table size="small"><TableHead><TableRow>
    {['Сессия', 'Начало', 'Окончание', 'Состояние', 'Ошибка'].map(label => <TableCell key={label}>{label}</TableCell>)}
  </TableRow></TableHead><TableBody>{history.items.map(c => <TableRow key={c.executionId}>
    <TableCell>№{c.runtimeSessionId ?? c.executionId}</TableCell>
    <TableCell>{c.startedAt ? displayDateTime(c.startedAt) : '—'}</TableCell>
    <TableCell>{c.finishedAt ? displayDateTime(c.finishedAt) : '—'}</TableCell>
    <TableCell>{displayRuntimeStatus(c.state)}</TableCell><TableCell>{c.failure?.code ?? '—'}</TableCell>
  </TableRow>)}</TableBody></Table></TableContainer>
    <FixedTablePagination count={history.total} page={page - 1} rowsPerPage={20} onPageChange={p => onPage(p + 1)} />
  </>;
}
