import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeSteamCode, getApiBaseUrl } from '../../shared/api';
import { LoadingBlock, Notice } from '../../ui/v16';
import { AuthCard } from './AuthCard';

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
    <AuthCard title="Вход через Steam" description={error ? undefined : 'Шаг 1 из 2 · подтверждаем авторизацию.'}>
      {error ? (
        <>
          <Notice tone="danger">{error}</Notice>
          <a className="lsr-btn is-primary lsr-auth-wide" href={`${getApiBaseUrl()}/admin/auth/steam`}>Повторить вход</a>
        </>
      ) : (
        <div className="lsr-auth-wait"><p>Завершаем вход через Steam...</p><LoadingBlock rows={2} label="Завершаем вход через Steam" /></div>
      )}
    </AuthCard>
  );
}
