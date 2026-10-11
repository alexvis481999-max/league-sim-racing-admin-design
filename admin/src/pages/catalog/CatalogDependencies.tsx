import { Link } from 'react-router-dom';
import type { CatalogItem } from '../../shared/types';
import { ErrorState, LoadingBlock, Panel, dateTime } from '../../ui/v16';
import type { LoadError } from './catalogData';
import { usageLabel, type CatalogDetails, type DependencyUsage } from './catalogModel';

const isDependency = (value: unknown): value is DependencyUsage => !!value && typeof value === 'object' && 'ownerType' in value && 'ownerId' in value;

/** Usages of the card, dependent saved versions and the version history (`GET /admin/catalog/items/{id}`). */
export function CatalogDependencies({ item, details }: { item: CatalogItem; details: { data: CatalogDetails | null; error: LoadError | null; loading: boolean } }) {
  const dependencies = (details.data?.usages ?? []).filter(isDependency);
  const versions = details.data?.versions ?? [];
  return (
    <Panel title="Версии и использование" sub="Сохранённые версии событий продолжают использовать свою версию материала" shadow>
      <div className="lsr-stack is-tight">
        <div>
          <h3 className="lsr-cat-section-title">Где используется</h3>
          {item.usages?.length ? (
            <div className="lsr-cat-list">
              {item.usages.map((usage) => (
                <div key={usage.id}>
                  <span>{usageLabel(usage.usageType)}: {usage.url ? <a href={usage.url} target={usage.url.startsWith('/') ? undefined : '_blank'} rel="noreferrer">{usage.targetTitle}</a> : usage.targetTitle}</span>
                  <small>{[usage.placement, usage.targetId && `#${usage.targetId}`].filter(Boolean).join(' · ') || '—'}</small>
                </div>
              ))}
            </div>
          ) : <p className="lsr-muted" style={{ margin: 0 }}>Не используется.</p>}
        </div>
        {details.loading && !details.data ? <LoadingBlock rows={3} label="Загрузка версий" /> : details.error ? (
          <ErrorState compact error={details.error.status === 403 ? 'Недостаточно прав для просмотра версий.' : 'Не удалось загрузить версии и использование'} status={details.error.status} />
        ) : (
          <>
            <div>
              <h3 className="lsr-cat-section-title">Зависимые версии</h3>
              {dependencies.length ? (
                <div className="lsr-cat-list">
                  {dependencies.map((usage, i) => (
                    <div key={i}>
                      <span>{usage.ownerType === 'EVENT' ? <Link to={`/events/${usage.ownerId}`}>Событие #{usage.ownerId}</Link> : `Версия набора #${usage.ownerId}`}</span>
                      <small>версия {usage.versionId}</small>
                    </div>
                  ))}
                </div>
              ) : <p className="lsr-muted" style={{ margin: 0 }}>Доступных вам зависимостей нет.</p>}
            </div>
            <div>
              <h3 className="lsr-cat-section-title">Версии</h3>
              {versions.length ? (
                <div className="lsr-cat-list">
                  {versions.map((version) => (
                    <div key={version.id}>
                      <span className="lsr-cat-code">{version.id}<span className="lsr-sub"> · {version.checksumSha256?.slice(0, 12) ?? 'без архива'}</span></span>
                      <small>{dateTime(version.createdAt)}</small>
                    </div>
                  ))}
                </div>
              ) : <p className="lsr-muted" style={{ margin: 0 }}>Версии не переданы.</p>}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
