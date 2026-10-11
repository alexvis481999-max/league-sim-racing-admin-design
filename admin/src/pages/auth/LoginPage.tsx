import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SecurityIcon from '@mui/icons-material/Security';
import { Alert, Avatar, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, getApiBaseUrl, getUserToken, loginAdmin } from '../../shared/api';
import { useAsyncState } from '../../shared/asyncState';
import { StatusAlert } from '../../shared/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userJwt, setUserJwtState] = useState(getUserToken() ?? '');
  const [adminPassword, setAdminPassword] = useState('');
  const [state, run] = useAsyncState<{ accessToken: string }>();
  const [steamUser, setSteamUser] = useState<{ steamId: string; steamName: string; steamAvatar: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (userJwt) void apiFetch<{ steamId: string; steamName: string; steamAvatar: string | null }>('/users/me', {}, 'user')
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
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
      <Paper variant="outlined" sx={{ width: 'min(620px, 100%)', p: 3, borderRadius: 2 }}>
        <Stack spacing={2}>
          {typeof location.state?.authError === 'string' && <Alert severity="warning">{location.state.authError}</Alert>}
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 850 }}>
              LSR League Sim Racing
            </Typography>
            <Typography color="text.secondary">Авторизация администратора через Steam.</Typography>
          </Box>
          <Box component="form" onSubmit={handleLogin}>
            <Stack spacing={1.5}>
              {userJwt ? (
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Avatar src={steamUser?.steamAvatar ?? undefined} alt={steamUser?.steamName ?? 'Steam'} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800 }}>{steamUser?.steamName ?? 'Steam профиль'}</Typography>
                      <Typography variant="caption" color="text.secondary">Steam ID: {steamUser?.steamId ?? 'unknown'}</Typography>
                    </Box>
                    <Button type="button" onClick={resetSteamUser}>Сменить</Button>
                  </Stack>
                </Paper>
              ) : (
                <Button type="button" variant="contained" startIcon={<SecurityIcon />} onClick={startSteamLogin}>
                  Войти через Steam
                </Button>
              )}
              {userJwt ? (
                <>
                  <TextField
                    label="Пароль админки"
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <Button type="submit" variant="contained" startIcon={<AdminPanelSettingsIcon />} disabled={state.loading}>
                    Войти в админку
                  </Button>
                </>
              ) : null}
            </Stack>
          </Box>
          <StatusAlert state={state} operation successMessage={false} />
        </Stack>
      </Paper>
    </Box>
  );
}
