import { Alert, Link, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api';
type Details = { versions?: { id: string; checksumSha256: string | null; createdAt: string }[]; usages?: { ownerType: string; ownerId: string; versionId: string }[] };
export function CatalogDependencies({ id, revision }: { id: string; revision?: number }) {
  const [details, setDetails] = useState<Details>({}), [error, setError] = useState('');
  useEffect(() => { let alive = true; setError(''); void apiFetch<Details>(`/admin/catalog/items/${id}`).then(value => { if (alive) setDetails(value); }).catch(() => { if (alive) setError('Не удалось загрузить версии и использование'); }); return () => { alive = false; }; }, [id, revision]);
  return <Stack spacing={1}><Typography variant="subtitle2">Версии и использование</Typography>
    {error ? <Alert severity="warning">{error}</Alert> : <>
      {details.versions?.map(version => <Typography key={version.id} variant="body2">Версия {version.id} · {new Date(version.createdAt).toLocaleString()} · {version.checksumSha256?.slice(0, 12) ?? 'Официальный контент'}</Typography>)}
      {details.usages?.length ? details.usages.map((usage, i) => <Typography key={i} variant="body2">{usage.ownerType === 'EVENT' ? <Link href={`/events/${usage.ownerId}`}>Событие #{usage.ownerId}</Link> : `Версия набора #${usage.ownerId}`} · версия {usage.versionId}</Typography>) : <Typography variant="body2" color="text.secondary">Доступных вам зависимостей нет.</Typography>}
    </>}
  </Stack>;
}
