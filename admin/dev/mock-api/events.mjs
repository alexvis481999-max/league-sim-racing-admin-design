// Dev-only synthetic events. Projections mirror api-reference/workspace-schedule (event-workspace.service.ts).
// Nothing here is real data; the generator only exists to render admin screens without a backend.
import { CARS, PILOTS, TRACKS, carItem, trackItem, weatherItem } from './reference.mjs';
import { championshipBlocks, practiceBlocks, singleBlocks, timeAttackBlocks, tournamentBlocks } from './formats.mjs';

export const NOW = '2026-10-09T10:05:00.000Z'; // 13:05 Europe/Moscow
const MSK = 3 * 3600_000;
const iso = (ms) => new Date(ms).toISOString();
const at = (localDate, localTime) => Date.parse(`${localDate}T${localTime}:00Z`) - MSK;
const addDays = (date, n) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400_000).toISOString().slice(0, 10);
export const status = (code, label, effectiveAt = null, reason = null) => ({ code, label, reason, effectiveAt, observedAt: NOW, freshness: code === 'UNKNOWN' ? 'UNCERTAIN' : 'CURRENT' });
const action = (code, enabled, reason = 'access_denied') => ({ code, enabled, reason: enabled ? null : { code: reason, message: { access_denied: 'Недостаточно прав.', event_finished: 'Событие завершено.', event_already_started: 'Событие уже началось.', event_already_published: 'Событие уже опубликовано.', event_settings_unavailable: 'Настройки события недоступны.', registration_closed: 'Регистрация закрыта.' }[reason] ?? reason } });

const organizer = { id: '1', name: 'LeagueSimRacing' };
const author = { participantId: '701', displayName: 'Vortex' };
const baseGame = (trackCode, layoutCode, weather) => ({
  track: { code: trackCode, layoutCode },
  cars: { allowedCarIds: ['bmw_m4_gt3', 'porsche_911_gt3_r'], defaultCarId: 'bmw_m4_gt3' },
  environment: { sunAngle: 32, weather, dynamicTrack: { sessionStart: 96, randomness: 2, sessionTransfer: 80, lapGain: 10 } },
  assists: { absAllowed: 1, tractionControlAllowed: 1, stabilityAllowed: false, forceVirtualMirror: false, autoClutchAllowed: true, tyreBlanketsAllowed: true },
  simulation: { tyreWearRatePercent: 100, fuelRatePercent: 100, damageMultiplierPercent: 100, allowedTyresOut: 2, legalTyres: [] },
  finishRules: { qualifyingMaximumWaitPercent: 120, raceOverTimeSeconds: 180 },
  catalogChoices: { weatherCodes: [weather.presetCode].filter(Boolean), pluginCodes: ['csp'] },
});
const fixedWeather = (presetCode, ambient, road) => ({ mode: 'FIXED', presetCode, ambientTemperature: ambient, roadTemperature: road, ambientVariation: 2, roadVariation: 3 });
const raceSettings = (overrides = {}) => ({ format: 'SINGLE_RACE', resultAggregation: 'ONLY_RACE', maxPlayersPerSession: 24, maxSessions: 3, practice: { durationMinutes: 15 }, qualifying: { durationMinutes: 10 }, race: { durationMinutes: 25, laps: null }, reverseGridPositions: null, ...overrides });

/* ---------------------------------------------------------------- weekly */
const WEEKLY_ID = '1038';
const weeklyFirstDate = '2026-09-21';
const weeklyTracks = ['monza', 'spa', 'imola', 'silverstone', 'nurburgring', 'suzuka', 'brands_hatch', 'barcelona', 'red_bull_ring', 'zandvoort', 'misano', 'mugello'];
const weeklyTimes = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
const weeklyWeather = (w) => (w === 4 ? fixedWeather('7_heavy_clouds', 14, 17) : w % 3 === 1 ? fixedWeather('4_mid_clear', 18, 24) : fixedWeather('3_clear', 22, 30));
const weeklySettings = {
  event: { organizerId: '1', title: 'Weekly · Осенний сезон', description: '<p>Серия регулярных гонок на Assetto Corsa. Гонки каждые 30 минут, разные трассы по неделям.</p>', timezone: 'Europe/Moscow', gameCode: 'assetto_corsa', disciplineCode: 'circuit', presentation: { coverUrl: null, subtitle: 'Честные гонки и соревновательная атмосфера', cardAppearance: null } },
  minimumParticipantsPerRace: 2,
  raceRegistration: { mode: 'open_until_capacity' },
  scoring: { mode: 'classic_top_10', points: { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 } },
  rating: { mode: 'result', pilotMultiplier: 1, safetyMultiplier: 1 },
  authoring: { presetId: 'club-racing', version: 2, editorVersion: 2 },
  weekly: {
    firstDate: weeklyFirstDate,
    dayTimes: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), weeklyTimes])),
    weeks: weeklyTracks.map((code, i) => ({ _editorId: 'week-' + i, title: `Неделя ${i + 1} · ${TRACKS.find((t) => t.code === code).title}`, track: { code, layoutCode: TRACKS.find((t) => t.code === code).layouts[0].code || null }, weather: { sunAngle: 32, weather: weeklyWeather(i + 1), dynamicTrack: { sessionStart: 96, randomness: 2, sessionTransfer: 80, lapGain: 10 } }, weatherCodes: [], raceOverrides: i === 4 ? { race: { durationMinutes: 30, laps: null } } : {} })),
  },
  participantAdmission: { minimumPilotLicense: 'D', minimumSafetyLicense: 'D' },
  common: { game: baseGame('', null, fixedWeather('3_clear', 22, 30)), race: raceSettings({ practice: { durationMinutes: 15 }, qualifying: { durationMinutes: 10 }, race: { durationMinutes: 25, laps: null } }) },
  registrationRules: { durationMinutes: 1440, closesBeforeMinutes: 3 },
};
const FAILED_RACES = new Set(['3-18', '3-40', '2-07']);
const UNCERTAIN_RACES = new Set([]);

