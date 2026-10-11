// Dev-only matchmaking queue (`/admin/matchmaking/*`). Shapes follow admin/src/pages/matchmaking/matchmaking-model.ts
// and ADMIN_API_MAP.md «Матчмейкинг». Values are synthetic; commands check the numeric `version` and change local state.
// MOCK_MATCHMAKING=empty (no queue yet) | legacy (saved conditions without pools) | forbidden (403 on reads).
const minutes = (iso, n) => new Date(Date.parse(iso) + n * 60_000).toISOString();
const NAMES = ['Marko77', 'KostyaRS', 'Rival', 'ApexMaks', 'NightShift', 'VolkRacing', 'racer_24', 'Spitfire', 'DimiPro', 'Racecraft', 'EvgenGT', 'Ghost44', 'Astra_R', 'Kirik'];
const pilot = (i) => ({ id: String(700 + (i % NAMES.length)), name: NAMES[i % NAMES.length] });

const game = () => ({
  track: { code: '', layoutCode: null },
  cars: { allowedCarIds: [], defaultCarId: '' },
  environment: {
    sunAngle: 16,
    weather: { mode: 'FIXED', presetCode: '3_clear', ambientTemperature: 18, roadTemperature: 28, ambientVariation: 2, roadVariation: 2 },
    dynamicTrack: { sessionStart: 89, randomness: 3, sessionTransfer: 80, lapGain: 50 },
  },
  assists: { absAllowed: 1, tractionControlAllowed: 1, stabilityAllowed: false, forceVirtualMirror: false, autoClutchAllowed: true, tyreBlanketsAllowed: true },
  simulation: { tyreWearRatePercent: 100, fuelRatePercent: 100, damageMultiplierPercent: 100, allowedTyresOut: -1, legalTyres: [] },
  finishRules: { qualifyingMaximumWaitPercent: 120, raceOverTimeSeconds: 180 },
  catalogChoices: { pluginCodes: [] },
});
const fixed = (presetCode, ambientTemperature, roadTemperature) => ({ mode: 'FIXED', presetCode, ambientTemperature, roadTemperature, ambientVariation: 2, roadVariation: 3 });
const pools = () => ({
  version: 1,
  carIds: ['toyota_ae86', 'mazda_rx7_fd', 'bmw_m4_gt4', 'porsche_911_gt3_r', 'ferrari_488_gt3'],
  offerCount: 3,
  readyTimeoutSeconds: 120,
  minimumPilotLicense: 'D',
  tiePolicy: 'omt',
  tracks: [
    { key: 'trk-akina-down', title: 'Akina', code: 'akina', layoutCode: 'downhill', enabled: true, weight: 10, durationMinutes: 6, carIds: ['toyota_ae86', 'mazda_rx7_fd', 'bmw_m4_gt4', 'porsche_911_gt3_r'], weatherKeys: ['w-sun', 'w-clouds'] },
    { key: 'trk-akina-up', title: 'Akina', code: 'akina', layoutCode: 'uphill', enabled: true, weight: 6, durationMinutes: 8, carIds: ['toyota_ae86', 'mazda_rx7_fd', 'bmw_m4_gt4'], weatherKeys: ['w-sun', 'w-clouds'] },
    { key: 'trk-mugello', title: 'Mugello', code: 'mugello', layoutCode: null, enabled: true, weight: 4, durationMinutes: 7, carIds: ['bmw_m4_gt4', 'porsche_911_gt3_r', 'ferrari_488_gt3'], weatherKeys: ['w-sun'] },
  ],
  weather: [
    { key: 'w-sun', title: 'Ясно', enabled: true, weight: 7, codes: ['3_clear'], weather: fixed('3_clear', 22, 28) },
    { key: 'w-clouds', title: 'Переменная облачность', enabled: true, weight: 3, codes: ['4_mid_clear'], weather: fixed('4_mid_clear', 19, 24) },
    { key: 'w-overcast', title: 'Пасмурно', enabled: false, weight: 1, codes: ['7_heavy_clouds'], weather: fixed('7_heavy_clouds', 15, 18) },
  ],
});
const config = (legacy) => ({
  ...(legacy ? {} : { pools: pools() }),
  organizerId: '1',
  title: 'Тоге',
  description: null,
  coverImageId: null,
  gameCode: 'assetto_corsa',
  disciplineCode: 'touge',
  timezone: 'Europe/Moscow',
  blockDurationMinutes: 6,
  game: game(),
  conditions: legacy
    ? [
        { key: 'c1', title: 'Akina · Ясно', trackTitle: 'Akina Downhill', weatherTitle: 'Ясно', game: game() },
        { key: 'c2', title: 'Akina · Облачно', trackTitle: 'Akina Uphill', weatherTitle: 'Переменная облачность', game: game() },
      ]
    : [],
  duel: { winsTo: 2, maximumOmtRounds: 2, runtimeTimeLimitMinutes: 6 },
  rating: { mode: 'result', pilotMultiplier: 1, safetyMultiplier: 1 },
});

