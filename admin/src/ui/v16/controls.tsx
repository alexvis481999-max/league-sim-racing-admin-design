import { useId, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import MuiDialog from '@mui/material/Dialog';

/* ---------- tables ---------- */
export function Table({ variant, children, label }: { variant?: 'list' | 'weeks' | 'module'; children: ReactNode; label?: string }) {
  return <div className="lsr-tablewrap"><table className={`lsr-table${variant ? ` is-${variant}` : ''}`} aria-label={label}>{children}</table></div>;
}

/** Whole-row opening that keeps nested links, buttons and inputs independent. */
export function clickableRow(onOpen: () => void, extraClass = '') {
  return {
    className: `is-clickable${extraClass ? ' ' + extraClass : ''}`,
    tabIndex: 0,
    onClick: (event: MouseEvent<HTMLElement>) => { if (!(event.target as HTMLElement).closest('button,a,input,select,textarea,label')) onOpen(); },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(); } },
  };
}

export function TableFoot({ children }: { children: ReactNode }) {
  return <div className="lsr-tablefoot">{children}</div>;
}

/* ---------- toolbar & filters ---------- */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="lsr-toolbar">{children}</div>;
}

export function SearchInput({ value, onChange, placeholder = 'Поиск', label, wide, onCommit }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string; wide?: boolean; onCommit?: (value: string) => void }) {
  return (
    <input
      type="search"
      className={`lsr-search${wide ? ' is-wide' : ''}`}
      value={value}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => onCommit?.(value.trim())}
      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onCommit?.(value.trim()); } }}
    />
  );
}

export function SelectInput({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <select className="lsr-select" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

/** Text-only segmented filter of list pages. aria-pressed keeps the selection audible. */
export function FilterButtons<T extends string>({ value, options, onChange, label, disabled }: { value: T; options: readonly { value: T; label: ReactNode }[]; onChange: (value: T) => void; label: string; disabled?: boolean }) {
  return (
    <div className="lsr-filter-row" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" disabled={disabled} className={`lsr-filter-btn${option.value === value ? ' is-active' : ''}`} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Bordered chips for in-panel filters (status, split, day). */
export function PillButtons<T extends string>({ value, options, onChange, label, size, prefix }: { value: T; options: readonly { value: T; label: ReactNode; title?: string }[]; onChange: (value: T) => void; label: string; size?: 'lg'; prefix?: ReactNode }) {
  return (
    <div className="lsr-filterbar" role="group" aria-label={label}>
      {prefix && <span className="lsr-filterbar-label">{prefix}</span>}
      {options.map((option) => (
        <button key={option.value} type="button" title={option.title} className={`lsr-pillbtn${size === 'lg' ? ' is-lg' : ''}${option.value === value ? ' is-active' : ''}`} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- form fields ---------- */
export function Field({ label, help, error, full, children, htmlFor }: { label?: ReactNode; help?: ReactNode; error?: ReactNode; full?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`lsr-field${full ? ' is-full' : ''}${error ? ' has-error' : ''}`}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {(error || help) && <small role={error ? 'alert' : undefined}>{error || help}</small>}
    </div>
  );
}
export function Fields({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return <div className={`lsr-fields${columns === 3 ? ' is-3' : ''}`}>{children}</div>;
}
export function TextField({ label, help, error, full, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; help?: ReactNode; error?: ReactNode; full?: boolean }) {
  const id = useId();
  return <Field label={label} help={help} error={error} full={full} htmlFor={input.id ?? id}><input id={input.id ?? id} aria-invalid={!!error} {...input} /></Field>;
}
export function TextArea({ label, help, error, full, ...input }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; help?: ReactNode; error?: ReactNode; full?: boolean }) {
  const id = useId();
  return <Field label={label} help={help} error={error} full={full} htmlFor={input.id ?? id}><textarea id={input.id ?? id} aria-invalid={!!error} {...input} /></Field>;
}
export function SelectField({ label, help, error, full, options, ...input }: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; help?: ReactNode; error?: ReactNode; full?: boolean; options: { value: string; label: string }[] }) {
  const id = useId();
  return <Field label={label} help={help} error={error} full={full} htmlFor={input.id ?? id}><select id={input.id ?? id} {...input}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>;
}
export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="lsr-check"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

/* ---------- dialogs ---------- */
export function Dialog({ open, onClose, title, description, children, actions, width = 560 }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; actions?: ReactNode; width?: number }) {
  const titleId = useId();
  return (
    <MuiDialog open={open} onClose={onClose} aria-labelledby={titleId} fullWidth slotProps={{ paper: { sx: { maxWidth: width, borderRadius: '14px', boxShadow: '0 30px 100px #101c3066' } }, backdrop: { sx: { background: '#10203077' } } }}>
      <div className="lsr-root">
        <div className="lsr-dialog-head"><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
        {children && <div className="lsr-dialog-body">{children}</div>}
        {actions && <div className="lsr-dialog-actions">{actions}</div>}
      </div>
    </MuiDialog>
  );
}
