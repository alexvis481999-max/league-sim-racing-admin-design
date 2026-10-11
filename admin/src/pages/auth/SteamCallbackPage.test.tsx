// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SteamCallbackPage } from './SteamCallbackPage';
const { exchange } = vi.hoisted(() => ({exchange:vi.fn()}));
vi.mock('../../shared/api',()=>({exchangeSteamCode:exchange,getApiBaseUrl:()=> 'https://api.example.test'}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function mount(query:string) {
  return render(<StrictMode><MemoryRouter initialEntries={['/callback'+query]}><Routes>
    <Route path="/callback" element={<SteamCallbackPage/>}/><Route path="/login" element={<div>Password step</div>}/>
  </Routes></MemoryRouter></StrictMode>);
}
describe('Steam callback',()=>{
  it('shows profile error without exchanging a code',async()=>{
    mount('?error=steam_profile_unavailable&code=must-not-exchange');
    expect(await screen.findByText(/временно не отдаёт/)).toBeTruthy(); expect(exchange).not.toHaveBeenCalled();
    expect(screen.getByRole('link',{name:'Повторить вход'}).getAttribute('href')).toBe('https://api.example.test/admin/auth/steam');
  });
  it('does not open password screen on exchange failure',async()=>{
    exchange.mockRejectedValueOnce(new Error('failed')); mount('?code=one');
    expect(await screen.findByText(/Не удалось завершить/)).toBeTruthy(); expect(screen.queryByText('Password step')).toBeNull();
    expect(exchange).toHaveBeenCalledTimes(1);
  });
  it('exchanges once under StrictMode and opens password screen',async()=>{
    exchange.mockResolvedValueOnce({accessToken:'token'});mount('?code=one');
    await waitFor(()=>expect(screen.getByText('Password step')).toBeTruthy());expect(exchange).toHaveBeenCalledTimes(1);
  });
});