function weeklyBlocks(firstDate = weeklyFirstDate, weeks = 12, firstId = 5000) {
  const blocks = [];
  let id = firstId;
  for (let w = 1; w <= weeks; w++) {
    const weekStart = addDays(firstDate, (w - 1) * 7);
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      weeklyTimes.forEach((time, t) => {
        const k = d * 10 + t + 1;
        id += 1;
        const start = at(date, time), end = start + 45 * 60_000, now = Date.parse(NOW);
        const tag = `${w}-${String(k).padStart(2, '0')}`;
        let execution = null, phase = null;
        if (end <= now) {
          const failed = FAILED_RACES.has(tag);
          const jitter = [2, 1, 0, 4, -1][k % 5] * 60_000;
          execution = { status: failed ? 'FAILED' : 'COMPLETED', startedAt: iso(start + jitter), finishedAt: iso(start + jitter + (35 + (k % 9)) * 60_000), reason: failed ? { code: 'SESSION_FAILED', message: null } : null };
        } else if (start <= now) {
          execution = { status: 'RUNNING', startedAt: iso(start), finishedAt: null };
          phase = 'RACE_1';
        }
        const splits = execution ? 1 + (k % 3 === 0 ? 2 : k % 2) : 0;
        blocks.push({ id: String(id), w, k, date, start, end, execution, phase, splits, key: `week-${w}-race-${k}`, title: `Гонка ${k}`, track: weeklyTracks[w - 1] });
      });
    }
  }
  return blocks;
}
const WEEKLY_BLOCKS = weeklyBlocks();
const WINTER_FIRST = '2026-12-14';
const WINTER_BLOCKS = weeklyBlocks(WINTER_FIRST, 4, 9000);
const winterSettings = { ...structuredClone(weeklySettings), event: { ...weeklySettings.event, title: 'Weekly · Зимний сезон' }, weekly: { ...structuredClone(weeklySettings.weekly), firstDate: WINTER_FIRST, weeks: structuredClone(weeklySettings.weekly.weeks).slice(0, 4) } };

