import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { EventAuthoringPage } from '../pages/events/current/EventAuthoringPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { AccessPage } from '../pages/access/AccessPage';
import { AchievementsPage } from '../pages/achievements/AchievementsPage';
import { AuditPage } from '../pages/audit/AuditPage';
import { ChatsPage } from '../pages/chats/ChatsPage';
import { CatalogPage } from '../pages/catalog/CatalogPage';
import { EventWorkspacePage as EventDetailsPage } from '../pages/events/workspace/EventWorkspacePage';
import { CurrentEventsPage as EventsPage } from '../pages/events/current/CurrentEventsPage';
import { EventCardStudioPage } from '../pages/card-studio/EventCardStudioPage';
import { MatchmakingPage } from '../pages/matchmaking/MatchmakingPage';
import { PracticeServersPage } from '../pages/practice-servers/PracticeServersPage';
import { OfficiatingPage } from '../pages/officiating/OfficiatingPage';
import { RuntimePage } from '../pages/runtime/RuntimePage';
import { SitePage } from '../pages/site/SitePage';
import { CurrentUsersPage as UsersPage } from '../pages/users/CurrentUsersPage';
import { logoutSessions } from '../shared/api';
import { hasAny } from '../shared/format';
import type { AdminAccess, ModuleDefinition } from '../shared/types';
import { ShellContext, type PageChrome } from '../ui/v16';
import { Topbar } from './Topbar';

const roleLabels: Record<string, string> = {
  platform_owner: 'Владелец платформы',
  platform_admin: 'Администратор платформы',
  organizer_owner: 'Владелец организатора',
  organizer_catalog_manager: 'Каталог организатора',
  organizer_event_manager: 'События организатора',
  organizer_news_editor: 'Редактор сайта',
  organizer_referee: 'Судья организатора',
  temporary_event_host: 'Временный организатор',
};

function getModules(access: AdminAccess): ModuleDefinition[] {
  const modules: ModuleDefinition[] = [
    { code: 'events', label: 'События', group: 'racing', path: '/events', glyph: '▣', permissions: ['events.read.all', 'events.read.scoped', 'events.read.own', 'events.write.all', 'events.write.scoped', 'events.write.own'], element: <EventsPage access={access} /> },
    { code: 'event-cards', label: 'Оформление карточек', group: 'content', path: '/event-cards', glyph: '▥', permissions: ['events.read.all', 'events.read.scoped', 'events.read.own'], element: <EventCardStudioPage /> },
    { code: 'officiating', label: 'Судейство', group: 'racing', path: '/officiating', glyph: '⚖', permissions: ['reports.read.all', 'reports.audit.all', 'reports.decide.all'], element: <OfficiatingPage /> },
    { code: 'runtime', label: 'Игровые серверы', group: 'racing', path: '/runtime', glyph: '◷', permissions: ['events.override.all', 'monitoring.read'], element: <RuntimePage /> },
    { code: 'matchmaking', label: 'Матчмейкинг', group: 'racing', path: '/matchmaking', glyph: '⌘', permissions: ['matchmaking.read.all', 'matchmaking.manage.all'], element: <MatchmakingPage access={access} /> },
    { code: 'practice-servers', label: 'Серверы практики', group: 'racing', path: '/practice-servers', glyph: '◎', permissions: ['practice.read.all', 'practice.read.scoped', 'practice.manage.all', 'practice.manage.scoped'], element: <PracticeServersPage access={access} /> },
    { code: 'catalog', label: 'Игровой каталог', group: 'content', path: '/media-catalog', glyph: '▤', permissions: ['catalog.manage.all', 'catalog.manage.scoped'], element: <CatalogPage access={access} /> },
    { code: 'content', label: 'Сайт и публикации', group: 'content', path: '/site', glyph: '▧', permissions: ['news.write.all', 'news.write.scoped', 'news.publish.all', 'news.publish.scoped', 'news.delete.all', 'news.delete.scoped', 'catalog.manage.all'], element: <SitePage access={access} /> },
    { code: 'chats', label: 'Чаты', group: 'community', path: '/chats', glyph: '☷', permissions: ['chats.review.all', 'chats.system.write'], element: <ChatsPage /> },
    { code: 'achievements', label: 'Достижения', group: 'community', path: '/achievements', glyph: '★', permissions: ['users.moderate.all'], element: <AchievementsPage /> },
    { code: 'access', label: 'Организаторы и доступы', group: 'system', path: '/access', glyph: '♧', permissions: ['access.manage.all', 'organizers.write.all', 'organizers.read.scoped'], element: <AccessPage access={access} /> },
    { code: 'audit', label: 'Журнал действий', group: 'system', path: '/audit', glyph: '≡', permissions: ['audit.read.all'], element: <AuditPage /> },
    { code: 'users', label: 'Пилоты', group: 'community', path: '/users', glyph: '♙', permissions: ['users.read.all'], element: <UsersPage /> },
  ];
  const visible = modules.filter((module) => hasAny(access, module.permissions));
  // The overview only composes projections of other sections, so it is shown when at least one of them is available.
  return visible.length ? [{ code: 'dashboard', label: 'Обзор', group: 'platform', path: '/dashboard', glyph: '◫', permissions: [], element: <DashboardPage access={access} /> }, ...visible] : visible;
}

