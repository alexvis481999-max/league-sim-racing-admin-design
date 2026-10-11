import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { Value } from './event-api';
import {Link} from 'react-router-dom';
type Row = Record<string, Value>;
const row = (v: Value | undefined): Row =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const list = (v: Value | undefined): Row[] => (Array.isArray(v) ? v.map(row) : []);
const text = (v: Value | undefined) =>
  typeof v === 'string' || typeof v === 'number' ? String(v) : '—';
const time = (v: Value | undefined) =>
  typeof v === 'number'
    ? `${Math.floor(v / 60000)}:${((v % 60000) / 1000).toFixed(3).padStart(6, '0')}`
    : '—';
export function EventResultTable({ value,eventId }: { value: Value;eventId?:string }) {
  if (!value) return <Typography>Результат ещё не получен</Typography>;
  const payload = row(value),
    names = new Map(
      [
        ...list(payload.participants),
        ...list(payload.splits).flatMap((split) => list(split.participants)),
      ].map((p) => [text(p.participantId), text(p.displayName)]),
    );
  const name = (id: Value | undefined) => names.get(text(id)) ?? 'Пилот';
  const pilot=(id:Value|undefined,label:string)=>eventId&&typeof id==='string'?<Link to={`/events/${eventId}?section=participants&participantId=${encodeURIComponent(id)}`}>{label}</Link>:label;
  const groups =
    payload.type === 'RACE_CLASSIFICATION'
      ? list(payload.splits).map((split) => ({
          title: `Сплит ${text(split.splitIndex)}`,
          rows: list(split.classification).map((p) => [
            text(p.splitPosition ?? p.position),
            pilot(p.participantId,text(row(p.participant).displayName ?? name(p.participantId))),
            text(row(p.points).total),
            time(row(p.timing).bestLapMs),
          ]),
        }))
      : [
          {
            title: 'Классификация',
            rows: list(payload.rows).map((p) => [
              text(p.position),
              pilot(p.participantId,name(p.participantId)),
              text(p.points),
              time(p.bestAttemptMilliseconds),
            ]),
          },
        ];
  return (
    <Stack spacing={2}>
      {groups.map((group, index) => (
        <Box key={index} sx={{ overflowX: 'auto' }}>
          <Typography variant="subtitle1">{group.title}</Typography>
          {group.rows.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Место', 'Пилот', 'Очки', 'Лучшее время'].map((label) => (
                    <TableCell key={label}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {group.rows.map((cells, i) => (
                  <TableRow key={i}>
                    {cells.map((cell, j) => (
                      <TableCell key={j}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      ))}
      {list(payload.matches).map((match, i) => (
        <Typography key={i}>
          Пара {i + 1}:{' '}
          {(Array.isArray(match.participantIds) ? match.participantIds : []).map(name).join(' / ')}.
          Победитель: {match.winnerId ? name(match.winnerId) : 'не определён'}
        </Typography>
      ))}
      {payload.type === 'DUEL_RESULT' && (
        <Typography>
          Победитель: {payload.winnerId ? name(payload.winnerId) : 'не определён'}
        </Typography>
      )}
    </Stack>
  );
}
