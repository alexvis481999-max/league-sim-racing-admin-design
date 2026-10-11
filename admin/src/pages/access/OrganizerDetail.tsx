import { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api';
import type { OrganizerRecord } from '../../shared/access-types';
import { Button, EmptyState, FormGroup, Kpis, LoadingBlock, Notice, Panel, RecordHead, RecordTopline, SaveBar, Tabs, TextArea, usePageChrome } from '../../ui/v16';
import { OrganizerLinkFields, OrganizerMainFields, OrganizerQuotaFields } from './AccessForms';
import { defaultSettings, eventTypeName, limitLabel, quotaFields, quotaModeName, useCommands, type OrganizerDraft } from './access-model';

type Tab = 'main' | 'quotas' | 'appearance';
const draftOf = (row: OrganizerRecord | null): OrganizerDraft => row ? { ...row, settings: structuredClone(row.settings), presentationOnly: !row.actions.edit } : { code: '', name: '', description: null, active: true, settings: structuredClone(defaultSettings) };
const themeOf = (row: OrganizerRecord | null) => JSON.stringify(row?.settings.theme ?? null, null, 2);

/**
 * Organizer card. Full editors (`actions.edit`, or creation with `organizers.write.all`) PUT the whole record;
 * presentation-only owners PUT `/presentation` with name, description, theme and links. Both use `If-Match`.
 */
export function OrganizerDetail({ record, creating, loading, back, onSaved }: { record: OrganizerRecord | null; creating: boolean; loading: boolean; back(): void; onSaved(message: string, created: boolean): Promise<void> }) {
  const title = creating ? 'Новый организатор' : record?.name ?? 'Организатор';
  usePageChrome({ crumbs: [{ label: 'Организаторы и доступы', to: '/access' }, { label: title }] });
  const { busy, error, notice, setError, setNotice, command, run, confirmed } = useCommands();
  const [tab, setTab] = useState<Tab>('main');
  const [draft, setDraft] = useState<OrganizerDraft>(() => draftOf(record));
  const [themeText, setThemeText] = useState(() => themeOf(record));
  const [base, setBase] = useState(record?.version);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(record)) || themeText !== themeOf(record);
  const stale = !!record && !!base && record.version !== base;
  // A fresh server version replaces an untouched form; a dirty form keeps the user's input and warns.
  useEffect(() => { if (record && record.version !== base && !dirty) { setDraft(draftOf(record)); setThemeText(themeOf(record)); setBase(record.version); } }, [record?.version]);
  useEffect(() => { if (record && base === undefined) { setDraft(draftOf(record)); setThemeText(themeOf(record)); setBase(record.version); } }, [record]);
  if (!creating && !record) return loading ? <LoadingBlock /> : <EmptyState title="Организатор не найден" action={<Button onClick={back}>К списку организаторов</Button>}>Запись недоступна или удалена.</EmptyState>;

  const readOnly = !creating && !!record && !record.actions.edit && !record.actions.editPresentation;
  const presentationOnly = !!draft.presentationOnly;
  const showQuotas = !presentationOnly || readOnly;
  const valid = !!draft.name.trim() && (presentationOnly || /^[a-z0-9_-]{2,64}$/i.test(draft.code.trim()) && quotaFields.every(([key]) => draft.settings[key] === null || Number.isSafeInteger(draft.settings[key]) && draft.settings[key]! > 0));
  const save = () => run(async () => {
    let theme: unknown; try { theme = JSON.parse(themeText); } catch { throw new Error('Оформление должно содержать корректный JSON.'); }
    if (theme !== null && (typeof theme !== 'object' || Array.isArray(theme))) throw new Error('Оформление должно быть объектом или null.');
    const path = draft.id ? `/admin/access/organizers/${draft.id}${presentationOnly ? '/presentation' : ''}` : '/admin/access/organizers';
    const payload = presentationOnly ? { name: draft.name, description: draft.description, theme, websiteUrl: draft.settings.websiteUrl, discordUrl: draft.settings.discordUrl } : { code: draft.code, name: draft.name, description: draft.description, active: draft.active, settings: { ...draft.settings, theme } };
    await apiFetch(path, command(path, draft.id ? 'PUT' : 'POST', payload, draft.version)); confirmed();
    setBase(undefined);
    await onSaved('Организатор сохранён.', !draft.id);
    setNotice('Организатор сохранён.');
  });
  const reset = () => { if (creating) back(); else { setDraft(draftOf(record)); setThemeText(themeOf(record)); setBase(record?.version); setError(''); } };
  const disabled = busy || readOnly;
  const usage = (key: typeof quotaFields[number][0], used: typeof quotaFields[number][2]) => {
    const limit = record?.settings[key] ?? null, value = record?.usage ? record.usage[used] : null;
    return `${value ?? '—'} / ${limit === null ? '∞' : limit}`;
  };
  const types = record?.settings.allowedEventRuntimeTypes ?? [];
  return (
    <>
      <RecordTopline back={{ label: 'Организаторы', onClick: back }} current={title} />
      <RecordHead title={title} meta={creating ? 'Создание записи организатора' : `${record!.code} · ID ${record!.id}${presentationOnly && !readOnly ? ' · доступно только оформление' : readOnly ? ' · только просмотр' : ''}`} />
      <Tabs variant="module" label="Разделы организатора" value={tab} onChange={setTab} items={[{ key: 'main', label: 'Основное' }, { key: 'quotas', label: 'Настройки и квоты', hidden: !showQuotas }, { key: 'appearance', label: 'Оформление' }]} />
      {error && <div className="lsr-access-gap"><Notice tone="danger">{error}</Notice></div>}
      {notice && !dirty && <div className="lsr-access-gap"><Notice role="status">{notice}</Notice></div>}
      {stale && dirty && <div className="lsr-access-gap"><Notice tone="warning" actions={<Button size="sm" onClick={() => { setDraft(draftOf(record)); setThemeText(themeOf(record)); setBase(record!.version); }}>Загрузить актуальную версию</Button>}>Организатор изменён на сервере. Ваши правки остались в форме; сохранение получит отказ из-за версии.</Notice></div>}
      {tab === 'main' && <div className="lsr-stack">
        {record && showQuotas && <Kpis items={[
          { label: 'Состояние', value: record.active ? 'Активен' : 'Выключен', foot: `При превышении квоты: ${quotaModeName(record.settings.quotaEnforcementMode).toLowerCase()}` },
          { label: 'События', value: usage('maxEvents', 'events'), foot: record.remaining?.maxEvents != null ? `Осталось ${record.remaining.maxEvents}` : `Лимит: ${limitLabel(record.settings.maxEvents).toLowerCase()}` },
          { label: 'Одновременно', value: usage('maxConcurrentEvents', 'activeEvents'), foot: record.remaining?.maxConcurrentEvents != null ? `Осталось ${record.remaining.maxConcurrentEvents}` : `Лимит: ${limitLabel(record.settings.maxConcurrentEvents).toLowerCase()}` },
          { label: 'Разрешённые типы', value: types.length ? types.length : 'Все', foot: types.length ? types.map(eventTypeName).join(' · ') : 'Без ограничения по типам' },
        ]} />}
        <Panel title="Основные данные"><OrganizerMainFields value={draft} onChange={setDraft} disabled={disabled} /></Panel>
      </div>}
      {tab === 'quotas' && <div className="lsr-stack">
        <Notice tone="warning">Изменение квот не останавливает уже созданные события; новые ограничения проверяются при создании и запуске.</Notice>
        <OrganizerQuotaFields value={draft} record={record ?? undefined} onChange={setDraft} disabled={disabled} />
      </div>}
      {tab === 'appearance' && <div className="lsr-cols-module">
        <div className="lsr-stack">
          <FormGroup title="Ссылки" description="Показываются на странице организатора на сайте."><OrganizerLinkFields value={draft} onChange={setDraft} disabled={disabled} /></FormGroup>
          <FormGroup title="Тема (JSON)" description="Объект с параметрами темы или null. Проверяется перед сохранением."><TextArea label="Оформление (JSON)" full rows={8} className="lsr-access-json" value={themeText} disabled={disabled} onChange={e => setThemeText(e.target.value)} /></FormGroup>
        </div>
        <Panel title="Предпросмотр карточки">
          <div className="lsr-access-preview"><small>Организатор</small><strong>{draft.name || 'Без названия'}</strong>{draft.description && <span>{draft.description}</span>}<small>{draft.settings.websiteUrl || 'Ссылка на сайт не задана'}</small></div>
          <p className="lsr-mutedline" style={{ margin: '12px 0 0' }}>Предпросмотр показывает название, описание и ссылку из формы. Параметры темы применяет сайт.</p>
        </Panel>
      </div>}
      {!readOnly && <div className="lsr-access-gap is-top"><SaveBar dirty={dirty && !busy} status={<>{busy ? 'Сохраняем…' : dirty ? 'Есть несохранённые изменения' : creating ? 'Заполните название и код' : 'Изменений нет'}{!valid && !busy ? ' · проверьте поля' : ''}</>}
        actions={<><Button disabled={busy} onClick={reset}>{creating ? 'Отменить' : 'Сбросить'}</Button><Button variant="primary" disabled={busy || !valid || (!creating && !dirty)} onClick={() => void save()}>{creating ? 'Создать организатора' : 'Сохранить изменения'}</Button></>} /></div>}
    </>
  );
}
