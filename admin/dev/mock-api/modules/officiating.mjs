// Officiating mock: protests (reports), penalty rules and decisions for events and matchmaking matches.
// Shapes follow admin/src/pages/officiating/officiating-types.ts and ADMIN_API_MAP.md «Судейство». Synthetic data.
const MIN = 60_000;
const base = Date.parse('2026-10-09T10:05:00.000Z');
const ago = (minutes) => new Date(base - minutes * MIN).toISOString();

const race = (resultId, split, occurrence) => `race:${JSON.stringify([resultId, split, occurrence])}`;
const res = (...parts) => `res:${JSON.stringify(parts)}`;

const REPORTS = [
  { id: '184', status: 'submitted', reason: 'Контакт в T1 на первом круге: пилот затормозил поздно и развернул меня, потерял 6 позиций.', submittedById: '719', accusedId: '702', incidentLocation: 'Круг 1, поворот 1', videoUrl: 'https://video.example.com/watch?v=lsr184', replayUploadId: 'up-184', createdAt: ago(55), context: { eventId: '1038', source: { id: race('r5001', 1, 1) }, participantIds: ['719', '702'] }, comments: [] },
  { id: '183', status: 'under_review', reason: 'Срезка шиканы на последнем круге, получено преимущество в борьбе за позицию.', submittedById: '708', accusedId: '704', incidentLocation: 'Круг 12, шикана', videoUrl: null, createdAt: ago(16 * 60), context: { eventId: '1038', source: { id: race('r5002', 1, 1) }, participantIds: ['708', '704'] }, comments: [{ id: 'c1', authorId: '701', body: 'Запросили телеметрию у обоих участников.', createdAt: ago(15 * 60) }] },
  { id: '182', status: 'needs_info', reason: 'Опасный манёвр при обгоне на прямой, смена траектории дважды.', submittedById: '711', accusedId: null, incidentLocation: 'Круг 5, главная прямая', videoUrl: null, createdAt: ago(18 * 60), context: { eventId: '1038', source: { id: res('r5003') }, participantIds: ['711'] }, comments: [] },
  { id: '181', status: 'resolved', reason: 'Столкновение на старте, вылет обоих автомобилей.', submittedById: '703', accusedId: '706', incidentLocation: 'Старт, поворот 2', videoUrl: 'https://video.example.com/watch?v=lsr181', createdAt: ago(40 * 60), context: { eventId: '1038', source: { id: race('r5001', 1, 1) }, participantIds: ['703', '706'] }, comments: [] },
  { id: '180', status: 'rejected', reason: 'Блокировка в зоне торможения.', submittedById: '712', accusedId: '713', incidentLocation: 'Круг 8, поворот 4', videoUrl: null, createdAt: ago(46 * 60), context: { eventId: '1040', source: { id: res('r7001') }, participantIds: ['712', '713'] }, comments: [] },
  { id: '179', status: 'duplicate', reason: 'Контакт в T1 — повторное обращение.', submittedById: '719', accusedId: '702', incidentLocation: 'Круг 1, поворот 1', videoUrl: null, createdAt: ago(54), context: { eventId: '1038', source: { id: race('r5001', 1, 1) }, participantIds: ['719', '702'] }, comments: [] },
  { id: '178', status: 'withdrawn', reason: 'Отзываю: разобрались с соперником после гонки.', submittedById: '715', accusedId: '716', incidentLocation: 'Круг 3', videoUrl: null, createdAt: ago(70 * 60), context: { eventId: '1038', source: { id: res('r5002') }, participantIds: ['715', '716'] }, comments: [] },
  { id: '177', status: 'submitted', reason: 'Матч дуэли: соперник не вышел на финальный заезд, прошу засчитать техническое поражение.', submittedById: '705', accusedId: '709', incidentLocation: 'Матч №77', videoUrl: null, createdAt: ago(5 * 60), context: { source: { id: res('mm-res-77', 'matchmaking', '77') }, participantIds: ['705', '709'] }, comments: [] },
];
const HISTORY = {
  '183': [{ at: ago(15.5 * 60), reason: 'Взято в работу судьёй', to: 'under_review' }],
  '182': [{ at: ago(17 * 60), reason: 'Нужна запись с камеры заявителя', to: 'needs_info' }],
  '181': [{ at: ago(39 * 60), reason: 'Взято в работу', to: 'under_review' }, { at: ago(38 * 60), reason: 'Решение №41: штраф +5 с пилоту #706', to: 'resolved' }],
  '180': [{ at: ago(45 * 60), reason: 'Гоночный инцидент, нарушения нет', to: 'rejected' }],
  '179': [{ at: ago(50), reason: 'Дубликат протеста №184', to: 'duplicate' }],
};

