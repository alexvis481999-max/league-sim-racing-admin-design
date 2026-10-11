import { Button, TextField } from '../../ui/v16';

type Layout = { code: string; title?: string; pitboxes?: number; isDefault?: boolean; tougeZones?: unknown };
const invalidPitboxes = (value: number | undefined) => value !== undefined && (!Number.isSafeInteger(value) || value < 1);

/** Track configurations kept in `metadata.layouts`; other layout fields (touge zones, etc.) are preserved on edit. */
export function TrackLayoutFields({ metadata, onChange }: { metadata: string; onChange(value: string): void }) {
  const value = JSON.parse(metadata) as { layouts?: Layout[] };
  const layouts = value.layouts ?? [];
  const save = (next: Layout[]) => onChange(JSON.stringify({ ...value, layouts: next }, null, 2));
  return (
    <div className="lsr-field is-full">
      <span className="lsr-field-label">Конфигурации трассы</span>
      <small className="lsr-help">Для архива конфигурации определяются по ui_track.json. Для официальной трассы укажите их здесь; пустой код — основная конфигурация.</small>
      <div className="lsr-stack is-tight" style={{ marginTop: 4 }}>
        {layouts.map((layout, i) => (
          <div className="lsr-cat-layoutrow" key={i}>
            <TextField label={`Код конфигурации ${i + 1}`} value={layout.code} onChange={(e) => save(layouts.map((l, n) => (n === i ? { ...l, code: e.target.value, isDefault: !e.target.value } : l)))} />
            <TextField label={`Название конфигурации ${i + 1}`} value={layout.title ?? ''} onChange={(e) => save(layouts.map((l, n) => (n === i ? { ...l, title: e.target.value } : l)))} />
            <TextField
              label="Количество мест"
              type="number"
              min={1}
              step={1}
              aria-label={`Количество мест конфигурации ${i + 1}`}
              value={layout.pitboxes ?? ''}
              error={invalidPitboxes(layout.pitboxes) ? 'Введите целое число больше нуля' : undefined}
              help="Пит-боксы. Нужны для создания заезда."
              onChange={(e) => save(layouts.map((l, n) => (n === i ? { ...l, pitboxes: e.target.value === '' ? undefined : Number(e.target.value) } : l)))}
            />
            <Button size="sm" variant="plain" onClick={() => save(layouts.filter((_, n) => n !== i))}>Убрать</Button>
          </div>
        ))}
        <div><Button size="sm" variant="soft" onClick={() => save([...layouts, { code: layouts.length ? `layout_${layouts.length + 1}` : '', title: '', isDefault: !layouts.length }])}>＋ Добавить конфигурацию</Button></div>
      </div>
    </div>
  );
}