function blockDisplay(b) {
  const e = b.execution;
  if (b.type === 'TIME_ATTACK') {
    if (e?.status === 'COMPLETED') return status('COMPLETED', 'Завершён', e.finishedAt);
    if (Date.parse(NOW) < b.start) return status('SCHEDULED', 'Окно ещё не открыто');
    if (Date.parse(NOW) >= b.end) return status('FINISHING', 'Окно закрыто · завершение', iso(b.end));
    return status('OPEN', 'Окно попыток открыто', iso(b.start));
  }
  if (b.type === 'PRACTICE' && e?.status === 'COMPLETED') return status('COMPLETED', 'Практика завершена', e.finishedAt);
  if (b.type === 'PRACTICE' && e?.status === 'RUNNING') return status('OPEN', 'Практика открыта', e.startedAt);
  if (b.type === 'PRACTICE' && !e) return status('SCHEDULED', 'Практика запланирована');
  if (b.type === 'TOURNAMENT' && e?.status === 'RUNNING') return status('RUNNING', 'Заезды идут', e.startedAt);
  if (e?.status === 'COMPLETED') return status('COMPLETED', 'Завершён', e.finishedAt);
  if (e?.status === 'FAILED') return status('FAILED', 'Не состоялся', e.finishedAt, { code: e.reason.code, message: 'Техническая ошибка игрового сервера.' });
  if (e?.status === 'RUNNING') {
    if (UNCERTAIN_RACES.has(b.key)) return status('UNKNOWN', 'Состояние уточняется', e.startedAt, { code: 'CONNECTION_LOST', message: 'Нет подтверждённого актуального состояния сервера.' });
    return status(b.phase, { RACE_1: 'Гонка', QUALIFYING: 'Квалификация', PRACTICE: 'Практика' }[b.phase], e.startedAt);
  }
  return status('SCHEDULED', 'Заезд запланирован');
}
const pilotsFor = (b, split) => {
  const size = split === 1 ? 8 : split === 2 ? 7 : 6;
  return Array.from({ length: size }, (_, j) => PILOTS[(j + (split - 1) * 6 + (b.k ?? b.seed ?? 0)) % PILOTS.length]);
};
function sessionsFor(b) {
  if (!b.execution) return [];
  return Array.from({ length: b.splits }, (_, i) => {
    const running = b.execution.status === 'RUNNING';
    const failed = b.execution.status === 'FAILED' && i === 0;
    const s = {
      id: `${b.id}${i + 1}`, requesterId: 'exec-' + b.id, serverId: `ac-node-0${(i % 3) + 1}`,
      status: running ? 'RUNNING' : failed ? 'FAILED' : 'STOPPED',
      phase: running ? { code: 'RACE_1', observedAt: NOW, effectiveAt: iso(b.start + 26 * 60_000) } : null,
      requestedAt: iso(b.start - 10 * 60_000), allocatedAt: iso(b.start - 9 * 60_000), startIssuedAt: iso(b.start - 8 * 60_000), startedAt: b.execution.startedAt,
      stopRequestedAt: null, stoppedAt: running ? null : b.execution.finishedAt, connectionLostAt: null, recoveryDeadlineAt: null,
      capacityWaitStartedAt: null, failure: failed ? { code: 'SESSION_FAILED' } : null, stopCause: failed ? 'Процесс сервера завершился с ошибкой' : running ? null : 'Заезд завершён',
      connectedPlayers: running ? pilotsFor(b, i + 1).length - 1 : null,
    };
    const ds = s.status === 'FAILED' ? status('FAILED', 'Ошибка сервера', s.stoppedAt, { code: 'SESSION_FAILED', message: 'Не удалось штатно выполнить запуск.' }) : s.status === 'RUNNING' ? status('RACE_1', 'Гонка', s.phase.effectiveAt) : status('STOPPED', 'Сервер остановлен', s.stoppedAt);
    return { ...s, displayStatus: ds };
  });
}
function progressFor(b) {
  if (b.matches) {
    return b.matches.map((m) => ({ key: m.key, title: m.title, status: m.status, runtimeSessionId: m.runtimeSessionId, participants: m.participants,
      displayStatus: m.status === 'COMPLETED' ? status('COMPLETED', 'Завершено', b.execution?.finishedAt) : m.status === 'RUNNING' ? status('DUEL', 'Дуэль', b.execution?.startedAt) : status('PENDING', 'Запланировано'),
      children: m.children.map((h) => ({ ...h, displayStatus: status('FINISHED', 'Завершено') })) }));
  }
  if (b.type === 'TIME_ATTACK') return [];
  return sessionsFor(b).map((s, i) => ({
    key: `split-${i + 1}`, title: `Сплит ${i + 1}`, status: s.status === 'RUNNING' ? 'RACE_1' : s.status === 'FAILED' ? 'FAILED' : 'FINISHED',
    runtimeSessionId: s.id, children: [], participants: pilotsFor(b, i + 1),
    displayStatus: s.displayStatus.code === 'STOPPED' ? status('FINISHED', 'Завершено', s.stoppedAt) : s.displayStatus,
  }));
}
const hasResult = (b) => b.execution?.status === 'COMPLETED' && b.type !== 'PRACTICE';
function scheduleBlock(b) {
  return {
    id: b.id, key: b.key, title: b.title, type: b.type ?? 'RACE', status: b.execution?.status ?? 'PENDING', executionId: b.execution ? 'exec-' + b.id : null,
    plannedStartsAt: iso(b.start), estimatedEndsAt: iso(b.end), startedAt: b.execution?.startedAt ?? null, finishedAt: b.execution?.finishedAt ?? null,
    actualParticipantIds: progressFor(b).flatMap((p) => p.participants.map((x) => x.participantId)),
    displayStatus: blockDisplay(b), group: b.w ? { key: `week-${b.w}`, title: `Неделя ${b.w}`, kind: 'WEEK' } : b.group ?? null,
    progress: progressFor(b), resultIds: hasResult(b) ? ['r' + b.id] : [], sessions: b.type === 'TIME_ATTACK' ? [] : sessionsFor(b),
  };
}

