// Mock of «Сайт и публикации»: /admin/publications (entry + revision + placements + version) and slide order per placement.
// Shapes follow admin/src/shared/types.ts (PublicationDetails) and ADMIN_API_MAP.md «Управление публикациями». Values are synthetic.
const SLIDERS = ['home.hero', 'home.promo', 'touge.featured_news'];
let seq = 900;

const placement = (revisionId, code, extra = {}) => ({
  id: `pl-${revisionId}-${code}`, contentRevisionId: revisionId, placementCode: code, enabled: true, sortOrder: 0,
  startsAt: null, endsAt: null, titleOverride: null, summaryOverride: null, eyebrowOverride: null, imageAssetId: null, actions: [], presentation: {}, ...extra,
});

function publication({ id, slug, kind, status, title, summary, body, organizerId = null, publishedAt = null, scheduledPublishAt = null, places, draftOnTop = false }) {
  const revisionId = `rev-${id}-${draftOnTop ? 2 : 1}`;
  const placements = places.map(([code, extra]) => placement(revisionId, code, extra));
  return {
    version: 3,
    allowedActions: { edit: true, publish: true, delete: true },
    entry: {
      id, contentType: 'publication', slug, status, visibility: 'public', locale: 'ru', currentRevisionId: draftOnTop ? `rev-${id}-1` : revisionId,
      coverAssetId: null, primaryAssetId: null, eventId: null, accessOrganizerId: organizerId, disciplineCode: null, gameCode: null, contentCode: null,
      publicationKind: kind, publishedAt, scheduledPublishAt, scheduledRevisionId: scheduledPublishAt ? revisionId : null, currentTitle: title, currentSummary: summary,
    },
    revision: { id: revisionId, contentEntryId: id, changeSetId: `cs-${id}`, title, summary, body, metadata: {}, createdAt: '2026-10-08T09:00:00.000Z' },
    placements,
    currentPlacements: status === 'published' ? placements : undefined,
  };
}

const ITEMS = [
  publication({ id: '84', slug: 'start-osennego-sezona-weekly', kind: 'announcement', status: 'published', title: 'Старт осеннего сезона Weekly', summary: 'Новые трассы, расписание и правила участия.', body: '<p>Сезон стартует 10 октября. Гонки каждые 30 минут.</p>', publishedAt: '2026-10-10T09:00:00.000Z',
    places: [['home.feed'], ['home.hero', { titleOverride: 'Осенний Weekly уже идёт', eyebrowOverride: 'Сезон 2026', actions: [{ role: 'primary', label: 'Расписание', url: '/events/1038', newTab: false }], presentation: { version: 1, previewTheme: 'dark', slider: { layout: 'panel', textAlign: 'left', titleSize: 56 } } }]] }),
  publication({ id: '83', slug: 'novyy-etap-gt3-championship', kind: 'news', status: 'scheduled', title: 'Новый этап GT3 Championship', summary: 'Анонс шестого этапа на Spa.', body: '<p>Шестой этап пройдёт на Spa-Francorchamps.</p>', scheduledPublishAt: '2026-10-12T15:00:00.000Z',
    places: [['home.hero', { startsAt: '2026-10-12T15:00:00.000Z' }], ['home.feed', { startsAt: '2026-10-12T15:00:00.000Z' }]] }),
  publication({ id: '82', slug: 'rekomendacii-dlya-pilotov', kind: 'news', status: 'draft', title: 'Рекомендации для пилотов', summary: 'Памятка новичка.', body: '', places: [['home.feed']] }),
  publication({ id: '80', slug: 'trassy-novogo-sezona', kind: 'update', status: 'published', title: 'Трассы нового сезона', summary: 'Обновление гоночного календаря.', body: '<p>Добавлены Imola и Suzuka.</p>', publishedAt: '2026-10-07T12:00:00.000Z', draftOnTop: true,
    places: [['home.hero'], ['home.promo', { actions: [{ role: 'primary', label: 'Календарь', url: '/events', newTab: false }] }]] }),
  publication({ id: '81', slug: 'touge-masters-registraciya', kind: 'promo', status: 'published', title: 'Touge Masters · Регистрация', summary: 'Открыта регистрация на турнир.', body: '', organizerId: '1', publishedAt: '2026-10-08T10:00:00.000Z',
    places: [['touge.featured_news'], ['touge.feed']] }),
  publication({ id: '79', slug: 'itogi-letnego-kubka', kind: 'result', status: 'archived', title: 'Итоги летнего кубка', summary: 'Победители и лучшие круги.', body: '<p>Спасибо всем участникам.</p>', publishedAt: '2026-08-30T18:00:00.000Z', places: [['home.feed']] }),
];
const ORDERS = Object.fromEntries(SLIDERS.map((code) => [code, { version: 1, ids: ITEMS.filter((i) => i.entry.status === 'published' && i.placements.some((p) => p.placementCode === code)).map((i) => i.entry.id) }]));

