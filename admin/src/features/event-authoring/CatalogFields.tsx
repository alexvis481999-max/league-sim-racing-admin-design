import { Autocomplete, TextField } from '@mui/material';

export type CatalogOption = { code: string; title: string };
export type TrackOption = CatalogOption & {
  metadata?: { layouts?: { code: string; title?: string; name?: string }[] };
};

/** Keep saved selections visible even when a catalog item has become unavailable. */
function catalogOptions<T extends CatalogOption>(
  items: T[],
  codes: string[],
): CatalogOption[] {
  return [
    ...items,
    ...codes
      .filter((code) => code && !items.some((item) => item.code === code))
      .map((code) => ({ code, title: `${code} (недоступен в каталоге)` })),
  ];
}

export function CatalogMultiSelect({
  label,
  items,
  value,
  onChange,
  disabled = false,
  helperText,
  error = false,
}: {
  label: string;
  items: CatalogOption[];
  value: string[];
  onChange(value: string[]): void;
  disabled?: boolean;
  helperText?: string;
  error?: boolean;
}) {
  const options = catalogOptions(items, value);
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      size="small"
      disabled={disabled}
      options={options}
      value={options.filter((item) => value.includes(item.code))}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      getOptionLabel={(item) => item.title}
      onChange={(_, next) => onChange(next.map((item) => item.code))}
      renderInput={(params) => (
        <TextField {...params} label={label} error={error} helperText={helperText} />
      )}
    />
  );
}

export function TrackSelectionFields({
  items,
  value,
  onChange,
  disabled = false,
  error,
  path,
}: {
  items: TrackOption[];
  value: { code: string; layoutCode: string | null };
  onChange(value: { code: string; layoutCode: string | null }): void;
  disabled?: boolean;
  error?: string;
  path?: string;
}) {
  const options = catalogOptions(items, [value.code]);
  const layouts = (items.find((item) => item.code === value.code)?.metadata?.layouts ?? [])
    .filter((item) => item.code)
    .map((item) => ({ code: item.code, title: item.title ?? item.name ?? item.code }));
  const layoutOptions = catalogOptions(layouts, value.layoutCode ? [value.layoutCode] : []);
  return (
    <>
      <Autocomplete
        size="small"
        disabled={disabled}
        options={options}
        value={options.find((item) => item.code === value.code) ?? null}
        isOptionEqualToValue={(a, b) => a.code === b.code}
        getOptionLabel={(item) => item.title}
        onChange={(_, item) => onChange({ code: item?.code ?? '', layoutCode: null })}
        renderInput={(params) => (
          <TextField
            {...params}
            data-field-path={path ? path + '.code' : undefined}
            label="Трасса"
            error={!!error}
            helperText={error}
          />
        )}
      />
      <Autocomplete
        size="small"
        disabled={disabled || !value.code}
        options={layoutOptions}
        value={layoutOptions.find((item) => item.code === value.layoutCode) ?? null}
        isOptionEqualToValue={(a, b) => a.code === b.code}
        getOptionLabel={(item) => item.title}
        onChange={(_, item) => onChange({ ...value, layoutCode: item?.code ?? null })}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Конфигурация трассы"
            helperText="Пусто — основная конфигурация"
          />
        )}
      />
    </>
  );
}
