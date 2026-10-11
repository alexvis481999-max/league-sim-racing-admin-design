import { Link, useNavigate } from 'react-router-dom';
import { useRealtimeStatus } from '../shared/realtime';
import { useShell, type PageChrome } from '../ui/v16';

/** Shell topbar: back target and breadcrumbs declared by the current page, realtime delivery state on the right. */
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

