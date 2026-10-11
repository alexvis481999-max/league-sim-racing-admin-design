export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
export type Settings = { [key: string]: Value };
export interface Document {
  contractVersion: 1;
  scenarioCode: string | null;
  settings: Settings;
  pendingImages: string[];
}
export interface Draft {
  id: string;
  document: Document;
  revision: string;
  publishedEventId: string | null;
  updatedAt: string;
}
export interface Descriptor {
  windowDefaultMinutes: number;
  raceOverrideFields: string[];
  constraints: Record<
    string,
    { minimum?: number; maximum?: number; exclusiveMinimum?: number; integer: boolean }
  >;
  sections: string[];
  components: string[];
  admissionTypes: string[];
  entryTypes: string[];
  carChangePolicies: string[];
  licenses: string[];
  minimumParticipantsPath: string | null;
  registrationWindow: boolean;
  raceDefaults: Settings | null;
  practiceDefaults: Settings;
  practiceMinimumParticipants: number;
  code: string;
  title: string;
  gameCode: string;
  enabled: boolean;
  reason: string | null;
  defaults: Settings;
  options: {
    assists: string[];
    registration: string[];
    raceFormats: string[];
    raceAggregation: Record<string, string[]>;
    elimination: string[];
    pairing: string[];
    scoring: string[];
    rating: string[];
  };
}
export interface Catalog {
  contractVersion: 1;
  games: { code: string; title: string }[];
  items: Descriptor[];
}
export interface Issue {
  code: string;
  path: string;
  sectionId: string;
  message: string;
  severity: 'error' | 'warning';
}
export interface EditRestrictions {
  structureLocked: boolean;
  scheduleLocked: boolean;
  paths: string[];
}
export interface Resolution {
  editRestrictions?: EditRestrictions;
  contractVersion: 1;
  revision: number;
  canPublish: boolean;
  issues: Issue[];
  warnings?: { code: string; message?: string }[];
  preview: {
    displaySchedule: import('../../../../shared/public-event').DisplaySchedule | null;
    event?: { startsAt: string; endsAt: string; timezone: string };
    blocks: {
      requiredServers: number;
      key: string;
      title: string;
      schedule: { startsAt: string; estimatedEndsAt: string | null };
    }[];
    registrations?: {
      key: string;
      config: {
        mode: string;
        capacity: number | null;
        opensAt: string | null;
        closesAt: string;
        withdrawalClosesAt: string;
      };
    }[];
  } | null;
}
export const emptyDocument = (): Document => ({
  contractVersion: 1,
  scenarioCode: null,
  settings: {},
  pendingImages: [],
});
