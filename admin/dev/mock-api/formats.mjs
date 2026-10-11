// Dev-only synthetic blocks for championship, single race, practice, time attack and tournament.
// Group keys follow blockGroup() of api-reference/workspace-schedule (stage-N / `${bracket}-${round}`).
import { PILOTS, TRACKS } from './reference.mjs';

const MSK = 3 * 3600_000;
const iso = (ms) => new Date(ms).toISOString();
const at = (localDate, localTime) => Date.parse(`${localDate}T${localTime}:00Z`) - MSK;
const addDays = (date, n) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400_000).toISOString().slice(0, 10);
const trackTitle = (code) => TRACKS.find((t) => t.code === code)?.title ?? code;

function execution(start, end, now, failed = false) {
  if (end <= now) return { status: failed ? 'FAILED' : 'COMPLETED', startedAt: iso(start + 2 * 60_000), finishedAt: iso(end - 3 * 60_000), reason: failed ? { code: 'SESSION_FAILED' } : null };
  if (start <= now) return { status: 'RUNNING', startedAt: iso(start + 2 * 60_000), finishedAt: null };
  return null;
}

export function championshipBlocks(now) {
  const tracks = ['monza', 'spa', 'imola', 'silverstone', 'nurburgring', 'suzuka', 'brands_hatch', 'barcelona'];
  const blocks = [];
  tracks.forEach((track, i) => {
    const date = addDays('2026-09-25', i * 7);
    const n = i + 1;
    const group = { key: `stage-${n}`, title: `Этап ${n} · ${trackTitle(track)}`, kind: 'STAGE' };
    const pStart = at(date, '11:00'), pEnd = at(date, '12:30'), rStart = at(date, '13:00'), rEnd = at(date, '14:06');
    blocks.push({ id: String(6000 + n * 2 - 1), key: `stage-${n}-practice`, title: `Этап ${n} · ${trackTitle(track)}: практика`, type: 'PRACTICE', start: pStart, end: pEnd, execution: execution(pStart, pEnd, now), phase: 'PRACTICE', splits: execution(pStart, pEnd, now) ? 1 : 0, seed: n, track, group });
    const ex = execution(rStart, rEnd, now);
    blocks.push({ id: String(6000 + n * 2), key: `stage-${n}-race`, title: `Этап ${n} · ${trackTitle(track)}: гонка`, type: 'RACE', start: rStart, end: rEnd, execution: ex, phase: 'QUALIFYING', splits: ex ? 2 : 0, seed: n + 3, track, group });
  });
  return blocks;
}

export function singleBlocks(now) {
  const s = at('2026-10-16', '18:00'), e = at('2026-10-16', '18:45');
  return [{ id: '7101', key: 'race', title: 'Гоночная сессия', type: 'RACE', start: s, end: e, execution: execution(s, e, now), splits: 0, seed: 2, track: 'silverstone', group: null }];
}

export function practiceBlocks(now) {
  const s = at('2026-10-10', '10:00'), e = at('2026-10-10', '14:00');
  return [{ id: '7201', key: 'practice', title: 'Открытая практика', type: 'PRACTICE', start: s, end: e, execution: execution(s, e, now), splits: 0, seed: 4, track: 'monza', group: null, settings: { durationMinutes: 240, maxParticipants: 24 } }];
}

export function timeAttackBlocks() {
  const s = at('2026-09-28', '12:00'), e = at('2026-10-04', '22:00');
  const rows = PILOTS.slice(0, 10).map((p, i) => ({ position: i + 1, participantId: p.participantId, bestAttemptMilliseconds: 106000 + i * 1079, points: null, attempts: (i % 5) + 1 }));
  const attempts = PILOTS.slice(0, 10).flatMap((p, i) => Array.from({ length: (i % 3) + 1 }, (_, j) => ({
    id: String(i * 10 + j + 1), key: `attempt-${i}-${j}`, title: `Попытка ${j + 1} · ${p.displayName}`, status: j === 1 && i === 2 ? 'DISQUALIFIED' : 'COMPLETED', runtimeSessionId: `ta${i}${j}`,
    participants: [p], children: [], lapMs: 106000 + i * 1079 + j * 420,
  })));
  return [{ id: '7301', key: 'attempts', title: 'Окно попыток', type: 'TIME_ATTACK', start: s, end: e, execution: { status: 'COMPLETED', startedAt: iso(s), finishedAt: iso(e) }, splits: 0, seed: 5, track: 'imola', group: null,
    settings: { attemptDurationMinutes: 15, attemptLimit: 10 }, result: { type: 'TIME_ATTACK', rows, participants: PILOTS.slice(0, 10) }, attempts }];
}

export function tournamentBlocks(now) {
  const date = '2026-10-09';
  const seeds = PILOTS.slice(0, 8);
  const rounds = [
    { bracket: 'UPPER', round: 1, time: '11:00', pairs: [[0, 7], [3, 4], [1, 6], [2, 5]] },
    { bracket: 'UPPER', round: 2, time: '12:30', pairs: [[0, 3], [1, 2]] },
    { bracket: 'LOWER', round: 1, time: '12:30', pairs: [[7, 4], [6, 5]] },
    { bracket: 'UPPER', round: 3, time: '14:00', pairs: [[0, 1]] },
    { bracket: 'LOWER', round: 2, time: '14:00', pairs: [[3, 4], [2, 5]] },
    { bracket: 'FINAL', round: 1, time: '16:00', pairs: [[0, 2]] },
  ];
  return rounds.map((r, i) => {
    const s = at(date, r.time), e = s + 80 * 60_000;
    const ex = execution(s, e, now);
    const bracketTitle = r.bracket === 'UPPER' ? 'Основная сетка' : r.bracket === 'LOWER' ? 'Нижняя сетка' : 'Финал';
    const matches = r.pairs.map(([a, b], m) => {
      const done = ex?.status === 'COMPLETED', live = ex?.status === 'RUNNING' && m === 0;
      const winner = done ? seeds[a] : null;
      return {
        key: `${r.bracket.toLowerCase()}-${r.round}-m${m + 1}`, title: `Матч ${i * 4 + m + 1}`, status: done ? 'COMPLETED' : live ? 'RUNNING' : 'PENDING', runtimeSessionId: done || live ? `t${i}${m}` : null,
        participants: [seeds[a], seeds[b]], winnerId: winner?.participantId ?? null,
        children: done ? [1, 2, 3].slice(0, m % 2 ? 3 : 2).map((h) => ({ key: `heat-${h}`, title: `Заезд ${h}`, status: 'FINISHED', runtimeSessionId: `t${i}${m}${h}`, participants: [seeds[h % 2 ? a : b]], children: [] })) : [],
      };
    });
    return { id: String(7400 + i + 1), key: `round-${r.bracket.toLowerCase()}-${r.round}`, title: `${bracketTitle} · раунд ${r.round}`, type: 'TOURNAMENT', start: s, end: e, execution: ex, splits: 0, seed: i, track: 'akina',
      group: { key: `${r.bracket}-${r.round}`, title: `${bracketTitle} · раунд ${r.round}`, kind: 'ROUND' }, matches,
      settings: { bracket: r.bracket, round: r.round, match: { winsTo: 2, maximumOmtRounds: 2, runtimeTimeLimitMinutes: 12 }, expectedParticipants: r.pairs.length * 2 },
      result: ex?.status === 'COMPLETED' ? { type: 'BRACKET_ROUND', matches: matches.map((m) => ({ participantIds: m.participants.map((p) => p.participantId), winnerId: m.winnerId })), participants: seeds } : null };
  });
}
