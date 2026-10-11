import { localDateTime } from './scenarios/authoring-time';

/** Weeks follow the authored local calendar, including races moved within that calendar. */
export function workspaceWeek(settings: unknown, startsAt: string, timezone: string, fallbackStart: string) {
  const source = settings as { weekly?: { firstDate?: string }; firstDate?: string } | null;
  const firstDate = source?.weekly?.firstDate ?? source?.firstDate ?? localDateTime(fallbackStart, timezone).slice(0, 10);
  const day = localDateTime(startsAt, timezone).slice(0, 10);
  const index = Math.floor((Date.parse(day + 'T12:00Z') - Date.parse(firstDate + 'T12:00Z')) / (7 * 86400000));
  return { key: `week-${index + 1}`, title: `Неделя ${index + 1}`, kind: 'WEEK' };
}
