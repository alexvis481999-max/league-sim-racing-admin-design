import { useState } from 'react';
import type { AccessOrganizer, CatalogItem } from '../../shared/types';
import { formatBytes } from '../../shared/format';
import { Button, Notice, Panel, RowItem, StatusBadge, dateTime } from '../../ui/v16';
import { catalogActorLabel } from './catalogActor';
import {
  catalogItemImageUrl, errorText, gameTitle, getTrackLayouts, ownerLabel, plural, statusLike, statusTone, tougeZonesLabel, tougeZonesTone,
} from './catalogModel';
import { FileButton, Thumb } from './catalogUi';

const badge = (value: string) => <StatusBadge status={statusLike(value)} tone={statusTone(value)} variant="badge" />;

/** Files, storage and game-server state of a saved card (right column of the v16 record). */
export function CatalogFilesPanel({ item, hasFiles, organizerById, busy, onInstallShared, onUploadImage, onDeleteImage }: {
  item: CatalogItem;
  hasFiles: boolean;
  organizerById: Map<string, AccessOrganizer>;
  busy: boolean;
  onInstallShared: () => void;
  onUploadImage: (file: File) => void;
  onDeleteImage: () => void;
}) {
  const canRetryShared = (item.kind === 'car' || item.kind === 'track') && item.tags.includes('ac') && item.storageStatus === 'present' && item.sharedStatus !== 'present' && item.sharedStatus !== 'not_applicable';
  const canEditImage = item.kind === 'car' || item.kind === 'track';
  const official = item.sourceType === 'official' || item.sourceType === 'vanilla';
  const image = catalogItemImageUrl(item);
  const usages = item.usages?.length ?? 0;
  return (
    <Panel title="Файлы и зависимости" shadow>
      <div className="lsr-stack">
        {(canEditImage || item.kind === 'photo') && (
          <div className="lsr-stack is-tight">
            <Thumb src={image} alt={item.title} className="lsr-cat-preview" glyph="Изображение не загружено" />
            {canEditImage && (
              <div className="lsr-hstack">
                <FileButton label={item.primaryImageAsset || item.primaryImageAssetId ? 'Заменить фото' : 'Добавить фото'} accept="image/png,image/jpeg,image/webp" disabled={busy} onFile={onUploadImage} />
                {(item.primaryImageAsset || item.primaryImageAssetId) && <Button size="sm" variant="danger" disabled={busy} onClick={onDeleteImage}>Удалить фото</Button>}
              </div>
            )}
          </div>
        )}
        <div className="lsr-cat-rows">
          <RowItem title="Идентификатор" aside={<div className="lsr-cat-code">{item.code}</div>} />
          <RowItem title="ID записи" aside={<div className="lsr-cat-code">{item.id}{item.revision != null ? ` · ред. ${item.revision}` : ''}</div>} />
          <RowItem title="Игра" aside={<div>{gameTitle(item) ?? '—'}</div>} />
          <RowItem title="Владелец" aside={<div>{ownerLabel(item, organizerById)}</div>} />
          {hasFiles && <RowItem
            title="Архив / файл"
            sub={item.archiveAsset ? `${item.archiveAsset.fileName} · ${formatBytes(Number(item.archiveAsset.sizeBytes))}` : item.primaryImageAsset && item.kind === 'photo' ? `${item.primaryImageAsset.fileName} · ${formatBytes(Number(item.primaryImageAsset.sizeBytes))}` : official ? 'Официальный контент без архива' : 'Файл не прикреплён'}
            aside={item.archiveAsset?.publicUrl ? <a className="lsr-btn is-sm" href={item.archiveAsset.publicUrl} target="_blank" rel="noreferrer">Скачать ZIP</a> : image && item.kind === 'photo' ? <a className="lsr-btn is-sm" href={image} target="_blank" rel="noreferrer">Просмотреть</a> : undefined}
          />}
          {hasFiles ? <RowItem title="Хранилище" aside={badge(item.storageStatus)} /> : <RowItem title="Файлы" aside={<div>Состав без файлов</div>} />}
          {(item.kind === 'car' || item.kind === 'track' || item.sharedStatus !== 'not_applicable') && <RowItem
            title="Игровой сервер"
            sub={item.installError ? <span className="lsr-cat-error" style={{ color: 'var(--lsr-red)' }}>{item.installError}</span> : item.sharedStatus === 'not_applicable' && item.archiveAssetId ? 'Установка на игровой сервер подключается в разделе 08.' : item.installedAt ? `Установлено ${dateTime(item.installedAt)}` : undefined}
            aside={<div className="lsr-cat-status" style={{ justifyContent: 'flex-end' }}>{badge(item.sharedStatus)}{item.installStatus !== item.sharedStatus && badge(item.installStatus)}{canRetryShared && <Button size="sm" variant="soft" disabled={busy} onClick={onInstallShared}>Установить</Button>}</div>}
          />}
          <RowItem title="Добавил" aside={<div>{catalogActorLabel(item)}<div className="lsr-cat-mute">{dateTime(item.createdAt)}</div></div>} />
          <RowItem title="Обновлено" aside={<div>{dateTime(item.updatedAt)}</div>} />
          <RowItem title="Состояние" aside={badge(item.status)} />
        </div>
        <Notice tone="warning">
          {usages
            ? `Материал используется: ${usages} ${plural(usages, 'связь', 'связи', 'связей')}. ${hasFiles ? 'Замена архива' : 'Изменение состава'} создаёт новую версию; удаление убирает материал из нового выбора, сохранённые версии событий остаются доступны.`
            : hasFiles ? 'Замена архива создаёт новую версию. Удаление убирает материал из нового выбора; сохранённые версии событий остаются доступны.' : 'Изменение состава создаёт новую версию. Удаление убирает материал из нового выбора; сохранённые версии событий остаются доступны.'}
        </Notice>
      </div>
    </Panel>
  );
}

