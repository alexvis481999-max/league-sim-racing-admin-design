// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {MatchDetails} from './MatchDetails';
afterEach(cleanup);
it('shows server details and actual leader/chaser roles',()=>{
 render(<MatchDetails match={{id:'1',startedAt:'2026-10-08T18:01:00Z',finishedAt:'2026-10-08T18:04:00Z',serverId:'server_02',resultId:'20',players:[{id:'a',name:'Alice'},{id:'b',name:'Bob'}],result:{winnerId:'a',rounds:[{roundNumber:1,kind:'REGULAR',winnerId:'a',heats:[{heatNumber:1,attemptNumber:1,leaderId:'b',chaserId:'a',winnerId:'a',status:'COMPLETED',adjustedGapMs:842}]}]}}}/>);
 expect(screen.getByText('3 мин 0 с')).toBeTruthy();expect(screen.getByText('server_02')).toBeTruthy();expect(screen.getByText('Лидер').parentElement?.textContent).toContain('Bob');expect(screen.getByText('Догоняющий').parentElement?.textContent).toContain('Alice');
});
