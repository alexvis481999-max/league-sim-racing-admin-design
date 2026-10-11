// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {SkinsPage} from './SkinsPage';
import {apiFetch} from '../../shared/api';
vi.mock('../../shared/api',async()=>({...await vi.importActual('../../shared/api'),apiFetch:vi.fn()}));
vi.mock('../../shared/realtime',()=>({useRealtimeRefresh:()=>{}}));
it('requests one skin page, shows skeletons and advances using the cursor',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let resolve!:(v:unknown)=>void;
 vi.mocked(apiFetch).mockImplementation(async path=>path.startsWith('/skins/admin')?new Promise(r=>{resolve=r;}):[]);
 try{
 await act(async()=>root.render(<SkinsPage/>));expect(host.querySelector('.MuiSkeleton-root')).not.toBeNull();
 await act(async()=>resolve({items:[],nextAfterId:'42'}));
 expect(vi.mocked(apiFetch).mock.calls.filter(([path])=>path.startsWith('/skins/admin'))).toHaveLength(1);
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Далее')!.click());
 expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path.includes('afterId=42'))).toBe(true);
 expect(host.querySelector('.MuiSkeleton-root')).not.toBeNull();
 await act(async()=>resolve({items:[],nextAfterId:null}));
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
