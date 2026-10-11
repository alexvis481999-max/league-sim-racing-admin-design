import { EmptyState, Panel, StatusBadge, Table, TextLink, clickableRow, count } from '../../../../ui/v16';
import { useWorkspace, useWorkspaceNav } from '../context';
import { currentGroup, groupProgram, groupStateLabel, groupStateTone } from '../program';
import { groupPeriod } from './WeeklyOverview';

/** Weeks of a weekly series, grouped by the server group.key of every race in WorkspaceSummary.program. */
export function WeeksList() {
  const { summary, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const groups = groupProgram(summary.program, 'Без недели');
  const weeks = groups.filter((g) => g.kind === 'WEEK');
  const current = currentGroup(groups, summary.currentStage?.key);
  if (!groups.length) return <Panel title="Недели"><EmptyState compact title="Недель пока нет">Расписание серии ещё не сформировано сервером.</EmptyState></Panel>;
  return (
    <Panel title={count(weeks.length, ['неделя', 'недели', 'недель'])} body={false}
      foot="Период — даты первой и последней гонки недели в часовом поясе события. Состояние недели рассчитано по серверным статусам её гонок: отдельного статуса недели API не передаёт.">
      <Table variant="weeks" label="Недели серии">
        <thead><tr><th>Неделя</th><th>Период</th><th className="lsr-hide-sm">Трасса</th><th>Гонки</th><th>Состояние</th><th aria-hidden="true" /></tr></thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} {...clickableRow(() => nav.week(g.key), g.key === current?.key ? 'is-current' : '')} aria-label={`Открыть ${g.title}`}>
              <td>
                <div className="lsr-primary">{g.title}{g.tracks.length === 1 && !g.title.includes(g.tracks[0]) ? ` · ${g.tracks[0]}` : ''}</div>
                <div className="lsr-minor">{g.kind === 'WEEK' ? `Неделя ${g.index + 1} из ${weeks.length}` : 'Гонки без серверной группы недели'}</div>
              </td>
              <td className="lsr-nowrap">{groupPeriod(g, timezone)}</td>
              <td className="lsr-hide-sm">{g.tracks.join(', ') || '—'}</td>
              <td className="lsr-num lsr-nowrap">{g.completed} / {g.total}</td>
              <td><StatusBadge status={{ code: g.state, label: groupStateLabel[g.state] }} tone={groupStateTone[g.state]} title={g.failed ? `Ошибок выполнения: ${g.failed}` : undefined} /></td>
              <td><TextLink onClick={() => nav.week(g.key)}>Открыть →</TextLink></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
