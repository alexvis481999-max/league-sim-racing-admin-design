import {useRealtimeRefresh} from '../shared/realtime';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError, apiFetch, getAdminToken, subscribeAdminAuthChanged } from '../shared/api';
import type { AsyncState } from '../shared/asyncState';
import type { AdminAccess } from '../shared/types';
import { AdminLayout } from './AdminLayout';

export function RequireAdmin() {
  const [state, setState] = useState<AsyncState<AdminAccess>>({ loading: true, error: null, data: null, done: false });
  const [authVersion, setAuthVersion] = useState(0);

  useRealtimeRefresh(['security'],()=>setAuthVersion(v=>v+1));
  useEffect(() => subscribeAdminAuthChanged(() => setAuthVersion((current) => current + 1)), []);

  useEffect(() => {
    if (!getAdminToken()) {
      setState({ loading: false, error: null, data: null, done: false });
      return;
    }

    let cancelled = false;

    apiFetch<AdminAccess>('/admin/me/access')
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: null, data, done: true });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: error instanceof ApiError && error.status === 401
            ? 'Срок действия авторизации истёк. Войдите в админку ещё раз.'
            : 'Не удалось проверить доступ к админке. Проверьте соединение и попробуйте снова.',
          data: null,
          done: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [authVersion]);

  if (state.loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Проверяем доступ...</Typography>
        </Stack>
      </Box>
    );
  }

  if (state.error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Stack spacing={2} sx={{ width: '100%', maxWidth: 480 }}>
          <Alert severity="warning">
            {state.error}
          </Alert>
          <Button variant="contained" href="/login">
            Войти снова
          </Button>
        </Stack>
      </Box>
    );
  }

  if (!state.data?.panelAccess) return <Navigate to="/login" replace />;

  return <AdminLayout access={state.data} />;
}
