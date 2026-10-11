import {expect,it} from 'vitest';
import {weekCells,zonedInstant,zonedLocal} from './weekly-calendar';
it('shows the same stored weekly start in two viewer zones without changing the recurrence',()=>{
 const times={'1':['20:00']};
 expect(weekCells('2027-01-04','Europe/Moscow','Europe/Moscow',times,2).filter(x=>x.selected).map(x=>x.time)).toEqual(['20:00']);
 expect(weekCells('2027-01-04','Europe/Moscow','America/New_York',times,2).filter(x=>x.selected).map(x=>x.time)).toEqual(['12:00']);
 expect(times).toEqual({'1':['20:00']});
 expect(zonedLocal(zonedInstant('2027-01-04T12:00','America/New_York'),'Europe/Moscow')).toBe('2027-01-04T20:00');
});
it('rejects both kinds of DST ambiguity and keeps the weekly wall time across DST',()=>{
 expect(()=>zonedInstant('2026-03-29T02:30','Europe/Berlin')).toThrow();
 expect(()=>zonedInstant('2026-10-25T02:30','Europe/Berlin')).toThrow();
 expect(zonedInstant('2026-03-23T20:00','Europe/Berlin')).toBe('2026-03-23T19:00:00.000Z');
 expect(zonedInstant('2026-03-30T20:00','Europe/Berlin')).toBe('2026-03-30T18:00:00.000Z');
});
