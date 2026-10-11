import { useEffect, useId, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPlatformPermission, organizerIdsFor } from '../../shared/access';
import { PhotoCatalogDialog, RichDescriptionEditor, type PhotoSelection } from '../../shared/RichContent';
import type { AccessOrganizer, AdminAccess, PublicationAction, PublicationDetails, PublicationPlacementCode } from '../../shared/types';
import {
  Button, Checkbox, Dialog, Field, Fields, Notice, PageHeader, Panel, SelectField, StatusBadge, dateTime, usePageChrome,
} from '../../ui/v16';
import { ContentAppearancePreview, ContentAppearanceStudio } from './ContentAppearanceStudio';
import { defaultContentAppearance } from './contentAppearance';
import {
  emptyForm, placementPayload, validatePublication,
  type PlacementForm, type PublicationForm, type PublicationValidation,
} from './publicationForm';
import {
  contentSlug, errorText, isLive, kindOptions, organizerName, placementDefinitions, placementPreviewImage, placementTitle,
  publicationKindLabel, publicationStatus, publicationToForm, usePublicationCommands,
} from './siteModel';

type Props = {
  access: AdminAccess;
  item: PublicationDetails | null;
  latest: PublicationDetails | null;
  organizers: AccessOrganizer[];
  onSaved: () => Promise<void>;
};

