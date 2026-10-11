import { Box, Button, Paper, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeSteamCode, getApiBaseUrl } from '../../shared/api';

export function SteamCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get('code');
    window.history.replaceState({}, '', window.location.pathname);
    if (params.has('error')) {
      setError(params.get('error') === 'steam_profile_unavailable' ? 'Steam временно не отдаёт данные профиля. Повторите вход позже.' : 'Не удалось подтвердить вход через Steam. Попробуйте снова.');
      return;
    }
    if (!code) {
      setError('Steam не вернул код входа. Попробуйте снова.');
      return;
    }
    void exchangeSteamCode(code).then(() => navigate('/login', { replace: true }))
      .catch(() => setError('Не удалось завершить вход через Steam. Попробуйте снова.'));
  }, [navigate, params]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 750 }}>{error ?? 'Завершаем вход через Steam...'}</Typography>
        {error && <Button href={`${getApiBaseUrl()}/admin/auth/steam`}>Повторить вход</Button>}
      </Paper>
    </Box>
  );
}
