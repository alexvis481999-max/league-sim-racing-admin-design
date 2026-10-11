import { createContext } from 'react';
import type { Descriptor, Issue, EditRestrictions, Settings, Value } from './types';
export const EditingRestrictions = createContext<EditRestrictions | undefined>(undefined);
export const FieldFocus = createContext<string | null>(null);
export const FieldIssues = createContext<Issue[]>([]);
export const FieldCapabilities = createContext<Descriptor | undefined>(undefined);
export function read(value: Settings, path: string): Value | undefined {
  return path
    .split('.')
    .reduce<
      Value | undefined
    >((v, key) => (v && typeof v === 'object' ? (v as Settings)[key] : undefined), value);
}
export function write(value: Settings, path: string, next: Value): Settings {
  const result = structuredClone(value);
  const keys = path.split('.');
  let target = result;
  for (const key of keys.slice(0, -1)) {
    if (!target[key] || typeof target[key] !== 'object') target[key] = {};
    target = target[key] as Settings;
  }
  target[keys.at(-1)!] = next;
  return result;
}
