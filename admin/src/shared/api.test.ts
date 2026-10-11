import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, clearTokens, getAdminToken, getUserToken, setUserToken, logoutSessions, parseApiErrorMessage, setAdminToken, subscribeAdminAuthChanged } from './api';

it('reuses reference reads but invalidates them when the administrator changes',async()=>{
 clearTokens();
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}}));
 vi.stubGlobal('fetch',fetcher);
 try{
 await apiFetch('/admin/catalog/car-brands',{},'none');await apiFetch('/admin/catalog/car-brands',{},'none');
 expect(fetcher).toHaveBeenCalledTimes(1);
 setAdminToken('test-admin');
 fetcher.mockResolvedValueOnce(new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}}));
 await apiFetch('/admin/catalog/car-brands',{},'none');expect(fetcher).toHaveBeenCalledTimes(2);
 }finally{clearTokens();vi.unstubAllGlobals();}
});

describe('parseApiErrorMessage', () => {
  it('explains a championship race outside its round period', () => {
    expect(parseApiErrorMessage(JSON.stringify({
      error: {
        code: 'scenario_config_invalid',
        message: 'Scenario config is invalid',
        kind: 'validation',
        details: {
          field: 'championshipRounds.1.startsAt',
          reason: 'outside_round_period',
          periodStartDate: '2026-08-05',
          periodEndDate: '2026-08-11',
        },
      },
    }))).toBe(
      'Некорректная конфигурация: дата и время гонки этапа 2 — должна находиться в периоде этапа 05.08.2026–11.08.2026.',
    );
  });

  it('explains insufficient split capacity', () => {
    expect(parseApiErrorMessage(JSON.stringify({
      error: {
        code: 'scenario_config_invalid',
        message: 'Scenario config is invalid',
        details: {
          field: 'maxParticipants',
          reason: 'capacity_exceeded',
          maxParticipants: 64,
          maxPlayersPerSession: 20,
          maxSessions: 3,
        },
      },
    }))).toBe(
      'Некорректная конфигурация: максимальное количество участников — 64 участников не помещаются в 3 сплит(а) по 20 человек.',
    );
  });

  it('keeps a useful fallback when backend did not provide validation details', () => {
    expect(parseApiErrorMessage(JSON.stringify({
      error: {
        code: 'scenario_config_invalid',
        message: 'Scenario config is invalid',
        details: {},
      },
    }))).toBe(
      'Некорректная конфигурация сценария. Проверьте обязательные поля и расписание.',
    );
  });
});


afterEach(() => {
  clearTokens();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('admin auth session', () => {
  it('logout sends only admin logout and preserves site token', async () => {
    setAdminToken('admin-token'); setUserToken('site-token');
    const fetchMock = vi.fn(async (_url: string) => Response.json({ok:true})); vi.stubGlobal('fetch',fetchMock);
    await logoutSessions();
    expect(getAdminToken()).toBeNull(); expect(getUserToken()).toBe('site-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/admin/auth/logout');
  });
  it('a delayed refresh does not restore admin login after logout', async () => {
    setAdminToken('admin-token'); setUserToken('site-token');
    let reply!: (response: Response) => void;
    const fetchMock = vi.fn((url: string) => url.endsWith('/admin/auth/refresh')
      ? new Promise<Response>(resolve => { reply=resolve; }) : Promise.resolve(Response.json({ok:true}, {status:url.endsWith('/protected')?401:200})));
    vi.stubGlobal('fetch',fetchMock);
    const request = apiFetch('/protected').catch(() => undefined);
    await vi.waitFor(() => expect(reply).toBeTypeOf('function'));
    await logoutSessions(); reply(Response.json({accessToken:'late-token'})); await request;
    expect(getAdminToken()).toBeNull(); expect(getUserToken()).toBe('site-token');
  });
  it('notifies the application when refresh fails after an authorized request returns 401', async () => {
    setAdminToken('active-token');
    const onAuthChanged = vi.fn();
    const unsubscribe = subscribeAdminAuthChanged(onAuthChanged);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"message":"expired"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/admin/protected')).rejects.toMatchObject({ status: 401 });

    expect(getAdminToken()).toBeNull();
    expect(onAuthChanged).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('refreshes an idle session before token expiry and notifies the UI when refresh is rejected', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'));
    const fetchMock = vi.fn(async () => new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    setAdminToken(jwtWithExpiry(Math.floor(Date.now() / 1000) + 60));
    const onAuthChanged = vi.fn();
    const unsubscribe = subscribeAdminAuthChanged(onAuthChanged);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/admin/auth/refresh'), expect.any(Object));
    expect(getAdminToken()).toBeNull();
    expect(onAuthChanged).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

function jwtWithExpiry(exp: number) {
  const payload = btoa(JSON.stringify({ exp })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `header.${payload}.signature`;
}
