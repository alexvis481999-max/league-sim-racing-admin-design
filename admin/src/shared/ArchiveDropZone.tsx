import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { useRef, useState, type DragEvent } from 'react';
import { formatBytes } from './format';

export type UploadPhase = 'idle' | 'reading' | 'ready' | 'uploading' | 'uploaded' | 'error';

export function ArchiveDropZone({ file, phase = 'idle', progress = null, accept = '.zip,application/zip', label = 'Перетащите ZIP-архив сюда', hint = 'или выберите файл', buttonLabel = 'Выбрать архив', selectedButtonLabel = 'Выбрать другой архив', onSelect, disabled = false }: {
  file: File | null;
  phase?: UploadPhase;
  progress?: number | null;
  accept?: string;
  label?: string;
  hint?: string;
  buttonLabel?: string;
  selectedButtonLabel?: string;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const selectDropped = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false);
    if (disabled) return;
    const next = event.dataTransfer.files?.[0] ?? null;
    if (next) onSelect(next);
  };
  const complete = phase === 'ready' || phase === 'uploaded';
  return <Box
    onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={selectDropped}
    sx={{ border: '1px dashed', borderColor: dragging ? 'primary.main' : complete ? 'success.main' : 'divider', borderRadius: 2, bgcolor: dragging ? 'action.hover' : complete ? 'rgba(46, 125, 50, 0.06)' : 'background.default', p: 2.5, transition: 'border-color 140ms ease, background-color 140ms ease' }}
  >
    <Stack alignItems="center" spacing={1.1} textAlign="center">
      {complete ? <CheckCircleOutlineIcon color="success" sx={{ fontSize: 34 }} /> : <CloudUploadOutlinedIcon color={dragging ? 'primary' : 'disabled'} sx={{ fontSize: 38 }} />}
      <Box><Typography fontWeight={750}>{file ? file.name : label}</Typography><Typography variant="body2" color="text.secondary">{file ? formatBytes(file.size) : hint}</Typography></Box>
      <Button size="small" variant="outlined" disabled={disabled} onClick={() => inputRef.current?.click()}>{file ? selectedButtonLabel : buttonLabel}</Button>
      <input ref={inputRef} hidden type="file" accept={accept} onChange={(event) => { onSelect(event.target.files?.[0] ?? null); event.target.value = ''; }} />
      {phase === 'reading' ? <Typography variant="caption" color="text.secondary">Читаем содержимое архива…</Typography> : null}
      {phase === 'ready' ? <Typography variant="caption" color="success.main">Архив проверен и готов к загрузке</Typography> : null}
      {phase === 'uploading' ? <Typography variant="caption" color="primary.main">Загружаем архив…</Typography> : null}
      {phase === 'uploaded' ? <Typography variant="caption" color="success.main">Архив загружен</Typography> : null}
      {progress !== null && phase === 'uploading' ? <LinearProgress variant="determinate" value={progress} sx={{ width: '100%', mt: .5 }} /> : null}
    </Stack>
  </Box>;
}