function applyDocument(item, doc, status = item.entry.status) {
  const revisionId = `rev-${item.entry.id}-${++seq}`;
  item.entry = { ...item.entry, slug: doc.slug ?? item.entry.slug, publicationKind: doc.kind ?? item.entry.publicationKind, accessOrganizerId: doc.ownerId ?? null, coverAssetId: doc.coverAssetId ?? null, status, currentTitle: doc.title, currentSummary: doc.summary };
  if (status !== 'published') item.entry.currentRevisionId = revisionId;
  item.revision = { ...item.revision, id: revisionId, title: doc.title, summary: doc.summary ?? '', body: doc.body ?? '', createdAt: new Date().toISOString() };
  item.placements = (doc.placements ?? []).map((p) => placement(revisionId, p.placementCode, { ...p, startsAt: doc.startsAt ?? null, endsAt: doc.endsAt ?? null }));
  item.version += 1;
  return item;
}
const find = (id) => ITEMS.find((i) => i.entry.id === id);
function syncOrders(item) {
  for (const code of SLIDERS) {
    const order = ORDERS[code];
    const on = item.entry.status === 'published' && item.placements.some((p) => p.placementCode === code);
    if (on && !order.ids.includes(item.entry.id)) { order.ids.push(item.entry.id); order.version += 1; }
    if (!on && order.ids.includes(item.entry.id)) { order.ids = order.ids.filter((id) => id !== item.entry.id); order.version += 1; }
  }
}

export function register(on, { fail }) {
  const versioned = (id, body, apply) => {
    const item = find(id);
    if (!item) return fail(404, 'publication_not_found', 'Публикация не найдена');
    if (body?.expectedVersion !== item.version) return fail(409, 'publication_version_conflict', 'Публикация уже изменена другим редактором. Обновите данные и повторите.');
    const result = apply(item);
    syncOrders(item);
    return result ?? item;
  };
  on('GET', '/admin/publications', ({ q }) => {
    const limit = Number(q.get('limit') ?? 100), after = q.get('afterId');
    const start = after ? ITEMS.findIndex((i) => i.entry.id === after) + 1 : 0;
    const slice = ITEMS.slice(start, start + limit);
    return { items: slice, nextAfterId: start + limit < ITEMS.length ? slice.at(-1).entry.id : null };
  });
  on('POST', '/admin/publications', ({ body }) => {
    if (!body?.title?.trim()) return fail(422, 'validation_failed', 'Укажите заголовок');
    const id = String(++seq);
    const item = publication({ id, slug: body.slug, kind: body.kind, status: 'draft', title: body.title, summary: body.summary, body: body.body, organizerId: body.ownerId, places: [] });
    item.version = 0;
    applyDocument(item, body, 'draft');
    ITEMS.unshift(item);
    return item;
  });
  on('PATCH', '/admin/publications/:id', ({ p, body }) => versioned(p.id, body, (item) => {
    applyDocument(item, body.publication);
    if (item.entry.status === 'published') { item.entry.currentRevisionId = item.revision.id; item.currentPlacements = item.placements; }
  }));
  on('POST', '/admin/publications/:id/publish', ({ p, body }) => versioned(p.id, body, (item) => {
    item.entry = { ...item.entry, status: 'published', publishedAt: new Date().toISOString(), scheduledPublishAt: null, currentRevisionId: item.revision.id };
    item.currentPlacements = item.placements; item.version += 1;
  }));
  on('POST', '/admin/publications/:id/schedule', ({ p, body }) => versioned(p.id, body, (item) => {
    item.entry = { ...item.entry, status: 'scheduled', scheduledPublishAt: body.startsAt, scheduledRevisionId: item.revision.id }; item.version += 1;
  }));
  on('POST', '/admin/publications/:id/unpublish', ({ p, body }) => versioned(p.id, body, (item) => {
    item.entry = { ...item.entry, status: 'draft', scheduledPublishAt: null }; item.currentPlacements = undefined; item.version += 1;
  }));
  on('DELETE', '/admin/publications/:id', ({ p, body }) => versioned(p.id, body, (item) => {
    ITEMS.splice(ITEMS.indexOf(item), 1); item.entry.status = 'archived';
    return {};
  }));
  on('GET', '/admin/publications/placements/:code/order', ({ p }) => ORDERS[p.code] ?? fail(404, 'placement_not_found'));
  on('POST', '/admin/publications/placements/:code/order', ({ p, body }) => {
    const order = ORDERS[p.code];
    if (!order) return fail(404, 'placement_not_found');
    if (body?.expectedVersion !== order.version) return fail(409, 'placement_order_conflict', 'Порядок уже изменён. Обновите данные.');
    order.ids = body.ids; order.version += 1;
    return order;
  });
}
