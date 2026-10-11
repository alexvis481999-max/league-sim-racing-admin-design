import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link } from 'react-router-dom';
import './admin-lists.css';
import ClearIcon from '@mui/icons-material/Clear';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { Box, Button, Chip, Collapse, Grid, IconButton, InputAdornment, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { TextFieldProps } from '@mui/material/TextField';
import type { AsyncState } from './asyncState';
import { dismissNotification, showNotification } from './notifications';
import { uiFoundation } from '../../../shared/ui-foundation';

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
  if(embedded)return <Stack spacing={2} sx={{minWidth:0}}>{actions}{children}</Stack>;
  return (
    <Stack className="admin-page" spacing={uiFoundation.pageGap} sx={{ minWidth: 0 }}>
      {back && <Box className="admin-page-back">{back}</Box>}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: 0, fontSize: { xs: '1.5rem', md: '2rem' }, overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {actions ? <PageActions>{actions}</PageActions> : null}
      </Stack>
      {children}
    </Stack>
  );
}

export function PageActions({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
      {children}
    </Stack>
  );
}

export function FilterButtons<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: readonly { value: T; label: string }[];
  onChange: (value: T) => void; disabled?: boolean;
}) {
  return <Stack role="group" aria-label={label} direction="row" useFlexGap flexWrap="wrap" gap={0.5} alignItems="center">
    {options.map(option => <Button key={option.value} size="small" disabled={disabled}
      aria-label={`${label}: ${option.label}`} aria-pressed={value === option.value} onClick={() => onChange(option.value)}
      sx={{ minHeight: 34, px: 1.5, color: value === option.value ? 'primary.main' : 'text.secondary',
        bgcolor: value === option.value ? 'action.selected' : 'transparent',
        fontWeight: value === option.value ? 700 : 500, transition: 'background-color 120ms ease, color 120ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}>
      {option.label}
    </Button>)}
  </Stack>;
}

export function ListToolbar({ children }: { children: ReactNode }) {
  return <Stack spacing={1.25} sx={{ pb: 1.5, borderBottom: 1, borderColor: 'divider', minWidth: 0,
    '& > .MuiTextField-root': { width: '100%', maxWidth: 480 } }}>{children}</Stack>;
}

export function MoreFilters({ children, count = 0 }: { children: ReactNode; count?: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <Box><Button size="small" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
    Дополнительные фильтры{count ? ` · ${count}` : ''}
  </Button><Collapse in={open}><Stack id={id} direction="row" flexWrap="wrap" useFlexGap gap={1.5}
    sx={{ pt: 1.5, '& .MuiTextField-root': { flex: '1 1 200px', minWidth: 0 } }}>{children}</Stack></Collapse></Box>;
}

export function SearchField({
  value,
  onChange,
  onCommit,
  label = 'Поиск',
  placeholder,
  fullWidth = true,
  disabled = false,
  sx,
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
    <TextField
      size="small"
      fullWidth={fullWidth}
      label={label}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                edge="end"
                aria-label="Очистить поиск"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange('');
                  onCommit?.('');
                }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      sx={sx}
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
  return <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onClick} disabled={loading}>{label}</Button>;
}

export function CreateAction({ onClick, disabled = false, label = 'Добавить' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return <Button variant="contained" startIcon={<AddIcon />} onClick={onClick} disabled={disabled}>{label}</Button>;
}

export function BackAction({onClick,label='Назад',disabled=false}:{onClick():void;label?:string;disabled?:boolean}) {
  return <Button variant="text" color="inherit" startIcon={<ArrowBackIcon/>} onClick={onClick} disabled={disabled}>{label}</Button>;
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
  return (
    <Paper component="section" className="admin-section" variant="outlined" sx={{ p: embedded?0:2, borderRadius: embedded?0:2, border:embedded?0:undefined,boxShadow:embedded?'none':undefined,bgcolor:embedded?'transparent':undefined,minWidth: 0 }}>
      <Stack spacing={1.5}>
        {title || actions ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent={title ? 'space-between' : 'flex-start'} gap={1}>
            {title ? (
              <Typography component="h2" variant="h6" sx={{ fontWeight: 750 }}>
                {title}
              </Typography>
            ) : null}
            {actions ? <Box sx={{ flex: title ? '0 0 auto' : 1 }}>{actions}</Box> : null}
          </Stack>
        ) : null}
        {children}
      </Stack>
    </Paper>
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
