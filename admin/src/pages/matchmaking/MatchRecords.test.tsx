// @vitest-environment jsdom
import {cleanup,render,screen,within,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it} from 'vitest';
import {MatchRecords} from './MatchRecords';
import type {Match} from './MatchmakingPage';
afterEach(cleanup);
const match={id:'12',status:'FAILED',failure:'SESSION_FAILED',condition:{trackTitle:'Ikawa',weatherTitle:'Ясно'},players:[{id:'1',name:'Alice',ready:true,selection:{carId:'car_a',skinId:'20'}},{id:'2',name:'Bob',ready:true}],resultId:'40',result:{winnerId:'1',rounds:[]},runtimeSessionId:'13',serverId:'server-2',startedAt:'2026-10-08T18:00:00Z'} as Match;
it('keeps the list compact and opens details and actions in a keyboard accessible dialog',async()=>{
 render(<MatchRecords items={[match]} queueId="7"/>);
 expect(screen.queryByText('SESSION_FAILED')).toBeNull();
 expect(screen.queryByRole('link',{name:'Журнал игры'})).toBeNull();
 const record=screen.getByRole('button',{name:'Открыть заезд №12'});
 record.focus();await userEvent.keyboard('{Enter}');
 const dialog=within(screen.getByRole('dialog',{name:/Заезд №12/}));
 expect(dialog.getByText(/Заезд прерван: SESSION_FAILED/)).toBeTruthy();
 expect(dialog.getByText('car_a')).toBeTruthy();
 expect(dialog.getByText('server-2')).toBeTruthy();
 expect(dialog.getByRole('link',{name:'Решения по заезду'}).getAttribute('href')).toBe('/officiating?matchmakingId=7&matchId=12&resultId=40');
 expect(dialog.getByRole('link',{name:'Сессия №13'}).getAttribute('href')).toBe('/runtime?sessionId=13');
 await userEvent.keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(document.activeElement).toBe(record);
});
it('does not offer result or session actions when they do not exist',async()=>{
 render(<MatchRecords items={[{...match,result:null,resultId:null,runtimeSessionId:null}]} queueId="7"/>);
 await userEvent.click(screen.getByRole('button',{name:'Открыть заезд №12'}));
 expect(screen.queryByRole('link',{name:'Решения по заезду'})).toBeNull();
 expect(screen.queryByRole('link',{name:/Сессия №/})).toBeNull();
 expect(screen.getByRole('link',{name:'Журнал игры'})).toBeTruthy();
});