/* ------------------------------------------------------- event records */
const presentation = (subtitle) => ({ coverUrl: null, subtitle, cardAppearance: null });
const planSettings = (title) => ({ event: { organizerId: '1', title, timezone: 'Europe/Moscow', gameCode: 'assetto_corsa', disciplineCode: 'circuit' }, authoring: { version: 2, editorVersion: 1 } });
export const EVENTS = [
  { id: WEEKLY_ID, title: 'Weekly · Осенний сезон', description: '<p>Серия регулярных гонок на Assetto Corsa. Гонки каждые 30 минут, разные трассы по неделям.</p>', scenarioCode: 'weekly', scenarioTitle: 'Регулярные гонки', organizerId: '1', gameCode: 'assetto_corsa', disciplineCode: 'circuit', timezone: 'Europe/Moscow', startsAt: iso(WEEKLY_BLOCKS[0].start), endsAt: iso(WEEKLY_BLOCKS.at(-1).end), status: 'RUNNING', version: '42', presentation: presentation('Честные гонки и соревновательная атмосфера'), settings: weeklySettings, blocks: WEEKLY_BLOCKS },
  { id: '1040', title: 'Weekly · Зимний сезон', description: '<p>Четыре недели зимних гонок. Расписание и условия ещё можно менять.</p>', scenarioCode: 'weekly', scenarioTitle: 'Регулярные гонки', organizerId: '1', gameCode: 'assetto_corsa', disciplineCode: 'circuit', timezone: 'Europe/Moscow', startsAt: iso(WINTER_BLOCKS[0].start), endsAt: iso(WINTER_BLOCKS.at(-1).end), status: 'PUBLISHED', version: '7', presentation: presentation('Зимняя серия'), settings: winterSettings, blocks: WINTER_BLOCKS },
  { id: '2041', title: 'LSR GT3 Championship', description: '<p>Восьмиэтапный чемпионат GT3 с квалификацией, зачётом и регистрацией.</p>', scenarioCode: 'championship', scenarioTitle: 'Чемпионат', organizerId: '1', gameCode: 'assetto_corsa', disciplineCode: 'circuit', timezone: 'Europe/Moscow', startsAt: '2026-09-25T15:00:00.000Z', endsAt: '2026-11-13T18:00:00.000Z', status: 'RUNNING', version: '17', presentation: presentation('Восемь этапов GT3'), settings: planSettings('plan'), blocks: championshipBlocks(Date.parse(NOW)) },
  { id: '3110', title: 'Friday GT Sprint', description: '<p>Одиночная гонка с квалификацией и сплитами.</p>', scenarioCode: 'circuit_single_race', scenarioTitle: 'Разовая гонка', organizerId: '1', gameCode: 'assetto_corsa', disciplineCode: 'circuit', timezone: 'Europe/Moscow', startsAt: '2026-10-16T15:00:00.000Z', endsAt: '2026-10-16T16:30:00.000Z', status: 'PUBLISHED', version: '5', presentation: presentation('Пятничный спринт'), settings: planSettings('plan'), blocks: singleBlocks(Date.parse(NOW)) },
  { id: '4112', title: 'GT3 Open Practice', description: '<p>Практика с мониторингом сессий и подключений.</p>', scenarioCode: 'practice', scenarioTitle: 'Практика', organizerId: '1', gameCode: 'assetto_corsa', disciplineCode: 'circuit', timezone: 'Europe/Moscow', startsAt: '2026-10-10T07:00:00.000Z', endsAt: '2026-10-10T19:00:00.000Z', status: 'PUBLISHED', version: '3', presentation: presentation('Открытая практика'), settings: planSettings('plan'), blocks: practiceBlocks(Date.parse(NOW)) },
  { id: '5120', title: 'Imola Hotlap Challenge', description: '<p>Окно попыток и таблица лучших кругов.</p>', scenarioCode: 'time_attack', scenarioTitle: 'Тайм-аттак', organizerId: '1', gameCode: 'assetto_corsa', disciplineCode: 'circuit', timezone: 'Europe/Moscow', startsAt: '2026-09-28T09:00:00.000Z', endsAt: '2026-10-04T19:00:00.000Z', status: 'COMPLETED', version: '9', presentation: presentation('Лучший круг Имолы'), settings: planSettings('plan'), blocks: timeAttackBlocks(Date.parse(NOW)) },
  { id: '6140', title: 'Touge Masters · Cup', description: '<p>Турнирная сетка, дуэли, верхняя и нижняя сетки.</p>', scenarioCode: 'double_elimination_tournament', scenarioTitle: 'Турнир', organizerId: '1', gameCode: 'assetto_corsa', disciplineCode: 'touge', timezone: 'Europe/Moscow', startsAt: '2026-10-09T08:00:00.000Z', endsAt: '2026-10-09T14:20:00.000Z', status: 'RUNNING', version: '4', presentation: presentation('Двойное выбывание'), settings: planSettings('plan'), blocks: tournamentBlocks(Date.parse(NOW)) },
  { id: '7001', title: 'Зимний кубок (отменён)', description: null, scenarioCode: 'circuit_single_race', scenarioTitle: 'Разовая гонка', organizerId: '1', gameCode: 'assetto_corsa', disciplineCode: 'circuit', timezone: 'Europe/Moscow', startsAt: '2026-10-02T15:00:00.000Z', endsAt: '2026-10-02T16:30:00.000Z', status: 'CANCELLED', version: '6', presentation: presentation(null), blocks: [] },
];
export const DRAFTS = [
  { id: 'd-31', revision: '3', publishedEventId: null, updatedAt: '2026-10-08T17:12:00.000Z', document: { contractVersion: 1, scenarioCode: 'weekly', settings: { event: { title: 'Weekly · Зимний сезон' } }, pendingImages: [] } },
];

