// Dev-only practice servers (`/admin/practice-servers/*`). Shapes follow admin/src/pages/practice-servers/practice-types.ts.
// Values are synthetic; commands change local state and keep config versions and allowedActions consistent.
const minutes = (iso, n) => new Date(Date.parse(iso) + n * 60_000).toISOString();

const game = (track, layoutCode, cars, presetCode = '3_clear') => ({
  track: { code: track, layoutCode },
  cars: { allowedCarIds: cars, defaultCarId: cars[0] ?? '' },
  environment: {
    sunAngle: 32,
    weather: { mode: 'FIXED', presetCode, ambientTemperature: 22, roadTemperature: 30, ambientVariation: 2, roadVariation: 2 },
    dynamicTrack: { sessionStart: 96, randomness: 2, sessionTransfer: 80, lapGain: 10 },
  },
  assists: { absAllowed: 1, tractionControlAllowed: 1, stabilityAllowed: false, forceVirtualMirror: false },
  simulation: { tyreWearRatePercent: 100, fuelRatePercent: 100, damageMultiplierPercent: 100, allowedTyresOut: 2, legalTyres: [] },
  finishRules: { qualifyingMaximumWaitPercent: 120, raceOverTimeSeconds: 180 },
  catalogChoices: { pluginCodes: [] },
});
const config = (title, discipline, duration, max, delay, g, description = null) => ({
  organizerId: '1', title, description, coverImageId: null, timezone: 'Europe/Moscow', gameCode: 'assetto_corsa', disciplineCode: discipline,
  sessionDurationMinutes: duration, extraDelaySeconds: delay, game: g, practice: { durationMinutes: duration, maxParticipants: max },
});
const cycle = (executionId, state, runtimeSessionId, resourceState, startedAt, extra = {}) => ({
  executionId, state, runtimeSessionId, resourceState, startedAt, finishedAt: null, connectionLostAt: null, failure: null, ...extra,
});

