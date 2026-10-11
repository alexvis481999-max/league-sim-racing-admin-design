import {expect,it} from 'vitest';
import {initialSettings} from './initial-settings';
import {localInput,localInstant} from './local-time';
import catalog from './fixtures/catalog.json';
import type {Descriptor,Settings} from './types';
it('initializes a new document once without altering catalog defaults or a saved document',()=>{
  const descriptor=catalog.items[0] as unknown as Descriptor, original=structuredClone(descriptor.defaults);
  const settings=initialSettings(descriptor),event=settings.event as Settings;
  expect(typeof event.timezone).toBe('string');
  expect(Number.isFinite(Date.parse(String(settings.raceStartsAt)))).toBe(true);
  expect(descriptor.defaults).toEqual(original);
  const wire=String(settings.raceStartsAt);expect(localInstant(localInput(wire))).toBe(wire);
});
