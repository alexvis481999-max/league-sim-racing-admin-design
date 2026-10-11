import type {EventWorkspaceQueries} from './event-workspace.service';
export const EVENT_WORKSPACE=Symbol('EVENT_WORKSPACE');
export type EventWorkspaceOperations=Pick<EventWorkspaceQueries,'summary'|'section'>;
export type WorkspaceSection='edit'|'schedule'|'attendance'|'attempts'|'participants'|'conditions'|'runtime'|'runtime-history'|'presence'|'results'|'revisions'|'result'|'rating'|'history'|'notifications';
export interface WorkspacePageQuery {limit:number;stateGroup?:'active'|'finished'|'uncertain';stageKey?:string;afterId?:string;blockId?:string;participantId?:string;resultId?:string;revisionId?:string}
