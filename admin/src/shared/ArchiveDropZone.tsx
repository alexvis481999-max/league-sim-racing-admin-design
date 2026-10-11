import { useRef, useState, type DragEvent } from 'react';
import { formatBytes } from './format';
import './catalog/upload.v16.css';

export type UploadPhase = 'idle' | 'reading' | 'ready' | 'uploading' | 'uploaded' | 'error';

/** Drop zone of the catalogue and skins. A finished transfer is only a temporary upload: the card attaches the file after confirmation. */
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
  const image = accept.includes('image');
  const selectDropped = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const next = event.dataTransfer.files?.[0] ?? null;
    if (next) onSelect(next);
  };
  const complete = phase === 'ready' || phase === 'uploaded';
  const state = phase === 'reading' ? { text: 'Читаем содержимое архива…', tone: '' }
    : phase === 'ready' ? { text: 'Архив проверен и готов к загрузке', tone: 'is-done' }
      : phase === 'uploading' ? { text: image ? 'Загружаем изображение…' : 'Загружаем архив…', tone: 'is-live' }
        : phase === 'uploaded' ? { text: image ? 'Изображение загружено' : 'Архив загружен', tone: 'is-done' }
          : null;
  return (
    <div
      className={['lsr-dropzone', dragging && 'is-dragging', complete && 'is-complete', phase === 'error' && 'is-error', disabled && 'is-disabled'].filter(Boolean).join(' ')}
      onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={selectDropped}
    >
      <div className="lsr-dropzone-row">
        <span className="lsr-dropzone-icon" aria-hidden="true">{complete ? '✓' : '↑'}</span>
        <div className="lsr-dropzone-text">
          <b>{file ? file.name : label}</b>
          <small>{file ? formatBytes(file.size) : hint}</small>
        </div>
        <button type="button" className="lsr-btn is-sm" disabled={disabled} onClick={() => inputRef.current?.click()}>{file ? selectedButtonLabel : buttonLabel}</button>
        <input ref={inputRef} hidden type="file" accept={accept} onChange={(event) => { onSelect(event.target.files?.[0] ?? null); event.target.value = ''; }} />
      </div>
      {state && <div className={`lsr-dropzone-state ${state.tone}`} role="status">{state.text}</div>}
      {phase === 'uploading' && (
        <div className={`lsr-progress${progress === null ? ' is-indeterminate' : ''}`} role="progressbar" aria-label="Загрузка файла" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined}>
          <span style={progress === null ? undefined : { width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
