// Audit mock: GET /admin/audit with free-text search, eventId filter and opaque cursor.
// Shape follows AuditItem in admin/src/shared/access-types.ts. Synthetic data.
const MIN = 60_000;
const base = Date.parse('2026-10-09T10:05:00.000Z');
const SAMPLES = [
  { action: 'event.reschedule', target: 'event', reason: 'Плановый старт перенесён на 10:40', changes: { startsAt: { before: '2026-10-10T07:30:00Z', after: '2026-10-10T07:40:00Z' } } },
  { action: 'runtime.session.start', target: 'runtime_session', system: true, reason: 'Выделен игровой сервер', changes: null },
  { action: 'chat.review.create', target: 'chat_thread', reason: 'Просмотр в рамках жалобы', changes: null },
  { action: 'access.grant.create', target: 'grant', reason: 'Добавлен доступ к событиям организатора', changes: { roleCode: { before: null, after: 'event_manager' } } },
  { action: 'officiating.decision.issue', target: 'decision', reason: 'Штраф времени +5 с', changes: { status: { before: 'draft', after: 'applied' } } },
  { action: 'event.registration.review', target: 'registration_entry', reason: 'Заявка принята', changes: { status: { before: 'PENDING', after: 'ACCEPTED' } } },
  { action: 'catalog.item.update', target: 'catalog_item', reason: null, changes: { title: { before: 'BMW M4', after: 'BMW M4 GT3' } } },
];
const ITEMS = Array.from({ length: 130 }, (_, i) => {
  const s = SAMPLES[i % SAMPLES.length];
  const eventId = i % 3 === 2 ? '1040' : '1038';
  return {
    id: String(9007199254740000n + BigInt(130 - i)), at: new Date(base - i * 37 * MIN - (i % 60) * 1000).toISOString(),
    actor: s.system ? { type: 'system', userId: null } : { type: 'user', userId: String(701 + (i % 3) * 7) },
    action: s.action, target: { type: s.target, id: s.target === 'event' ? eventId : String(9007199254740993n + BigInt(i)) },
    subjectId: s.target === 'grant' ? String(705 + (i % 10)) : null, organizerId: '1', eventId: ['event', 'registration_entry', 'decision', 'runtime_session'].includes(s.target) ? eventId : null,
    changes: s.changes, reason: s.reason, commandId: s.system ? null : `cmd-${(i * 7919).toString(16)}`,
  };
});

export function register(on) {
  on('GET', '/admin/audit', ({ q }) => {
    let items = ITEMS;
    if (q.get('eventId')) items = items.filter((x) => x.eventId === q.get('eventId'));
    const words = (q.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) items = items.filter((x) => { const s = JSON.stringify(x).toLowerCase(); return words.every((w) => s.includes(w)); });
    const limit = Number(q.get('limit') ?? 50);
    const start = q.get('cursor') ? Number(Buffer.from(q.get('cursor'), 'base64url').toString()) : 0;
    const next = start + limit < items.length ? Buffer.from(String(start + limit)).toString('base64url') : null;
    return { items: items.slice(start, start + limit), nextCursor: next };
  });
}
