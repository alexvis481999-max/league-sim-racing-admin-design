#!/usr/bin/env node
// Dev-only mock of the admin API for visual checks without a backend.
// Not used by the build or tests. Run: `npm run mock-api` (port 3000 by default, MOCK_API_PORT to override).
// Responses follow the client types and api-reference/workspace-schedule projections; values are synthetic.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DRAFTS, EVENTS, NOW, findEvent, listEvents, page, workspaceSection, workspaceSummary } from './events.mjs';
import { referenceRoute } from './reference.mjs';
import { attachRealtime, broadcast } from './realtime.mjs';

const port = Number(process.env.MOCK_API_PORT ?? 3000);
const catalog = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/features/event-authoring/fixtures/catalog.json', import.meta.url)), 'utf8'));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub) => `${b64({ alg: 'none' })}.${b64({ sub, exp: Math.floor(Date.now() / 1000) + 12 * 3600 })}.mock`;
const ALL_PERMISSIONS = ['events.read.all', 'events.write.all', 'events.publish.all', 'events.cancel.all', 'events.registrations.manage.all', 'events.override.all', 'monitoring.read', 'matchmaking.read.all', 'matchmaking.manage.all', 'practice.read.all', 'practice.manage.all', 'catalog.manage.all', 'news.write.all', 'news.publish.all', 'news.delete.all', 'chats.review.all', 'chats.system.write', 'users.moderate.all', 'users.read.all', 'access.manage.all', 'organizers.write.all', 'audit.read.all', 'reports.read.all', 'reports.audit.all', 'reports.decide.all', 'notifications.admin.delivery'];
const access = { userId: '701', user: { id: '701', steamId: '76561198000000701', steamName: 'Vortex', steamAvatar: null, avatar: null, firstName: null, lastName: null }, grants: [{ id: 'g1', roleCode: 'platform_owner', scopeType: 'platform', scopeId: null, validFrom: null, validTo: null, constraints: null, permissions: ALL_PERMISSIONS }], panelAccess: true };

const routes = [];
const on = (method, pattern, handler) => routes.push({ method, pattern: new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, '(?<$1>[^/]+)') + '$'), handler });

// The real API hosts a coordinator page that serialises cookie refreshes between tabs (shared/browser-session-lock.ts).
routes.push({ method: 'GET', pattern: /^\/auth\/session-coordinator$/, html: `<!doctype html><script>
addEventListener('message', (e) => { const d = e.data; if (d?.type === 'lsr-session-lock' && d.action === 'acquire') e.source.postMessage({ type: 'lsr-session-lock', id: d.id, status: 'acquired' }, e.origin); });
</script>` });
on('POST', '/auth/refresh', () => ({ accessToken: token('user-701') }));
on('POST', '/admin/auth/refresh', () => ({ accessToken: token('admin-701') }));
on('POST', '/admin/auth/login', () => ({ accessToken: token('admin-701') }));
on('POST', '/admin/auth/logout', () => ({}));
on('GET', '/users/me', () => ({ steamId: access.user.steamId, steamName: 'Vortex', steamAvatar: null }));
on('GET', '/admin/me/access', () => access);

