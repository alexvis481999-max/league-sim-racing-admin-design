import { createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { WorkspaceSummary } from './data';
import type { Execute } from './useEventCommands';

export type WorkspaceContextValue = {
  eventId: string;
  summary: WorkspaceSummary;
  reload: () => Promise<void>;
  execute: Execute;
  /** A command is running or awaits retry; other commands stay disabled. */
  blocked: boolean;
  timezone: string;
};
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside an event workspace');
  return value;
}
export const action = (summary: WorkspaceSummary, code: string) => summary.actions.find((a) => a.code === code);

/** Section values of the event shell. Legacy values from links of the previous admin are mapped in resolveSection. */
export type Section = 'overview' | 'weeks' | 'stages' | 'program' | 'standings' | 'leaderboard' | 'participants' | 'results' | 'servers' | 'journal' | 'appearance' | 'settings';

/** URL state of the workspace: ?section=… for the shell, ?week=… for a week/stage, ?stage=… for a race block. */
export function useWorkspaceNav() {
  const [params, setParams] = useSearchParams();
  const go = (next: Record<string, string | null>, keep: string[] = []) =>
    setParams((old) => {
      const result = new URLSearchParams();
      for (const k of keep) { const v = old.get(k); if (v) result.set(k, v); }
      for (const [k, v] of Object.entries(next)) if (v) result.set(k, v);
      return result;
    });
  return {
    params,
    section: (section: Section, extra: Record<string, string | null> = {}) => { go({ section, ...extra }); scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); },
    week: (key: string, view?: 'settings') => { go({ week: key, view: view ?? null }); scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); },
    race: (key: string, tab?: string) => { go({ stage: key, tab: tab ?? null }); scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); },
    setParam: (key: string, value: string | null) => setParams((old) => { const n = new URLSearchParams(old); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: true }),
  };
}
