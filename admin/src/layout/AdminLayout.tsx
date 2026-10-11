import { EventAuthoringPage } from '../pages/events/current/EventAuthoringPage';
import {useRealtimeStatus} from '../shared/realtime';
import ArticleIcon from '@mui/icons-material/Article';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { uiFoundation } from '../../../shared/ui-foundation';
import EventIcon from '@mui/icons-material/Event';
import GavelIcon from '@mui/icons-material/Gavel';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import HubIcon from '@mui/icons-material/Hub';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import CollectionsIcon from '@mui/icons-material/Collections';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import MarkChatReadIcon from '@mui/icons-material/MarkChatRead';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import SecurityIcon from '@mui/icons-material/Security';
import { AppBar, Avatar, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, Toolbar, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import MenuIcon from '@mui/icons-material/Menu';
import { Link as RouterLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AccessPage } from '../pages/access/AccessPage';
import { AchievementsPage } from '../pages/achievements/AchievementsPage';
import { AuditPage } from '../pages/audit/AuditPage';
import { ChatsPage } from '../pages/chats/ChatsPage';
import { CatalogPage } from '../pages/catalog/CatalogPage';
import { EventWorkspacePage as EventDetailsPage } from '../pages/events/current/EventWorkspacePage';
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

const drawerWidth = 272;

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
    {
      code: 'events',
      label: 'События',
      group: 'racing',
      path: '/events',
      icon: EventIcon,
      permissions: ['events.read.all', 'events.read.scoped', 'events.read.own', 'events.write.all', 'events.write.scoped', 'events.write.own'],
      element: <EventsPage access={access} />,
    },
    {
      code: 'event-cards',
      label: 'Оформление карточек',
      group: 'content',
      path: '/event-cards',
      icon: CollectionsIcon,
      permissions: ['events.read.all', 'events.read.scoped', 'events.read.own'],
      element: <EventCardStudioPage />,
    },
    {
      code: 'officiating',
      label: 'Судейство',
      group: 'racing',
      path: '/officiating',
      icon: GavelIcon,
      permissions: ['reports.read.all', 'reports.audit.all', 'reports.decide.all'],
      element: <OfficiatingPage />,
    },
    {
      code: 'runtime',
      label: 'Серверы и сессии',
      group: 'racing',
      path: '/runtime',
      icon: PlayCircleIcon,
      permissions: ['events.override.all', 'monitoring.read'],
      element: <RuntimePage />,
    },
    {
      code: 'matchmaking',
      label: 'Матчмейкинг',
      group: 'racing',
      path: '/matchmaking',
      icon: HubIcon,
      permissions: ['matchmaking.read.all', 'matchmaking.manage.all'],
      element: <MatchmakingPage access={access} />,
    },
    {
      code: 'practice-servers',
      label: 'Серверы практики',
      group: 'racing',
      path: '/practice-servers',
      icon: SportsEsportsIcon,
      permissions: ['practice.read.all', 'practice.read.scoped', 'practice.manage.all', 'practice.manage.scoped'],
      element: <PracticeServersPage access={access} />,
    },
    {
      code: 'catalog',
      label: 'Игровой каталог',
      group: 'content',
      path: '/media-catalog',
      icon: Inventory2Icon,
      permissions: ['catalog.manage.all', 'catalog.manage.scoped'],
      element: <CatalogPage access={access} />,
    },
    {
      code: 'content',
      label: 'Сайт и публикации',
      group: 'content',
      path: '/site',
      icon: ArticleIcon,
      permissions: ['news.write.all', 'news.write.scoped', 'news.publish.all', 'news.publish.scoped', 'news.delete.all', 'news.delete.scoped', 'catalog.manage.all'],
      element: <SitePage access={access} />,
    },
    {
      code: 'chats',
      label: 'Чаты',
      group: 'community',
      path: '/chats',
      icon: MarkChatReadIcon,
      permissions: ['chats.review.all', 'chats.system.write'],
      element: <ChatsPage />,
    },
    {
      code: 'achievements',
      label: 'Достижения',
      group: 'community',
      path: '/achievements',
      icon: EmojiEventsIcon,
      permissions: ['users.moderate.all'],
      element: <AchievementsPage />,
    },
    {
      code: 'access',
      label: 'Организаторы и доступы',
      group: 'system',
      path: '/access',
      icon: SecurityIcon,
      permissions: ['access.manage.all', 'organizers.write.all', 'organizers.read.scoped'],
      element: <AccessPage access={access} />,
    },
    {
      code: 'audit',
      label: 'Журнал действий',
      group: 'system',
      path: '/audit',
      icon: HealthAndSafetyIcon,
      permissions: ['audit.read.all'],
      element: <AuditPage />,
    },
    {
      code: 'users',
      label: '\u041F\u0438\u043B\u043E\u0442\u044B',
      group: 'community',
      path: '/users',
      icon: PeopleIcon,
      permissions: ['users.read.all'],
      element: <UsersPage />,
    },
  ];

  return modules.filter((module) => hasAny(access, module.permissions));
}