const RULES = [
  { ruleCode: 'note', title: 'Замечание', description: 'Фиксируется в протоколе, результат не меняется.', values: [] },
  { ruleCode: 'warning', title: 'Предупреждение', description: 'Предупреждение пилоту без изменения результата.', values: [] },
  { ruleCode: 'time_penalty', title: 'Штраф времени', description: 'Добавляет время к итогу заезда. Значения — из регламента события.', values: [3000, 5000, 10000, 30000] },
  { ruleCode: 'disqualification', title: 'Дисквалификация', description: 'Исключение пилота из классификации заезда или результата целиком.', values: [] },
];
const MM_RULES = [
  { ruleCode: 'warning', title: 'Предупреждение', description: 'Без изменения исхода матча.', values: [] },
  { ruleCode: 'match_outcome', title: 'Исход матча', description: 'Устанавливает победителя пары или аннулирует результат матча.', values: [] },
];
const EFFECT = { note: 'NOTE', warning: 'WARNING', time_penalty: 'ADD_TIME_PENALTY', disqualification: 'DISQUALIFY', match_outcome: 'SET_MATCH_OUTCOME' };

const DECISIONS = {
  '/admin/events/1038': [
    { id: '41', status: 'applied', version: 'd41-v3', reason: 'Протест №181: контакт на старте по вине #706.', source: { id: 'r5001' }, effect: { type: 'ADD_TIME_PENALTY', participantId: '706', milliseconds: 5000, target: { type: 'RACE_SESSION', splitIndex: 1, occurrence: 1 } }, supersedesDecisionId: null, reportId: '181' },
    { id: '42', status: 'draft', version: 'd42-v1', reason: 'Срезка шиканы, преимущество не возвращено.', source: { id: 'r5002' }, effect: { type: 'WARNING', participantId: '704', target: { type: 'RACE_SESSION', splitIndex: 1, occurrence: 1 } }, supersedesDecisionId: null, reportId: '183' },
    { id: '40', status: 'cancelled', version: 'd40-v2', reason: 'Ошибочно выбран пилот.', source: { id: 'r5001' }, effect: { type: 'NOTE', participantId: '703', target: { type: 'RESULT' } }, supersedesDecisionId: null, reportId: null },
  ],
  '/admin/matchmaking/12/matches/77': [],
};
let nextDecision = 60, versionSeq = 10;

