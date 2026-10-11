import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRealtimeStatus } from '../../shared/realtime';

/** Crumb labels are plain strings so the page chrome can be compared and stored without re-render loops. */
export type Crumb = { label: string; to?: string };
export type PageChrome = { crumbs?: Crumb[]; back?: { label?: string; to?: string } | null; variant?: 'module' | 'event' };
type ShellContextValue = { moduleLabel: string; modulePath: string; openNavigation: () => void; setChrome: (chrome: PageChrome | null) => void };
export const ShellContext = createContext<ShellContextValue>({ moduleLabel: '', modulePath: '/', openNavigation: () => {}, setChrome: () => {} });
export const useShell = () => useContext(ShellContext);

/** Embedded pages (a journal inside an event, etc.) never replace the host page chrome. */
export const EmbeddedContext = createContext(false);
export const useEmbedded = () => useContext(EmbeddedContext);

/** Declares the topbar of the current screen: breadcrumbs, back target and v16 geometry. */
export function usePageChrome(chrome: PageChrome) {
  const { setChrome } = useShell();
  const embedded = useEmbedded();
  const key = JSON.stringify(chrome);
  useLayoutEffect(() => {
    if (embedded) return;
    setChrome(JSON.parse(key) as PageChrome);
    return () => setChrome(null);
  }, [key, embedded, setChrome]);
}

export function Topbar({ chrome }: { chrome: PageChrome | null }) {
  const shell = useShell();
  const navigate = useNavigate();
  const connected = useRealtimeStatus();
  const items = chrome?.crumbs?.length ? chrome.crumbs : [{ label: shell.moduleLabel }];
  const back = chrome?.back;
  return (
    <header className={`lsr-topbar${chrome?.variant === 'event' ? ' is-event' : ''}`}>
      <div className="lsr-topbar-left">
        <button type="button" className="lsr-menu-button" aria-label="Открыть навигацию" onClick={shell.openNavigation}>☰</button>
        {back && <button type="button" className="lsr-backtop" onClick={() => (back.to ? navigate(back.to) : navigate(-1))}>← {back.label ?? 'Назад'}</button>}
        <nav className="lsr-crumbs" aria-label="Навигационная цепочка">
          {items.map((crumb, index) => {
            const last = index === items.length - 1;
            return (
              <span key={index} style={{ display: 'contents' }}>
                {index > 0 && <span className="lsr-crumb-sep" aria-hidden="true">›</span>}
                {last ? <b aria-current="page">{crumb.label}</b> : crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
              </span>
            );
          })}
        </nav>
      </div>
      <div className="lsr-topright" role="status">
        <span className={`lsr-dot ${connected ? 'is-done' : 'is-current'}`} aria-hidden="true" />
        {connected ? 'LeagueSimRacing · обновления подключены' : 'LeagueSimRacing · нет связи, данные могут устареть'}
      </div>
    </header>
  );
}

export function PageHeader({ overline, title, description, actions, children }: { overline?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="lsr-pagetop">
      <div className="lsr-pagetop-main">
        {overline && <div className="lsr-smallover">{overline}</div>}
        <h1 className="lsr-page-title">{title}</h1>
        {description && <div className="lsr-page-desc">{description}</div>}
        {children}
      </div>
      {actions && <div className="lsr-page-actions">{actions}</div>}
    </div>
  );
}

export type TabItem<T extends string> = { key: T; label: ReactNode; count?: number | null; hidden?: boolean };
export function Tabs<T extends string>({ items, value, onChange, variant = 'page', label }: { items: TabItem<T>[]; value: T; onChange: (key: T) => void; variant?: 'page' | 'module'; label: string }) {
  return (
    <div className={`lsr-tabs${variant === 'module' ? ' is-module' : ''}`} role="tablist" aria-label={label}>
      {items.filter((item) => !item.hidden).map((item) => (
        <button key={item.key} type="button" role="tab" aria-selected={item.key === value} className={`lsr-tab${item.key === value ? ' is-active' : ''}`} onClick={() => onChange(item.key)}>
          {item.label}
          {item.count != null && <span className="lsr-tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Secondary switch inside a section (v16 matchmaking/settings sub-navigation). */
export function SubTabs<T extends string>({ items, value, onChange, label }: { items: { key: T; label: ReactNode }[]; value: T; onChange: (key: T) => void; label: string }) {
  return (
    <div className="lsr-subtabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button key={item.key} type="button" role="tab" aria-selected={item.key === value} className={item.key === value ? 'is-active' : ''} onClick={() => onChange(item.key)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
