import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, getApiBaseUrl, getUserToken, loginAdmin } from '../../shared/api';
import { useAsyncState } from '../../shared/asyncState';
import { StatusAlert } from '../../shared/ui';
import { Button, Notice, Skeleton, TextField } from '../../ui/v16';
import { AuthCard } from './AuthCard';

type SteamUser = { steamId: string; steamName: string; steamAvatar: string | null };

/** Two-step admin sign-in: Steam (user session) → admin password (admin session). */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userJwt, setUserJwtState] = useState(getUserToken() ?? '');
  const [adminPassword, setAdminPassword] = useState('');
  const [state, run] = useAsyncState<{ accessToken: string }>();
  const [steamUser, setSteamUser] = useState<SteamUser | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (userJwt) void apiFetch<SteamUser>('/users/me', {}, 'user')
      .then(user => { if (!cancelled) setSteamUser(user); })
      .catch(() => { if (!cancelled) { setSteamUser(null); setUserJwtState(''); } });
    return () => { cancelled = true; };
  }, [userJwt]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (!userJwt.trim()) throw new Error('Сначала войдите через Steam');
      const response = await loginAdmin(adminPassword);
      navigate('/');
      return response;
    });
  }

  function startSteamLogin() {
    window.location.href = `${getApiBaseUrl()}/admin/auth/steam`;
  }

  function resetSteamUser() {
    setSteamUser(null);
    setUserJwtState('');
    setAdminPassword('');
  }

  return (
    <AuthCard title="Вход в админку" description={userJwt ? 'Шаг 2 из 2 · подтвердите вход паролем админки.' : 'Шаг 1 из 2 · авторизация администратора через Steam.'}>
      {typeof location.state?.authError === 'string' && <Notice tone="warning">{location.state.authError}</Notice>}
      <form className="lsr-auth-form" onSubmit={handleLogin}>
        {userJwt ? (
          <div className="lsr-auth-steam">
            {steamUser?.steamAvatar ? <img src={steamUser.steamAvatar} alt={steamUser.steamName} width={40} height={40} /> : <span className="lsr-auth-avatar" aria-hidden="true">{steamUser?.steamName.slice(0, 1).toUpperCase() ?? 'S'}</span>}
            <div className="lsr-auth-steam-main">
              {steamUser ? <><b>{steamUser.steamName}</b><small>Steam ID: {steamUser.steamId}</small></> : <><Skeleton width={140} height={14} /><Skeleton width={180} height={11} style={{ marginTop: 6 }} /></>}
            </div>
            <Button size="sm" variant="plain" onClick={resetSteamUser}>Сменить</Button>
          </div>
        ) : (
          <Button variant="primary" className="lsr-auth-wide" onClick={startSteamLogin}>Войти через Steam</Button>
        )}
        {userJwt ? (
          <>
            <TextField label="Пароль админки" type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required autoComplete="current-password" />
            <Button type="submit" variant="primary" className="lsr-auth-wide" disabled={state.loading}>{state.loading ? 'Входим…' : 'Войти в админку'}</Button>
          </>
        ) : null}
      </form>
      <StatusAlert state={state} operation successMessage={false} />
    </AuthCard>
  );
}
