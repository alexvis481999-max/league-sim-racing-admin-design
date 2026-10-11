import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link } from 'react-router-dom';
import './admin-lists.css';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { Box, Collapse, Grid, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { TextFieldProps } from '@mui/material/TextField';
import type { AsyncState } from './asyncState';
import { dismissNotification, showNotification } from './notifications';
import { Button as V16Button, EmbeddedContext, PageHeader } from '../ui/v16';

export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <Grid container spacing={1.5}>
      {children}
    </Grid>
  );
}

export function FormCell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <Grid size={{ xs: 12, md: wide ? 12 : 6, lg: wide ? 12 : 4 }}>
      {children}
    </Grid>
  );
}

export function JsonBlock({ value, maxHeight = 340 }: { value: unknown; maxHeight?: number }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        maxHeight,
        overflow: 'auto',
        bgcolor: '#101418',
        color: '#d8e2ec',
        borderRadius: 1,
        fontSize: 12,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
      }}
    >
      {JSON.stringify(value, null, 2)}
    </Box>
  );
}

export function Page({ title, subtitle, actions, back, children, embedded=false }: { embedded?:boolean; title: string; subtitle?: string; actions?: ReactNode; back?:ReactNode; children: ReactNode }) {
  if(embedded)return <EmbeddedContext.Provider value><div className="lsr-stack">{actions&&<div className="lsr-page-actions" style={{justifyContent:'flex-start'}}>{actions}</div>}{children}</div></EmbeddedContext.Provider>;
  return (
    <div className="admin-page lsr-stack" style={{ gap: 0 }}>
      {back && <div className="admin-page-back">{back}</div>}
      <PageHeader title={title} description={subtitle} actions={actions} />
      <div className="lsr-stack">{children}</div>
    </div>
  );
}

export function PageActions({ children }: { children: ReactNode }) {
  return <div className="lsr-page-actions">{children}</div>;
}

export function FilterButtons<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: readonly { value: T; label: string }[];
  onChange: (value: T) => void; disabled?: boolean;
}) {
  return <div className="lsr-filter-row" role="group" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" disabled={disabled}
      className={`lsr-filter-btn${value === option.value ? ' is-active' : ''}`}
      aria-label={`${label}: ${option.label}`} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      {option.label}
    </button>)}
  </div>;
}

export function ListToolbar({ children }: { children: ReactNode }) {
  return <div className="lsr-filterbar admin-list-toolbar">{children}</div>;
}

export function MoreFilters({ children, count = 0 }: { children: ReactNode; count?: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div><button type="button" className="lsr-pillbtn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
    Дополнительные фильтры{count ? ` · ${count}` : ''}
  </button><Collapse in={open}><Stack id={id} direction="row" flexWrap="wrap" useFlexGap gap={1.5}
    sx={{ pt: 1.5, '& .MuiTextField-root': { flex: '1 1 200px', minWidth: 0 } }}>{children}</Stack></Collapse></div>;
}

export function SearchField({
  value,
  onChange,
  onCommit,
  label = 'Поиск',
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  label?: string;
  placeholder?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}) {
  const commit = () => onCommit?.(value.trim());
  return (
    <input
      type="search"
      className="lsr-search admin-search"
      aria-label={label}
      placeholder={placeholder ?? label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape' && value) {
          onChange('');
          onCommit?.('');
        }
      }}
    />
  );
}

type BufferedFieldProps = Omit<TextFieldProps, 'value' | 'defaultValue' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  delayMs?: number;
};

export function BufferedField({ value, onValueChange, delayMs = 300, onBlur, ...props }: BufferedFieldProps) {
  const [draft, setDraft] = useState(value);
  const latestRef = useRef(value);
  const committedRef = useRef(value);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === committedRef.current) return;
    committedRef.current = value;
    latestRef.current = value;
    setDraft(value);
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  function commit(next = latestRef.current) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (next === committedRef.current) return;
    committedRef.current = next;
    onValueChange(next);
  }

  return (
    <TextField
      {...props}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        latestRef.current = next;
        setDraft(next);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => commit(next), delayMs);
      }}
      onBlur={(event) => {
        commit();
        onBlur?.(event);
      }}
    />
  );
}

