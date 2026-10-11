export type DisplaySchedule = {startsAt:string;endsAt:string|null;qualificationStartsAt:string|null;qualificationEndsAt:string|null};
export type PublicEvent = {
  organizerName?: string | null;
  rules?: { calendarStartDate?:string|null; rating:{enabled:boolean;pilotMultiplier:number|null;safetyMultiplier:number|null}; aggregation:string|null; carChangeResetsPoints:boolean|null; scoring:{title:string;mode:string;points?:Record<string,number>}[]; registrations:{key:string;scope:string;blockKey:string|null;eligibilityRequired:boolean}[] } | null;
  displayStatus: import('./event-status').EventDisplayStatus;
  observedAt: string;
  displaySchedule: DisplaySchedule | null;
  id: string; organizerId: string; scenarioCode: string; title: string; description: string | null;
  registrations?: { acceptedCount?:number; displayStatus:import('./event-status').DisplayStatus; key: string; mode: string; capacity: number | null; opensAt: string | null; closesAt: string; withdrawalClosesAt: string;
    admission: { minimumPilotLicense: string; minimumSafetyLicense: string } | null;
    participants: { participantId: string; displayName: string }[] }[];
  presentation?: { coverUrl: string | null; subtitle: string | null; cardAppearance?: Record<string, unknown> | null } | null;
  timezone: string; startsAt: string; endsAt: string; gameCode: string; disciplineCode: string;
  status: 'DRAFT' | 'PUBLISHED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
};
