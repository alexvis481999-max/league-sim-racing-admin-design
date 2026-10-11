import { Button, MenuItem, Stack, TextField } from '@mui/material';

type Slot = {
  presetCode: string;
  ambientTemperature: number;
  roadTemperature: number;
  ambientVariation: number;
  roadVariation: number;
};
export type WeatherConfig =
  | (Slot & { mode: 'FIXED' })
  | {
      mode: 'RANDOM';
      presetCodes: string[];
      ambientTemperature: number;
      roadTemperature: number;
      ambientVariation: number;
      roadVariation: number;
    }
  | { mode: 'MANUAL'; slots: Slot[] };
const initial = (): Slot => ({
  presetCode: '3_clear',
  ambientTemperature: 18,
  roadTemperature: 28,
  ambientVariation: 2,
  roadVariation: 2,
});

export function WeatherFields({
  value,
  items,
  disabled,
  allowRandom,
  onChange,
  catalogCodes,
}: {
  value: WeatherConfig;
  items: { code: string; title: string; name?: string; metadata?: Record<string, unknown> }[];
  catalogCodes?: string[];
  disabled: boolean;
  allowRandom: boolean;
  onChange(value: WeatherConfig, catalogCodes?: string[]): void;
}) {
  const slots: Slot[] =
    value.mode === 'MANUAL'
      ? value.slots
      : value.mode === 'FIXED'
        ? [value]
        : [{ ...value, presetCode: value.presetCodes[0] ?? '3_clear' }];
  const graphics = (code: string) =>
    String(items.find((item) => item.code === code)?.metadata?.graphics ?? code);
  const currentCodes =
    value.mode === 'MANUAL'
      ? value.slots.map((slot) => slot.presetCode)
      : value.mode === 'RANDOM'
        ? value.presetCodes
        : [value.presetCode];
  const savedCode = (code: string, index: number) =>
    catalogCodes?.find((saved) => graphics(saved) === code) ??
    (currentCodes[index] === code ? catalogCodes?.[index] : undefined) ??
    items.find((item) => graphics(item.code) === code)?.code ??
    code;
  const emit = (next: WeatherConfig, selected?: string[]) => {
    const codes =
      next.mode === 'MANUAL'
        ? next.slots.map((slot) => slot.presetCode)
        : next.mode === 'RANDOM'
          ? next.presetCodes
          : [next.presetCode];
    if (catalogCodes) onChange(next, [...new Set(selected ?? codes.map(savedCode))]);
    else onChange(next);
  };
  const update = (index: number, slot: Slot, selectedCode?: string) => {
    const codes = selectedCode
      ? slots.map((s, i) => (i === index ? selectedCode : savedCode(s.presetCode, i)))
      : undefined;
    if (value.mode === 'MANUAL')
      emit({ ...value, slots: value.slots.map((s, i) => (i === index ? slot : s)) }, codes);
    else if (value.mode === 'FIXED') emit({ ...slot, mode: 'FIXED' }, codes);
    else {
      const { presetCode, ...temperatures } = slot;
      void presetCode;
      emit({ ...value, ...temperatures });
    }
  };
  return (
    <Stack spacing={2}>
      <TextField
        select
        label="Режим погоды"
        value={value.mode}
        disabled={disabled}
        onChange={(e) => {
          const slot = slots[0] ?? initial();
          if (e.target.value === 'FIXED') emit({ ...slot, mode: 'FIXED' });
          else if (e.target.value === 'MANUAL') emit({ mode: 'MANUAL', slots: [slot] });
          else {
            const { presetCode, ...temperatures } = slot;
            emit({ mode: 'RANDOM', presetCodes: [presetCode], ...temperatures });
          }
        }}
      >
        <MenuItem value="FIXED">Постоянная</MenuItem>
        <MenuItem value="MANUAL">Заданные погодные слоты</MenuItem>
        {(allowRandom || value.mode === 'RANDOM') && (
          <MenuItem value="RANDOM" disabled={!allowRandom}>
            Случайная
          </MenuItem>
        )}
      </TextField>
      {value.mode === 'RANDOM' && (
        <TextField
          select
          label="Варианты погоды"
          value={value.presetCodes.map(savedCode)}
          slotProps={{ select: { multiple: true } }}
          disabled={disabled}
          onChange={(e) => {
            const codes =
              typeof e.target.value === 'string'
                ? e.target.value.split(',')
                : (e.target.value as string[]);
            emit({ ...value, presetCodes: codes.map(graphics) }, codes);
          }}
        >
          {Array.from(
            new Set([...items.map((i) => i.code), ...value.presetCodes.map(savedCode)]),
          ).map((code) => (
            <MenuItem key={code} value={code}>
              {items.find((i) => i.code === code)?.title || code}
            </MenuItem>
          ))}
        </TextField>
      )}
      {slots.map((slot, index) => (
        <Stack key={index} spacing={2}>
          {value.mode !== 'RANDOM' && (
            <TextField
              select
              label={value.mode === 'MANUAL' ? `Погода, слот ${index + 1}` : 'Погода'}
              value={savedCode(slot.presetCode, index)}
              disabled={disabled}
              onChange={(e) => {
                const code = e.target.value,
                  metadata = items.find((item) => item.code === code)?.metadata;
                const next = { ...slot, presetCode: graphics(code) };
                for (const key of [
                  'ambientTemperature',
                  'roadTemperature',
                  'ambientVariation',
                  'roadVariation',
                ] as const)
                  if (typeof metadata?.[key] === 'number') next[key] = metadata[key];
                update(index, next, code);
              }}
            >
              {Array.from(
                new Set([...items.map((i) => i.code), savedCode(slot.presetCode, index)]),
              ).map((code) => (
                <MenuItem key={code} value={code}>
                  {items.find((i) => i.code === code)?.title || code}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Stack
            className="weather-numeric-fields"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
              gap: 2,
            }}
          >
            {(
              [
                'ambientTemperature',
                'roadTemperature',
                'ambientVariation',
                'roadVariation',
              ] as const
            ).map((key, i) => (
              <TextField
                key={key}
                type="number"
                label={
                  [
                    'Температура воздуха',
                    'Температура трассы',
                    'Разброс температуры воздуха',
                    'Разброс температуры трассы',
                  ][i]
                }
                value={slot[key]}
                disabled={disabled}
                onChange={(e) => update(index, { ...slot, [key]: Number(e.target.value) })}
              />
            ))}
          </Stack>
        </Stack>
      ))}
      {value.mode === 'MANUAL' && (
        <Button
          disabled={disabled}
          onClick={() =>
            emit({
              ...value,
              slots:
                value.slots.length === 1
                  ? [...value.slots, { ...value.slots[0] }]
                  : value.slots.slice(0, 1),
            })
          }
        >
          {value.slots.length === 1 ? 'Добавить второй слот' : 'Убрать второй слот'}
        </Button>
      )}
    </Stack>
  );
}
