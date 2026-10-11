import { Autocomplete, Box, TextField } from '@mui/material';
type Metadata = Record<string, unknown>;
export function CatalogPresetFields<T extends Metadata>({
  kind,
  metadata,
  onChange,
  cars,
  disabled,
}: {
  kind: 'car_set' | 'weather_preset';
  metadata: T;
  onChange(v: T): void;
  cars: { id: string; title: string }[];
  disabled?: boolean;
}) {
  if (kind === 'car_set')
    return (
      <Autocomplete
        multiple
        disabled={disabled}
        options={cars}
        value={cars.filter((c) => (metadata.carIds as string[]).includes(c.id))}
        getOptionLabel={(x) => x.title}
        onChange={(_, items) => onChange({ ...metadata, carIds: items.map((x) => x.id) })}
        renderInput={(p) => <TextField {...p} label="Машины класса" />}
      />
    );
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 2 }}>
      {[
        ['graphics', 'Графика'],
        ['ambientTemperature', 'Воздух, °C'],
        ['roadTemperature', 'Трасса, °C'],
        ['ambientVariation', 'Разброс воздуха'],
        ['roadVariation', 'Разброс трассы'],
      ].map(([key, label]) => (
        <TextField
          key={key}
          disabled={disabled}
          size="small"
          label={label}
          type={key === 'graphics' ? 'text' : 'number'}
          value={metadata[key] ?? ''}
          onChange={(e) =>
            onChange({
              ...metadata,
              [key]:
                key === 'graphics'
                  ? e.target.value
                  : e.target.value === ''
                    ? ''
                    : Number(e.target.value),
            })
          }
        />
      ))}
    </Box>
  );
}
