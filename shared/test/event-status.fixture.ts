import type {EventDisplayStatus} from '../event-status';
export const statusFixture=(code='SCHEDULED',label='Заезд запланирован'):EventDisplayStatus=>({code,label,reason:null,effectiveAt:null,observedAt:'2027-01-01T09:10:00Z',freshness:'CURRENT',currentStage:null});