on('GET', '/admin/events', ({ q }) => listEvents(q));
on('GET', '/admin/event-drafts', ({ q }) => page(DRAFTS.filter((d) => !q.get('q') || JSON.stringify(d).toLowerCase().includes(q.get('q').toLowerCase())), q, 20));
on('GET', '/admin/event-drafts/:id', ({ p }) => DRAFTS.find((d) => d.id === p.id) ?? fail(404, 'event_draft_not_found'));
on('GET', '/admin/event-authoring/catalog', () => catalog);
on('POST', '/admin/event-authoring/resolve', ({ body }) => ({ contractVersion: 1, revision: body?.revision ?? 0, canPublish: true, issues: [], warnings: [], editRestrictions: body?.edit ? { structureLocked: true, scheduleLocked: false, paths: [] } : undefined, preview: null }));
on('PUT', '/admin/event-authoring/events/:id', ({ p, body }) => {
  const e = findEvent(p.id);
  if (!e) return fail(404, 'event_not_found');
  if (body?.expectedVersion !== e.version) return fail(409, 'event_version_conflict', 'Событие уже изменено другим администратором. Обновите данные.');
  e.settings = body.document.settings;
  e.version = String(Number(e.version) + 1);
  return { eventId: e.id, version: e.version };
});
on('GET', '/admin/events/:id/workspace', ({ p }) => { const e = findEvent(p.id); return e ? workspaceSummary(e) : fail(404, 'event_not_found'); });
on('GET', '/admin/events/:id/workspace/:section', ({ p, q }) => {
  const e = findEvent(p.id);
  if (!e) return fail(404, 'event_not_found');
  const r = workspaceSection(e, p.section, q);
  return r?.__status ? fail(r.__status, r.error.code, r.error.message) : r;
});
on('GET', '/admin/events/:id/copy-template', ({ p }) => ({ scenarioCode: findEvent(p.id)?.scenarioCode, settings: findEvent(p.id)?.settings ?? {} }));
on('PATCH', '/admin/events/:id', ({ p, body }) => versioned(p.id, body, (e) => { if (body.patch?.description !== undefined) e.description = body.patch.description; }));
on('POST', '/admin/events/:id/publish', ({ p }) => { const e = findEvent(p.id); e.status = 'PUBLISHED'; return { eventId: e.id, version: e.version }; });
on('POST', '/admin/events/:id/cancel', ({ p, body }) => versioned(p.id, body, (e) => { e.status = 'CANCELLED'; }));
on('POST', '/admin/events/:id/reschedule', ({ p, body }) => versioned(p.id, body, () => {}));
on('POST', '/admin/events/:id/registrations/:key/entries/:entry/:op', ({ p, body }) => versioned(p.id, body, () => {}));
on('GET', '/admin/events/:id/game-chat', () => ({ items: [], nextCursor: null }));
on('GET', '/games/assetto_corsa/.*', ({ path }) => referenceRoute(path) ?? fail(404, 'not_found'));

// Section mocks live in ./modules/*.mjs and export register(on, helpers); see modules/README.md.
import { readdirSync } from 'node:fs';
for (const file of readdirSync(fileURLToPath(new URL('./modules', import.meta.url))).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = await import(new URL('./modules/' + file, import.meta.url));
  mod.register?.(on, { fail, page, NOW });
}
function versioned(id, body, apply) {
  const e = findEvent(id);
  if (!e) return fail(404, 'event_not_found');
  if (body?.expectedVersion !== e.version) return fail(409, 'event_version_conflict', 'Событие уже изменено. Обновите данные и повторите.');
  apply(e);
  e.version = String(Number(e.version) + 1);
  return { eventId: e.id, version: e.version };
}
function fail(status, code, message) { return { __status: status, body: { error: { code, message: message ?? code } } }; }

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, If-Match');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, ETag');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  if (req.method !== 'GET' && process.env.MOCK_API_LOG !== '0') console.log(`[mock-api] ${req.method} ${url.pathname} key=${req.headers['idempotency-key'] ?? '-'} body=${raw.slice(0, 300)}`);
  const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
  if (!route) {
    console.log(`[mock-api] 404 ${req.method} ${url.pathname}${url.search}`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'mock_route_missing', message: `Mock API: маршрут ${req.method} ${url.pathname} не реализован` } }));
    return;
  }
  const p = route.pattern.exec(url.pathname).groups ?? {};
  if (route.html) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(route.html); return; }
  const delay = Number(process.env.MOCK_API_DELAY_MS ?? 120);
  await new Promise((r) => setTimeout(r, delay));
  const result = route.handler({ p, q: url.searchParams, body, path: url.pathname, req });
  const status = result?.__status ?? 200;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result?.__status ? result.body : result));
  if (status >= 400) console.log(`[mock-api] ${status} ${req.method} ${url.pathname}`);
  else if (req.method !== 'GET' && !url.pathname.endsWith('/resolve') && !url.pathname.includes('/auth/')) {
    const section = url.pathname.split('/')[2] ?? '';
    const domains = { events: 'events', 'event-drafts': 'events', 'event-authoring': 'events', 'practice-servers': 'practice', matchmaking: 'matchmaking', catalog: 'catalog', publications: 'publications', officiating: 'reports', access: 'security', users: 'users', chat: 'chats', notifications: 'notifications' };
    setTimeout(() => broadcast(domains[section] ?? section), 50);
  }
});
attachRealtime(server);
server.listen(port, () => console.log(`[mock-api] http://localhost:${port} · simulated now ${NOW} · ${EVENTS.length} events`));