const CONDITIONS = [
  { key: 'trk-akina-down:w-sun', title: 'Akina Downhill · Ясно', trackTitle: 'Akina · Downhill', weatherTitle: 'Ясно', pool: { durationMinutes: 6 } },
  { key: 'trk-akina-up:w-clouds', title: 'Akina Uphill · Облачно', trackTitle: 'Akina · Uphill', weatherTitle: 'Переменная облачность', pool: { durationMinutes: 8 } },
  { key: 'trk-mugello:w-sun', title: 'Mugello · Ясно', trackTitle: 'Mugello', weatherTitle: 'Ясно', pool: { durationMinutes: 7 } },
];
const CARS = ['toyota_ae86', 'mazda_rx7_fd', 'bmw_m4_gt4', 'porsche_911_gt3_r'];

function finishedResult(a, b, i) {
  const winner = i % 3 === 0 ? b : a, loser = winner === a ? b : a;
  const heats = (round) => [
    { heatNumber: 1, attemptNumber: 1, leaderId: a.id, chaserId: b.id, winnerId: round === 2 ? loser.id : winner.id, status: 'COMPLETED', adjustedGapMs: 640 + i * 37 },
    { heatNumber: 2, attemptNumber: i % 4 === 0 ? 2 : 1, leaderId: b.id, chaserId: a.id, winnerId: round === 2 ? loser.id : winner.id, status: 'COMPLETED', adjustedGapMs: 410 + i * 21 },
  ];
  return {
    winnerId: winner.id,
    resolution: 'ROUNDS',
    roundsWon: { [winner.id]: 2, [loser.id]: 1 },
    rounds: [
      { roundNumber: 1, kind: 'REGULAR', winnerId: winner.id, heats: heats(1) },
      { roundNumber: 2, kind: 'REGULAR', winnerId: loser.id, heats: heats(2) },
      { roundNumber: 3, kind: 'OMT', winnerId: winner.id, heats: heats(3) },
    ],
  };
}

function makeMatch(i, NOW, status) {
  const a = pilot(i * 2), b = pilot(i * 2 + 1), condition = CONDITIONS[i % CONDITIONS.length];
  const createdAt = minutes(NOW, -12 - i * 17);
  const base = {
    id: String(5200 - i), status, failure: null, condition, createdAt, readyDeadlineAt: minutes(createdAt, 2),
    players: [
      { ...a, ready: true, selection: { carId: CARS[i % CARS.length], skinId: i % 2 ? String(300 + i) : null } },
      { ...b, ready: status !== 'READY_CHECK', selection: status === 'READY_CHECK' ? null : { carId: CARS[(i + 1) % CARS.length], skinId: null } },
    ],
    startedAt: null, finishedAt: null, runtimeSessionId: null, runtimeStatus: null, serverId: null, runtimeFailure: null, resultId: null, result: null,
  };
  if (status === 'READY_CHECK') return base;
  if (status === 'STARTING') return { ...base, runtimeStatus: 'WAITING_CAPACITY' };
  const started = { ...base, startedAt: minutes(createdAt, 2), runtimeSessionId: String(4100 + i), serverId: `ac-touge-0${(i % 3) + 1}` };
  if (status === 'RUNNING') return { ...started, runtimeStatus: 'RUNNING' };
  if (status === 'FAILED') return i % 2
    ? { ...base, failure: 'SERVER_START_TIMEOUT', runtimeFailure: { code: 'server_start_timeout', message: 'Сервер не подтвердил запуск за 90 секунд' } }
    : { ...started, finishedAt: minutes(createdAt, 5), runtimeStatus: 'FAILED', failure: 'SESSION_LOST', runtimeFailure: { code: 'session_lost', message: null } };
  if (status === 'CANCELLED') return { ...base, failure: 'READY_TIMEOUT' };
  return { ...started, finishedAt: minutes(createdAt, 11 + (i % 4)), runtimeStatus: 'FINISHED', resultId: String(9100 + i), result: finishedResult(a, b, i) };
}