type UploadState = { phase: 'uploading' | 'uploaded' | 'error'; fileName: string; error?: string };

/** Track configurations with per-layout touge zone files: upload (session → confirm → POST) and download. */
export function TrackLayoutsPanel({ item, onUpload, onDownload }: { item: CatalogItem; onUpload: (layoutCode: string, file: File) => Promise<void>; onDownload: (layoutCode: string) => Promise<void> }) {
  const layouts = getTrackLayouts(item);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  async function upload(code: string, file: File) {
    setUploads((current) => ({ ...current, [code]: { phase: 'uploading', fileName: file.name } }));
    try {
      await onUpload(code, file);
      setUploads((current) => ({ ...current, [code]: { phase: 'uploaded', fileName: file.name } }));
    } catch (error) {
      setUploads((current) => ({ ...current, [code]: { phase: 'error', fileName: file.name, error: errorText(error) } }));
    }
  }
  return (
    <Panel title="Конфигурации и зоны тоге" sub="Разметка зон загружается отдельно для каждой конфигурации" shadow>
      {layouts.length ? (
        <div className="lsr-cat-layouts">
          {layouts.map((layout) => {
            const state = uploads[layout.code];
            const status = state?.phase ?? layout.tougeZones?.status;
            const error = state?.phase === 'error' ? state.error : layout.tougeZones?.error;
            const present = layout.tougeZones?.status === 'present';
            return (
              <div className="lsr-cat-layout" key={layout.code}>
                <div className="lsr-cat-layout-head">
                  <div className="lsr-hstack" style={{ gap: 8 }}>
                    <b>{layout.title}</b>
                    {layout.isDefault && <span className="lsr-small-tag">основная</span>}
                    <StatusBadge status={{ code: status ?? 'missing', label: tougeZonesLabel(status) }} tone={tougeZonesTone(status)} variant="badge" />
                  </div>
                  <div className="lsr-hstack" style={{ gap: 8 }}>
                    {present && <Button size="sm" onClick={() => void onDownload(layout.code)}>Скачать конфиг</Button>}
                    <FileButton
                      label={state?.phase === 'uploading' ? 'Загрузка…' : present || state?.phase === 'uploaded' ? 'Заменить разметку' : 'Загрузить разметку'}
                      accept="application/json,.json"
                      disabled={state?.phase === 'uploading'}
                      onFile={(file) => void upload(layout.code, file)}
                    />
                  </div>
                </div>
                <small>
                  Код: {layout.code === 'default' ? 'основная' : layout.code}
                  {layout.pitboxes != null ? ` · мест: ${layout.pitboxes}` : ''}
                  {layout.tougeZones?.checksumSha256 ? ` · ${layout.tougeZones.checksumSha256.slice(0, 10)}` : ''}
                  {layout.tougeZones?.updatedAt ? ` · ${dateTime(layout.tougeZones.updatedAt)}` : ''}
                  {state?.fileName ? ` · ${state.fileName}` : ''}
                </small>
                {error && <small className="lsr-cat-error" role="alert">{error}</small>}
              </div>
            );
          })}
        </div>
      ) : <p className="lsr-muted" style={{ margin: 0 }}>Конфигурации не найдены. Они появятся после загрузки архива с ui_track.json или после сохранения списка конфигураций.</p>}
    </Panel>
  );
}
