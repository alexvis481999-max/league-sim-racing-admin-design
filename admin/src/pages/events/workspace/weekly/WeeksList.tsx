import { EmptyState, Panel, StatusBadge, Table, TextLink, clickableRow, count, shortDateTime } from '../../../../ui/v16';
import { useWorkspace, useWorkspaceNav } from '../context';
import { currentGroup, groupProgram, groupStateText, groupStateTone } from '../program';
import { groupPeriod } from './WeeklyOverview';

const words = {
  WEEK: { forms: ['неделя', 'недели', 'недель'] as [string, string, string], column: 'Неделя', of: 'Неделя', none: 'Гонки без серверной группы недели', foot: 'Период — даты первой и последней гонки недели в часовом поясе события. Состояние недели рассчитано по серверным статусам её гонок: отдельного статуса недели API не передаёт.' },
  STAGE: { forms: ['этап', 'этапа', 'этапов'] as [string, string, string], column: 'Этап', of: 'Этап', none: 'Блоки без группы этапа', foot: 'Дата — плановый старт гонки этапа в часовом поясе события. Состояние этапа рассчитано по серверным статусам его блоков (практика и гонка).' },
};

/** Weeks (weekly) or stages (championship) grouped by the server group.key of WorkspaceSummary.program. */
export function WeeksList({ kind = 'WEEK' }: { kind?: 'WEEK' | 'STAGE' }) {
  const { summary, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const w = words[kind];
  const groups = groupProgram(summary.program, kind === 'WEEK' ? 'Без недели' : 'Без этапа');
  const main = groups.filter((g) => g.kind === kind);
  const current = currentGroup(groups, summary.currentStage?.key);
  if (!groups.length) return <Panel title={w.column}><EmptyState compact title="Пока пусто">Расписание ещё не сформировано сервером.</EmptyState></Panel>;
  return (
    <Panel title={count(main.length, w.forms)} body={false} foot={w.foot}>
      <Table variant="weeks" label={w.column}>
        <thead><tr><th>{w.column}</th><th>{kind === 'WEEK' ? 'Период' : 'Дата'}</th><th className="lsr-hide-sm">Трасса</th><th>{kind === 'WEEK' ? 'Гонки' : 'Блоки'}</th><th>Состояние</th><th aria-hidden="true" /></tr></thead>
        <tbody>
          {groups.map((g) => {
            const race = g.blocks.find((b) => b.type === 'RACE') ?? g.blocks.at(-1);
            return (
              <tr key={g.key} {...clickableRow(() => nav.week(g.key), g.key === current?.key ? 'is-current' : '')} aria-label={`Открыть ${g.title}`}>
                <td>
                  <div className="lsr-primary">{g.title}{kind === 'WEEK' && g.tracks.length === 1 && !g.title.includes(g.tracks[0]) ? ` · ${g.tracks[0]}` : ''}</div>
                  <div className="lsr-minor">{g.kind === kind ? `${w.of} ${g.index + 1} из ${main.length}` : w.none}</div>
                </td>
                <td className="lsr-nowrap">{kind === 'WEEK' ? groupPeriod(g, timezone) : shortDateTime(race?.startsAt, timezone)}</td>
                <td className="lsr-hide-sm">{g.tracks.join(', ') || '—'}</td>
                <td className="lsr-num lsr-nowrap">{g.completed} / {g.total}</td>
                <td><StatusBadge status={{ code: g.state, label: groupStateText(g.state, g.kind) }} tone={groupStateTone[g.state]} title={g.failed ? `Ошибок выполнения: ${g.failed}` : undefined} /></td>
                <td><TextLink onClick={() => nav.week(g.key)}>Открыть →</TextLink></td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Panel>
  );
}
