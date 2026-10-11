// Chats mock: thread list, review journal, review-gated messages, message hiding and site announcements.
// Shapes follow admin/src/pages/chats/chat-types.ts and ADMIN_API_MAP.md «Чаты, объявления и аудит». Synthetic data.
const MIN = 60_000;
const base = Date.parse('2026-10-09T10:05:00.000Z');
const ago = (minutes) => new Date(base - minutes * MIN).toISOString();
const NAMES = ['Marko77', 'KostyaRS', 'Rival', 'ApexMaks', 'NightShift', 'VolkRacing', 'racer_24', 'Spitfire', 'DimiPro', 'Racecraft', 'EvgenGT', 'Ghost44', 'Astra_R', 'Kirik', 'GreenFlag', 'LateBraker', 'Pitwall', 'Slipstream', 'Torque', 'Vortex'];

// Large numeric strings keep the client honest about exact string ids.
const THREADS = [
  { id: '9007199254740993', type: 'EVENT', eventId: '1038', status: 'OPEN', messageCount: 272, members: ['700', '701', '702', '719'] },
  { id: '9007199254740994', type: 'DIRECT', eventId: null, status: 'OPEN', messageCount: 27, members: ['704', '719'] },
  { id: '9007199254740995', type: 'EVENT', eventId: '1040', status: 'OPEN', messageCount: 89, members: ['705', '706'] },
  { id: '9007199254740996', type: 'DIRECT', eventId: null, status: 'ARCHIVED', messageCount: 4, members: ['702', '711'] },
  ...Array.from({ length: 56 }, (_, i) => ({ id: String(9007199254741000n + BigInt(i)), type: i % 3 ? 'DIRECT' : 'EVENT', eventId: i % 3 ? null : '1038', status: i % 7 === 6 ? 'ARCHIVED' : 'OPEN', messageCount: 3 + ((i * 7) % 40), members: [String(700 + (i % 20)), String(700 + ((i + 5) % 20))] })),
];
const REVIEWS = [
  { reviewId: '9007199254740997', threadId: '9007199254740994', actorId: '701', createdAt: ago(16 * 60), reason: 'Жалоба на оскорбления в личных сообщениях' },
  { reviewId: '9007199254740998', threadId: '9007199254740993', actorId: '708', createdAt: ago(46 * 60), reason: 'Проверка нарушения правил общения в чате события' },
];
const MESSAGES = new Map();
function messagesOf(thread) {
  if (!MESSAGES.has(thread.id)) {
    const count = Math.min(thread.messageCount, 120);
    MESSAGES.set(thread.id, Array.from({ length: count }, (_, i) => {
      const system = i === count - 1 || i % 37 === 0;
      const author = thread.members[i % thread.members.length];
      return {
        id: String(BigInt(thread.id) * 1000n + BigInt(i + 1)), kind: system ? 'SYSTEM' : 'USER',
        authorName: system ? null : NAMES[Number(author) - 700] ?? null, authorUserId: system ? null : author,
        createdAt: ago((count - i) * 7), originalBody: system ? 'Администратор открыл переписку для проверки.' : `Сообщение ${i + 1}: обсуждаем гонку и настройки машины.`,
        moderation: { hidden: i === 3 },
      };
    }));
  }
  return MESSAGES.get(thread.id);
}
const cursorPage = (items, q, limit = 50) => {
  const start = Number(q.get('cursor') ?? 0) || 0;
  const n = Number(q.get('limit') ?? limit);
  return { items: items.slice(start, start + n), nextCursor: start + n < items.length ? String(start + n) : null };
};
const text = (q) => (q.get('q') ?? '').toLowerCase();
let nextReview = 9007199254741100n;

