// Mock: Организаторы и доступы (/admin/access/*, admin password). Shapes follow admin/src/shared/access-types.ts.
// GET /admin/access/organizers is also registered by the core server with a reduced shape; the core route wins there
// (see docs/v16/users-access.md). The richer list below is used when the core route is absent.
import { USERS } from './users.mjs';

const NOW = Date.parse('2026-10-09T10:05:00.000Z');
const ALL = ['panel.access', 'events.read.all', 'events.write.all', 'events.publish.all', 'users.read.all', 'access.manage.all', 'organizers.write.all', 'audit.read.all'];
const ROLES = [
  { code: 'platform_owner', title: 'Владелец платформы', description: 'Все разрешения платформы, включая доступы и организаторов.', scopeTypes: ['platform'], permissions: ALL },
  { code: 'platform_admin', title: 'Администратор платформы', description: 'Модули, контент и события всех организаторов, без управления владельцами.', scopeTypes: ['platform'], permissions: ['panel.access', 'events.read.all', 'events.write.all', 'users.read.all', 'catalog.manage.all', 'news.write.all'] },
  { code: 'organizer_owner', title: 'Владелец организатора', description: 'Управление своей областью: события, оформление организатора, судьи.', scopeTypes: ['organizer'], permissions: ['panel.access', 'events.read.scoped', 'events.write.scoped', 'organizers.read.scoped', 'organizers.presentation.write.scoped'] },
  { code: 'organizer_event_manager', title: 'Менеджер событий', description: 'События и расписание организатора в пределах квот.', scopeTypes: ['organizer'], permissions: ['panel.access', 'events.read.scoped', 'events.write.scoped'] },
  { code: 'organizer_referee', title: 'Судья организатора', description: 'Протесты и решения по событиям организатора.', scopeTypes: ['organizer', 'event'], permissions: ['panel.access', 'reports.read.scoped', 'reports.decide.scoped'] },
  { code: 'organizer_catalog_manager', title: 'Каталог организатора', description: 'Каталог и материалы организатора.', scopeTypes: ['organizer'], permissions: ['panel.access', 'catalog.manage.scoped'] },
  { code: 'temporary_event_host', title: 'Временный организатор', description: 'Проведение одного события в заданный срок.', scopeTypes: ['event'], permissions: ['panel.access', 'events.read.own', 'events.write.own'] },
];
const settings = (patch) => ({ maxEvents: null, maxRaceEvents: null, maxConcurrentEvents: null, maxConcurrentRaces: null, quotaEnforcementMode: 'block', allowedEventRuntimeTypes: [], allowedTougeSubtypes: [], allowedTougeDuelEntryModes: [], theme: null, websiteUrl: null, discordUrl: null, ...patch });
export const ORGANIZERS = [
  { id: '1', version: '3', code: 'lsr', name: 'LeagueSimRacing', description: 'Основной организатор платформы', active: true, settings: settings({ websiteUrl: 'https://leaguesimracing.ru', discordUrl: 'https://discord.gg/lsr', theme: { accent: '#285ed6' } }), createdAt: '2025-01-10T09:00:00.000Z', updatedAt: '2026-09-30T12:00:00.000Z', usage: { events: 41, raceEvents: 118, activeEvents: 3, activeRaces: 1 }, remaining: { maxEvents: null, maxRaceEvents: null, maxConcurrentEvents: null, maxConcurrentRaces: null }, actions: { edit: true, editPresentation: true } },
  { id: '2', version: '7', code: 'trackday', name: 'Trackday Club', description: 'Практики и разовые гонки клуба', active: true, settings: settings({ maxEvents: 20, maxRaceEvents: 60, maxConcurrentEvents: 2, maxConcurrentRaces: null, quotaEnforcementMode: 'warn', allowedEventRuntimeTypes: ['practice', 'single'], websiteUrl: 'https://trackday.example' }), createdAt: '2025-06-01T09:00:00.000Z', updatedAt: '2026-10-01T08:30:00.000Z', usage: { events: 18, raceEvents: 47, activeEvents: 2, activeRaces: 0 }, remaining: { maxEvents: 2, maxRaceEvents: 13, maxConcurrentEvents: 0, maxConcurrentRaces: null }, actions: { edit: true, editPresentation: true } },
  { id: '3', version: '2', code: 'touge', name: 'Touge Community', description: null, active: false, settings: settings({ maxEvents: 5, allowedEventRuntimeTypes: ['touge', 'time_attack'], allowedTougeSubtypes: ['tournament', 'time_attack'], allowedTougeDuelEntryModes: ['manual'] }), createdAt: '2025-11-20T09:00:00.000Z', updatedAt: '2026-08-14T16:00:00.000Z', usage: null, remaining: null, actions: { edit: true, editPresentation: true } },
];
const status = (g) => g.revokedAt ? 'revoked' : g.validTo && Date.parse(g.validTo) < NOW ? 'expired' : g.validFrom && Date.parse(g.validFrom) > NOW ? 'scheduled' : 'active';
let seq = 50;
const GRANTS = [
  { id: '11', version: 'g11-1', subjectId: '701', roleCode: 'platform_owner', scopeType: 'platform', scopeId: null, validFrom: null, validTo: null, revokedAt: null, constraints: null },
  { id: '12', version: 'g12-1', subjectId: '702', roleCode: 'organizer_event_manager', scopeType: 'organizer', scopeId: '1', validFrom: '2026-10-01T09:00:00.000Z', validTo: null, revokedAt: null, constraints: { allowedEventRuntimeTypes: ['weekly', 'single'], mustEndWithinHours: 6 } },
  { id: '13', version: 'g13-2', subjectId: '702', roleCode: 'organizer_referee', scopeType: 'organizer', scopeId: '2', validFrom: '2026-09-15T09:00:00.000Z', validTo: '2026-10-05T21:00:00.000Z', revokedAt: null, constraints: null },
  { id: '14', version: 'g14-1', subjectId: '702', roleCode: 'temporary_event_host', scopeType: 'event', scopeId: '3110', validFrom: '2026-10-15T09:00:00.000Z', validTo: '2026-10-17T21:00:00.000Z', revokedAt: null, constraints: null },
  { id: '15', version: 'g15-3', subjectId: '703', roleCode: 'organizer_catalog_manager', scopeType: 'organizer', scopeId: '3', validFrom: '2026-09-12T09:00:00.000Z', validTo: null, revokedAt: '2026-10-02T12:00:00.000Z', constraints: null },
];
const HISTORY = new Map([['12', [{ id: 'h1', actorId: '701', at: '2026-09-30T15:20:00.000Z', before: null, after: { ...GRANTS[1], validFrom: null } }, { id: 'h2', actorId: '701', at: '2026-10-01T08:10:00.000Z', before: { ...GRANTS[1], validFrom: null }, after: GRANTS[1] }]]]);
const view = (g) => ({ ...g, status: status(g) });
const record = (actorId, before, after) => { const list = HISTORY.get(after.id) ?? []; list.push({ id: 'h' + ++seq, actorId, at: new Date().toISOString(), before, after: { ...after } }); HISTORY.set(after.id, list); };

