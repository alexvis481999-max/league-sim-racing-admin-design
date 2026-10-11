import { expect, it } from 'vitest';
import { catalogActorLabel } from './catalogActor';

it('keeps the creator ID with a real name, Steam fallback, or a missing account', () => {
  const item = { createdByUserId: '7', createdBy: { id: '7', firstName: ' Ivan ', lastName: 'Petrov', steamName: 'Steam nick', steamAvatar: null } };
  expect(catalogActorLabel(item)).toBe('Ivan Petrov · #7');
  expect(catalogActorLabel({ ...item, createdBy: { ...item.createdBy, firstName: null, lastName: ' ' } })).toBe('Steam nick · #7');
  expect(catalogActorLabel({ createdByUserId: '7', createdBy: null })).toBe('#7');
});