export function register(on, { fail, page }) {
  on('GET', '/admin/officiating/protests', ({ q }) => {
    let items = REPORTS;
    if (q.get('status')) items = items.filter((r) => r.status === q.get('status'));
    if (q.get('eventId')) items = items.filter((r) => r.context.eventId === q.get('eventId'));
    if (q.get('organizerId')) items = items.filter((r) => q.get('organizerId') === '1' && r.context.eventId);
    if (q.get('userId')) {
      const id = q.get('userId'), relation = q.get('relation');
      items = items.filter((r) => (relation === 'accused' ? r.accusedId === id : relation === 'authored' ? r.submittedById === id : r.submittedById === id || r.accusedId === id));
    }
    return page(items, q, 30);
  });
  on('GET', '/admin/officiating/protests/:id', ({ p }) => {
    const report = REPORTS.find((r) => r.id === p.id);
    return report ? { report, history: HISTORY[p.id] ?? [] } : fail(404, 'report_not_found', 'Протест не найден');
  });
  on('GET', '/admin/officiating/protests/:id/replay', ({ p }) => {
    const report = REPORTS.find((r) => r.id === p.id);
    return report?.replayUploadId ? { mock: 'replay', protestId: p.id } : fail(404, 'replay_not_found', 'Реплей не загружен');
  });
  on('POST', '/admin/officiating/protests/:id/status', ({ p, body }) => {
    const report = REPORTS.find((r) => r.id === p.id);
    if (!report) return fail(404, 'report_not_found', 'Протест не найден');
    if (!body?.resolutionReason?.trim()) return fail(400, 'resolution_reason_required', 'Укажите обоснование');
    if (body.status === 'duplicate' && !REPORTS.some((r) => r.id === body.duplicateOfProtestId && r.id !== report.id)) return fail(400, 'duplicate_target_not_found', 'Протест-оригинал не найден');
    report.status = body.status;
    (HISTORY[p.id] ??= []).push({ at: new Date().toISOString(), reason: body.resolutionReason, to: body.status });
    return { id: report.id, status: report.status };
  });

  on('GET', '/admin/matchmaking/matches/:matchId/context', ({ p }) => (p.matchId === '77' ? { matchmakingId: '12', matchId: '77' } : fail(404, 'match_not_found', 'Матч не найден')));

  const owners = [['/admin/events/:eventId', (p) => `/admin/events/${p.eventId}`], ['/admin/matchmaking/:mmId/matches/:matchId', (p) => `/admin/matchmaking/${p.mmId}/matches/${p.matchId}`]];
  for (const [pattern, owner] of owners) {
    const mm = pattern.includes('matchmaking');
    on('GET', `${pattern}/penalty-rules`, ({ p, q }) => {
      const key = owner(p);
      DECISIONS[key] ??= [];
      if (!mm && !q.get('resultId')) return fail(400, 'result_required', 'Укажите результат');
      return { rulesVersion: mm ? 'mm-2026.3' : '2026.10-a', resultId: mm ? `mm-res-${p.matchId}` : q.get('resultId'), rules: mm ? MM_RULES : RULES };
    });
    on('GET', `${pattern}/decisions`, ({ p, q }) => page(DECISIONS[owner(p)] ?? [], q, 30));
    on('POST', `${pattern}/decisions`, ({ p, body }) => {
      const list = (DECISIONS[owner(p)] ??= []);
      const err = validate(body, mm);
      if (err) return fail(400, err[0], err[1]);
      const d = { id: String(nextDecision++), status: 'draft', version: 'v1', reason: body.reason, source: { id: body.resultId ?? (mm ? 'mm-res-77' : '') }, effect: effectOf(body), supersedesDecisionId: body.supersedesDecisionId ?? null, reportId: body.reportId ?? null };
      list.unshift(d);
      return { id: d.id, version: d.version };
    });
    on('PATCH', `${pattern}/decisions/:id`, ({ p, body }) => {
      const d = (DECISIONS[owner(p)] ?? []).find((x) => x.id === p.id);
      if (!d) return fail(404, 'decision_not_found', 'Решение не найдено');
      if (d.status !== 'draft') return fail(409, 'decision_not_draft', 'Изменять можно только черновик');
      if (body?.expectedVersion !== d.version) return fail(409, 'decision_version_conflict', 'Решение уже изменено. Обновите список.');
      if (!body.changeReason?.trim()) return fail(400, 'change_reason_required', 'Укажите причину изменения');
      const err = validate(body, mm);
      if (err) return fail(400, err[0], err[1]);
      Object.assign(d, { reason: body.reason, effect: effectOf(body), version: `d${d.id}-v${++versionSeq}` });
      return { id: d.id, version: d.version };
    });
    on('POST', `${pattern}/decisions/:id/issue`, ({ p, body }) => {
      const list = DECISIONS[owner(p)] ?? [];
      const d = list.find((x) => x.id === p.id);
      if (!d) return fail(404, 'decision_not_found', 'Решение не найдено');
      if (body?.expectedVersion !== d.version) return fail(409, 'decision_version_conflict', 'Решение уже изменено. Обновите список.');
      if (!['draft', 'submitted', 'approved'].includes(d.status)) return fail(409, 'decision_not_issuable', 'Решение уже вынесено или отменено');
      d.status = 'applied'; d.version += '-i';
      if (d.supersedesDecisionId) { const old = list.find((x) => x.id === d.supersedesDecisionId); if (old) old.status = 'superseded'; }
      return { id: d.id, status: d.status };
    });
    on('POST', `${pattern}/decisions/:id/cancel`, ({ p, body }) => {
      const d = (DECISIONS[owner(p)] ?? []).find((x) => x.id === p.id);
      if (!d) return fail(404, 'decision_not_found', 'Решение не найдено');
      if (!body?.reason?.trim()) return fail(400, 'reason_required', 'Укажите причину отмены');
      if (['cancelled', 'superseded'].includes(d.status)) return fail(409, 'decision_closed', 'Решение уже закрыто');
      d.status = 'cancelled'; d.version += '-c';
      return { id: d.id, status: d.status };
    });
  }
}

function validate(body, mm) {
  const rules = mm ? MM_RULES : RULES;
  const rule = rules.find((r) => r.ruleCode === body?.ruleCode);
  if (!rule) return ['rule_not_found', 'Правило недоступно для этого результата'];
  if (!body.reason?.trim()) return ['reason_required', 'Укажите обоснование'];
  if (rule.values.length && !rule.values.includes(body.value)) return ['value_not_allowed', 'Значение не входит в регламент'];
  return null;
}
function effectOf(body) {
  const effect = { type: EFFECT[body.ruleCode] ?? body.ruleCode.toUpperCase(), participantId: body.participantId, target: body.target };
  if (body.ruleCode === 'time_penalty') effect.milliseconds = body.value;
  if (body.ruleCode === 'match_outcome') { effect.participantIds = body.participantIds; effect.winnerId = body.winnerId; }
  return effect;
}
