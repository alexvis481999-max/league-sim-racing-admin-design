// Mock: Пилоты (/admin/users, history sections, avatar, countries, read-only sanctions).
// Shapes follow admin/src/pages/users (User, AdminPlayer, PlayerHistoryTable strategies). Values are synthetic.

const NAMES = [
  ['Vortex', 'Иван', 'Петров', 'VTX', 'RU'], ['Racer_Maks', 'Максим', 'Орлов', 'MAX', 'RU'], ['Sato', 'Kenji', 'Sato', 'SAT', 'JP'], ['Pilot_17', 'Daan', 'de Vries', 'DVR', 'NL'],
  ['Alex_R', 'Alexander', 'Richter', 'ALR', 'DE'], ['Nightline', null, null, null, 'unknown'], ['Apex Hunter', 'Lucas', 'Martin', 'LMA', 'FR'], ['Drift_Kot', 'Кирилл', 'Котов', 'KOT', 'RU'],
  ['Lina GT', 'Lina', 'Berg', 'LBE', 'SE'], ['Turbo Owl', 'Олег', 'Совин', 'OWL', 'KZ'], ['Mika_S', 'Mika', 'Saarinen', 'MSA', 'FI'], ['RedLine', 'Роман', 'Лебедев', null, 'RU'],
  ['Hotlap Hero', 'Tom', 'Walker', 'TWA', 'GB'], ['Kuro', 'Hiro', 'Kuroda', 'KUR', 'JP'], ['Sector3', 'Пётр', 'Ковалёв', 'PKV', 'BY'], ['Slipstream', 'Marco', 'Bianchi', 'MBI', 'IT'],
  ['Late Braker', 'Jan', 'Novak', 'JNO', 'CZ'], ['Gravel Fox', 'Анна', 'Лисицына', 'ALS', 'RU'], ['Chicane', 'Pablo', 'Ruiz', 'PRU', 'ES'], ['Paddock Cat', null, null, null, 'PL'],
  ['Kerb Rider', 'Илья', 'Бордюров', 'IBR', 'RU'], ['Box Box', 'Sam', 'Taylor', 'STA', 'AU'], ['Torque', 'Нурлан', 'Ахметов', 'NAH', 'KZ'], ['Feather', 'Eva', 'Lind', 'ELI', 'NO'],
];

export const USERS = NAMES.map(([nick, firstName, lastName, shortName, country], i) => {
  const id = String(701 + i);
  const user = {
    userId: id, steamId: String(76561198000000701n + BigInt(i)), steamName: nick, createdAt: new Date(Date.UTC(2025, 2 + (i % 9), 3 + i, 10, 15)).toISOString(), updatedAt: new Date(Date.UTC(2026, 9, 9 - (i % 8), 8, 30)).toISOString(),
    enabledGames: i % 3 ? ['assetto_corsa'] : ['assetto_corsa', 'assetto_corsa_competizione'], themeMode: i % 2 ? 'light' : 'dark',
    firstName, lastName, shortName, country, discord: i % 4 === 1 ? null : nick.toLowerCase().replace(/\s+/g, '_'), youtube: i % 5 === 2 ? `https://youtube.com/@${nick.replace(/\s+/g, '')}` : null,
    avatar: null, version: `v${i + 3}`, presentation: { displayName: nick, avatarUrl: '' }, actions: { edit: true, uploadAvatar: true, deleteAvatar: false },
  };
  return completeness(user);
});
const findUser = (id) => USERS.find((u) => u.userId === id);

function completeness(user) {
  const missing = ['firstName', 'lastName', 'shortName', 'country'].filter((key) => !user[key] || user[key] === 'unknown');
  user.complete = missing.length === 0;
  user.missingFields = missing;
  return user;
}
function avatarUrl(user) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="#285ed6"/><text x="48" y="58" font-family="Arial" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${user.steamName.slice(0, 2).toUpperCase()}</text></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
const bump = (user) => { user.version = `v${Number(user.version.slice(1)) + 1}`; user.updatedAt = new Date().toISOString(); };
const day = (offset, hour = 18, minute = 0) => new Date(Date.UTC(2026, 9, 9 + offset, hour - 3, minute)).toISOString();

