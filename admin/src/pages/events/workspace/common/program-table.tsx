import { EmptyState, Panel, StatusBadge, Table, TextLink, clickableRow, shortDateTime } from '../../../../ui/v16';
import { useWorkspace, useWorkspaceNav } from '../context';
import { isWaiting } from '../program';
import { EventFacts, UpcomingList, blockTypeLabel } from './overview';

/** Program of any scenario: every block of WorkspaceSummary.program with planned/actual times and server status. */
export function ProgramTable() {
  const { summary, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const blocks = [...(summary.program ?? [])].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  if (!blocks.length) return <Panel title="Программа"><EmptyState compact>Программа события пока недоступна.</EmptyState></Panel>;
  return (
    <Panel title="Программа" body={false} foot={`Время — в часовом поясе события (${timezone || 'не указан'}).`}>
      <Table label="Программа события">
        <thead><tr><th>Блок</th><th>Тип</th><th>План старта</th><th>Факт старта</th><th>Факт окончания</th><th>Состояние</th><th aria-hidden="true" /></tr></thead>
        <tbody>
          {blocks.map((b) => (
            <tr key={b.key} {...clickableRow(() => nav.race(b.key))}>
              <td><div className="lsr-primary">{b.title}</div>{b.group && <div className="lsr-minor">{b.group.title}</div>}</td>
              <td>{blockTypeLabel(b.type)}</td>
              <td className="lsr-num">{shortDateTime(b.startsAt, timezone)}</td>
              <td className="lsr-num">{shortDateTime(b.startedAt, timezone)}</td>
              <td className="lsr-num">{shortDateTime(b.finishedAt, timezone)}</td>
              <td><StatusBadge status={b.displayStatus} small /></td>
              <td><TextLink onClick={() => nav.race(b.key)}>Открыть →</TextLink></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}

export function GenericOverview() {
  const { summary } = useWorkspace();
  return (
    <div className="lsr-cols-overview">
      <EventFacts />
      <UpcomingList title="Ближайшие блоки" blocks={(summary.program ?? []).filter(isWaiting).slice(0, 5)} empty="Запланированных блоков нет." />
    </div>
  );
}