function eventStatusView(e) {
  const titles = { championship: 'Чемпионат', weekly: 'Серия', double_elimination_tournament: 'Турнир' };
  const title = titles[e.scenarioCode];
  if (e.status === 'CANCELLED') return { ...status('CANCELLED', title ? `${title} отменён` : 'Отменено', '2026-10-01T09:00:00.000Z', { code: 'CANCELLED', message: 'Недостаточно участников.' }), currentStage: null };
  if (e.status === 'COMPLETED') return { ...status('COMPLETED', title ? `${title} завершён` : 'Завершено', e.endsAt), currentStage: null };
  if (e.status === 'DRAFT') return { ...status('DRAFT', 'Черновик'), currentStage: null };
  if (e.scenarioCode === 'weekly' && e.status === 'RUNNING') {
    const live = e.blocks.find((b) => b.execution?.status === 'RUNNING');
    return { ...status('RUNNING', 'Серия идёт'), currentStage: live ? { key: live.key, title: live.title } : null };
  }
  if (!title && e.blocks.length === 1) return { ...blockDisplay(e.blocks[0]), currentStage: { key: e.blocks[0].key, title: e.blocks[0].title } };
  if (e.status === 'RUNNING') return { ...status('RUNNING', `${title ?? 'Событие'} идёт`), currentStage: null };
  return { ...status('SCHEDULED', title ? `${title}: запланировано` : 'Заезд запланирован'), currentStage: null };
}
function displaySchedule(e) {
  return { startsAt: e.startsAt, endsAt: e.endsAt, qualificationStartsAt: null, qualificationEndsAt: null };
}
function terminal(e) { return ['COMPLETED', 'CANCELLED', 'FAILED'].includes(e.status); }
function eventActions(e) {
  return [
    action('publish', e.status === 'DRAFT', e.status === 'DRAFT' ? 'access_denied' : terminal(e) ? 'event_finished' : 'event_already_published'),
    action('edit', !terminal(e), terminal(e) ? 'event_finished' : 'access_denied'),
    action('reschedule', !terminal(e) && e.blocks.some((b) => !b.execution), terminal(e) ? 'event_finished' : 'event_already_started'),
    action('cancel', !terminal(e), terminal(e) ? 'event_finished' : 'access_denied'),
    action('copy', !!e.settings, 'event_settings_unavailable'),
  ];
}
export function eventSummary(e) {
  const { settings: _s, blocks: _b, ...rest } = e;
  return { ...rest, displayStatus: eventStatusView(e), displaySchedule: displaySchedule(e), observedAt: NOW, actions: eventActions(e) };
}
export function listEvents(q) {
  let items = EVENTS.map(eventSummary);
  if (q.get('q')) items = items.filter((e) => (e.title + ' ' + e.id).toLowerCase().includes(q.get('q').toLowerCase()));
  if (q.get('status')) items = items.filter((e) => e.status === q.get('status'));
  if (q.get('scenarioCode')) items = items.filter((e) => e.scenarioCode === q.get('scenarioCode'));
  if (q.get('publication') === 'unpublished') items = items.filter((e) => e.status === 'DRAFT');
  if (q.get('publication') === 'published') items = items.filter((e) => e.status !== 'DRAFT');
  return page(items, q, 20);
}
export function page(items, q, defaultLimit = 25) {
  const limit = Number(q.get('limit') ?? defaultLimit);
  const after = q.get('afterId');
  const start = after ? items.findIndex((x) => String(x.id) === after) + 1 : 0;
  const slice = items.slice(start, start + limit);
  return { items: slice, nextAfterId: start + limit < items.length ? String(slice.at(-1).id) : null };
}