function grantError(body) {
  const role = ROLES.find((r) => r.code === body?.roleCode);
  if (!role || !role.scopeTypes.includes(body.scopeType)) return 'Роль недоступна для выбранной области.';
  if (body.scopeType !== 'platform' && !/^[1-9]\d*$/.test(body.scopeId ?? '')) return 'Укажите объект области.';
  if (body.validFrom && body.validTo && Date.parse(body.validFrom) > Date.parse(body.validTo)) return 'Дата начала позже даты окончания.';
  return null;
}
const versionCheck = (req, current, fail) => !req.headers['if-match'] ? fail(428, 'version_required') : req.headers['if-match'] !== current ? fail(409, 'version_conflict') : null;

export function register(on, { fail }) {
  on('GET', '/admin/access/roles', () => ({ items: ROLES }));
  on('GET', '/admin/access/organizers', () => ORGANIZERS);
  on('POST', '/admin/access/organizers', ({ body }) => {
    if (ORGANIZERS.some((o) => o.code === body?.code)) return fail(409, 'organizer_code_exists');
    const org = { id: String(ORGANIZERS.length + 1), version: '1', code: body.code, name: body.name, description: body.description ?? null, active: body.active !== false, settings: settings(body.settings), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usage: { events: 0, raceEvents: 0, activeEvents: 0, activeRaces: 0 }, remaining: {}, actions: { edit: true, editPresentation: true } };
    ORGANIZERS.push(org);
    return org;
  });
  on('PUT', '/admin/access/organizers/:id', ({ p, body, req }) => {
    const org = ORGANIZERS.find((o) => o.id === p.id);
    if (!org) return fail(404, 'organizer_not_found');
    const conflict = versionCheck(req, org.version, fail);
    if (conflict) return conflict;
    Object.assign(org, { code: body.code, name: body.name, description: body.description, active: body.active, settings: settings(body.settings), version: String(Number(org.version) + 1), updatedAt: new Date().toISOString() });
    return org;
  });
  on('PUT', '/admin/access/organizers/:id/presentation', ({ p, body, req }) => {
    const org = ORGANIZERS.find((o) => o.id === p.id);
    if (!org) return fail(404, 'organizer_not_found');
    const conflict = versionCheck(req, org.version, fail);
    if (conflict) return conflict;
    Object.assign(org, { name: body.name, description: body.description, version: String(Number(org.version) + 1) });
    Object.assign(org.settings, { theme: body.theme, websiteUrl: body.websiteUrl, discordUrl: body.discordUrl });
    return org;
  });

  on('GET', '/admin/access/grants', ({ q }) => q.get('subjectId') ? GRANTS.filter((g) => g.subjectId === q.get('subjectId')).map(view) : fail(400, 'subject_required'));
  on('POST', '/admin/access/grants', ({ body }) => {
    const error = grantError(body);
    if (error) return fail(400, 'invalid_grant', error);
    const grant = { id: String(++seq), version: `g${seq}-1`, subjectId: body.subjectId, roleCode: body.roleCode, scopeType: body.scopeType, scopeId: body.scopeId, validFrom: body.validFrom, validTo: body.validTo, revokedAt: null, constraints: body.constraints };
    GRANTS.push(grant); record('701', null, grant);
    return view(grant);
  });
  on('PUT', '/admin/access/grants/:id', ({ p, body, req }) => {
    const grant = GRANTS.find((g) => g.id === p.id);
    if (!grant) return fail(404, 'grant_not_found');
    if (grant.revokedAt) return fail(409, 'grant_revoked');
    const conflict = versionCheck(req, grant.version, fail);
    if (conflict) return conflict;
    const error = grantError(body);
    if (error) return fail(400, 'invalid_grant', error);
    const before = { ...grant };
    Object.assign(grant, { roleCode: body.roleCode, scopeType: body.scopeType, scopeId: body.scopeId, validFrom: body.validFrom, validTo: body.validTo, constraints: body.constraints, version: `g${grant.id}-${Date.now()}` });
    record('701', before, grant);
    return view(grant);
  });
  on('DELETE', '/admin/access/grants/:id', ({ p, req }) => {
    const grant = GRANTS.find((g) => g.id === p.id);
    if (!grant) return fail(404, 'grant_not_found');
    const conflict = versionCheck(req, grant.version, fail);
    if (conflict) return conflict;
    if (grant.roleCode === 'platform_owner' && !grant.validTo && GRANTS.filter((g) => g.roleCode === 'platform_owner' && !g.revokedAt).length === 1) return fail(409, 'last_platform_owner');
    const before = { ...grant };
    Object.assign(grant, { revokedAt: new Date().toISOString(), version: `g${grant.id}-${Date.now()}` });
    record('701', before, grant);
    return view(grant);
  });
  on('GET', '/admin/access/grants/:id/history', ({ p }) => HISTORY.get(p.id) ?? []);

  on('PUT', '/admin/auth/password', ({ body }) => (USERS.some((u) => u.userId === body?.userId) && body?.adminPassword ? {} : fail(400, 'invalid_password_request')));
  on('DELETE', '/admin/auth/password/:userId', ({ p }) => (USERS.some((u) => u.userId === p.userId) ? {} : fail(404, 'user_not_found')));
}
