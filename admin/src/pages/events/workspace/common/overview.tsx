import type { ReactNode } from 'react';
import { displayDiscipline, displayGame } from '../../../../../../shared/presentation';
import { Button, DateGrid, Meta, MetaGrid, Panel, StatusBadge, TextLink, period, shortDateTime } from '../../../../ui/v16';
import { useWorkspace, useWorkspaceNav } from '../context';
import type { ProgramBlock } from '../program';

/** "Общая информация" panel shared by every scenario; extra rows come from the scenario. */
export function EventFacts({ extra = [], footer }: { extra?: [ReactNode, ReactNode][]; footer?: ReactNode }) {
  const { summary, eventId, timezone } = useWorkspace();
  const event = summary.event;
  const schedule = event.displaySchedule;
  const items: [ReactNode, ReactNode][] = [
    ['ID события', eventId],
    ['Организатор', summary.metadata.organizer?.name ?? 'Организатор не сохранён'],
    ['Сценарий', event.scenarioTitle ? `${event.scenarioTitle} · ${event.scenarioCode}` : event.scenarioCode],
    ['Игра', displayGame(event.gameCode)],
    ['Дисциплина', displayDiscipline(event.disciplineCode)],
    ['Период', period(schedule?.startsAt ?? event.startsAt, schedule ? schedule.endsAt : event.endsAt, timezone)],
    ...extra,
  ];
  return (
    <Panel title="Общая информация">
      <MetaGrid>{items.map(([label, value], i) => <Meta key={i} label={label}>{value}</Meta>)}</MetaGrid>
      {footer && <><hr className="lsr-rule" />{footer}</>}
    </Panel>
  );
}

/** Planned and actual times of one block from WorkspaceSummary.program; missing facts stay "—". */
export function BlockTimes({ block }: { block: ProgramBlock }) {
  const { timezone } = useWorkspace();
  return (
    <DateGrid items={[
      { label: 'Плановый старт', value: shortDateTime(block.startsAt, timezone) },
      { label: 'Фактический старт', value: shortDateTime(block.startedAt, timezone) },
      { label: 'Фактическое окончание', value: shortDateTime(block.finishedAt, timezone) },
      { label: 'Ожидаемое окончание', value: shortDateTime(block.endsAt, timezone) },
    ]} />
  );
}

const typeLabels: Record<string, string> = { RACE: 'Гонка', PRACTICE: 'Практика', TIME_ATTACK: 'Окно попыток', TOURNAMENT: 'Раунд турнира', DUEL: 'Дуэль' };
export const blockTypeLabel = (type: string) => typeLabels[type] ?? type;

/** A block of the program with its times and the transition to its own page. */
export function BlockPanel({ block, title, note, openLabel = 'Открыть проведение →' }: { block: ProgramBlock; title?: ReactNode; note?: ReactNode; openLabel?: string }) {
  const nav = useWorkspaceNav();
  return (
    <Panel title={title ?? block.title} actions={<StatusBadge status={block.displayStatus} small />}>
      <BlockTimes block={block} />
      <div className="lsr-between" style={{ marginTop: 14 }}>
        <div><b>{block.title}</b><div className="lsr-muted">{blockTypeLabel(block.type)}{block.track ? ` · ${block.track}` : ''}{note ? <> · {note}</> : null}</div></div>
        <Button variant="primary" onClick={() => nav.race(block.key)}>{openLabel}</Button>
      </div>
    </Panel>
  );
}

export function UpcomingList({ blocks, title, empty }: { blocks: ProgramBlock[]; title: string; empty: string }) {
  const { timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  return (
    <Panel title={title}>
      <div className="lsr-cards-inline">
        {blocks.length ? blocks.map((b) => (
          <div className="lsr-item-line is-clickable" key={b.key} onClick={() => nav.race(b.key)} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') nav.race(b.key); }}>
            <div><div className="lsr-strong">{b.group?.title ?? b.title}</div><div className="lsr-mutedline">{shortDateTime(b.startsAt, timezone)}{b.track ? ` · ${b.track}` : ''} · {blockTypeLabel(b.type)}</div></div>
            <TextLink onClick={() => nav.race(b.key)} label={`Открыть ${b.title}`}>→</TextLink>
          </div>
        )) : <div className="lsr-mutedline">{empty}</div>}
      </div>
    </Panel>
  );
}