/* ---------------------------------------------------------- workspace */
const program = (e) => e.blocks.map((b) => {
  void 0;
  const s = scheduleBlock(b);
  return { key: s.key, title: s.title, type: s.type, group: s.group, displayStatus: s.displayStatus, startsAt: s.plannedStartsAt, endsAt: s.estimatedEndsAt, startedAt: s.startedAt, finishedAt: s.finishedAt, track: trackItem(b.track)?.title ?? b.track, cars: ['BMW M4 GT3', 'Porsche 911 GT3 R'] };
});
export function workspaceSummary(e) {
  const blocks = e.blocks;
  const live = blocks.find((b) => b.execution?.status === 'RUNNING');
  const next = blocks.find((b) => !b.execution);
  const started = blocks.some((b) => b.execution);
  return {
    eventId: e.id, version: e.version, observedAt: NOW,
    event: { ...eventSummary(e), observedAt: NOW },
    metadata: { createdAt: '2026-09-01T08:30:00.000Z', updatedAt: '2026-10-08T16:02:00.000Z', publishedAt: e.status === 'DRAFT' ? null : '2026-09-02T09:00:00.000Z', author, organizer },
    currentStage: live ? { key: live.key, title: live.title } : null,
    nextStage: next && !terminal(e) ? { key: next.key, title: next.title, startsAt: iso(next.start) } : null,
    stop: e.status === 'CANCELLED' ? { reason: 'Недостаточно участников.', requestedAt: '2026-10-01T09:00:00.000Z' } : null,
    actions: eventActions(e),
    editableFields: terminal(e) ? [] : started ? ['description'] : ['description', 'settings'],
    program: program(e),
    counts: { stages: blocks.length, results: blocks.filter((b) => b.execution?.status === 'COMPLETED').length + 1, participants: started ? 20 : 0 },
    activity: { applications: { pending: 3, accepted: 41 }, runtime: { active: live ? live.splits : 0, uncertain: 0 }, hasRegistration: true },
    primaryResultId: 'r-total',
  };
}
function conditionsFor(e, b) {
  const week = b.w ? e.settings?.weekly?.weeks?.[b.w - 1] : null;
  const weather = week?.weather.weather ?? fixedWeather('3_clear', 22, 30);
  const game = baseGame(b.track, week?.track.layoutCode ?? null, weather);
  const overrides = week?.raceOverrides ?? {};
  const t = TRACKS.find((x) => x.code === b.track);
  return {
    key: b.key, title: b.title, type: b.type ?? 'RACE',
    origins: { 'game.track': { source: 'STAGE' }, 'game.environment': { source: 'STAGE' }, 'game.cars': { source: 'COMMON' }, 'game.assists': { source: 'COMMON' }, 'game.simulation': { source: 'COMMON' }, 'game.finishRules': { source: 'COMMON' }, 'settings.practice': { source: 'COMMON' }, 'settings.qualifying': { source: 'COMMON' }, 'settings.race': overrides.race ? { source: 'OVERRIDE', baseline: { durationMinutes: 25, laps: null } } : { source: 'COMMON' } },
    carClass: null,
    weatherPresets: [weatherItem(weather.presetCode)].filter(Boolean),
    plugins: [{ id: 'cat-plugin-csp', kind: 'plugin', code: 'csp', title: 'Custom Shaders Patch', imageUrl: null }],
    game,
    settings: b.settings ?? (b.type === 'PRACTICE' ? { durationMinutes: Math.round((b.end - b.start) / 60000), maxParticipants: 24 } : raceSettings(overrides)),
    admission: { minimumPilotLicense: 'D', minimumSafetyLicense: 'D' },
    content: [{ itemId: 'cat-track-' + b.track, versionId: '11', kind: 'track', code: b.track, title: t?.title ?? null, imageUrl: null }, ...['bmw_m4_gt3', 'porsche_911_gt3_r'].map((c, i) => ({ itemId: 'cat-car-' + c, versionId: String(20 + i), kind: 'car', code: c, title: CARS.find((x) => x.code === c).title, imageUrl: null }))],
    layoutTitle: t?.layouts.find((l) => l.code === (week?.track.layoutCode ?? ''))?.title ?? t?.layouts[0]?.title ?? null,
    track: trackItem(b.track),
    cars: ['bmw_m4_gt3', 'porsche_911_gt3_r'].map(carItem),
  };
}
const registrationConfig = { mode: 'open_until_capacity', capacity: 24, opensAt: '2026-09-20T09:00:00.000Z', closesAt: '2026-12-13T13:27:00.000Z', withdrawalClosesAt: '2026-12-13T13:27:00.000Z' };
const entries = PILOTS.slice(0, 16).map((p, i) => ({
  id: String(900 + i), registrationId: 'reg-1', registrationKey: 'entry', participantId: p.participantId, status: i < 3 ? 'PENDING' : i === 15 ? 'REJECTED' : i === 14 ? 'WITHDRAWN' : 'ACCEPTED',
  createdAt: iso(Date.parse('2026-09-20T10:00:00Z') + i * 3600_000), decidedAt: i < 3 ? null : iso(Date.parse('2026-09-21T10:00:00Z') + i * 3600_000), withdrawnAt: i === 14 ? '2026-10-02T09:00:00.000Z' : null, removedAt: null,
  identity: { displayName: p.displayName }, car: carItem(i % 2 ? 'porsche_911_gt3_r' : 'bmw_m4_gt3'), skin: i % 3 ? null : { id: 'sk-' + i, title: 'Ливрея ' + p.displayName, imageUrl: null },
  selection: { data: { carId: i % 2 ? 'porsche_911_gt3_r' : 'bmw_m4_gt3' } },
  reviews: i < 3 ? [] : [{ decidedAt: iso(Date.parse('2026-09-21T10:00:00Z') + i * 3600_000), decision: i === 15 ? 'REJECTED' : 'ACCEPTED', reason: i === 15 ? 'Лицензия ниже требуемой' : undefined }],
  actions: [action('review', i < 3, 'registration_closed'), action('remove', i >= 3 && i < 14, 'registration_closed')],
}));
function resultPayload(b) {
  if (b.result) return b.result;
  const splits = progressFor(b).map((p, s) => ({
    splitIndex: s + 1,
    participants: p.participants,
    classification: p.participants.map((x, i) => ({
      participantId: x.participantId, splitPosition: i + 1, position: i + 1, carId: i % 2 ? 'porsche_911_gt3_r' : 'bmw_m4_gt3',
      points: { total: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][i] ?? 0 },
      timing: { bestLapMs: i === 4 ? null : 85329 + i * 731 + s * 400, totalMs: 1500000 + i * 4100 },
      finishStatus: i === 4 ? 'DNF' : 'FINISHED',
    })),
  }));
  return { type: 'RACE_CLASSIFICATION', splits };
}
export function workspaceSection(e, section, q) {
  if (section === 'schedule') {
    const blocks = q.get('stageKey') ? e.blocks.filter((b) => b.key === q.get('stageKey')) : e.blocks;
    if (q.get('stageKey') && !blocks.length) return { __status: 404, error: { code: 'event_block_not_found', message: 'Блок не найден' } };
    const p = page(blocks.map((b) => ({ id: b.id, b })), q, 25);
    return { items: p.items.map((x) => scheduleBlock(x.b)), nextAfterId: p.nextAfterId, registrations: [{ key: 'entry', config: registrationConfig, displayStatus: status('OPEN', 'Регистрация открыта', '2026-09-20T09:00:00.000Z') }], dependencies: null };
  }
  if (section === 'conditions') {
    const blocks = q.get('stageKey') ? e.blocks.filter((b) => b.key === q.get('stageKey')) : e.blocks.slice(0, 3);
    return { stages: e.settings ? blocks.map((b) => conditionsFor(e, b)) : null, registrations: [{ key: 'entry', admission: { minimumPilotLicense: 'D', minimumSafetyLicense: 'D' }, selection: { car: 'required', skin: 'optional' } }], results: [{ key: 'race-result', producer: { key: q.get('stageKey') }, scoring: weeklySettings.scoring }], rating: { mode: 'result', config: { pilotMultiplier: 1, safetyMultiplier: 1 } } };
  }
  if (section === 'participants') {
    let items = entries;
    if (q.get('participantId')) items = items.filter((x) => x.participantId === q.get('participantId'));
    return { ...page(items, q, 25), registrations: [{ id: 'reg-1', key: 'entry', config: registrationConfig, admission: { minimumPilotLicense: 'D', minimumSafetyLicense: 'D' }, displayStatus: status('OPEN', 'Регистрация открыта', '2026-09-20T09:00:00.000Z'), actions: [action('add', false, 'registration_closed')] }] };
  }
  if (section === 'attendance') {
    const done = e.blocks.filter((b) => b.execution);
    const items = PILOTS.map((p) => ({ id: p.participantId, participantId: p.participantId, identity: p, stages: done.filter((b) => progressFor(b).some((s) => s.participants.some((x) => x.participantId === p.participantId))).slice(0, 4).map((b) => ({ key: b.key, title: b.title })) }));
    return page(q.get('participantId') ? items.filter((x) => x.participantId === q.get('participantId')) : items, q, 25);
  }
  if (section === 'results') {
    const done = e.blocks.filter(hasResult);
    const heads = [{ id: 'r-total', title: 'Итог события', definition: { key: 'season', type: 'SEASON_STANDINGS', primaryForEvent: true }, displayStatus: status('WAITING', 'Ожидается результат'), currentRevisionId: null, currentRevisionNumber: 0 },
      ...done.map((b) => ({ id: 'r' + b.id, title: b.title, definition: { key: b.key + '-result', type: b.type === 'TIME_ATTACK' ? 'TIME_ATTACK' : b.type === 'TOURNAMENT' ? 'BRACKET' : 'RACE_CLASSIFICATION', primaryForEvent: false }, displayStatus: status('READY', 'Результат опубликован', b.execution.finishedAt), currentRevisionId: 'rev' + b.id, currentRevisionNumber: 1 }))];
    return page(q.get('resultId') ? heads.filter((x) => x.id === q.get('resultId')) : heads, q, 25);
  }
  if (section === 'revisions') {
    const b = e.blocks.find((x) => 'r' + x.id === q.get('resultId'));
    return { items: b ? [{ id: 'rev' + b.id, number: 1, createdAt: b.execution.finishedAt, source: 'RUNTIME' }] : [], nextAfterId: null };
  }
  if (section === 'result') {
    const b = e.blocks.find((x) => 'rev' + x.id === q.get('revisionId'));
    if (!b) return { __status: 404, error: { code: 'event_result_not_found' } };
    return { id: q.get('revisionId'), resultId: 'r' + b.id, number: 1, createdAt: b.execution.finishedAt, source: 'RUNTIME', payload: resultPayload(b), decisions: [] };
  }
  if (section === 'runtime') {
    const group = q.get('stateGroup') ?? 'active';
    const all = e.blocks.flatMap(sessionsFor);
    const items = all.filter((s) => group === 'active' ? s.status === 'RUNNING' : group === 'uncertain' ? !!s.connectionLostAt : s.status !== 'RUNNING').reverse();
    return { ...page(items, q, 25), reservations: e.blocks.filter((b) => !b.execution).slice(0, 6).map((b) => ({ id: 'res' + b.id, blockKey: b.key, stageTitle: b.title, startsAt: iso(b.start - 10 * 60_000), estimatedEndsAt: iso(b.end), serverCount: 2, status: 'SCHEDULED' })) };
  }
  if (section === 'runtime-history') {
    const items = e.blocks.filter((b) => b.execution).slice(-12).reverse().flatMap((b) => sessionsFor(b).flatMap((s) => [
      ...(s.stoppedAt ? [{ id: 'h-stop-' + s.id, sessionId: s.id, type: s.status === 'FAILED' ? 'FAILED' : 'STOPPED', occurredAt: s.stoppedAt, reason: s.stopCause, phase: null, acknowledged: true }] : []),
      { id: 'h-start-' + s.id, sessionId: s.id, type: 'STARTED', occurredAt: s.startedAt, reason: null, phase: 'PRACTICE', acknowledged: true },
    ]));
    return page(items, q, 25);
  }
  if (section === 'presence') {
    const b = e.blocks.find((x) => x.execution?.status === 'RUNNING') ?? e.blocks.find((x) => x.execution);
    const items = b ? progressFor(b).flatMap((p) => p.participants.map((x, i) => ({ id: `pr-${p.runtimeSessionId}-${x.participantId}`, sessionId: p.runtimeSessionId, participantId: x.participantId, name: x.displayName, kind: i === 3 ? 'DISCONNECTED' : 'CONNECTED', occurredAt: iso(b.start + (i + 1) * 60_000), reason: i === 3 ? 'Таймаут соединения' : null }))) : [];
    return page(q.get('participantId') ? items.filter((x) => x.participantId === q.get('participantId')) : items, q, 25);
  }
  if (section === 'rating') {
    const b = e.blocks.find((x) => x.execution?.status === 'COMPLETED');
    const changes = progressFor(b)[0].participants.map((p, i) => ({ participantId: p.participantId, pilot: { before: 1500 + i * 7, delta: 12 - i * 3, after: 1512 + i * 4 }, safety: { before: 80 + i, delta: i % 2 ? -1 : 1, after: 81 + i } }));
    return { items: [{ id: 'ra-1', status: 'APPLIED', appliedAt: b.execution.finishedAt, source: { id: 'r' + b.id, version: '1' }, supersedesApplicationId: null, changes }], nextAfterId: null, identities: PILOTS };
  }
  if (section === 'history') {
    return page([
      { id: 'st-3', fromStatus: 'PUBLISHED', toStatus: 'RUNNING', reason: 'Начался первый заезд', effectiveAt: e.startsAt, observedAt: e.startsAt },
      { id: 'st-2', fromStatus: 'DRAFT', toStatus: 'PUBLISHED', reason: 'Опубликовано администратором', effectiveAt: '2026-09-02T09:00:00.000Z', observedAt: '2026-09-02T09:00:00.000Z' },
      { id: 'st-1', fromStatus: null, toStatus: 'DRAFT', reason: 'Создано из черновика', effectiveAt: '2026-09-01T08:30:00.000Z', observedAt: '2026-09-01T08:30:00.000Z' },
    ], q, 25);
  }
  if (section === 'notifications') return { items: [], nextAfterId: null };
  if (section === 'edit') return { settings: e.settings ?? null, version: e.version, description: e.description };
  if (section === 'attempts') {
    const b = e.blocks.find((x) => x.id === q.get('blockId'));
    if (!b) return { __status: 404, error: { code: 'event_block_not_found' } };
    const items = (b.attempts ?? []).map((a) => ({ ...a, displayStatus: a.status === 'DISQUALIFIED' ? status('DISQUALIFIED', 'Дисквалификация', null, { code: 'TRACK_LIMITS', message: 'Попытка не засчитана: выезды за пределы трассы.' }) : status('COMPLETED', 'Завершено') }));
    return page(items, q, 25);
  }
  return { __status: 400, error: { code: 'invalid_workspace_section' } };
}
export const findEvent = (id) => EVENTS.find((e) => e.id === id);
