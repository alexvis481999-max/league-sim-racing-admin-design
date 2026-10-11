import { useId, useState, type KeyboardEvent } from 'react';
import './catalog/upload.v16.css';

/** Free tags with quick suggestions (catalogue and skins): Enter or comma adds the typed tag, × removes one. */
export function TagEditor({ options, value, onChange, label = 'Теги', placeholder, requiredTags = [], disabled = false }: { options: string[]; value: string[]; onChange: (value: string[]) => void; label?: string; placeholder?: string; requiredTags?: string[]; disabled?: boolean }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const normalizedRequired = requiredTags.map(normalizeTag);
  const normalize = (items: readonly string[]) => Array.from(new Set([...normalizedRequired, ...items.map(normalizeTag).filter(Boolean)]));
  const selected = normalize(value);
  const selectedSet = new Set(selected);
  const available = options.map(normalizeTag).filter((tag) => tag && !selectedSet.has(tag)).slice(0, 24);
  const add = (raw: string) => {
    const next = raw.split(',').map(normalizeTag).filter(Boolean);
    if (next.length) onChange(normalize([...selected, ...next]));
    setDraft('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) { event.preventDefault(); add(draft); }
    else if (event.key === 'Backspace' && !draft) {
      const removable = selected.filter((tag) => !normalizedRequired.includes(tag));
      if (removable.length) onChange(normalize(selected.filter((tag) => tag !== removable[removable.length - 1])));
    }
  };
  return (
    <div className="lsr-tageditor">
      <label className="lsr-field-label" htmlFor={id}>{label}</label>
      <div className={`lsr-tagbox${disabled ? ' is-disabled' : ''}`}>
        {selected.map((tag) => (
          <span key={tag} className="lsr-tagchip">
            {tag}
            {!normalizedRequired.includes(tag) && <button type="button" disabled={disabled} aria-label={`Убрать тег ${tag}`} onClick={() => onChange(normalize(selected.filter((item) => item !== tag)))}>×</button>}
          </span>
        ))}
        <input id={id} value={draft} disabled={disabled} placeholder={selected.length ? '' : placeholder} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={() => { if (draft.trim()) add(draft); }} />
      </div>
      {available.length > 0 && (
        <div className="lsr-tag-suggest" role="group" aria-label="Добавить тег">
          {available.map((tag) => <button key={tag} type="button" disabled={disabled} onClick={() => onChange(normalize([...selected, tag]))}><span aria-hidden="true">+</span>{tag}</button>)}
        </div>
      )}
    </div>
  );
}

function normalizeTag(value: string) { return String(value ?? '').trim().toLowerCase(); }