export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

export function RefreshAction({ onClick, loading = false, label = 'Обновить' }: { onClick: () => void; loading?: boolean; label?: string }) {
  return <V16Button onClick={onClick} disabled={loading}>↻ {label}</V16Button>;
}

export function CreateAction({ onClick, disabled = false, label = 'Добавить' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return <V16Button variant="primary" onClick={onClick} disabled={disabled}>＋ {label}</V16Button>;
}

export function BackAction({onClick,label='Назад',disabled=false}:{onClick():void;label?:string;disabled?:boolean}) {
  return <button type="button" className="lsr-backtop" onClick={onClick} disabled={disabled}>← {label}</button>;
}

/** One primary hit area; independent actions remain above it and never trigger navigation. */
export function ListRecord({id,title,meta,children,actions,to,onOpen,openLabel,disabled=false}:{id?:string;title:ReactNode;meta?:ReactNode;children?:ReactNode;actions?:ReactNode;to?:string;onOpen?():void;openLabel?:string;disabled?:boolean}) {
  const interactive=Boolean(to||onOpen);
  return <Box component="article" className={`admin-list-record${interactive?' is-interactive':''}`}>
    {interactive&&(to?<Link className="admin-record-target" to={to} aria-label={openLabel}/>:<button className="admin-record-target" type="button" aria-label={openLabel} onClick={onOpen} disabled={disabled}/>)}
    {id!=null&&<Typography className="admin-record-id" variant="body2" color="text.secondary">{id}</Typography>}
    <Box className="admin-record-copy"><Typography component="div" className="admin-record-title">{title}</Typography>{meta&&<Typography component="div" variant="body2" color="text.secondary">{meta}</Typography>}{children}</Box>
    {actions&&<Box className="admin-record-actions">{actions}</Box>}
    {interactive&&<ChevronRightIcon className="admin-record-chevron" fontSize="small" aria-hidden="true"/>}
  </Box>;
}

export function LiveStatus({ connected, connectedLabel = 'Live подключён', disconnectedLabel = 'Live отключён' }: { connected: boolean; connectedLabel?: string; disconnectedLabel?: string }) {
  const label = connected ? connectedLabel : disconnectedLabel;
  return (
    <Tooltip title={label}>
      <Box
        role="status"
        aria-label={label}
        sx={{
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          color: connected ? 'success.main' : 'error.main',
        }}
      >
        {connected ? <WifiIcon fontSize="small" /> : <WifiOffIcon fontSize="small" />}
      </Box>
    </Tooltip>
  );
}

export function Section({ title, children, actions, embedded=false }: { embedded?:boolean; title?: string; children: ReactNode; actions?: ReactNode }) {
  if (embedded) return <div className="lsr-stack admin-section">{(title || actions) && <div className="lsr-between">{title && <h2 className="lsr-strong" style={{ margin: 0, fontSize: 15 }}>{title}</h2>}{actions}</div>}{children}</div>;
  return (
    <section className="lsr-panel admin-section">
      {(title || actions) && <div className="lsr-panel-header">{title ? <h2>{title}</h2> : <span />}{actions ? <div className="lsr-hstack" style={{ flex: title ? '0 0 auto' : 1 }}>{actions}</div> : null}</div>}
      <div className="lsr-panel-body"><Stack spacing={1.5}>{children}</Stack></div>
    </section>
  );
}

export function StatusAlert<T>({
  state,
  operation = false,
  successMessage = 'Данные обновлены',
}: {
  state: AsyncState<T>;
  operation?: boolean;
  successMessage?: string | false;
}) {
  const reactId = useId();
  const id = `async-state-${reactId}`;
  useEffect(() => {
    if (state.loading && operation) {
      showNotification({ id, severity: 'info', message: 'Загрузка данных…', durationMs: null });
    } else if (state.error) {
      showNotification({ id, severity: 'error', message: state.error, durationMs: 5000 });
    } else if (state.done && operation && successMessage) {
      showNotification({ id, severity: 'success', message: successMessage, durationMs: 5000 });
    }
    return () => dismissNotification(id);
  }, [id, state.loading, state.error, state.done, operation, successMessage]);
  return null;
}
