import { Stack, TextField, Typography } from '@mui/material';
import { localInput, localInstant } from './local-time';
export function LocalDateTimeField({
  value,
  onChange,
  label,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
  error?: string;
}) {
  const [date = '', time = ''] = localInput(value).split('T');
  return (
    <Stack spacing={1}>
      <Typography variant="body2">{label}</Typography>
      <Stack direction="row" gap={1}>
        <TextField
          fullWidth
          size="small"
          type="date"
          label={label + ' — дата'}
          value={date}
          disabled={disabled}
          error={!!error}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => onChange(localInstant(e.target.value + 'T' + time))}
        />
        <TextField
          fullWidth
          size="small"
          type="time"
          label={label + ' — время'}
          value={time.slice(0, 5)}
          disabled={disabled}
          error={!!error}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => onChange(localInstant(date + 'T' + e.target.value))}
        />
      </Stack>
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
    </Stack>
  );
}
