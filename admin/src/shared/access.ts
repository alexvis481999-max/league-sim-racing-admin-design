import type { AdminAccess } from './types';
/** UI hints only. Backend rechecks owner, grant constraints and current resource scopes. */
export function hasPlatformPermission(access: AdminAccess, ...permissions: string[]): boolean {
  return access.grants.some(grant => grant.scopeType === 'platform' && grant.scopeId === null && permissions.some(p => grant.permissions.includes(p)));
}
export function organizerIdsFor(access: AdminAccess, ...permissions: string[]): string[] {
  return [...new Set(access.grants.filter(grant => grant.scopeType === 'organizer' && grant.scopeId
    && permissions.some(p => grant.permissions.includes(p))).map(grant => grant.scopeId!))];
}
