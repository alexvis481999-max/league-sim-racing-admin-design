// Dev-only runtime daemon projection (`GET /admin/runtime/ac/daemon`). Shape follows admin/src/pages/runtime/runtime-monitoring.ts.
// Slot state, process state and session state are deliberately independent: an allocated slot may have no confirmed process,
// and a session with lost connection is "unconfirmed", not stopped. Values are synthetic.
const minutes = (iso, n) => new Date(Date.parse(iso) + n * 60_000).toISOString();

export function register(on, { NOW }) {
  const status = (code, label, reason = null) => ({ code, label, reason, effectiveAt: null, observedAt: NOW, freshness: code === 'UNKNOWN' ? 'UNCERTAIN' : 'CURRENT' });
  const slots = [
    { serverId: 'srv-1', serverCode: 'server_01', state: 'ALLOCATED', currentRuntimeSessionId: '3301' },
    { serverId: 'srv-2', serverCode: 'server_02', state: 'ALLOCATED', currentRuntimeSessionId: '3302' },
    { serverId: 'srv-3', serverCode: 'server_03', state: 'AVAILABLE', currentRuntimeSessionId: null },
    { serverId: 'srv-4', serverCode: 'server_04', state: 'ALLOCATED', currentRuntimeSessionId: '3305' },
    { serverId: 'srv-5', serverCode: 'server_05', state: 'COOLDOWN', currentRuntimeSessionId: null, availableAt: minutes(NOW, 1) },
    { serverId: 'srv-6', serverCode: 'server_06', state: 'AVAILABLE', currentRuntimeSessionId: null },
  ];
  const session = (id, extra) => ({
    id, status: 'RUNNING', serverId: null, runtimeRunId: 'run_' + id, connectionLostAt: null, capacityWaitDeadlineAt: minutes(NOW, 30), failure: null,
    startedAt: null, stoppedAt: null, plannedStartsAt: null, estimatedEndsAt: null, reservationId: null, connectedPlayers: null, sessionTypes: ['RACE'], ...extra,
  });
  const sessions = [
    session('3301', { serverId: 'srv-1', sessionTypes: ['QUALIFYING', 'RACE'], connectedPlayers: 18, startedAt: minutes(NOW, -5), estimatedEndsAt: minutes(NOW, 43), reservationId: '71', displayStatus: status('RACE', 'Гонка') }),
    session('3302', { serverId: 'srv-2', sessionTypes: ['PRACTICE'], connectedPlayers: 14, startedAt: minutes(NOW, -25), estimatedEndsAt: minutes(NOW, 35), displayStatus: status('PRACTICE', 'Практика') }),
    session('3305', { serverId: 'srv-4', sessionTypes: ['PRACTICE'], connectedPlayers: null, startedAt: minutes(NOW, -35), estimatedEndsAt: minutes(NOW, 25), connectionLostAt: minutes(NOW, -2),
      displayStatus: status('UNKNOWN', 'Связь уточняется', { code: 'connection_lost', message: 'Нет свежих данных от сервера с ' + new Date(minutes(NOW, -2)).toISOString().slice(11, 16) + ' UTC' }) }),
    session('3308', { status: 'WAITING_CAPACITY', sessionTypes: ['PRACTICE'], plannedStartsAt: null, displayStatus: status('WAITING_CAPACITY', 'Ожидает сервер') }),
    session('3290', { status: 'STOPPED', serverId: 'srv-5', sessionTypes: ['PRACTICE'], startedAt: minutes(NOW, -66), stoppedAt: minutes(NOW, -6), displayStatus: status('COMPLETED', 'Завершена') }),
    session('3288', { status: 'FAILED', serverId: 'srv-3', sessionTypes: ['PRACTICE'], startedAt: minutes(NOW, -50), stoppedAt: minutes(NOW, -49), failure: { code: 'server_start_timeout' },
      displayStatus: status('FAILED', 'Ошибка запуска', { code: 'server_start_timeout', message: 'Процесс не ответил за 60 секунд' }) }),
  ];
  const queue = [
    { runtimeSessionId: '3308', requestedAt: minutes(NOW, -1), plannedStartsAt: null, reservationId: null },
    { runtimeSessionId: '3310', requestedAt: minutes(NOW, -0.5), plannedStartsAt: minutes(NOW, 25), reservationId: '72' },
  ];
  const reservations = [
    { id: '71', owner: { type: 'EVENT', id: '12' }, serverCount: 1, status: 'ACTIVE', startsAt: minutes(NOW, -10), estimatedEndsAt: minutes(NOW, 43) },
    { id: '72', owner: { type: 'EVENT', id: '12' }, serverCount: 2, status: 'SCHEDULED', startsAt: minutes(NOW, 25), estimatedEndsAt: minutes(NOW, 120) },
    { id: '73', owner: { type: 'EVENT', id: '14' }, serverCount: 3, status: 'SCHEDULED', startsAt: minutes(NOW, 145), estimatedEndsAt: minutes(NOW, 235) },
    { id: '74', owner: { type: 'MATCHMAKING', id: '3' }, serverCount: 1, status: 'SCHEDULED', startsAt: minutes(NOW, 535), estimatedEndsAt: minutes(NOW, 595) },
    { id: '70', owner: { type: 'EVENT', id: '9' }, serverCount: 2, status: 'RELEASED', startsAt: minutes(NOW, -200), estimatedEndsAt: minutes(NOW, -100) },
  ];
  const metrics = {
    uptimeSeconds: 51_660,
    plugin: { status: 'CURRENT' },
    process: { pid: 4412, cpuPercent: 22.4, memoryRssBytes: 1_932_735_283, memoryHeapUsedBytes: 412_090_368 },
    system: { platform: 'linux', arch: 'x64', cpuCount: 16, loadAverage: [3.12, 2.8, 2.4], cpuPercent: 41.7, memoryFreeBytes: 21_474_836_480, memoryTotalBytes: 68_719_476_736 },
    servers: [
      { serverId: 'server_01', status: 'running', pid: 5101, runtimeSessionRefId: '3301', runtimeRunId: 'run_3301' },
      { serverId: 'server_02', status: 'running', pid: 5133, runtimeSessionRefId: '3302', runtimeRunId: 'run_3302' },
      { serverId: 'server_03', status: 'idle', pid: null },
      // server_04 has no process report: the slot is allocated but the process is not confirmed.
      { serverId: 'server_05', status: 'idle', pid: null },
      { serverId: 'server_06', status: 'idle', pid: null },
    ],
  };
  on('GET', '/admin/runtime/ac/daemon', () => ({ daemonId: 'ac-node-01', status: 'CURRENT', receivedAt: minutes(NOW, -0.2), checkedAt: NOW, stale: false, slots, sessions, queue, reservations, metrics }));
}
