import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../shared/api';
import { AsyncView, Button, EmptyState, ErrorState, LoadMore, LoadingBlock, Meta, MetaGrid, Notice, Panel, StatusBadge, Table, TextLink, count, eventTone, shortDateTime } from '../../../../ui/v16';
import { useWorkspaceData } from '../data';
import { workspacePath, type PageData } from '../data';
import type { ProgressView } from '../../../../../../shared/event-status';
import { useWorkspace, useWorkspaceNav } from '../context';
import { groupProgram, isWaiting, type ProgramBlock } from '../program';
import type { ConditionsResponse } from '../common/conditions';
import type { ScheduleBlock, ScheduleResponse } from '../common/schedule';
import { BlockPanel, EventFacts, UpcomingList } from '../common/overview';
import { ResultRevisions } from '../common/results';

const firstOf = (program: ProgramBlock[] | undefined, type: string) => program?.find((b) => b.type === type) ?? program?.[0];
function useConditions(blockKey: string | undefined) {
  const { eventId } = useWorkspace();
  return useWorkspaceData<ConditionsResponse>(workspacePath(eventId, 'conditions') + `?stageKey=${encodeURIComponent(blockKey ?? '')}`, !!blockKey);
}
const setting = (c: ConditionsResponse | null, key: string) => {
  const v = c?.stages?.[0]?.settings?.[key];
  return typeof v === 'number' || typeof v === 'string' ? v : v === null ? null : undefined;
};

