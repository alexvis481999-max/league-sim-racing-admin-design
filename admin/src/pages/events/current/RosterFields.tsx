import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Button, Stack, TextField } from '@mui/material';
import { apiFetch } from '../../../shared/api';
type User = { userId: string; presentation: { displayName: string } };
type Car = { code: string; title: string };
export function RosterFields({
  userId,
  carId,
  skinId,
  setUser,
  setCar,
  setSkin,
  disabled,
}: {
  userId: string;
  carId: string;
  skinId: string;
  setUser(v: string): void;
  setCar(v: string): void;
  setSkin(v: string): void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState(''),
    [users, setUsers] = useState<User[]>([]),
    [cars, setCars] = useState<Car[]>([]),
    [error, setError] = useState(''),
    [searching, setSearching] = useState(false);
  useEffect(() => {
    let active = true;
    void apiFetch<Car[]>('/games/assetto_corsa/cars', {}, 'none')
      .then((items) => {
        if (active) setCars(items);
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить машины');
      });
    return () => {
      active = false;
    };
  }, []);
  async function search() {
    setSearching(true);
    setError('');
    try {
      const page = await apiFetch<{ items: User[] }>(
        `/admin/users?q=${encodeURIComponent(query)}&page=1&pageSize=20`,
      );
      setUsers(page.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Поиск недоступен');
    } finally {
      setSearching(false);
    }
  }
  return (
    <Stack spacing={2}>
      {error && <><Alert severity="warning">{error}</Alert><TextField label="Идентификатор пилота, если поиск недоступен" value={userId} disabled={disabled} onChange={e => setUser(e.target.value)} /></>}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <TextField
          label="Поиск пилота по имени"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button disabled={disabled || searching || !query.trim()} onClick={() => void search()}>
          Найти пилота
        </Button>
      </Stack>
      <Autocomplete
        disabled={disabled}
        options={users}
        getOptionLabel={(item) => item.presentation.displayName}
        value={users.find((item) => item.userId === userId) ?? null}
        onChange={(_, item) => setUser(item?.userId ?? '')}
        renderInput={(p) => <TextField {...p} label="Пилот" />}
      />
      <Autocomplete
        disabled={disabled}
        options={cars}
        getOptionLabel={(item) => item.title}
        value={cars.find((item) => item.code === carId) ?? null}
        onChange={(_, item) => setCar(item?.code ?? '')}
        renderInput={(p) => (
          <TextField
            {...p}
            label="Машина"
            helperText="Допустимость выбора для этой регистрации проверит сервер"
          />
        )}
      />
      <TextField
        disabled={disabled}
        label="ID скина (необязательно)"
        value={skinId}
        onChange={(e) => setSkin(e.target.value)}
      />
    </Stack>
  );
}