const COUNTRIES = [['RU', 'Россия'], ['BY', 'Беларусь'], ['KZ', 'Казахстан'], ['DE', 'Германия'], ['GB', 'Великобритания'], ['FR', 'Франция'], ['IT', 'Италия'], ['ES', 'Испания'], ['NL', 'Нидерланды'], ['PL', 'Польша'], ['CZ', 'Чехия'], ['SE', 'Швеция'], ['NO', 'Норвегия'], ['FI', 'Финляндия'], ['JP', 'Япония'], ['AU', 'Австралия']].map(([code, name]) => ({ code, name }));

function cursorPage(items, q, limit = 20) {
  const size = Number(q.get('limit') ?? limit);
  const after = q.get('afterId');
  const start = after ? items.findIndex((x) => String(x.id) === after) + 1 : 0;
  const slice = items.slice(start, start + size);
  return { items: slice, nextAfterId: start + size < items.length ? String(slice.at(-1).id) : null };
}
function numberedPage(items, q, extra = {}) {
  const size = Number(q.get('limit') ?? q.get('pageSize') ?? 20), current = Math.max(1, Number(q.get('page') ?? 1));
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  return { items: items.slice((current - 1) * size, current * size), pagination: { page: current, pageSize: size, total: items.length, totalPages }, ...extra };
}

const EVENTS = [['2041', 'LSR GT3 Championship'], ['1040', 'Weekly · Зимний сезон'], ['3110', 'Friday GT Sprint'], ['6140', 'Touge Masters · Cup'], ['5120', 'Imola Hotlap Challenge']];
const FINISH = ['CLASSIFIED', 'CLASSIFIED', 'CLASSIFIED', 'DNF', 'CLASSIFIED', 'DSQ'];
function participations(seed) {
  return Array.from({ length: 23 }, (_, i) => {
    const [eventId, title] = EVENTS[(i + seed) % EVENTS.length];
    const status = FINISH[(i + seed) % FINISH.length];
    const matchmaking = i % 7 === 6;
    return {
      id: `p-${seed}-${i}`, date: day(-i * 2 - 1, 19, 10), eventId: matchmaking ? null : eventId, title: matchmaking ? 'Матчмейкинг · GT3 Ranked' : title,
      raceKey: matchmaking ? 'match-' + (40 + i) : eventId === '6140' ? 'duel' : eventId === '5120' ? 'time-attack' : `race:${(i % 3) + 1}`,
      position: status === 'CLASSIFIED' ? ((i * 3 + seed) % 14) + 1 : null, finishStatus: status, resultId: `r-${seed}-${i}`, matchmakingId: matchmaking ? 'q-gt3' : null, owner: matchmaking ? { type: 'match', id: `m-${40 + i}` } : null,
    };
  });
}
function rating(seed, game, discipline) {
  const shift = discipline === 'touge' ? 7 : 0;
  let pilot = 1500 + seed * 17 - shift * 23, safety = 80 + ((seed + shift) % 9);
  const rows = Array.from({ length: 26 }, (_, i) => {
    const dp = ((i * 37 + seed * 11) % 41) - 14, ds = ((i * 13 + seed) % 7) - 2;
    const row = { id: `rt-${seed}-${discipline}-${i}`, sequence: 1000 - i, appliedAt: day(-i * 2 - 1, 20, 5), race: { eventTitle: EVENTS[(i + seed) % EVENTS.length][1], raceTitle: discipline === 'touge' ? 'Дуэль' : `Гонка ${(i % 3) + 1}` }, pilot: { before: pilot - dp, after: pilot, delta: dp }, safety: { before: safety - ds, after: safety, delta: ds }, kind: i === 9 ? 'CORRECTION' : 'APPLIED', reason: i === 9 ? 'Пересчёт после протеста' : null };
    pilot -= dp; safety -= ds;
    return row;
  });
  if (game !== 'assetto_corsa' && seed % 2) return { current: null, items: [], nextAfterSequence: null };
  return { current: { pilot: { value: rows[0].pilot.after }, safety: { value: rows[0].safety.after } }, rows };
}

