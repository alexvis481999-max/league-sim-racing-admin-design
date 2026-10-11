import type { Descriptor, Settings } from './types';
import { localInput } from './local-time';
export function initialSettings(descriptor: Descriptor): Settings {
  const settings = structuredClone(descriptor.defaults),
    now = new Date();
  now.setSeconds(0, 0);
  const start = now.toISOString(),
    end = new Date(now.getTime() + descriptor.windowDefaultMinutes * 60000).toISOString();
  (settings.event as Settings).timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const visit = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    for (const [key, item] of Object.entries(v)) {
      const r = v as Settings;
      if (item === '' && ['startsAt', 'raceStartsAt', 'firstBlockStartsAt'].includes(key))
        r[key] = start;
      else if (item === '' && key === 'endsAt') r[key] = end;
      else if (item === '' && key === 'firstDate') r[key] = localInput(start).slice(0, 10);
      else visit(item);
    }
  };
  visit(settings);
  return settings;
}
