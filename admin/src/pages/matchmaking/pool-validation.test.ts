import { expect, it } from 'vitest';
import { newPools, changeCommonCars } from './PoolFields';
import { poolErrors } from './pool-validation';
function valid() {
  const p = newPools(); p.carIds = ['a','b','c','d'];
  p.weather = [{ key:'clear',title:'Ясно',enabled:true,weight:10,codes:['clear'],weather:{mode:'FIXED',presetCode:'clear',ambientTemperature:20,roadTemperature:25,ambientVariation:0,roadVariation:0} }];
  p.tracks = [{key:'hill',title:'Гора',code:'hill',layoutCode:null,enabled:true,weight:10,durationMinutes:6,carIds:[...p.carIds],weatherKeys:['clear']}]; return p;
}
it('проверяет размеры предложения, включая все машины и выключенные трассы', () => {
  for (const count of [2,3,4,'all'] as const) { const p = valid(); p.offerCount=count; expect(poolErrors(p)).toEqual([]); }
  const p=valid(); p.tracks[0].carIds=['a']; expect(poolErrors(p).join()).toContain('недостаточно'); p.offerCount='all'; expect(poolErrors(p)).toEqual([]);
  p.tracks[0].enabled=false; p.offerCount=4; expect(poolErrors(p).join()).toContain('недостаточно');
});
it('удаление общей машины требует исправить подпул, длительность и доступную погоду', () => {
  const p=changeCommonCars(valid(),['a']); p.tracks[0].durationMinutes=0; p.tracks[0].weight=0; p.weather[0].enabled=false;
  const errors=poolErrors(p).join(); for(const word of ['недостаточно','длительность','вес','погоду'])expect(errors).toContain(word);
});
