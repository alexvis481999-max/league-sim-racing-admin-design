import {describe,it,expect} from 'vitest';
import {practiceServerStatus} from './PracticeServersPage';
describe('наблюдение самостоятельного сервера',()=>{
 it('STOPPED не скрывает незавершённую остановку процесса',()=>{expect(practiceServerStatus({status:'STOPPED',currentCycle:{executionId:'1',runtimeSessionId:'2',state:'CANCELLED',resourceState:'STOPPING',failure:null}}).label).toBe('Останавливается');});
 it('не считает неизвестный ресурс свободным',()=>{expect(practiceServerStatus({status:'ACTIVE',currentCycle:{executionId:'1',runtimeSessionId:'2',state:'RUNNING',resourceState:'UNKNOWN',failure:null}}).label).toBe('Связь уточняется');});
 it('пауза может дорабатывать текущую сессию',()=>{expect(practiceServerStatus({status:'PAUSED',currentCycle:{executionId:'1',runtimeSessionId:'2',state:'RUNNING',resourceState:'RUNNING',failure:null}}).label).toBe('Сервер работает');});
});
