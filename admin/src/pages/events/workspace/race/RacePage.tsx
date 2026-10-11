import { useMemo, useState } from 'react';
import { displayDiscipline, displayGame } from '../../../../../../shared/presentation';
import { LocalDateTimeField } from '../../../../features/event-authoring/LocalDateTimeField';
import {
  ActionButton, AsyncView, Button, DateGrid, Dialog, EmptyState, Notice, PageHeader, Panel, PillButtons, StatusBadge, Table, Tabs, TextLink, Timeline,
  count, shortDateTime, usePageChrome,
} from '../../../../ui/v16';
import { useWorkspaceData } from '../data';
import { workspacePath } from '../data';
import { action, useWorkspace, useWorkspaceNav } from '../context';
import { groupProgram } from '../program';
import { ConditionsPanel, type ConditionsResponse } from '../common/conditions';
import { ResultRevisions } from '../common/results';
import { raceSteps, type ScheduleBlock, type ScheduleResponse } from '../common/schedule';
import { groupHeading } from '../weekly/WeeklyOverview';

type RaceTab = 'conduct' | 'participants' | 'results' | 'history';
const tabs: { key: RaceTab; label: string }[] = [{ key: 'conduct', label: 'Проведение' }, { key: 'participants', label: 'Участники' }, { key: 'results', label: 'Результаты' }, { key: 'history', label: 'История' }];
const groupSection: Record<string, string> = { WEEK: 'weeks', STAGE: 'stages', ROUND: 'program' };
const groupListLabel: Record<string, string> = { WEEK: 'Недели', STAGE: 'Этапы', ROUND: 'Сетка' };

/** One scheduled block (race, practice, stage race, round) with its own tabs. Shared by weekly, championship and single-race scenarios. */
export function RacePage({ blockKey }: { blockKey: string }) {
  const { summary, eventId, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const tab = (tabs.some((t) => t.key === nav.params.get('tab')) ? nav.params.get('tab') : 'conduct') as RaceTab;
  const r = useWorkspaceData<ScheduleResponse>(workspacePath(eventId, 'schedule') + `?stageKey=${encodeURIComponent(blockKey)}`, true);
  const conditions = useWorkspaceData<ConditionsResponse>(workspacePath(eventId, 'conditions') + `?stageKey=${encodeURIComponent(blockKey)}`, tab === 'conduct');
  const groups = useMemo(() => groupProgram(summary.program), [summary.program]);
  const programBlock = summary.program?.find((b) => b.key === blockKey);
  const group = groups.find((g) => g.blocks.some((b) => b.key === blockKey) && g.key !== '__none') ?? null;
  const block = r.data?.items[0];
  const title = block?.title ?? programBlock?.title ?? blockKey;
  const kind = group?.kind ?? '';
  const backTo = group ? `/events/${eventId}?week=${encodeURIComponent(group.key)}` : `/events/${eventId}`;
  usePageChrome({
    variant: 'event', back: { label: 'Назад', to: backTo },
    crumbs: [{ label: summary.event.title, to: `/events/${eventId}` }, ...(group ? [{ label: groupListLabel[kind] ?? 'Программа', to: `/events/${eventId}?section=${groupSection[kind] ?? 'program'}` }, { label: groupHeading(group), to: backTo }] : []), { label: block?.type === 'PRACTICE' ? 'Практика' : 'Гонка' }],
  });
  const splits = block?.progress.length ?? 0;
  const heading = group ? groupHeading(group) : null;
  const subtitle = [heading, programBlock?.track && !heading?.includes(programBlock.track) ? programBlock.track : null, displayGame(summary.event.gameCode), displayDiscipline(summary.event.disciplineCode), splits ? count(splits, ['сплит', 'сплита', 'сплитов']) : null].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader title={title} description={subtitle}
        actions={<>{block && <Reschedule block={block} onDone={() => void r.load()} />}<Button to={backTo}>{group ? `← К ${kind === 'WEEK' ? 'неделе' : kind === 'STAGE' ? 'этапу' : 'группе'}` : '← К событию'}</Button></>} />
      <div className="lsr-between" style={{ margin: '-6px 0 18px' }}>
        <div className="lsr-hstack" style={{ gap: 9 }}>
          <StatusBadge status={block?.displayStatus ?? programBlock?.displayStatus} />
          <span className="lsr-muted">План старта {shortDateTime(block?.plannedStartsAt ?? programBlock?.startsAt, timezone)}</span>
        </div>
        <span className="lsr-muted">{blockKey}</span>
      </div>
      <Tabs label="Разделы гонки" items={tabs} value={tab} onChange={(key) => nav.setParam('tab', key === 'conduct' ? null : key)} />
      <AsyncView resource={r} isEmpty={(d) => !d.items.length} empty={<EmptyState title="Блок не найден">Сервер не вернул блок «{blockKey}».</EmptyState>}>
        {(data) => {
          const b = data.items[0];
          if (tab === 'participants') return <RaceParticipants block={b} />;
          if (tab === 'results') return <RaceResults block={b} />;
          if (tab === 'history') return <RaceHistory block={b} />;
          return <RaceConduct block={b} conditions={conditions} />;
        }}
      </AsyncView>
    </>
  );
}

