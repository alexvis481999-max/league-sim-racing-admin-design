import { describe, expect, it } from 'vitest';
import { disciplineOptions } from './MatchmakingPage';

describe('matchmaking disciplines', () => {
  it('does not expose the retired Drift discipline', () => {
    expect(disciplineOptions.map((option) => option.value)).toEqual(['touge']);
  });
});

import {changeCommonCars,newPools} from './PoolFields';
it('removing a common car cleans all track subpools without silently refilling them',()=>{
 const pools={...newPools(),carIds:['a','b'],tracks:[{key:'t',title:'T',code:'t',layoutCode:null,enabled:true,weight:1,durationMinutes:6,carIds:['a','b'],weatherKeys:['sun']}]};
 const next=changeCommonCars(pools,['b']);expect(next.tracks[0].carIds).toEqual(['b']);expect(pools.tracks[0].carIds).toEqual(['a','b']);expect(next.offerCount).toBe(2);
});
