import { describe, it, expect } from 'vitest';
import { hasPlatformPermission, organizerIdsFor } from './access';
import type { AdminAccess } from './types';
describe('grant scopes', () => {
  it('does not cross permissions between organizers', () => {
    const access: AdminAccess = {userId:'9007199254740993',panelAccess:true,grants:[
      {id:'1',roleCode:'organizer_event_manager',scopeType:'organizer',scopeId:'10',validFrom:null,validTo:null,constraints:null,permissions:['events.write.scoped']},
      {id:'2',roleCode:'organizer_news_editor',scopeType:'organizer',scopeId:'20',validFrom:null,validTo:null,constraints:null,permissions:['news.write.scoped']},
    ]};
    expect(organizerIdsFor(access,'events.write.scoped')).toEqual(['10']);
    expect(organizerIdsFor(access,'news.write.scoped')).toEqual(['20']);
    expect(hasPlatformPermission(access,'events.write.scoped')).toBe(false);
  });
});
