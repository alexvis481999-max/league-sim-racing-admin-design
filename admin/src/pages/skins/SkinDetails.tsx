import { Autocomplete, TextField as MuiTextField } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch, jsonBody, patchJsonBody } from '../../shared/api';
import { formatBytes } from '../../shared/format';
import { TagEditor } from '../../shared/TagEditor';
import {
  Button, Checkbox, EmptyState, ErrorState, Fields, LoadingBlock, Notice, PageHeader, Panel, RowItem, SelectField, StatusBadge, Table, TextArea, TextField, dateTime, usePageChrome,
} from '../../ui/v16';
import { useCommandSender } from '../catalog/commandKeys';
import { Thumb } from '../catalog/catalogUi';
import { errorMessage, gameLabel, skinCreatorName, skinState, uniqueTags, versionedPreviewUrl, visibilityLabel, type Skin, type SkinCar, type SkinDetailsData } from './skinModel';
import './skins.v16.css';

const date = (value: string | null | undefined) => (value ? dateTime(value) : 'Не сохранена при импорте');
const OWNER_TYPES: Record<Skin['ownerType'], string> = { official: 'Официальный', platform: 'Платформа', organizer: 'Организатор', user: 'Игрок' };

/** Skin record: `GET /skins/admin/{id}` (with history), `PATCH` with `metadataVersion`, moderation with a reason. */
export function SkinDetails({ skinId, initial, backTo }: { skinId: string; initial?: Skin | null; backTo: string }) {
  const send = useCommandSender();
  const [details, setDetails] = useState<SkinDetailsData | null>(initial ?? null);
  const [loadError, setLoadError] = useState<{ message: string; status: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState<SkinCar[]>([]);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const gameCode = details?.gameCode ?? initial?.gameCode;

  const reload = useCallback(async () => {
    try {
      const value = await apiFetch<SkinDetailsData>(`/skins/admin/${encodeURIComponent(skinId)}`);
      setDetails(value);
      setLoadError(null);
    } catch (caught) {
      setLoadError({ message: errorMessage(caught, 'Не удалось загрузить скин'), status: caught instanceof ApiError ? caught.status : null });
    } finally {
      setLoading(false);
    }
  }, [skinId]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!gameCode) return;
    let live = true;
    void apiFetch<SkinCar[]>(`/games/${gameCode}/cars`).then((value) => { if (live && Array.isArray(value)) setCars(value); }).catch((caught) => { if (live) setError(errorMessage(caught, 'Не удалось загрузить машины')); });
    return () => { live = false; };
  }, [gameCode]);

  usePageChrome({
    crumbs: [{ label: 'Игровой каталог', to: '/media-catalog?kind=skin' }, { label: 'Скины', to: '/media-catalog?kind=skin' }, { label: details?.displayName ?? `Скин ${skinId}` }],
    back: { label: backTo.startsWith('/media-catalog/item/') ? 'К машине' : 'К списку', to: backTo },
  });

  if (!details) {
    if (loading) return <LoadingBlock rows={6} label="Загрузка скина" />;
    if (loadError?.status === 404) return <EmptyState title="Скин не найден">Возможно, он удалён или у вас нет к нему доступа.</EmptyState>;
    return <ErrorState error={loadError?.message ?? 'Не удалось загрузить скин'} status={loadError?.status} onRetry={() => void reload()} />;
  }

  const carTitle = (code: string) => cars.find((c) => c.code === code)?.title ?? code;
  const expectedVersion = details.metadataVersion ?? 1;

  async function save(patch: Record<string, unknown>) {
    setBusy(true); setError('');
    try {
      await send<Skin>(`/skins/admin/${details!.id}`, patchJsonBody({ expectedVersion, patch }));
      await reload();
    } catch (caught) { setError(errorMessage(caught, 'Не удалось сохранить скин')); } finally { setBusy(false); }
  }
  async function moderate() {
    setBusy(true); setError('');
    try {
      await send<Skin>(`/skins/admin/${details!.id}/moderation`, jsonBody({ expectedVersion, blocked: !details!.moderation?.blocked, reason }));
      setReason('');
      await reload();
    } catch (caught) { setError(errorMessage(caught, 'Не удалось применить решение')); } finally { setBusy(false); }
  }

  const preview = versionedPreviewUrl(details);
  return (
    <>
      <PageHeader
        overline={`Скин · ID ${details.id}`}
        title={details.displayName}
        description={`${carTitle(details.carCode)} · ${gameLabel(details.gameCode)}`}
        actions={details.archiveUrl && details.allowedActions?.download !== false ? <a className="lsr-btn" href={details.archiveUrl} target="_blank" rel="noreferrer">Скачать текущий ZIP</a> : undefined}
      />
      <div className="lsr-cols-module">
        <div className="lsr-stack">
          <SkinCardForm key={`${details.id}-${expectedVersion}`} details={details} cars={cars} busy={busy} error={error} onSave={(patch) => void save(patch)} />
          <Panel title="История изменений" sub="Редакции метаданных и версии архива" body={false} shadow>
            {details.history?.length ? (
              <div className="lsr-skin-history">
                <Table variant="module" label="История изменений">
                  <thead><tr><th>Редакция / архив</th><th>Дата</th><th>Название и машина</th><th className="lsr-hide-sm">Теги</th><th>Состояние</th></tr></thead>
                  <tbody>
                    {details.history.map((row) => (
                      <tr key={row.metadataVersion}>
                        <td className="lsr-nowrap">{row.metadataVersion} / v{row.version}{row.archiveUrl && <a className="lsr-btn is-sm" href={row.archiveUrl} target="_blank" rel="noreferrer">ZIP</a>}</td>
                        <td>{date(row.changedAt)}{row.actorId && <div className="lsr-cat-mute">Изменил ID {row.actorId}</div>}</td>
                        <td>{row.displayName}<div className="lsr-cat-mute">{carTitle(row.carCode)}</div></td>
                        <td className="lsr-hide-sm">{row.tags.join(', ') || '—'}</td>
                        <td>{row.active ? 'Активен' : 'Отключён'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : <EmptyState compact>{loading ? 'Загрузка истории…' : 'История изменений не передана.'}</EmptyState>}
          </Panel>
          {details.allowedActions?.moderate && (
            <Panel title="Модерация" sub="Блокировка запрещает новые выборы скина; решение требует причины" shadow>
              <div className="lsr-skin-moderation">
                <TextArea label="Причина решения модератора" value={reason} rows={3} onChange={(e) => setReason(e.target.value)} />
                <div><Button variant={details.moderation?.blocked ? 'default' : 'danger-solid'} disabled={busy || !reason.trim()} onClick={() => void moderate()}>{details.moderation?.blocked ? 'Снять блокировку' : 'Заблокировать для новых выборов'}</Button></div>
              </div>
            </Panel>
          )}
        </div>
        <div className="lsr-stack">
          <Panel title="Файлы и состояние" shadow>
            <div className="lsr-stack">
              <Thumb src={preview} alt={details.displayName} className="lsr-skin-preview" glyph="Превью не найдено в архиве" />
              <div className="lsr-cat-rows">
                <RowItem title="ID" aside={<div className="lsr-cat-code">{details.id}</div>} />
                <RowItem title="Папка" aside={<div className="lsr-cat-code">{details.folderName}</div>} />
                <RowItem title="Архив" sub={details.archiveSizeBytes ? formatBytes(Number(details.archiveSizeBytes)) : undefined} aside={<div>v{details.version}</div>} />
                <RowItem title="Редакция" aside={<div>{expectedVersion}</div>} />
                <RowItem title="Владелец" aside={<div>{OWNER_TYPES[details.ownerType]}{details.ownerId ? ` · ID ${details.ownerId}` : ''}</div>} />
                <RowItem title="Доступ" aside={<div>{visibilityLabel(details)}</div>} />
                <RowItem title="Добавил" aside={<div>{skinCreatorName(details) || 'Не указан'}</div>} />
                <RowItem title="Добавлен" aside={<div>{date(details.createdAt)}</div>} />
                <RowItem title="Изменён" aside={<div>{date(details.updatedAt)}</div>} />
                <RowItem title="Состояние" aside={<div className="lsr-cat-status" style={{ justifyContent: 'flex-end' }}>{skinState(details).map((state) => <StatusBadge key={state.code} status={state} tone={state.tone} variant="badge" title={state.title} />)}</div>} />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

/** Editable metadata of the skin; re-created for each server revision so the form always starts from saved values. */
function SkinCardForm({ details, cars, busy, error, onSave }: { details: SkinDetailsData; cars: SkinCar[]; busy: boolean; error: string; onSave: (patch: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState(details.displayName);
  const [car, setCar] = useState(details.carCode);
  const [tags, setTags] = useState<string[]>(details.tags ?? []);
  const [active, setActive] = useState(details.active);
  const [visibility, setVisibility] = useState<string>(details.visibility);
  const editable = !!details.allowedActions?.edit && !busy;
  const official = details.ownerType === 'official';
  const changed = title.trim() !== details.displayName || car !== details.carCode || active !== details.active || tags.join(',') !== (details.tags ?? []).join(',') || (!official && visibility !== details.visibility);
  const reset = () => { setTitle(details.displayName); setCar(details.carCode); setTags(details.tags ?? []); setActive(details.active); setVisibility(details.visibility); };
  return (
    <Panel title="Карточка скина" shadow>
      <div className="lsr-cat-form">
        {details.deletedAt && <Notice tone="neutral">Владелец удалил скин из нового выбора {dateTime(details.deletedAt)}.</Notice>}
        {details.moderation?.blocked && <Notice tone="warning">Заблокирован: {details.moderation.reason || 'причина не указана'}</Notice>}
        {!details.allowedActions?.edit && <Notice tone="neutral">Изменение этого скина вам недоступно.</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        <Fields>
          <TextField label="Название" value={title} disabled={!editable} onChange={(e) => setTitle(e.target.value)} />
          <div className="lsr-cat-mui">
            <Autocomplete sx={{ '& .MuiOutlinedInput-root': { minHeight: 40 } }} options={cars} value={cars.find((c) => c.code === car) ?? (car ? { code: car, title: car } : null)} isOptionEqualToValue={(a, b) => a.code === b.code} getOptionLabel={(c) => c.title} disabled={!editable} onChange={(_, value) => setCar(value?.code ?? '')} renderInput={(params) => <MuiTextField {...params} label="Машина" required />} />
          </div>
          {!official && <SelectField label="Доступ" value={visibility} disabled={!editable} options={[{ value: 'private', label: 'Только владельцу' }, { value: 'public', label: 'Для всех' }]} onChange={(e) => setVisibility(e.target.value)} />}
          <div className="lsr-field" style={{ justifyContent: 'flex-end', paddingBottom: 9 }}><Checkbox label="Доступен для нового выбора" checked={active} disabled={!editable} onChange={setActive} /></div>
          <div className="lsr-cat-wide">
            <TagEditor value={tags} options={uniqueTags(['ac', 'acc', 'iracing', ...tags])} onChange={setTags} disabled={!editable} />
          </div>
        </Fields>
      </div>
      <div className="lsr-form-actions">
        <Button disabled={busy || !changed} onClick={reset}>Отменить</Button>
        <Button variant="primary" disabled={!editable || !title.trim() || !car} onClick={() => onSave({ displayName: title.trim(), carCode: car, tags, active, ...(official ? {} : { visibility }) })}>{busy ? 'Сохранение…' : 'Сохранить'}</Button>
      </div>
    </Panel>
  );
}
