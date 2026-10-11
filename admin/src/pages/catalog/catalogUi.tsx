import { useState, type ReactNode } from 'react';
import { Tag } from '../../ui/v16';

/** Bordered filter chips of the v16 module toolbar (`adm-chip`). */
export function ChipFilter<T extends string>({ value, options, onChange, label, size }: { value: T; options: readonly { value: T; label: ReactNode }[]; onChange: (value: T) => void; label: string; size?: 'sm' }) {
  return (
    <div className="lsr-cat-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" className={`lsr-cat-chip${size === 'sm' ? ' is-sm' : ''}${option.value === value ? ' is-active' : ''}`} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Preview image; a missing or unreadable file shows an empty frame instead of a broken image. */
export function Thumb({ src, alt, className = 'lsr-cat-thumb', glyph = '▤' }: { src: string | null | undefined; alt: string; className?: string; glyph?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <span className={className} aria-hidden="true">{glyph}</span>;
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(src)} />;
}

export function InlineTags({ tags, limit = 4 }: { tags: readonly string[]; limit?: number }) {
  if (!tags.length) return null;
  return (
    <span className="lsr-cat-tags" aria-label="Теги">
      {tags.slice(0, limit).map((tag) => <Tag key={tag}>{tag}</Tag>)}
      {tags.length > limit && <Tag>+{tags.length - limit}</Tag>}
    </span>
  );
}

/** A file input styled as a v16 button; the hidden input keeps keyboard and drag-free selection. */
export function FileButton({ label, accept, disabled, onFile, variant }: { label: string; accept: string; disabled?: boolean; onFile: (file: File) => void; variant?: 'soft' }) {
  return (
    <label className={`lsr-btn is-sm${variant ? ` is-${variant}` : ''} lsr-cat-filebtn${disabled ? ' is-disabled' : ''}`}>
      {label}
      <input hidden type="file" accept={accept} disabled={disabled} onChange={(event) => { const next = event.target.files?.[0] ?? null; event.target.value = ''; if (next) onFile(next); }} />
    </label>
  );
}
