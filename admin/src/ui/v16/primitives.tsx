import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Tooltip from '@mui/material/Tooltip';
import { blockTone, type StatusLike, type Tone } from './status';

type ButtonVariant = 'default' | 'primary' | 'soft' | 'plain' | 'danger' | 'danger-solid';
const buttonClass = (variant: ButtonVariant, size?: 'sm', extra?: string) =>
  ['lsr-btn', variant !== 'default' && `is-${variant}`, size === 'sm' && 'is-sm', extra].filter(Boolean).join(' ');

export function Button({ variant = 'default', size, to, className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm'; to?: string }) {
  if (to && !rest.disabled) return <Link className={buttonClass(variant, size, className)} to={to} aria-label={rest['aria-label']}>{children}</Link>;
  return <button type={type} className={buttonClass(variant, size, className)} {...rest}>{children}</button>;
}

/** Inline blue action, e.g. "Открыть →". */
export function TextLink({ to, onClick, children, size, disabled, label }: { to?: string; onClick?: () => void; children: ReactNode; size?: 'sm'; disabled?: boolean; label?: string }) {
  const cls = `lsr-link${size === 'sm' ? ' is-sm' : ''}`;
  if (to && !disabled) return <Link className={cls} to={to} aria-label={label}>{children}</Link>;
  return <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>;
}

export type ServerAction = { code: string; enabled: boolean; reason: { code: string; message: string } | null };
/** A command allowed by the server projection. The reason for a disabled command stays visible on hover/focus. */
export function ActionButton({ action, disabled, onClick, children, variant = 'default', size }: { action: ServerAction | undefined; disabled?: boolean; onClick: () => void; children: ReactNode; variant?: ButtonVariant; size?: 'sm' }) {
  const blocked = disabled || !action?.enabled;
  const reason = action ? action.reason?.message ?? '' : 'Действие недоступно в текущей проекции события';
  return (
    <Tooltip title={!action?.enabled ? reason : ''}>
      <span className="lsr-action-wrap">
        <Button variant={variant} size={size} disabled={blocked} onClick={onClick}>{children}</Button>
      </span>
    </Tooltip>
  );
}

export function Panel({ title, sub, actions, children, foot, body = true, shadow = false, className, id }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode; foot?: ReactNode; body?: boolean; shadow?: boolean; className?: string; id?: string }) {
  return (
    <section className={['lsr-panel', shadow && 'is-shadow', className].filter(Boolean).join(' ')} id={id} aria-label={typeof title === 'string' ? title : undefined}>
      {(title || actions) && (
        <div className="lsr-panel-header">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <div className="lsr-panel-sub">{sub}</div>}
          </div>
          {actions && <div className="lsr-hstack">{actions}</div>}
        </div>
      )}
      {body ? <div className="lsr-panel-body">{children}</div> : children}
      {foot && <div className="lsr-panel-foot">{foot}</div>}
    </section>
  );
}

export function FormGroup({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return <section className="lsr-formgroup"><h3>{title}</h3>{description && <p>{description}</p>}{children}</section>;
}

/** Server status badge. Text is the server label; colour comes from the tone rule of the domain. */
export function StatusBadge({ status, tone, variant = 'status', small, title }: { status: StatusLike | null | undefined; tone?: Tone; variant?: 'status' | 'pill' | 'badge'; small?: boolean; title?: string }) {
  if (!status) return <span className={`lsr-${variant} is-scheduled`}>Нет данных</span>;
  const resolved = tone ?? blockTone(status);
  const hint = title ?? (status.reason?.message || (status.freshness === 'UNCERTAIN' ? 'Состояние не подтверждено свежими данными' : undefined));
  return <span className={`lsr-${variant} is-${resolved}${small ? ' is-small' : ''}`} title={hint}>{status.label}</span>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="lsr-small-tag">{children}</span>;
}

export function MetaGrid({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  return <div className={`lsr-meta-grid${columns === 3 ? '' : ` is-${columns}`}`}>{children}</div>;
}
export function Meta({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="lsr-keyrow"><span>{label}</span><strong>{children ?? '—'}</strong></div>;
}
export function KvGrid({ items }: { items: [ReactNode, ReactNode][] }) {
  return <div className="lsr-kv-grid">{items.map(([label, value], i) => <div className="lsr-kv" key={i}><small>{label}</small><strong>{value ?? '—'}</strong></div>)}</div>;
}
export function InfoTiles({ items }: { items: { label: ReactNode; value: ReactNode; small?: boolean }[] }) {
  return <div className="lsr-info-tiles">{items.map((item, i) => <div className="lsr-info-tile" key={i}><div className="lsr-eyebrow">{item.label}</div><div className={`lsr-value${item.small ? ' is-sm' : ''}`}>{item.value}</div></div>)}</div>;
}
export function DateGrid({ items }: { items: { label: ReactNode; value: ReactNode; hint?: ReactNode }[] }) {
  return <div className="lsr-dategrid">{items.map((item, i) => <div key={i}><span>{item.label}</span><b>{item.value}</b>{item.hint && <small>{item.hint}</small>}</div>)}</div>;
}
export function InfoPills({ items }: { items: ReactNode[] }) {
  return <div className="lsr-infopills">{items.map((item, i) => <span className="lsr-infopill" key={i}>{item}</span>)}</div>;
}
export function Stats({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return <div className="lsr-stats">{items.map((item, i) => <div className="lsr-stat" key={i}><b>{item.value}</b>{item.label}</div>)}</div>;
}
export function Kpis({ items }: { items: { label: ReactNode; value: ReactNode; foot?: ReactNode; problem?: boolean }[] }) {
  return <div className="lsr-kpis">{items.map((item, i) => <div className={`lsr-kpi${item.problem ? ' is-problem' : ''}`} key={i}><div className="lsr-kpi-cap">{item.label}</div><span className="lsr-kpi-num">{item.value}</span>{item.foot && <div className="lsr-kpi-foot">{item.foot}</div>}</div>)}</div>;
}
export function RowItem({ title, sub, aside }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return <div className="lsr-row-item"><div style={{ minWidth: 0 }}><b>{title}</b>{sub && <small>{sub}</small>}</div>{aside}</div>;
}
export function Timeline({ items }: { items: { title: ReactNode; detail?: ReactNode; at: ReactNode }[] }) {
  return <div className="lsr-timeline">{items.map((item, i) => <div className="lsr-timeline-row" key={i}><div><b>{item.title}</b>{item.detail && <p>{item.detail}</p>}</div><time>{item.at}</time></div>)}</div>;
}
export function Details({ summary = 'Технические подробности', value }: { summary?: string; value: unknown }) {
  return <details className="lsr-details"><summary>{summary}</summary><pre className="lsr-pre">{JSON.stringify(value, null, 2)}</pre></details>;
}
