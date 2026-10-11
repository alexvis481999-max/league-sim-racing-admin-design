import type { ReactNode } from 'react';
import { Button } from './primitives';

export function Notice({ tone = 'info', children, actions, role }: { tone?: 'info' | 'warning' | 'danger' | 'neutral'; children: ReactNode; actions?: ReactNode; role?: 'alert' | 'status' }) {
  return (
    <div className={`lsr-notice${tone === 'info' ? '' : ` is-${tone}`}`} role={role ?? (tone === 'danger' ? 'alert' : undefined)}>
      {children}
      {actions && <div className="lsr-notice-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action, compact }: { title?: ReactNode; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`lsr-empty${compact ? ' is-compact' : ''}`}>
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, style }: { width?: number | string; height?: number | string; style?: React.CSSProperties }) {
  return <div className="lsr-skeleton" style={{ width, height, ...style }} aria-hidden="true" />;
}

export function LoadingBlock({ rows = 4, label = 'Загрузка данных' }: { rows?: number; label?: string }) {
  return (
    <div className="lsr-stack is-tight" role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={i === 0 ? 22 : 16} width={i === 0 ? '45%' : `${90 - i * 9}%`} />)}
    </div>
  );
}

/** One visible message per failed read; 403 is shown as missing access, never as an empty list. */
export function ErrorState({ error, status, onRetry, compact }: { error: string; status?: number | null; onRetry?: () => void; compact?: boolean }) {
  if (status === 403) return <EmptyState compact={compact} title="Недостаточно прав">{error || 'Ваш доступ не позволяет просматривать этот раздел.'}</EmptyState>;
  return (
    <Notice tone="danger" actions={onRetry ? <Button size="sm" onClick={onRetry}>Повторить</Button> : undefined}>
      {error || 'Не удалось загрузить данные'}
    </Notice>
  );
}

export type Resource<T> = { data: T | null; error: string; busy: boolean; status?: number | null; load: (cursor?: string) => Promise<void> };
/** Loading, error/forbidden and empty are separate states; stale data stays visible during a background refresh. */
export function AsyncView<T>({ resource, empty, isEmpty, children, loading, compact }: { resource: Resource<T>; empty?: ReactNode; isEmpty?: (data: T) => boolean; children: (data: T) => ReactNode; loading?: ReactNode; compact?: boolean }) {
  if (resource.data) {
    return (
      <>
        {resource.error && <ErrorState error={resource.error} status={resource.status} onRetry={() => void resource.load()} compact />}
        {isEmpty?.(resource.data) ? empty ?? <EmptyState compact>Данных нет.</EmptyState> : children(resource.data)}
      </>
    );
  }
  if (resource.error) return <ErrorState error={resource.error} status={resource.status} onRetry={() => void resource.load()} compact={compact} />;
  return <>{loading ?? <LoadingBlock />}</>;
}

export function LoadMore({ hasMore, busy, onClick, label = 'Показать ещё' }: { hasMore: boolean; busy?: boolean; onClick: () => void; label?: string }) {
  if (!hasMore) return null;
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 2px' }}><Button size="sm" disabled={busy} onClick={onClick}>{busy ? 'Загрузка…' : label}</Button></div>;
}