function RaceConduct({ block, conditions }: { block: ScheduleBlock; conditions: ReturnType<typeof useWorkspaceData<ConditionsResponse>> }) {
  const { timezone, eventId } = useWorkspace();
  const settings = conditions.data?.stages?.[0]?.settings;
  const absent = (name: string) => !!settings && block.type === 'RACE' && (settings[name] == null);
  const steps = raceSteps(block).filter((s) => !(s.key === 'practice' && absent('practice')) && !(s.key === 'qualifying' && absent('qualifying')));
  const inProgress = new Set(block.progress.map((p) => p.runtimeSessionId).filter(Boolean));
  const extraSessions = block.sessions.filter((s) => !inProgress.has(s.id));
  return (
    <div className="lsr-stack">
      <DateGrid items={[
        { label: 'Плановый старт', value: shortDateTime(block.plannedStartsAt, timezone) },
        { label: 'Фактический старт', value: shortDateTime(block.startedAt, timezone) },
        { label: 'Фактическое окончание', value: shortDateTime(block.finishedAt, timezone) },
        { label: 'Ожидаемое окончание', value: shortDateTime(block.estimatedEndsAt, timezone), hint: 'по плану' },
      ]} />
      <div className="lsr-cols-2">
        <Panel title="Ход проведения">
          {block.type === 'RACE' ? (
            <div className="lsr-stepper" aria-label="Фазы гонки">
              {steps.map((s) => <span key={s.key} className={`lsr-step${s.state === 'pending' ? '' : ` is-${s.state}`}`}>{s.label}</span>)}
            </div>
          ) : <div className="lsr-mutedline">Тип блока: {block.type}</div>}
          <div style={{ marginTop: 14 }}>
            {block.displayStatus.reason ? <Notice tone={block.displayStatus.code === 'FAILED' ? 'danger' : 'warning'}>{block.displayStatus.reason.message}</Notice>
              : <Notice>Фазы определены по серверным статусам гонки и её сессий{block.startedAt ? '' : '; гонка ещё не стартовала'}. Плановое время само по себе не означает старт.</Notice>}
          </div>
        </Panel>
        <Panel title="Сессии и сплиты">
          {!block.progress.length && !extraSessions.length ? <div className="lsr-mutedline">Сессии ещё не создавались.</div> : (
            <div className="lsr-rows">
              {block.progress.map((p) => {
                const session = block.sessions.find((s) => s.id === p.runtimeSessionId);
                return (
                  <div className="lsr-row-item" style={{ padding: '12px 0' }} key={p.key}>
                    <div><b>{p.title}</b><small>{session?.serverId ? `Сервер ${session.serverId}` : 'Сервер не назначен'} · {count(p.participants.length, ['пилот', 'пилота', 'пилотов'])}{p.runtimeSessionId ? <> · <TextLink size="sm" to={`/runtime?sessionId=${p.runtimeSessionId}&eventId=${eventId}`}>сессия №{p.runtimeSessionId} ↗</TextLink></> : null}</small>{p.displayStatus.reason && <small>{p.displayStatus.reason.message}</small>}</div>
                    <StatusBadge status={p.displayStatus} small />
                  </div>
                );
              })}
              {extraSessions.map((s) => (
                <div className="lsr-row-item" style={{ padding: '12px 0' }} key={s.id}>
                  <div><b>Запуск №{s.id}</b><small>{s.serverId ? `Сервер ${s.serverId}` : 'Сервер не назначен'}{s.connectedPlayers != null ? ` · онлайн ${s.connectedPlayers}` : ''}</small></div>
                  <StatusBadge status={s.displayStatus} small />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      {block.type === 'TOURNAMENT' && <RoundMatches block={block} />}
      <ConditionsPanel resource={conditions} heading={block.type === 'PRACTICE' ? 'Условия практики' : block.type === 'TOURNAMENT' ? 'Условия раунда' : block.type === 'TIME_ATTACK' ? 'Условия попыток' : 'Условия гонки'} />
    </div>
  );
}

function RoundMatches({ block }: { block: ScheduleBlock }) {
  const { eventId } = useWorkspace();
  if (!block.progress.length) return <Panel title="Пары раунда"><div className="lsr-mutedline">Пары сформируются при запуске раунда.</div></Panel>;
  return (
    <div className="lsr-stack">
      {block.progress.map((m) => (
        <Panel key={m.key} title={`${m.title} · ${m.participants.map((p) => p.displayName).join(' — ') || 'соперники не определены'}`} actions={<StatusBadge status={m.displayStatus} small />} body={!m.children.length}>
          {m.children.length ? (
            <Table label={m.title}>
              <thead><tr><th>Заезд</th><th>Участники заезда</th><th>Состояние</th><th>Сессия</th></tr></thead>
              <tbody>{m.children.map((h) => <tr key={h.key}><td className="lsr-primary">{h.title}</td><td>{h.participants.map((p) => p.displayName).join(', ') || '—'}</td><td><StatusBadge status={h.displayStatus} small /></td><td>{h.runtimeSessionId ? <TextLink size="sm" to={`/runtime?sessionId=${h.runtimeSessionId}&eventId=${eventId}`}>№{h.runtimeSessionId} ↗</TextLink> : '—'}</td></tr>)}</tbody>
            </Table>
          ) : <div className="lsr-mutedline">{m.displayStatus.reason?.message ?? 'Заезды пары ещё не проводились.'}</div>}
        </Panel>
      ))}
    </div>
  );
}

function RaceParticipants({ block }: { block: ScheduleBlock }) {
  const { eventId, summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const [mode, setMode] = useState<'attendance' | 'applications'>('attendance');
  const [split, setSplit] = useState('all');
  const shown = block.progress.filter((p) => split === 'all' || p.key === split);
  return (
    <div className="lsr-stack">
      <PillButtons label="Состав гонки" value={mode} onChange={setMode} size="lg" options={[{ value: 'attendance', label: 'Фактический состав' }, ...(summary.activity.hasRegistration ? [{ value: 'applications' as const, label: 'Заявки на участие' }] : [])]} />
      {mode === 'applications' ? (
        <Notice actions={<Button size="sm" onClick={() => nav.section('participants')}>Открыть заявки события</Button>}>
          Заявки принадлежат окнам регистрации события. Проекция заявок не указывает, к какой гонке относится окно, поэтому они рассматриваются в разделе «Участники» события.
        </Notice>
      ) : !block.progress.length ? (
        <EmptyState compact title="Фактический состав ещё не сформирован">{block.startedAt ? 'Сервер не передал распределение по сплитам.' : 'Состав появится после формирования сплитов при запуске гонки.'}</EmptyState>
      ) : (
        <>
          {block.progress.length > 1 && <PillButtons label="Сплит" prefix="Сплит:" value={split} onChange={setSplit} size="lg" options={[{ value: 'all', label: `Все (${block.progress.length})` }, ...block.progress.map((p) => ({ value: p.key, label: p.title }))]} />}
          {shown.map((p) => (
            <Panel key={p.key} title={`${p.title} · фактический состав`} body={false} foot="Фактический состав по сплитам из хода проведения, не список заявок. Машина и подключения отдельной гонки в этой проекции не передаются — см. результаты и подключения события.">
              <Table label={p.title}>
                <thead><tr><th>Пилот</th><th>ID участника</th><th aria-hidden="true" /></tr></thead>
                <tbody>
                  {p.participants.map((x) => (
                    <tr key={x.participantId}>
                      <td className="lsr-primary">{x.displayName}</td>
                      <td className="lsr-num lsr-sub">{x.participantId}</td>
                      <td style={{ textAlign: 'right' }}><span className="lsr-hstack" style={{ justifyContent: 'flex-end', gap: 14 }}>
                        <TextLink size="sm" to={`/users?userId=${x.participantId}&eventId=${eventId}`}>Профиль ↗</TextLink>
                        <TextLink size="sm" to={`/events/${eventId}?section=servers&view=presence&participantId=${x.participantId}`}>Подключения</TextLink>
                      </span></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          ))}
        </>
      )}
    </div>
  );
}

function RaceResults({ block }: { block: ScheduleBlock }) {
  const { eventId } = useWorkspace();
  const [selected, setSelected] = useState(block.resultIds[0] ?? '');
  if (!block.resultIds.length) {
    const code = block.displayStatus.code;
    return <Notice tone={code === 'FAILED' ? 'danger' : 'neutral'}>{code === 'FAILED' ? `Результат не сформирован: ${block.displayStatus.reason?.message ?? 'исполнение завершилось ошибкой'}.` : block.startedAt && !block.finishedAt ? 'Гонка идёт. Классификация появится после обработки результатов.' : block.finishedAt ? 'Сервер не связал результат с этой гонкой.' : 'Гонка ещё не началась. Классификация появится после завершения.'}</Notice>;
  }
  return (
    <div className="lsr-stack">
      {block.resultIds.length > 1 && <PillButtons label="Результат" value={selected} onChange={setSelected} options={block.resultIds.map((id, i) => ({ value: id, label: `Результат ${i + 1}` }))} />}
      <ResultRevisions key={selected} eventId={eventId} resultId={selected} active />
    </div>
  );
}

function RaceHistory({ block }: { block: ScheduleBlock }) {
  const { timezone } = useWorkspace();
  const requested = block.sessions.map((s) => s.requestedAt).filter((v): v is string => !!v).sort()[0] ?? null;
  const items = [
    { title: 'Плановый старт', at: shortDateTime(block.plannedStartsAt, timezone) },
    { title: 'Запрос игрового сервера', detail: block.sessions.length ? count(block.sessions.length, ['сессия', 'сессии', 'сессий']) : 'Сессии ещё не запрашивались', at: shortDateTime(requested, timezone) },
    { title: 'Фактический старт', at: shortDateTime(block.startedAt, timezone) },
    ...block.sessions.flatMap((s) => [
      ...(s.startedAt ? [{ title: `Сессия №${s.id} запущена`, detail: s.serverId ? `Сервер ${s.serverId}` : undefined, at: shortDateTime(s.startedAt, timezone) }] : []),
      ...(s.connectionLostAt ? [{ title: `Сессия №${s.id}: потеря связи`, detail: s.recoveryDeadlineAt ? `Проверка до ${shortDateTime(s.recoveryDeadlineAt, timezone)}` : undefined, at: shortDateTime(s.connectionLostAt, timezone) }] : []),
      ...(s.stoppedAt ? [{ title: `Сессия №${s.id}: ${s.displayStatus.label.toLowerCase()}`, detail: s.stopCause ?? s.displayStatus.reason?.message, at: shortDateTime(s.stoppedAt, timezone) }] : []),
    ]),
    { title: 'Фактическое окончание', detail: block.displayStatus.code === 'FAILED' ? block.displayStatus.reason?.message : undefined, at: shortDateTime(block.finishedAt, timezone) },
    { title: 'Ожидаемое окончание (план)', at: shortDateTime(block.estimatedEndsAt, timezone) },
  ];
  return (
    <Panel title="Хронология" foot="Только зафиксированные сервером моменты; отсутствующий факт — «—». Полный журнал исполнения и подключений — в разделе «Журнал» события.">
      <Timeline items={items} />
    </Panel>
  );
}

function Reschedule({ block, onDone }: { block: ScheduleBlock; onDone: () => void }) {
  const { summary, execute, blocked } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const reschedule = action(summary, 'reschedule');
  if (block.startedAt || !['SCHEDULED', 'WAITING'].includes(block.displayStatus.code)) return null;
  return (
    <>
      <ActionButton action={reschedule} disabled={blocked} onClick={() => { setDate(block.plannedStartsAt); setOpen(true); }}>Перенести</ActionButton>
      <Dialog open={open} onClose={() => !blocked && setOpen(false)} title={`Перенести «${block.title}»`} description="Новое время вводится в часовом поясе браузера; сервер проверит, что гонка ещё не началась."
        actions={<><Button disabled={blocked} onClick={() => setOpen(false)}>Отмена</Button>
          <ActionButton variant="primary" action={reschedule} disabled={blocked || !date}
            onClick={() => void execute('/reschedule', { expectedVersion: summary.version, changes: [{ target: { type: 'block', blockKey: block.key }, startsAt: date }] }).then((ok) => { if (ok) { setOpen(false); onDone(); } })}>Перенести</ActionButton></>}>
        <LocalDateTimeField label="Новое начало" value={date} onChange={setDate} />
      </Dialog>
    </>
  );
}