export function register(on, { fail, NOW }) {
  const servers = [
    { id: '11', status: 'ACTIVE', configVersion: 7, config: config('GT3 Practice · Monza', 'circuit', 60, 24, 20, game('monza', null, ['porsche_911_gt3_r', 'ferrari_488_gt3', 'bmw_m4_gt3']), 'Открытая тренировка для участников GT3'),
      currentCycle: cycle('1019', 'RUNNING', '3302', 'RUNNING', minutes(NOW, -5)), lastCycle: cycle('1018', 'COMPLETED', '3290', null, minutes(NOW, -66), { finishedAt: minutes(NOW, -6) }), nextEligibleAt: null },
    { id: '12', status: 'ACTIVE', configVersion: 3, config: config('Touge Practice · Akina', 'touge', 60, 16, 0, game('akina', 'downhill', ['toyota_ae86', 'mazda_rx7_fd'], '4_mid_clear')),
      currentCycle: cycle('2041', 'RUNNING', '3305', 'UNKNOWN', minutes(NOW, -35), { connectionLostAt: minutes(NOW, -2) }), lastCycle: null, nextEligibleAt: null },
    { id: '13', status: 'PAUSED', configVersion: 5, config: config('Nordschleife Open', 'circuit', 90, 24, 60, game('nurburgring', 'gp', ['bmw_m4_gt4'])),
      currentCycle: null, lastCycle: cycle('3007', 'COMPLETED', '3270', null, minutes(NOW, -180), { finishedAt: minutes(NOW, -90) }), nextEligibleAt: null },
    { id: '14', status: 'FAILED', configVersion: 2, config: config('GT4 Evening', 'circuit', 45, 20, 0, game('imola', null, ['bmw_m4_gt4'])),
      currentCycle: null, lastCycle: cycle('4002', 'FAILED', '3288', null, minutes(NOW, -50), { finishedAt: minutes(NOW, -49), failure: { code: 'server_start_timeout' } }), nextEligibleAt: minutes(NOW, 10) },
    { id: '15', status: 'STOPPED', configVersion: 1, config: config('Spa Hotlap', 'circuit', 30, 12, 0, game('spa', null, ['audi_r8_lms'])),
      currentCycle: null, lastCycle: null, nextEligibleAt: null },
  ];
  const history = {
    '11': Array.from({ length: 23 }, (_, i) => {
      const n = 1019 - i, start = minutes(NOW, -5 - i * 61);
      return i === 0 ? servers[0].currentCycle : cycle(String(n), i === 4 ? 'FAILED' : 'COMPLETED', String(3302 - i * 3), null, start, { finishedAt: minutes(start, 60), failure: i === 4 ? { code: 'connection_lost' } : null });
    }),
    '14': [servers[3].lastCycle],
    '13': [servers[2].lastCycle],
  };
  const chat = (id) => Array.from({ length: id === '11' ? 64 : 4 }, (_, i) => ({
    id: String(9000 - i), driverName: ['Marko77', 'KostyaRS', 'ApexMaks', 'NightShift', 'Rival'][i % 5],
    message: ['gg', 'Кто едет следующий круг?', 'Пит-лейн свободен', 'Сервер лагает в Parabolica?', 'спасибо за тренировку'][i % 5], occurredAt: minutes(NOW, -i * 2),
  }));

  const allowed = (s) => {
    const running = !!s.currentCycle;
    return {
      configure: true,
      start: s.status !== 'ACTIVE',
      pause: s.status === 'ACTIVE',
      stop: s.status !== 'STOPPED' || running,
      restart: running || s.status === 'FAILED',
    };
  };
  const view = (s) => ({ ...s, allowedActions: allowed(s) });
  const find = (id) => servers.find((s) => s.id === id);

  on('GET', '/admin/practice-servers', ({ q }) => {
    const status = q.get('status');
    const pageNo = Math.max(1, Number(q.get('page') ?? 1)), size = Number(q.get('pageSize') ?? 20);
    const list = servers.filter((s) => !status || s.status === status);
    return { items: list.slice((pageNo - 1) * size, pageNo * size).map(view), total: list.length };
  });
  on('GET', '/admin/practice-servers/:id', ({ p }) => (find(p.id) ? view(find(p.id)) : fail(404, 'practice_server_not_found', 'Сервер практики не найден')));
  on('GET', '/admin/practice-servers/:id/sessions', ({ p, q }) => {
    const pageNo = Math.max(1, Number(q.get('page') ?? 1)), size = Number(q.get('pageSize') ?? 20);
    const list = history[p.id] ?? [];
    return { items: list.slice((pageNo - 1) * size, pageNo * size), total: list.length };
  });
  on('GET', '/admin/practice-servers/:id/game-chat', ({ p, q }) => {
    const all = chat(p.id), limit = Number(q.get('limit') ?? 50), after = q.get('afterId');
    const start = after ? all.findIndex((m) => m.id === after) + 1 : 0, items = all.slice(start, start + limit);
    return { items, nextCursor: start + limit < all.length ? items.at(-1).id : null };
  });
  on('POST', '/admin/practice-servers', ({ body }) => {
    if (!body?.config?.organizerId) return fail(422, 'validation_failed', 'Укажите организатора');
    const s = { id: String(100 + servers.length), status: 'STOPPED', configVersion: 1, config: body.config, currentCycle: null, lastCycle: null, nextEligibleAt: null };
    servers.push(s);
    return view(s);
  });
  on('PUT', '/admin/practice-servers/:id/config', ({ p, body }) => {
    const s = find(p.id);
    if (!s) return fail(404, 'practice_server_not_found');
    if (body?.version !== s.configVersion) return fail(409, 'practice_config_version_conflict', 'Настройки уже изменены другим администратором.');
    s.config = body.config;
    s.configVersion += 1;
    return view(s);
  });
  on('POST', '/admin/practice-servers/:id/:action', ({ p }) => {
    const s = find(p.id);
    if (!s) return fail(404, 'practice_server_not_found');
    if (!allowed(s)[p.action]) return fail(409, 'practice_action_not_allowed', 'Команда недоступна в текущем состоянии сервера.');
    if (p.action === 'start') {
      s.status = 'ACTIVE';
      s.currentCycle ??= cycle(String(Date.now() % 100000), 'STARTING', null, null, null);
    }
    if (p.action === 'pause') s.status = 'PAUSED';
    if (p.action === 'stop') {
      s.status = 'STOPPED';
      if (s.currentCycle) s.currentCycle = { ...s.currentCycle, resourceState: 'STOPPING', state: 'CANCELLED' };
    }
    if (p.action === 'restart') s.currentCycle = cycle(String(Date.now() % 100000), 'STARTING', null, null, null);
    return view(s);
  });
}