export function SingleRaceOverview() {
  const { summary, eventId, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const race = firstOf(summary.program, 'RACE');
  const schedule = useWorkspaceData<ScheduleResponse>(workspacePath(eventId, 'schedule') + '?limit=25', true);
  const { applications } = summary.activity;
  return (
    <div className="lsr-stack">
      <EventFacts extra={[['Статус', <StatusBadge key="s" status={summary.event.displayStatus} tone={eventTone(summary.event.displayStatus)} small />]]} />
      <div className="lsr-cols-2">
        {race ? <BlockPanel block={race} title="Запланированная гонка" /> : <Panel title="Гонка"><EmptyState compact>Блок гонки не найден в программе.</EmptyState></Panel>}
        <Panel title="Регистрация">
          {!summary.activity.hasRegistration ? <div className="lsr-mutedline">У события нет регистрации: состав формируется без заявок.</div> : (
            <AsyncView resource={schedule} compact>
              {(data) => (
                <div className="lsr-stack is-tight">
                  {data.registrations.map((r) => (
                    <div key={r.key} className="lsr-stack is-tight" style={{ gap: 6 }}>
                      <div className="lsr-hstack" style={{ gap: 8 }}><b>Окно {r.key}</b><StatusBadge status={r.displayStatus} small /></div>
                      <div className="lsr-mutedline">Приём {shortDateTime(r.config.opensAt, timezone)} — {shortDateTime(r.config.closesAt, timezone)}{r.config.capacity != null ? ` · мест ${r.config.capacity}` : ''}</div>
                    </div>
                  ))}
                  <hr className="lsr-rule" style={{ margin: '8px 0' }} />
                  <MetaGrid columns={2}><Meta label="Допущено">{applications.accepted}</Meta><Meta label="Ожидают решения">{applications.pending}</Meta></MetaGrid>
                  <div className="lsr-mutedline">Заявки отделены от фактического состава и распределения по сплитам.</div>
                  <div><TextLink onClick={() => nav.section('participants')}>Заявки и участники →</TextLink></div>
                </div>
              )}
            </AsyncView>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function PracticeOverview() {
  const { summary, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const block = firstOf(summary.program, 'PRACTICE');
  const conditions = useConditions(block?.key);
  const duration = setting(conditions.data, 'durationMinutes'), seats = setting(conditions.data, 'maxParticipants') ?? setting(conditions.data, 'maxPlayersPerSession');
  return (
    <div className="lsr-stack">
      <EventFacts extra={[['Статус', <StatusBadge key="s" status={summary.event.displayStatus} tone={eventTone(summary.event.displayStatus)} small />]]} />
      <div className="lsr-cols-2">
        <Panel title="Окно практики">
          {!block ? <EmptyState compact>Блок практики не найден.</EmptyState> : (
            <div className="lsr-stack is-tight">
              <div className="lsr-row-item" style={{ padding: '0 0 10px' }}><div><small>Плановое начало</small><b>{shortDateTime(block.startsAt, timezone)}</b></div><StatusBadge status={block.displayStatus} small /></div>
              <div className="lsr-row-item" style={{ padding: '10px 0' }}><div><small>Длительность</small><b>{duration != null ? `${duration} минут` : conditions.busy ? '…' : 'Не сохранена'}</b></div></div>
              <div className="lsr-row-item" style={{ padding: '10px 0' }}><div><small>Максимум участников</small><b>{seats != null ? `${seats} на сервере` : conditions.busy ? '…' : 'Не сохранён'}</b></div></div>
              <div className="lsr-row-item" style={{ padding: '10px 0' }}><div><small>Фактический старт / окончание</small><b>{shortDateTime(block.startedAt, timezone)} / {shortDateTime(block.finishedAt, timezone)}</b></div></div>
              <div className="lsr-hstack" style={{ marginTop: 6 }}>
                <Button variant="primary" onClick={() => nav.section('servers')}>Сессии и подключения →</Button>
                <Button onClick={() => nav.race(block.key)}>Проведение и условия</Button>
              </div>
            </div>
          )}
        </Panel>
        <Panel title="Что важно отслеживать">
          <p style={{ marginTop: 0 }}>Сервер, доступность сессии, фактические подключения, время последнего появления пилота, завершение и ошибки.</p>
          <Notice>У практики нет обязательного спортивного зачёта, поэтому вкладка «Результаты» показывается только если сервер сформировал результаты.</Notice>
        </Panel>
      </div>
    </div>
  );
}

export function TimeAttackOverview() {
  const { summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const block = firstOf(summary.program, 'TIME_ATTACK');
  return (
    <div className="lsr-stack">
      <EventFacts extra={[['Статус', <StatusBadge key="s" status={summary.event.displayStatus} tone={eventTone(summary.event.displayStatus)} small />]]} />
      <div className="lsr-cols-2">
        {block ? <BlockPanel block={block} title="Окно попыток" openLabel="Проведение и условия →" /> : <Panel title="Окно попыток"><EmptyState compact>Блок попыток не найден.</EmptyState></Panel>}
        <Panel title="Рекорды и попытки">
          <p style={{ marginTop: 0 }}>Таблица лучших результатов строится сервером из засчитанных попыток. История попыток показывается отдельно и не смешивается с лучшим результатом пилота.</p>
          <Button onClick={() => nav.section('leaderboard')}>Открыть рекорды →</Button>
        </Panel>
      </div>
    </div>
  );
}

/** Leaderboard: the result of the attempt block (server classification) and the attempt history from …/attempts. */
export function LeaderboardTab({ active }: { active: boolean }) {
  const { summary, eventId, timezone } = useWorkspace();
  const block = firstOf(summary.program, 'TIME_ATTACK');
  const schedule = useWorkspaceData<ScheduleResponse>(workspacePath(eventId, 'schedule') + `?stageKey=${encodeURIComponent(block?.key ?? '')}`, active && !!block);
  const conditions = useConditions(active ? block?.key : undefined);
  if (!block) return <EmptyState title="Окна попыток нет">В программе события нет блока тайм-аттака.</EmptyState>;
  const scheduled = schedule.data?.items[0];
  const limit = setting(conditions.data, 'attemptLimit');
  return (
    <div className="lsr-cols-2">
      <div className="lsr-stack">
        <Panel title="Лучшие круги" sub="Классификация результата окна попыток">
          <AsyncView resource={schedule}>
            {() => scheduled?.resultIds.length ? <ResultRevisions eventId={eventId} resultId={scheduled.resultIds[0]} active={active} />
              : <Notice tone="neutral">{block.finishedAt ? 'Сервер не связал результат с окном попыток.' : 'Результат появится после закрытия окна и обработки попыток.'}</Notice>}
          </AsyncView>
        </Panel>
        {scheduled && <Attempts block={scheduled} active={active} />}
      </div>
      <Panel title="Окно и лимиты">
        <MetaGrid columns={2}>
          <Meta label="Открыто">{shortDateTime(block.startedAt ?? block.startsAt, timezone)}</Meta>
          <Meta label="Закроется / закрыто">{shortDateTime(block.finishedAt ?? block.endsAt, timezone)}</Meta>
          <Meta label="Попытка">{setting(conditions.data, 'attemptDurationMinutes') != null ? `${setting(conditions.data, 'attemptDurationMinutes')} мин` : '—'}</Meta>
          <Meta label="Лимит попыток">{limit === null ? 'Без ограничений' : limit ?? '—'}</Meta>
        </MetaGrid>
        <div style={{ marginTop: 14 }}><StatusBadge status={block.displayStatus} /></div>
      </Panel>
    </div>
  );
}
function Attempts({ block, active }: { block: ScheduleBlock; active: boolean }) {
  const { eventId } = useWorkspace();
  const r = useWorkspaceData<PageData<ProgressView & { id: string }>>(workspacePath(eventId, 'attempts') + `?blockId=${encodeURIComponent(block.id)}`, active);
  return (
    <Panel title="История попыток" sub="Каждая попытка — отдельный запуск; причина незачёта приходит с сервера" body={false}>
      <AsyncView resource={r} isEmpty={(d) => !d.items.length} empty={<EmptyState compact>Попыток пока нет.</EmptyState>}>
        {(data) => (
          <>
            <Table label="Попытки">
              <thead><tr><th>#</th><th>Попытка</th><th>Пилот</th><th>Состояние</th></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id} className={a.displayStatus.code === 'DISQUALIFIED' ? 'is-alert' : ''}>
                    <td className="lsr-num">{a.id}</td>
                    <td className="lsr-primary">{a.title}{a.displayStatus.reason && <div className="lsr-minor">{a.displayStatus.reason.message}</div>}</td>
                    <td>{a.participants.map((p) => p.displayName).join(', ') || '—'}</td>
                    <td><StatusBadge status={a.displayStatus} small /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <LoadMore hasMore={!!data.nextAfterId} busy={r.busy} onClick={() => void r.load(data.nextAfterId!)} />
          </>
        )}
      </AsyncView>
    </Panel>
  );
}

export function TournamentOverview() {
  const { summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const rounds = groupProgram(summary.program).filter((g) => g.kind === 'ROUND');
  const live = summary.program?.filter((b) => !isWaiting(b) && b.displayStatus?.code !== 'COMPLETED') ?? [];
  const upcoming = (summary.program ?? []).filter(isWaiting).slice(0, 4);
  return (
    <div className="lsr-cols-overview">
      <div className="lsr-stack">
        <EventFacts footer={<div className="lsr-infopills"><span className="lsr-infopill">{count(rounds.length, ['раунд', 'раунда', 'раундов'])}</span><span className="lsr-infopill">{rounds.filter((r) => r.state === 'done').length} завершено</span><span className="lsr-infopill">{live.length} идёт</span></div>} />
        {live.map((b) => <BlockPanel key={b.key} block={b} title="Идёт сейчас" openLabel="Открыть раунд →" />)}
        {!live.length && <Panel title="Сетка"><p style={{ marginTop: 0 }}>Сейчас нет идущих раундов.</p><Button variant="primary" onClick={() => nav.section('program')}>Турнирная сетка →</Button></Panel>}
      </div>
      <UpcomingList title="Ближайшие раунды" blocks={upcoming} empty="Запланированных раундов нет." />
    </div>
  );
}

/** Bracket columns from ROUND groups; matches are the progress nodes of each round block (schedule). */
export function BracketTab({ active }: { active: boolean }) {
  const { eventId, summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const [blocks, setBlocks] = useState<ScheduleBlock[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!active) return;
    let alive = true;
    (async () => {
      const all: ScheduleBlock[] = [];
      let after: string | null = null;
      do {
        const page: ScheduleResponse = await apiFetch(workspacePath(eventId, 'schedule') + `?limit=100${after ? `&afterId=${encodeURIComponent(after)}` : ''}`);
        all.push(...page.items);
        after = page.nextAfterId;
      } while (after);
      if (alive) { setBlocks(all); setError(''); }
    })().catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [active, eventId, summary.version]);
  if (error) return <ErrorState error={error} />;
  if (!blocks) return <Panel><LoadingBlock rows={5} label="Загружаем сетку" /></Panel>;
  const rounds = groupProgram(summary.program);
  const order = (key: string) => (key.startsWith('UPPER') ? 0 : key.startsWith('LOWER') ? 1 : 2);
  const columns = [...rounds].sort((a, b) => order(a.key) - order(b.key) || a.index - b.index);
  return (
    <div className="lsr-stack">
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(columns.length, 3)}, minmax(220px, 1fr))`, gap: 16, overflowX: 'auto' }}>
        {columns.map((g) => (
          <div key={g.key}>
            <div className="lsr-between" style={{ marginBottom: 10 }}><h3 style={{ fontSize: 13, margin: 0 }}>{g.title}</h3><StatusBadge status={g.blocks[0]?.displayStatus} small /></div>
            {g.blocks.flatMap((b) => {
              const scheduled = blocks.find((x) => x.key === b.key);
              if (!scheduled?.progress.length) return [<div key={b.key} className="lsr-item-line" style={{ marginBottom: 11 }}><span className="lsr-mutedline">Пары сформируются при запуске раунда · {shortDateTime(b.startsAt, summary.event.timezone)}</span></div>];
              return scheduled.progress.map((m) => (
                <button key={m.key} type="button" className="lsr-item-line is-clickable" style={{ width: '100%', background: '#fff', textAlign: 'left', marginBottom: 11, display: 'block' }} onClick={() => nav.race(b.key)}>
                  <div className="lsr-muted" style={{ marginBottom: 6 }}>{m.title} · {m.displayStatus.label}</div>
                  {m.participants.length ? m.participants.map((p) => <div key={p.participantId} style={{ fontSize: 13, margin: '4px 0' }}>{p.displayName}</div>) : <div className="lsr-mutedline">Соперники не определены</div>}
                  {!!m.children.length && <div className="lsr-mutedline" style={{ marginTop: 4 }}>{count(m.children.length, ['заезд', 'заезда', 'заездов'])}</div>}
                </button>
              ));
            })}
          </div>
        ))}
      </div>
      <Notice>Победитель пары и счёт приходят в результате раунда (вкладка «Результаты» или страница раунда). Узлы сетки показывают серверный статус и состав пары.</Notice>
    </div>
  );
}
