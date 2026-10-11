import { useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import MuiTextField from '@mui/material/TextField';
import type { CatalogOption } from '../../features/event-authoring/CatalogFields';
import { Button } from '../../ui/v16';

/** Searchable multi-select for a large catalog: selected items stay visible as removable chips, missing catalog items included (cars of the common pool). */
export function CarPoolSelect({ label, items, value, onChange, disabled = false, helperText, error = false }: {
  label: string;
  items: CatalogOption[];
  value: string[];
  onChange(value: string[]): void;
  disabled?: boolean;
  helperText?: string;
  error?: boolean;
}) {
  const [draft, setDraft] = useState<CatalogOption | null>(null);
  const available = items.filter((item) => !value.includes(item.code));
  const selected = (draft && available.find((item) => item.code === draft.code)) || null;
  return (
    <div className="lsr-mm-poolselect" role="group" aria-label={label}>
      <div className="lsr-between">
        <h3 className="lsr-mm-heading">{label} · {value.length}</h3>
        <div className="lsr-hstack">
          <Button size="sm" disabled={disabled || !available.length} onClick={() => onChange([...new Set([...value, ...items.map((item) => item.code)])])}>Выбрать все</Button>
          <Button size="sm" disabled={disabled || !value.length} onClick={() => onChange([])}>Очистить</Button>
        </div>
      </div>
      <div className="lsr-mm-addrow">
        <Autocomplete
          size="small"
          className="lsr-mm-addrow-input"
          options={available}
          value={selected}
          disabled={disabled}
          getOptionLabel={(item) => item.title}
          isOptionEqualToValue={(a, b) => a.code === b.code}
          filterOptions={(options, { inputValue }) => options.filter((item) => `${item.title} ${item.code}`.toLowerCase().includes(inputValue.toLowerCase()))}
          onChange={(_, item) => setDraft(item)}
          noOptionsText="Доступных машин не найдено"
          renderInput={(params) => <MuiTextField {...params} label={`Добавить машину — ${label.toLowerCase()}`} placeholder="Название или код" />}
        />
        <Button disabled={disabled || !selected} onClick={() => { if (selected) { onChange([...value, selected.code]); setDraft(null); } }}>Добавить</Button>
      </div>
      {value.length ? (
        <div className="lsr-mm-chipset">
          {value.map((code) => {
            const title = items.find((item) => item.code === code)?.title ?? `${code} (недоступен)`;
            return (
              <span key={code} className="lsr-mm-chip is-picked is-static" title={code}>
                {title}
                <button type="button" className="lsr-mm-chip-remove" disabled={disabled} aria-label={`Убрать ${title}`} onClick={() => onChange(value.filter((id) => id !== code))}>×</button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="lsr-muted lsr-mm-none">Машины не выбраны.</p>
      )}
      {helperText && <small className={error ? 'lsr-mm-error' : 'lsr-help'}>{helperText}</small>}
    </div>
  );
}