export function register(on, { fail }) {
  on('GET', '/site/countries', () => COUNTRIES);
  on('GET', '/admin/users', ({ q }) => {
    const term = (q.get('q') ?? '').trim().toLowerCase();
    const rows = USERS.filter((u) => !term || term.split(/\s+/).every((t) => [u.presentation.displayName, u.firstName, u.lastName, u.steamId, u.userId, u.discord].join(' ').toLowerCase().includes(t)));
    return numberedPage(rows, q);
  });
  on('GET', '/admin/users/:id', ({ p }) => findUser(p.id) ?? fail(404, 'user_not_found', 'Пользователь не найден'));
  on('PATCH', '/admin/users/:id', ({ p, body, req }) => {
    const user = findUser(p.id);
    if (!user) return fail(404, 'user_not_found');
    if (!req.headers['if-match']) return fail(428, 'version_required');
    if (req.headers['if-match'] !== user.version) return fail(409, 'version_conflict', 'Профиль уже изменён. Загрузите актуальную версию.');
    for (const key of ['firstName', 'lastName', 'shortName', 'country', 'discord', 'youtube']) if (body && key in body) user[key] = body[key] === '' ? null : body[key];
    if (user.shortName) user.shortName = user.shortName.toUpperCase();
    completeness(user); bump(user);
    return user;
  });
  on('POST', '/admin/users/:id/avatar', ({ p, req }) => {
    const user = findUser(p.id);
    if (!user) return fail(404, 'user_not_found');
    if (req.headers['if-match'] !== user.version) return fail(409, 'version_conflict', 'Профиль уже изменён.');
    user.avatar = 'avatar-' + user.userId; user.presentation.avatarUrl = avatarUrl(user); user.actions.deleteAvatar = true; bump(user);
    return user;
  });
  on('DELETE', '/admin/users/:id/avatar', ({ p, req }) => {
    const user = findUser(p.id);
    if (!user) return fail(404, 'user_not_found');
    if (req.headers['if-match'] !== user.version) return fail(409, 'version_conflict', 'Профиль уже изменён.');
    user.avatar = null; user.presentation.avatarUrl = ''; user.actions.deleteAvatar = false; bump(user);
    return user;
  });

  on('GET', '/admin/users/:id/history/:section', ({ p, q }) => {
    const user = findUser(p.id);
    if (!user) return fail(404, 'user_not_found');
    const seed = Number(p.id) - 700;
    switch (p.section) {
      case 'participations': {
        const rows = participations(seed);
        return numberedPage(rows, q, { totals: { races: rows.length + 115, wins: 9 + (seed % 5), dnf: rows.filter((r) => r.finishStatus === 'DNF').length + 6 } });
      }
      case 'registrations':
        return cursorPage(EVENTS.map(([eventId, title], i) => ({ id: `reg-${seed}-${i}`, createdAt: day(-20 + i * 3, 12), eventId, title, status: ['ACCEPTED', 'ACCEPTED', 'PENDING', 'WITHDRAWN', 'REJECTED'][i], decidedAt: i < 2 || i === 4 ? day(-19 + i * 3, 9) : null, withdrawnAt: i === 3 ? day(-10, 15) : null, removedAt: null })), q);
      case 'matchmaking':
        return cursorPage(Array.from({ length: 6 }, (_, i) => ({ id: `mm-${seed}-${i}`, queueId: 'q-gt3', matchId: i ? `m-${50 + i}` : null, resultId: i > 1 ? `r-mm-${i}` : null, queuedAt: day(-i * 3, 21, 4), status: i ? 'MATCHED' : 'QUEUED', trackTitle: ['Imola', 'Spa-Francorchamps', 'Monza', 'Brands Hatch'][i % 4], weatherTitle: i % 2 ? 'Ясно, +22 °C' : 'Облачно, +16 °C', matchStatus: i ? (i > 1 ? 'COMPLETED' : 'RUNNING') : null, startedAt: i ? day(-i * 3, 21, 12) : null, finishedAt: i > 1 ? day(-i * 3, 21, 48) : null })), q);
      case 'rating': {
        const data = rating(seed, q.get('gameCode'), q.get('disciplineCode'));
        if (!data.rows) return data;
        const size = Number(q.get('limit') ?? 20), after = q.get('afterSequence');
        const start = after ? data.rows.findIndex((r) => String(r.sequence) === after) + 1 : 0;
        const items = data.rows.slice(start, start + size);
        return { current: data.current, items, nextAfterSequence: start + size < data.rows.length ? String(items.at(-1).sequence) : null };
      }
      case 'sessions':
        return numberedPage([
          { id: 's1', audience: 'user', userAgent: 'Chrome 141 · Windows 11', status: 'active', expiresAt: day(20, 10), revokedAt: null },
          { id: 's2', audience: 'admin', userAgent: 'Firefox 143 · Windows 11', status: 'active', expiresAt: day(1, 22), revokedAt: null },
          { id: 's3', audience: 'user', userAgent: 'Safari · iPhone', status: 'revoked', expiresAt: day(5, 10), revokedAt: day(-2, 23, 40) },
          { id: 's4', audience: 'user', userAgent: 'Chrome 139 · macOS', status: 'expired', expiresAt: day(-14, 9), revokedAt: null },
        ], q);
      case 'presence':
        return cursorPage(Array.from({ length: 8 }, (_, i) => ({ id: `pr-${i}`, occurredAt: day(-Math.floor(i / 2), 21, 50 - i * 5), kind: i % 2 ? 'CONNECTED' : 'DISCONNECTED', sessionId: `srv-ac-0${(i % 3) + 1}:race`, name: user.presentation.displayName, reason: i % 2 ? null : i === 2 ? 'Тайм-аут соединения' : 'Выход из сессии' })), q);
      case 'notifications':
        return cursorPage([
          { id: 'n1', createdAt: day(-1, 12), title: 'Заявка принята', body: 'Вы допущены к LSR GT3 Championship · Этап 6.', status: 'read' },
          { id: 'n2', createdAt: day(-3, 18), title: 'Начисление рейтинга', body: 'PR и SR обновлены по итогам Weekly #30.', status: 'unread' },
        ], q);
      case 'preferences':
        return [{ type: 'event_reminder', channel: 'email', enabled: false, updatedAt: day(-40, 10) }, { type: 'registration_decision', channel: 'site', enabled: true, updatedAt: day(-40, 10) }];
      default:
        return fail(404, 'history_section_not_found');
    }
  });

  // Read-only sanctions list used by the profile. Officiating owns the write side.
  on('GET', '/admin/sanctions', ({ q }) => {
    const seed = Number(q.get('userId') ?? 0) - 700;
    const all = seed % 3 === 1
      ? [
          { id: `sn-${seed}-1`, type: 'public_chat_mute', status: 'active', publicReason: 'Оскорбления в общем чате', startsAt: day(-1, 20), endsAt: day(6, 20), revokedAt: null },
          { id: `sn-${seed}-2`, type: 'matchmaking_ban', status: 'expired', publicReason: 'Намеренные контакты', startsAt: day(-30, 20), endsAt: day(-23, 20), revokedAt: null },
        ]
      : [{ id: `sn-${seed}-3`, type: 'event_ban', status: 'revoked', publicReason: 'Неявка без снятия заявки', startsAt: day(-60, 12), endsAt: day(-30, 12), revokedAt: day(-50, 9) }];
    const rows = q.get('state') === 'active' ? all.filter((s) => s.status === 'active') : all;
    return cursorPage(rows, q);
  });
}