export function register(on, { fail }) {
  on('GET', '/admin/chat/threads', ({ q }) => {
    let items = THREADS;
    if (q.get('type')) items = items.filter((t) => t.type === q.get('type'));
    if (q.get('eventId')) items = items.filter((t) => t.eventId === q.get('eventId'));
    if (q.get('userId')) items = items.filter((t) => t.members.includes(q.get('userId')));
    if (text(q)) items = items.filter((t) => [t.id, t.eventId, ...t.members.map((m) => NAMES[Number(m) - 700])].some((v) => v && String(v).toLowerCase().includes(text(q))));
    return cursorPage(items.map((t) => ({ id: t.id, type: t.type, eventId: t.eventId, status: t.status, messageCount: t.messageCount })), q);
  });
  on('GET', '/admin/chat/reviews', ({ q }) => {
    let items = REVIEWS;
    if (q.get('eventId')) items = items.filter((r) => THREADS.find((t) => t.id === r.threadId)?.eventId === q.get('eventId'));
    if (q.get('userId')) items = items.filter((r) => THREADS.find((t) => t.id === r.threadId)?.members.includes(q.get('userId')));
    if (text(q)) items = items.filter((r) => [r.reviewId, r.threadId, r.actorId, r.reason].some((v) => v.toLowerCase().includes(text(q))));
    return cursorPage(items, q);
  });
  on('POST', '/admin/chat/threads/:id/review', ({ p, body }) => {
    const thread = THREADS.find((t) => t.id === p.id);
    if (!thread) return fail(404, 'chat_thread_not_found', 'Чат не найден');
    if (!body?.reason?.trim()) return fail(400, 'review_reason_required', 'Укажите причину проверки');
    const review = { reviewId: String(nextReview++), threadId: thread.id, actorId: '701', createdAt: new Date().toISOString(), reason: body.reason.trim() };
    REVIEWS.unshift(review);
    return { reviewId: review.reviewId };
  });
  on('GET', '/admin/chat/threads/:id/messages', ({ p, q }) => {
    const thread = THREADS.find((t) => t.id === p.id);
    if (!thread) return fail(404, 'chat_thread_not_found', 'Чат не найден');
    if (!REVIEWS.some((r) => r.reviewId === q.get('reviewId') && r.threadId === thread.id)) return fail(403, 'chat_review_required', 'Сначала зарегистрируйте проверку');
    const all = messagesOf(thread), limit = Number(q.get('limit') ?? 50);
    const end = q.get('beforeId') ? all.findIndex((m) => m.id === q.get('beforeId')) : all.length;
    const items = all.slice(Math.max(0, end - limit), end);
    return { items, hasMore: end - limit > 0, nextBeforeId: items[0]?.id ?? null };
  });
  on('POST', '/admin/chat/threads/:id/messages/:messageId/hide', ({ p, body }) => {
    const thread = THREADS.find((t) => t.id === p.id);
    if (!thread) return fail(404, 'chat_thread_not_found', 'Чат не найден');
    if (!REVIEWS.some((r) => r.reviewId === body?.reviewId && r.threadId === thread.id)) return fail(403, 'chat_review_required', 'Проверка не найдена');
    if (!body?.reason?.trim()) return fail(400, 'hide_reason_required', 'Укажите причину скрытия');
    const message = messagesOf(thread).find((m) => m.id === p.messageId);
    if (!message) return fail(404, 'chat_message_not_found', 'Сообщение не найдено');
    message.moderation = { hidden: true };
    return {};
  });
  on('POST', '/admin/notifications/announcements', ({ body }) => {
    if (!body?.title?.trim() || !body?.body?.trim()) return fail(400, 'announcement_invalid', 'Заполните заголовок и текст');
    const a = body.audience;
    if (a?.type === 'users') return a.userIds?.length ? { recipientCount: a.userIds.length } : fail(400, 'audience_empty', 'Укажите получателей');
    if (a?.type === 'event') return a.eventId ? { recipientCount: a.eventId === '1038' ? 18 : 0 } : fail(400, 'audience_empty', 'Укажите событие');
    return fail(400, 'audience_invalid', 'Неизвестная аудитория');
  });
}