/** Create / edit one publication: entry + current revision + revision placements. Lifecycle commands carry expectedVersion. */
export function PublicationEditor({ access, item, latest, organizers, onSaved }: Props) {
  const navigate = useNavigate();
  const command = usePublicationCommands();
  const scopedOrganizers = organizerIdsFor(access, 'news.write.scoped', 'news.publish.scoped');
  const canChoosePlatformOwner = hasPlatformPermission(access, 'news.write.all', 'catalog.manage.all');
  const [selected, setSelected] = useState<PublicationDetails | null>(item);
  const [form, setForm] = useState<PublicationForm>(() => item ? publicationToForm(item) : emptyForm(scopedOrganizers[0] ?? ''));
  const [fallbackSlug] = useState(() => `publication-${Date.now()}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const live = isLive(selected);
  const heading = selected ? (selected.revision.title || selected.entry.slug) : 'Новая публикация';

  usePageChrome({ back: { label: 'Публикации', to: '/site' }, crumbs: [{ label: 'Сайт и публикации', to: '/site' }, { label: heading }] });

  const draftValidation = validatePublication(form, 'draft');
  const publishValidation = validatePublication(form, 'publish');
  const ownerOptions = (() => {
    const allowed = canChoosePlatformOwner ? organizers : organizers.filter((o) => scopedOrganizers.includes(o.id));
    const options = [...(canChoosePlatformOwner ? [{ value: '', label: 'League Sim Racing' }] : []), ...allowed.map((o) => ({ value: o.id, label: `${o.name}${o.code ? ` (${o.code})` : ''}` }))];
    if (!options.some((o) => o.value === form.accessOrganizerId)) options.unshift({ value: form.accessOrganizerId, label: organizerName(form.accessOrganizerId, organizers) });
    return options;
  })();

  const back = () => navigate('/site');

  async function save(mode: 'draft' | 'publish') {
    const validation = validatePublication(form, live ? 'publish' : mode);
    if (!validation.valid) { setError(validation.blockers.join('. ')); return; }
    const activePlacements = placementDefinitions.filter(({ code }) => form.placements[code].enabled);
    const startsAt = form.timingMode === 'now' ? '' : form.publishStartsAt;
    const endsAt = form.timingMode === 'period' ? form.publishEndsAt : '';
    const publication = {
      slug: selected?.entry.slug ?? contentSlug(form.title, fallbackSlug), kind: form.publicationKind,
      ownerType: form.accessOrganizerId ? 'organizer' : 'platform', ownerId: form.accessOrganizerId || null,
      title: form.title.trim(), summary: form.summary.trim(), body: form.body.trim(), coverAssetId: form.coverAssetId || null,
      startsAt: startsAt ? new Date(startsAt).toISOString() : selected?.entry.publishedAt ?? null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      placements: activePlacements.map(({ code }) => { const { sortOrder: _sort, startsAt: _start, endsAt: _end, ...p } = placementPayload(code, form.placements[code], startsAt, endsAt); return p; }),
    };
    setBusy(true); setError('');
    try {
      const saved = selected
        ? await command<PublicationDetails>(`/admin/publications/${selected.entry.id}`, { expectedVersion: selected.version, publication }, 'PATCH')
        : await command<PublicationDetails>('/admin/publications', publication);
      setSelected(saved);
      if (mode === 'publish' && !isLive(saved)) {
        const scheduled = startsAt && new Date(startsAt).getTime() > Date.now();
        const updated = await command<PublicationDetails>(`/admin/publications/${saved.entry.id}/${scheduled ? 'schedule' : 'publish'}`, { expectedVersion: saved.version, ...(scheduled ? { startsAt: new Date(startsAt).toISOString() } : {}), endsAt: publication.endsAt });
        setSelected(updated);
      }
      back();
      await onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle(kind: 'unpublish' | 'delete') {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      if (kind === 'unpublish') await command(`/admin/publications/${selected.entry.id}/unpublish`, { expectedVersion: selected.version });
      else await command(`/admin/publications/${selected.entry.id}`, { expectedVersion: selected.version }, 'DELETE');
      setConfirmDelete(false);
      back();
      await onSaved();
    } catch (e) {
      setError(errorText(e));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  const status = selected ? publicationStatus(selected) : null;
  const editForbidden = selected?.allowedActions?.edit === false;
  return (
    <>
      <PageHeader overline={selected ? 'Публикация' : 'Сайт и публикации'} title={heading} description="Текст, места размещения, сроки и внешний вид карточек на сайте." />
      <div className="lsr-cols-module">
        <Panel title={selected ? 'Редактор публикации' : 'Создание публикации'}>
          <div className="lsr-stack is-tight">
            {latest && selected && latest.version !== selected.version && <Notice tone="warning">Публикация изменилась после открытия формы. Сохранение проверит версию на сервере.</Notice>}
            {editForbidden && <Notice tone="neutral">Сервер не разрешает изменять эту публикацию с вашими правами.</Notice>}
          </div>
          <Fields>
            <BufferedText full label="Заголовок" value={form.title} error={publishValidation.fieldErrors.title} onValueChange={(title) => setForm((f) => ({ ...f, title }))} />
            <SelectField label="Организатор" value={form.accessOrganizerId} disabled={!!selected} options={ownerOptions} help={selected ? 'Владелец задаётся при создании' : undefined} onChange={(e) => setForm((f) => ({ ...f, accessOrganizerId: e.target.value }))} />
            <SelectField label="Тип" value={form.publicationKind} options={kindOptions} onChange={(e) => setForm((f) => ({ ...f, publicationKind: e.target.value }))} />
            <BufferedText full multiline label="Краткое описание" value={form.summary} error={publishValidation.fieldErrors.summary} onValueChange={(summary) => setForm((f) => ({ ...f, summary }))} />
            <ImageField full label="Основное изображение" url={form.coverUrl} assetId={form.coverAssetId} ownerOrganizerId={form.accessOrganizerId}
              onChange={(photo) => setForm((f) => ({ ...f, coverAssetId: photo?.assetId ?? '', coverUrl: photo?.url ?? '', coverTitle: photo?.title ?? '' }))} />
            {form.publicationKind === 'promo'
              ? <BufferedText full multiline rows={5} label="Текст (необязательно)" value={form.body} onValueChange={(body) => setForm((f) => ({ ...f, body }))} />
              : <Field full label="Основной текст" error={publishValidation.fieldErrors.body}>
                  <div className={`lsr-site-rich${publishValidation.fieldErrors.body ? ' has-error' : ''}`}>
                    <RichDescriptionEditor value={form.body} onChange={(body) => setForm((f) => ({ ...f, body }))} ownerOrganizerId={form.accessOrganizerId} gameCode="" />
                  </div>
                </Field>}
            <PlacementPicker form={form} setForm={setForm} validation={publishValidation} />
            <PlacementOverrides form={form} setForm={setForm} />
            <TimingFields form={form} setForm={setForm} validation={publishValidation} />
          </Fields>
          {!publishValidation.valid && (
            <div style={{ marginTop: 16 }}>
              <Notice tone="warning"><b>Пока нельзя опубликовать</b><ul className="lsr-site-blockers">{publishValidation.blockers.map((m) => <li key={m}>{m}</li>)}</ul></Notice>
            </div>
          )}
          {error && <div style={{ marginTop: 12 }}><Notice tone="danger" actions={<Button size="sm" onClick={() => setError('')}>Скрыть</Button>}>{error}</Notice></div>}
          <div className="lsr-form-actions lsr-site-actions">
            <div className="lsr-hstack">
              {selected && <Button variant="danger-solid" disabled={busy || selected.allowedActions?.delete === false} onClick={() => setConfirmDelete(true)}>Удалить</Button>}
              {live && <Button disabled={busy} onClick={() => void lifecycle('unpublish')}>Снять с публикации</Button>}
            </div>
            <div className="lsr-hstack">
              <Button disabled={busy} onClick={back}>Отменить</Button>
              <Button variant={live ? 'primary' : 'default'} disabled={!draftValidation.valid || busy || editForbidden} onClick={() => void save('draft')}>{live ? 'Сохранить изменения' : 'Сохранить черновик'}</Button>
              {!live && <Button variant="primary" disabled={!publishValidation.valid || busy || selected?.allowedActions?.publish === false} onClick={() => void save('publish')}>Опубликовать</Button>}
            </div>
          </div>
        </Panel>
        <div className="lsr-sticky lsr-site-side">
          <Panel title="Предпросмотр карточек на сайте">
            <Notice>Карточки строит публичный сайт (VITE_SITE_URL) с текущими значениями формы. Без запущенного сайта область превью пустая.</Notice>
            <PlacementPreviews form={form} />
            <hr className="lsr-rule" />
            <div className="lsr-site-meta">
              <div><span>Статус</span>{status ? <StatusBadge variant="badge" status={status.status} tone={status.tone} /> : <b>Не сохранена</b>}</div>
              <div><span>Опубликована</span><b>{dateTime(selected?.entry.publishedAt)}</b></div>
              <div><span>Отложена на</span><b>{dateTime(selected?.entry.scheduledPublishAt)}</b></div>
              <div><span>Адрес</span><b className="lsr-site-slug">{selected?.entry.slug ?? (form.title.trim() ? contentSlug(form.title, '—') : '—')}</b></div>
              <div><span>Версия</span><b>{selected?.version ?? '—'}</b></div>
            </div>
          </Panel>
        </div>
      </div>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Удалить публикацию?"
        description="Материал исчезнет из всех размещений на сайте. Действие проверяет версию публикации."
        actions={<><Button onClick={() => setConfirmDelete(false)}>Отмена</Button><Button variant="danger-solid" disabled={busy} onClick={() => void lifecycle('delete')}>Удалить</Button></>}>
        <b>{heading}</b>
      </Dialog>
    </>
  );
}

type FormProps = { form: PublicationForm; setForm: Dispatch<SetStateAction<PublicationForm>> };
const patchPlacement = (setForm: FormProps['setForm'], code: PublicationPlacementCode, patch: Partial<PlacementForm>) =>
  setForm((current) => ({ ...current, placements: { ...current.placements, [code]: { ...current.placements[code], ...patch } } }));

function PlacementPicker({ form, setForm, validation }: FormProps & { validation: PublicationValidation }) {
  const groups = [...new Set(placementDefinitions.map((d) => d.group))];
  return (
    <Field full label="Где показывать материал" error={validation.fieldErrors.placements} help="Можно отметить несколько мест. Выбор сразу отражается в предпросмотре.">
      <div className="lsr-site-placegroups">
        {groups.map((group) => (
          <div className="lsr-site-togglebar" role="group" aria-label={group} key={group}>
            <span className="lsr-site-togglegroup">{group}</span>
            {placementDefinitions.filter((d) => d.group === group).map((d) => {
              const on = form.placements[d.code].enabled;
              return <button key={d.code} type="button" className={`lsr-site-toggle${on ? ' is-active' : ''}`} aria-pressed={on} onClick={() => patchPlacement(setForm, d.code, { enabled: !on })}>{on ? '✓ ' : ''}{d.label}</button>;
            })}
          </div>
        ))}
      </div>
    </Field>
  );
}

function PlacementOverrides({ form, setForm }: FormProps) {
  const [open, setOpen] = useState<PublicationPlacementCode | null>(null);
  const enabled = placementDefinitions.filter((d) => form.placements[d.code].enabled);
  return (
    <div className="lsr-field is-full">
      <div className="lsr-site-heading">Индивидуальные настройки карточек <span>(необязательно)</span></div>
      <p className="lsr-site-plain">По умолчанию все блоки используют общие заголовок, описание, изображение и оформление. Для выбранного места можно задать свои текст, изображение, кнопки и внешний вид.</p>
      {!enabled.length ? <Notice tone="neutral">Сначала выберите хотя бы одно место размещения.</Notice> : (
        <div className="lsr-site-overrides">
          {enabled.map((d) => {
            const placement = form.placements[d.code];
            const expanded = placement.customized && open === d.code;
            return (
              <section className="lsr-site-override" key={d.code} aria-label={placementTitle(d.code)}>
                <div className="lsr-site-override-head">
                  <div><strong>{placementTitle(d.code)}</strong><small>{placement.customized ? 'Собственные настройки включены' : 'Общие параметры публикации'}</small></div>
                  <div className="lsr-hstack">
                    {placement.customized
                      ? <Button size="sm" onClick={() => { patchPlacement(setForm, d.code, { customized: false }); setOpen(null); }}>Сбросить к общему</Button>
                      : <Button size="sm" variant="primary" onClick={() => { patchPlacement(setForm, d.code, { customized: true }); setOpen(d.code); }}>Настроить отдельно</Button>}
                    {placement.customized && <Button size="sm" variant="soft" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : d.code)}>{expanded ? 'Свернуть' : 'Поля ▾'}</Button>}
                  </div>
                </div>
                {expanded && (
                  <div className="lsr-site-override-editor">
                    <Fields>
                      <BufferedText label="Заголовок только здесь" value={placement.titleOverride} placeholder={form.title} help="Пусто = общий заголовок" onValueChange={(titleOverride) => patchPlacement(setForm, d.code, { titleOverride })} />
                      <BufferedText label="Рубрика над заголовком" value={placement.eyebrowOverride} placeholder={publicationKindLabel(form.publicationKind)} help="Пусто = тип публикации" onValueChange={(eyebrowOverride) => patchPlacement(setForm, d.code, { eyebrowOverride })} />
                      <BufferedText full multiline label="Описание" value={placement.summaryOverride} placeholder={form.summary} help="Пусто = общее краткое описание" onValueChange={(summaryOverride) => patchPlacement(setForm, d.code, { summaryOverride })} />
                      <ImageField full label="Отдельное изображение" url={placement.imageUrl} assetId={placement.imageAssetId} ownerOrganizerId={form.accessOrganizerId} help="Необязательно. Без него используется основное изображение."
                        onChange={(photo) => patchPlacement(setForm, d.code, { imageAssetId: photo?.assetId ?? '', imageUrl: photo?.url ?? '', imageTitle: photo?.title ?? '' })} />
                      {d.supportsActions && <ActionEditor code={d.code} actions={placement.actions} onChange={(actions) => patchPlacement(setForm, d.code, { actions })} />}
                    </Fields>
                    <ContentAppearanceStudio value={placement.appearance} onChange={(appearance) => patchPlacement(setForm, d.code, { appearance })} surfaces={[d.surface]} />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlacementPreviews({ form }: { form: PublicationForm }) {
  const enabled = placementDefinitions.filter((d) => form.placements[d.code].enabled);
  if (!enabled.length) return <div style={{ marginTop: 14 }}><Notice tone="neutral">Выберите место размещения публикации.</Notice></div>;
  return (
    <div className="lsr-site-previews">
      {enabled.map((d) => {
        const p = form.placements[d.code];
        const custom = p.customized;
        return (
          <ContentAppearancePreview
            key={d.code}
            label={placementTitle(d.code)}
            aside={custom ? <span className="lsr-site-custom">Индивидуальное оформление</span> : <span className="lsr-site-plain">Общие настройки</span>}
            placementCode={d.code}
            appearance={custom ? p.appearance : defaultContentAppearance}
            image={placementPreviewImage(d.code, custom ? p.imageUrl : '', form.coverUrl)}
            title={(custom && p.titleOverride) || form.title}
            summary={(custom && p.summaryOverride) || form.summary}
            eyebrow={(custom && p.eyebrowOverride) || publicationKindLabel(form.publicationKind)}
            actions={custom ? p.actions : []}
          />
        );
      })}
    </div>
  );
}

function TimingFields({ form, setForm, validation }: FormProps & { validation: PublicationValidation }) {
  const name = useId();
  const options: [PublicationForm['timingMode'], string][] = [['now', 'Сразу и бессрочно'], ['scheduled', 'С указанной даты и бессрочно'], ['period', 'В указанный период']];
  return (
    <div className="lsr-field is-full">
      <span className="lsr-field-label">Когда показывать публикацию</span>
      <div className="lsr-site-radios" role="radiogroup" aria-label="Когда показывать публикацию">
        {options.map(([value, label]) => (
          <label key={value} className={`lsr-site-radio${form.timingMode === value ? ' is-active' : ''}`}>
            <input type="radio" name={name} value={value} checked={form.timingMode === value} onChange={() => setForm((f) => ({ ...f, timingMode: value }))} />{label}
          </label>
        ))}
      </div>
      {form.timingMode !== 'now' && (
        <div className="lsr-fields" style={{ marginTop: 6 }}>
          <Field label="Начало публикации" error={validation.fieldErrors.scheduledPublishAt}>
            <input type="datetime-local" aria-label="Начало публикации" value={form.publishStartsAt} onChange={(e) => setForm((f) => ({ ...f, publishStartsAt: e.target.value }))} />
          </Field>
          {form.timingMode === 'period' && (
            <Field label="Окончание публикации" error={validation.fieldErrors.sliderEndsAt}>
              <input type="datetime-local" aria-label="Окончание публикации" value={form.publishEndsAt} onChange={(e) => setForm((f) => ({ ...f, publishEndsAt: e.target.value }))} />
            </Field>
          )}
        </div>
      )}
      <small>
        {form.timingMode === 'now' && 'Публикация появится сразу и будет доступна, пока вы её не снимете.'}
        {form.timingMode === 'scheduled' && 'Публикация появится автоматически в указанный момент и останется доступной.'}
        {form.timingMode === 'period' && 'Публикация будет видна только между датами начала и окончания.'}
      </small>
    </div>
  );
}

function ActionEditor({ code, actions, onChange }: { code: PublicationPlacementCode; actions: PublicationAction[]; onChange: (actions: PublicationAction[]) => void }) {
  const roles: PublicationAction['role'][] = code === 'home.hero' ? ['primary', 'secondary'] : ['primary'];
  const update = (role: PublicationAction['role'], patch: Partial<PublicationAction>) => {
    const current = actions.find((item) => item.role === role) ?? { role, label: '', url: '', newTab: false };
    onChange([...actions.filter((item) => item.role !== role), { ...current, ...patch }]);
  };
  return (
    <div className="lsr-field is-full">
      <span className="lsr-field-label">Кнопки блока</span>
      <div className="lsr-site-actions-list">
        {roles.map((role) => {
          const action = actions.find((item) => item.role === role);
          const labelMissing = Boolean(action?.url.trim()) && !action?.label.trim();
          const urlMissing = Boolean(action?.label.trim()) && !action?.url.trim();
          return (
            <div className="lsr-site-action-row" key={role}>
              <BufferedText label={role === 'primary' ? 'Надпись основной кнопки' : 'Надпись дополнительной кнопки'} value={action?.label ?? ''} error={labelMissing ? 'Укажите текст кнопки' : undefined} onValueChange={(label) => update(role, { label })} />
              <BufferedText label={role === 'primary' ? 'Ссылка основной кнопки' : 'Ссылка дополнительной кнопки'} value={action?.url ?? ''} error={urlMissing ? 'Укажите ссылку' : undefined} onValueChange={(url) => update(role, { url })} />
              <Checkbox label="Новая вкладка" checked={action?.newTab ?? false} onChange={(newTab) => update(role, { newTab })} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Text input that commits on blur, so heavy previews re-render once per edit rather than per keystroke. */
function BufferedText({ label, value, onValueChange, error, help, full, multiline, rows = 3, placeholder }: {
  label: string; value: string; onValueChange: (value: string) => void; error?: string; help?: string; full?: boolean; multiline?: boolean; rows?: number; placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const common = { id, value: draft, placeholder, 'aria-invalid': !!error, onChange: (e: { target: { value: string } }) => setDraft(e.target.value), onBlur: () => { if (draft !== value) onValueChange(draft); } };
  return (
    <Field label={label} error={error} help={help} full={full} htmlFor={id}>
      {multiline ? <textarea rows={rows} {...common} /> : <input {...common} />}
    </Field>
  );
}

function ImageField({ label, url, assetId, ownerOrganizerId, onChange, full, help }: {
  label: string; url: string; assetId: string; ownerOrganizerId: string; onChange: (photo: PhotoSelection | null) => void; full?: boolean; help?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Field label={label} full={full} help={help}>
      <div className="lsr-site-image">
        {url ? <img src={url} alt="" /> : <div className="lsr-site-image-empty">Изображение не выбрано</div>}
        <div className="lsr-hstack">
          <Button size="sm" onClick={() => setOpen(true)}>{assetId ? 'Заменить' : 'Выбрать из каталога'}</Button>
          {assetId && <Button size="sm" variant="plain" onClick={() => onChange(null)}>Убрать</Button>}
        </div>
      </div>
      <PhotoCatalogDialog open={open} title={label} ownerOrganizerId={ownerOrganizerId} gameCode="" onClose={() => setOpen(false)} onSelect={(photo) => { onChange(photo); setOpen(false); }} />
    </Field>
  );
}
