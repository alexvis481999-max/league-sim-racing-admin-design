import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import { fieldLabels } from './user-format';
import { Button, FormGroup, LoadingBlock, Notice, SelectField, TextField } from '../../ui/v16';

export type User = { userId: string; steamId: string; firstName: string | null; lastName: string | null; shortName: string | null; country: string; discord: string | null; youtube: string | null; avatar: string | null; complete: boolean; missingFields: string[]; version: string; presentation: { displayName: string; avatarUrl: string }; actions: { edit: boolean; uploadAvatar: boolean; deleteAvatar: boolean } };
const fields = ['firstName', 'lastName', 'shortName', 'country', 'discord', 'youtube'] as const;
const maxLength = (key: string) => key === 'shortName' ? 3 : key === 'youtube' ? 200 : key === 'discord' ? 160 : 80;
const formOf = (user: User) => Object.fromEntries(fields.map(key => [key, user[key] === 'unknown' ? '' : user[key] ?? ''])) as Record<typeof fields[number], string>;

/** Profile editor: PATCH sends only changed fields with `If-Match` of the displayed version; avatar upload/delete use the same version. */
export function UserEditor({ id, back, onDirty }: { id: string; back(): void; onDirty?(dirty: boolean): void }) {
  const [user, setUser] = useState<User | null>(null), [form, setForm] = useState<ReturnType<typeof formOf> | null>(null), [countries, setCountries] = useState<{ code: string; name: string }[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  useEffect(() => { onDirty?.(Boolean(user && form && fields.some(key => form[key] !== formOf(user)[key]))); }, [user, form, onDirty]);
  const live = useRef(false), lock = useRef(false);
  const [remoteChanged, setRemoteChanged] = useState(false);
  useRealtimeRefresh(['profiles'], async () => {
    if (lock.current || !user) return;
    try {
      const fresh = await apiFetch<User>(`/admin/users/${id}`);
      if (live.current && !lock.current) setRemoteChanged(fresh.version !== user.version);
    } catch (e) { if (live.current) setError(e instanceof Error ? e.message : String(e)); }
  });
  async function load() { setError(''); try { const [value, options] = await Promise.all([apiFetch<User>(`/admin/users/${id}`), apiFetch<typeof countries>('/site/countries', {}, 'none')]); if (live.current) { setUser(value); setForm(formOf(value)); setRemoteChanged(false); setCountries(options); setSaved(false); } } catch (error) { if (live.current) setError(error instanceof Error ? error.message : 'Не удалось загрузить профиль.'); } }
  useEffect(() => { live.current = true; void load(); return () => { live.current = false; }; }, [id]);
  async function mutate(init: RequestInit, avatar = false) {
    if (!user || lock.current || !live.current) return;
    lock.current = true; setBusy(true); setError(''); setSaved(false);
    try { const value = await apiFetch<User>(`/admin/users/${id}${avatar ? '/avatar' : ''}`, { ...init, headers: { 'If-Match': user.version } }); if (live.current) { setUser(value); setRemoteChanged(false); if (!avatar) setForm(formOf(value)); setSaved(true); } }
    catch (error) { if (live.current) setError(error instanceof Error ? error.message : 'Не удалось сохранить профиль.'); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  }
  function save() { if (!user || !form) return; const before = formOf(user), patch = Object.fromEntries(fields.filter(key => form[key] !== before[key]).map(key => [key, form[key]])); if (Object.keys(patch).length) void mutate({ method: 'PATCH', body: JSON.stringify(patch) }); }
  const changed = !!user && !!form && fields.some(key => form[key] !== formOf(user)[key]);
  const locked = busy || remoteChanged || !user?.actions.edit;
  return (
    <div className="lsr-root lsr-users-editor">
      <div className="lsr-users-editor-head">
        <div style={{ minWidth: 0 }}>
          <div className="lsr-eyebrow">Редактирование профиля</div>
          <h2>{user?.presentation.displayName ?? 'Профиль пилота'}</h2>
          {user && <div className="lsr-muted">ID {user.userId} · SteamID {user.steamId}</div>}
        </div>
        <Button variant="plain" onClick={back} disabled={busy}>Закрыть</Button>
      </div>
      <div className="lsr-users-editor-body">
        {remoteChanged && <Notice tone="warning" actions={<Button size="sm" disabled={busy} onClick={() => void load()}>Заменить форму актуальным профилем</Button>}>Профиль изменён. Ваши правки сохранены в форме.</Notice>}
        {error && <Notice tone="danger" actions={<Button size="sm" onClick={() => void load()} disabled={busy}>Загрузить актуальный профиль</Button>}>{error}</Notice>}
        {saved && <Notice role="status">Сохранено.</Notice>}
        {user && form ? <>
          <Notice tone={user.complete ? 'neutral' : 'warning'}>{user.complete ? 'Профиль заполнен.' : `Не заполнено: ${user.missingFields.map(key => fieldLabels[key] ?? key).join(', ')}`}</Notice>
          <form onSubmit={event => { event.preventDefault(); save(); }}>
            <FormGroup title="Данные пилота" description={user.actions.edit ? 'Сохраняются только изменённые поля.' : 'Ваш доступ не позволяет изменять профиль.'}>
              <fieldset disabled={locked} className="lsr-users-fieldset">
                <div className="lsr-fields">
                  {fields.map(key => key === 'country'
                    ? <SelectField key={key} label="Страна" value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} options={[{ value: '', label: 'Выберите страну' }, ...countries.map(country => ({ value: country.code, label: country.name }))]} />
                    : <TextField key={key} label={fieldLabels[key]} value={form[key]} maxLength={maxLength(key)} onChange={event => setForm({ ...form, [key]: event.target.value })} />)}
                </div>
                <div className="lsr-form-actions">
                  <Button onClick={back} disabled={busy}>Закрыть</Button>
                  <Button type="submit" variant="primary" disabled={!changed}>Сохранить профиль</Button>
                </div>
              </fieldset>
            </FormGroup>
          </form>
          <FormGroup title="Аватар" description="JPEG или PNG, до 5 МБ. Замена и удаление используют текущую версию профиля.">
            <div className="lsr-users-avatar-row">
              <Avatar url={user.presentation.avatarUrl} name={user.presentation.displayName} size={96} />
              <div className="lsr-hstack">
                <label className={`lsr-btn${busy || !user.actions.uploadAvatar ? ' is-disabled' : ''}`}>
                  Загрузить аватар
                  <input aria-label="Аватар" type="file" accept="image/png,image/jpeg" className="lsr-users-file" disabled={busy || !user.actions.uploadAvatar} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 5 * 1024 * 1024) { setError('Максимальный размер — 5 МБ.'); return; } const body = new FormData(); body.append('file', file); void mutate({ method: 'POST', body }, true); }} />
                </label>
                {user.actions.deleteAvatar && <Button variant="danger" disabled={busy} onClick={() => void mutate({ method: 'DELETE' }, true)}>Удалить аватар</Button>}
              </div>
            </div>
          </FormGroup>
        </> : !error && <LoadingBlock label="Загружаем профиль…" />}
      </div>
    </div>
  );
}

/** Round avatar; initials when the API returns no image URL. */
export function Avatar({ url, name, size = 40 }: { url: string | null | undefined; name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';
  return url
    ? <img className="lsr-users-avatar" src={url} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="lsr-users-avatar is-empty" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>{initials}</span>;
}