const moduleOrder = ['dashboard', 'events', 'matchmaking', 'practice-servers', 'runtime', 'officiating', 'catalog', 'content', 'event-cards', 'users', 'chats', 'achievements', 'access', 'audit'];
const groupLabels: Record<ModuleDefinition['group'], string> = { platform: 'Платформа', racing: 'Гонки', content: 'Контент', community: 'Сообщество', system: 'Система' };

export function AdminLayout({ access }: { access: AdminAccess }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [chrome, setChromeState] = useState<PageChrome | null>(null);
  const setChrome = useCallback((next: PageChrome | null) => setChromeState(next), []);
  const modules = useMemo(() => getModules(access), [access]);
  const canCreateEvents = access.grants.some((grant) => grant.permissions.some((p) => p.startsWith('events.write.')));
  const hasModule = (code: string) => modules.some((module) => module.code === code);
  const groups = (Object.keys(groupLabels) as ModuleDefinition['group'][])
    .map((group) => ({ group, items: modules.filter((m) => m.group === group).sort((a, b) => moduleOrder.indexOf(a.code) - moduleOrder.indexOf(b.code)) }))
    .filter((group) => group.items.length > 0);
  const creating = location.pathname === '/events/new';
  const current = modules.find((m) => location.pathname === m.path || location.pathname.startsWith(`${m.path}/`)) ?? (location.pathname.startsWith('/service-journal') ? modules.find((m) => m.code === 'runtime') : undefined);
  const roles = [...new Set(access.grants.map((grant) => roleLabel(grant.roleCode)))].join(', ');

  function logout() {
    void logoutSessions().then(() => navigate('/login'))
      .catch(() => navigate('/login', { state: { authError: 'Не удалось завершить сессию на сервере. Проверьте соединение и повторите выход.' } }));
  }
  const link = (to: string, label: string, glyph: string, active: boolean) => (
    <RouterLink key={to} to={to} className={`lsr-side-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} title={label} onClick={() => setNavigationOpen(false)}>
      <span className="lsr-glyph" aria-hidden="true">{glyph}</span><span className="lsr-nav-text">{label}</span>
    </RouterLink>
  );

  return (
    <ShellContext.Provider value={{ moduleLabel: creating ? 'Создание события' : current?.label ?? 'Админка', modulePath: current?.path ?? '/', openNavigation: () => setNavigationOpen(true), setChrome }}>
      <div className={`lsr-shell${navigationOpen ? ' is-nav-open' : ''}`}>
        <aside className="lsr-sidebar" aria-label="Разделы админки">
          <RouterLink to={modules[0]?.path ?? '/'} className="lsr-brand" onClick={() => setNavigationOpen(false)}>
            <span className="lsr-brandmark">LSR</span><span className="lsr-brand-name">LEAGUE SIM RACING</span>
          </RouterLink>
          {groups.map(({ group, items }) => (
            <div key={group}>
              <div className="lsr-nav-section">{groupLabels[group]}</div>
              <nav className="lsr-sidenav" aria-label={groupLabels[group]}>
                {items.map((module) => (
                  <span key={module.code} style={{ display: 'contents' }}>
                    {link(module.path, module.label, module.glyph, !creating && current?.code === module.code)}
                    {module.code === 'events' && canCreateEvents && link('/events/new', 'Создать событие', '＋', creating)}
                  </span>
                ))}
              </nav>
            </div>
          ))}
          <div className="lsr-side-bottom">
            <div className="lsr-side-user">
              <div style={{ minWidth: 0 }}>
                <b>{access.user?.steamName ?? `#${access.userId}`}</b>
                <span>{roles || 'Администратор'}</span>
              </div>
              <button type="button" className="lsr-side-logout" onClick={logout}>Выйти</button>
            </div>
          </div>
        </aside>
        <div className="lsr-scrim" onClick={() => setNavigationOpen(false)} aria-hidden="true" />
        <div className="lsr-workspace">
          <Topbar chrome={chrome} />
          <main className={`lsr-content${chrome?.variant === 'event' ? ' is-event' : ''}`}>
            <Routes>
              {hasModule('practice-servers') ? <Route path="/practice-servers/new" element={<PracticeServersPage access={access} />} /> : null}
              {hasModule('practice-servers') ? <Route path="/practice-servers/:id" element={<PracticeServersPage access={access} />} /> : null}
              {hasModule('practice-servers') ? <Route path="/practice-servers/:id/edit" element={<PracticeServersPage access={access} />} /> : null}
              <Route path="/service-journal" element={<RuntimePage />} />
              {hasModule('events') ? <Route path="/events/new" element={<EventAuthoringPage />} /> : null}
              {modules.map((module) => <Route key={module.code} path={`${module.path}/*`} element={module.element} />)}
              {hasModule('catalog') ? <Route path="/skins/*" element={<Navigate to="/media-catalog?kind=skin" replace />} /> : null}
              <Route path="/events/:eventId" element={<EventDetailsPage />} />
              <Route path="*" element={<Navigate to={modules[0]?.path ?? '/login'} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}

function roleLabel(code: string) {
  const normalized = code.replace(/-/g, '_');
  return roleLabels[normalized] ?? code;
}
