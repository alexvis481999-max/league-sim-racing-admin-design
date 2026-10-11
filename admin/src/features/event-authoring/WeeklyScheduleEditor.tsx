import { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Field, type FieldsProps } from './Fields';
import { read, write } from './form-state';
import { weekCells, zonedInstant, zonedLocal } from './weekly-calendar';
export function WeeklyScheduleEditor(props: FieldsProps) {
  const [step, setStep] = useState(2),
    [error, setError] = useState('');
  const zone = String(read(props.value, 'event.timezone')),
    viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const firstDate = String(read(props.value, 'weekly.firstDate')),
    times = read(props.value, 'weekly.dayTimes') as Record<string, string[]>;
  let cells: ReturnType<typeof weekCells> = [],
    calendarError = '';
  try {
    cells = weekCells(firstDate, zone, viewerZone, times, step);
  } catch (e) {
    calendarError = (e as Error).message;
  }
  const toggle = (day: string, time: string) => {
    const current = times[day] ?? [];
    props.onChange(
      write(
        props.value,
        'weekly.dayTimes.' + day,
        current.includes(time) ? current.filter((x) => x !== time) : [...current, time].sort(),
      ),
    );
  };
  const add = (date: string, time: string) => {
    try {
      const source = zonedLocal(zonedInstant(date + 'T' + time, viewerZone), zone),
        day = String(new Date(source.slice(0, 10) + 'T12:00Z').getUTCDay());
      if (!(times[day] ?? []).includes(source.slice(11))) toggle(day, source.slice(11));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Stack gap={2}>
      <Field {...props} path="weekly.firstDate" label="Начало недельной серии" type="date" />
      <Typography variant="body2" color="text.secondary">
        Время первой недели показано по вашему часовому поясу. Повторы сохраняют календарь серии;
        точные даты всех запусков — в проверке.
      </Typography>
      <Stack direction="row" gap={1} alignItems="center">
        <Typography>Шаг сетки</Typography>
        {[1, 2, 3, 6].map((n) => (
          <Button
            key={n}
            size="small"
            variant={step === n ? 'contained' : 'outlined'}
            onClick={() => setStep(n)}
          >
            {n} ч
          </Button>
        ))}
      </Stack>
      {(error || calendarError) && <Alert severity="error">{error || calendarError}</Alert>}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2,minmax(0,1fr))',
            md: `repeat(${Math.min(8, new Set(cells.map((x) => x.date)).size) || 7},minmax(0,1fr))`,
          },
          gap: 1,
        }}
      >
        {[...new Set(cells.map((x) => x.date))].map((date) => (
          <Stack key={date} gap={0.5}>
            <Typography fontWeight={700}>
              {new Date(date + 'T12:00').toLocaleDateString('ru-RU', {
                weekday: 'short',
                day: 'numeric',
                month: 'numeric',
              })}
            </Typography>
            {cells
              .filter((x) => x.date === date)
              .map((cell) => (
                <Button
                  key={cell.time}
                  size="small"
                  aria-pressed={cell.selected}
                  disabled={props.disabled}
                  variant={cell.selected ? 'contained' : 'outlined'}
                  onClick={() => toggle(cell.sourceDay, cell.sourceTime)}
                >
                  {cell.time}
                </Button>
              ))}
            <TextField
              size="small"
              type="time"
              label="Добавить"
              value=""
              disabled={props.disabled}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(e) => {
                if (e.target.value) add(date, e.target.value);
              }}
            />
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}