export function AdminLayout({ access }: { access: AdminAccess }) {
  const realtimeConnected=useRealtimeStatus();
  const desktop = useMediaQuery('(min-width:900px)');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const modules = useMemo(() => getModules(access), [access]);
  const moduleOrder = ['events', 'matchmaking', 'practice-servers', 'runtime', 'officiating', 'catalog', 'content', 'event-cards', 'users', 'chats', 'achievements', 'access', 'audit'];
  const groupItems = (group: ModuleDefinition['group']) => modules
    .filter((item) => item.group === group)
    .sort((left, right) => moduleOrder.indexOf(left.code) - moduleOrder.indexOf(right.code));
  const groups = [
    { code: 'racing', label: 'Гонки', items: groupItems('racing') },
    { code: 'content', label: 'Контент', items: groupItems('content') },
    { code: 'community', label: 'Сообщество', items: groupItems('community') },
    { code: 'system', label: 'Система', items: groupItems('system') },
  ].filter((group) => group.items.length > 0);

  function logout() {
    void logoutSessions().then(() => navigate('/login'))
      .catch(() => navigate('/login', { state: { authError: 'Не удалось завершить сессию на сервере. Проверьте соединение и повторите выход.' } }));
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || navigationOpen}
        onClose={() => setNavigationOpen(false)}
        sx={{
          width: desktop ? drawerWidth : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            p: 2,
            bgcolor: '#eef6ff',
            borderRight: '1px solid #dbe7f3',
          },
        }}
      >
        <Stack spacing={2} sx={{ height: '100%' }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ width: 42, height: 42, borderRadius: 1.25, bgcolor: 'primary.main', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 950, letterSpacing: 0.5 }}>
              LSR
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, lineHeight: 1.05 }}>LSR League</Typography>
              <Typography variant="caption" color="text.secondary">Sim Racing Admin</Typography>
            </Box>
          </Stack>
          <Divider />
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
            <Avatar src={access.user?.avatar ?? access.user?.steamAvatar ?? undefined} alt={access.user?.steamName ?? 'Admin'} sx={{ width: 42, height: 42 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">Администратор</Typography>
              <Typography sx={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {access.user?.steamName ?? `#${access.userId}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {[...new Set(access.grants.map(grant => roleLabel(grant.roleCode)))].join(', ')}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {groups.map((group) => (
              <Box key={group.code} sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, fontWeight: 800, textTransform: 'uppercase' }}>
                  {group.label}
                </Typography>
                <List dense sx={{ py: 0.75 }}>
                  {group.items.map((module) => {
                    const selected = location.pathname === module.path || location.pathname.startsWith(`${module.path}/`);
                    const Icon = module.icon;
                    return (
                      <ListItemButton
                        key={module.code}
                        component={RouterLink}
                        to={module.path}
                        onClick={() => setNavigationOpen(false)}
                        selected={selected}
                        sx={{
                          borderRadius: 1,
                          mb: 0.35,
                          '&.Mui-selected': {
                            bgcolor: alpha('#155eef', 0.12),
                            color: 'primary.main',
                            '& .MuiListItemIcon-root': { color: 'primary.main' },
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 34 }}>
                          <Icon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={module.label} primaryTypographyProps={{ fontWeight: selected ? 800 : 650 }} />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Box>
            ))}
          </Box>
          <Button onClick={logout} startIcon={<LogoutIcon />} color="inherit">
            Выйти
          </Button>
        </Stack>
      </Drawer>
      <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
        <AppBar position="sticky" elevation={0} color="inherit" sx={{ display: { md: 'none' }, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar sx={{ flexWrap: 'wrap', gap: 1 }}>
            <IconButton aria-label="Открыть навигацию" onClick={() => setNavigationOpen(true)}><MenuIcon /></IconButton>
            <Typography sx={{ flex: 1, fontWeight: 800 }}>LSR League Sim Racing</Typography>
            <IconButton aria-label="Выйти" onClick={logout}>
              <LogoutIcon />
            </IconButton>
          <Typography variant="caption" role="status">{realtimeConnected?'Обновления подключены':'Связь восстанавливается; данные могут устареть'}</Typography></Toolbar>
        </AppBar>
        <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: uiFoundation.adminPageWidth, mx: 'auto' }}>
          <Routes>
            {modules.some((module) => module.code === 'practice-servers') ? <Route path="/practice-servers/new" element={<PracticeServersPage access={access} />} /> : null}
            {modules.some((module) => module.code === 'practice-servers') ? <Route path="/practice-servers/:id" element={<PracticeServersPage access={access} />} /> : null}
            {modules.some((module) => module.code === 'practice-servers') ? <Route path="/practice-servers/:id/edit" element={<PracticeServersPage access={access} />} /> : null}
            <Route path="/service-journal" element={<RuntimePage />} />
            {modules.some((module) => module.code === 'events') ? <Route path="/events/new" element={<EventAuthoringPage />} /> : null}
            {modules.map((module) => (
              <Route key={module.code} path={`${module.path}/*`} element={module.element} />
            ))}
            {modules.some((module) => module.code === 'catalog') ? <Route path="/skins/*" element={<Navigate to="/media-catalog?kind=skin" replace />} /> : null}
            <Route path="/events/:eventId" element={<EventDetailsPage />} />
            <Route path="*" element={<Navigate to={modules[0]?.path ?? '/login'} replace />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

function roleLabel(code: string) {
  const normalized = code.replace(/-/g, '_');
  return roleLabels[normalized] ?? code;
}