export function register(on, { fail, NOW }) {
  const mode = process.env.MOCK_MATCHMAKING ?? '';
  let queue = mode === 'empty' ? null : { id: '31', version: 12, enabled: true, config: config(mode === 'legacy'), ...(mode === 'legacy' ? { poolConversion: { config: config(false), issues: ['Условие «Akina · Облачно» объединено с погодой «Переменная облачность».', 'Вес трасс выставлен поровну — проверьте частоты.'] } } : {}) };
  const live = [makeMatch(0, NOW, 'RUNNING'), makeMatch(1, NOW, 'READY_CHECK'), makeMatch(2, NOW, 'STARTING')];
  const statuses = ['FINISHED', 'FINISHED', 'FAILED', 'FINISHED', 'CANCELLED', 'FINISHED', 'FINISHED', 'FINISHED', 'FAILED'];
  const races = [...live, ...Array.from({ length: 44 }, (_, i) => makeMatch(i + 3, NOW, statuses[i % statuses.length]))];
  const tickets = [
    { id: '88014', participantId: '712', queuedAt: minutes(NOW, -2.3), waitingSeconds: 138 },
    { id: '88015', participantId: '705', queuedAt: minutes(NOW, -1.8), waitingSeconds: 106 },
    { id: '88017', participantId: '719', queuedAt: minutes(NOW, -0.9), waitingSeconds: 52 },
    { id: '88018', participantId: '703', queuedAt: minutes(NOW, -0.6), waitingSeconds: 35 },
  ];
  const guard = () => (mode === 'forbidden' ? fail(403, 'forbidden', 'Недостаточно прав для просмотра матчмейкинга.') : null);
  const find = (id) => (queue && queue.id === id ? queue : null);
  const versioned = (id, body, apply) => {
    const q = find(id);
    if (!q) return fail(404, 'matchmaking_not_found');
    if (body?.version !== q.version) return fail(409, 'matchmaking_version_conflict', 'Настройки очереди уже изменены другим администратором. Загрузите актуальные настройки.');
    apply(q);
    q.version += 1;
    return q;
  };

  on('GET', '/admin/matchmaking', () => guard() ?? { items: queue ? [queue] : [] });
  on('POST', '/admin/matchmaking', ({ body }) => {
    if (queue) return fail(409, 'matchmaking_exists');
    queue = { id: '31', version: 1, enabled: false, config: body.config };
    return queue;
  });
  on('GET', '/admin/matchmaking/:id/config', ({ p }) => guard() ?? find(p.id) ?? fail(404, 'matchmaking_not_found'));
  on('PUT', '/admin/matchmaking/:id/config', ({ p, body }) => versioned(p.id, body, (q) => { q.config = body.config; delete q.poolConversion; }));
  on('POST', '/admin/matchmaking/:id/enable', ({ p, body }) => versioned(p.id, body, (q) => { q.enabled = true; }));
  on('POST', '/admin/matchmaking/:id/disable', ({ p, body }) => versioned(p.id, body, (q) => { q.enabled = false; }));
  on('GET', '/admin/matchmaking/:id/live', ({ p }) => guard() ?? (find(p.id)
    ? { readiness: { code: 'READY', label: 'Подбор работает', action: null, availableConditions: 5 }, queue: queue.enabled ? tickets : [], matches: live }
    : fail(404, 'matchmaking_not_found')));
  on('GET', '/admin/matchmaking/:id/races', ({ p, q }) => {
    if (guard()) return guard();
    if (!find(p.id)) return fail(404, 'matchmaking_not_found');
    const size = Number(q.get('pageSize') ?? 20), page = Math.max(1, Number(q.get('page') ?? 1));
    return { items: races.slice((page - 1) * size, page * size), total: races.length };
  });
  on('GET', '/admin/matchmaking/:id/analytics', ({ p }) => guard() ?? (find(p.id) ? {
    matches: races.length,
    finished: races.filter((m) => m.status === 'FINISHED').length,
    failed: races.filter((m) => m.status === 'FAILED').length,
    cancelled: races.filter((m) => m.status === 'CANCELLED').length,
    uniquePilots: NAMES.length,
    tracks: [
      { key: 'trk-akina-down', title: 'Akina · Downhill', matches: 18, finished: 14, share: 38 },
      { key: 'trk-akina-up', title: 'Akina · Uphill', matches: 16, finished: 12, share: 34 },
      { key: 'trk-mugello', title: 'Mugello', matches: 13, finished: 9, share: 28 },
    ],
    weather: [
      { key: 'w-sun', title: 'Ясно', matches: 33, finished: 25, share: 70 },
      { key: 'w-clouds', title: 'Переменная облачность', matches: 14, finished: 10, share: 30 },
    ],
    cars: [
      { key: 'toyota_ae86', title: 'toyota_ae86', selections: 31, finished: 24, wins: 14, share: 33, winRate: 58 },
      { key: 'mazda_rx7_fd', title: 'mazda_rx7_fd', selections: 27, finished: 20, wins: 9, share: 29, winRate: 45 },
      { key: 'bmw_m4_gt4', title: 'bmw_m4_gt4', selections: 22, finished: 15, wins: 8, share: 23, winRate: 53 },
      { key: 'porsche_911_gt3_r', title: 'porsche_911_gt3_r', selections: 14, finished: 0, wins: 0, share: 15, winRate: null },
    ],
  } : fail(404, 'matchmaking_not_found')));
  on('GET', '/admin/matchmaking/:id/matches/:matchId/game-chat', () => ({ items: [], nextCursor: null }));
}
