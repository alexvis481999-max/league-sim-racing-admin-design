import { useState } from 'react';
import { getApiBaseUrl } from '../../../../shared/api';
import {
  ActionButton, AsyncView, Button, Dialog, EmptyState, LoadMore, Panel, PillButtons, StatusBadge, Table, TextArea, TextLink, Timeline,
  clickableRow, recordTone, shortDateTime, type Tone,
} from '../../../../ui/v16';
import { useWorkspaceData } from '../data';
import { workspacePath, type PageData } from '../data';
import { RosterFields } from '../../current/RosterFields';
import type { Action } from '../../current/event-api';
import type { DisplayStatus } from '../../../../../../shared/event-status';
import { useWorkspace, useWorkspaceNav } from '../context';

type Item = { title: string | null; imageUrl: string | null };
export type Entry = {
  id: string; registrationKey: string; participantId: string; status: string; createdAt: string;
  decidedAt: string | null; withdrawnAt: string | null; removedAt: string | null;
  identity: { displayName: string } | null; car: Item | null; skin: Item | null; selection: unknown;
  reviews: { decidedAt: string; decision: string; reason?: string }[]; actions: Action[];
};
type Registration = { id: string; key: string; config?: { mode?: string; capacity?: number | null; opensAt?: string | null; closesAt?: string; withdrawalClosesAt?: string }; displayStatus: DisplayStatus; actions: Action[] };
type ParticipantsPage = PageData<Entry> & { registrations: Registration[] };
type Attendance = PageData<{ id: string; participantId: string; identity: { displayName: string } | null; stages: { key: string; title: string }[] }>;

export const entryLabels: Record<string, string> = { PENDING: 'На рассмотрении', ACCEPTED: 'Допущен', REJECTED: 'Отказано', WITHDRAWN: 'Снялся', REMOVED: 'Снят администратором', EXPIRED: 'Истекла' };
const entryTones: Record<string, Tone> = { PENDING: 'current', ACCEPTED: 'done', REJECTED: 'failed', WITHDRAWN: 'scheduled', REMOVED: 'scheduled', EXPIRED: 'scheduled' };
const modeLabels: Record<string, string> = { open_until_capacity: 'Открытая до заполнения', manual_review: 'С рассмотрением', locked_roster: 'Фиксированный состав' };
const name = (e: Entry) => e.identity?.displayName ?? `Пилот ${e.participantId}`;

/** Applications (registration entries) and actual attendance are different sources and are never mixed. */
export function ParticipantsTab({ active }: { active: boolean }) {
  const { summary } = useWorkspace();
  const nav = useWorkspaceNav();
  const hasRegistration = summary.activity.hasRegistration;
  const [selectedTab, setTab] = useState<'applications' | 'attendance'>(hasRegistration ? 'applications' : 'attendance');
  const tab = hasRegistration ? selectedTab : 'attendance';
  const participant = nav.params.get('participantId');
  return (
    <div className="lsr-stack">
      <div className="lsr-between">
        <PillButtons label="Участники события" value={tab} onChange={setTab} size="lg"
          options={[...(hasRegistration ? [{ value: 'applications' as const, label: 'Заявки' }] : []), { value: 'attendance' as const, label: 'Фактическое участие' }]} />
        {participant && <Button size="sm" onClick={() => nav.setParam('participantId', null)}>Все участники</Button>}
      </div>
      <div hidden={tab !== 'applications'}>{hasRegistration && <Applications active={active && tab === 'applications'} participant={participant} />}</div>
      <div hidden={tab !== 'attendance'}><AttendanceTable active={active && tab === 'attendance'} participant={participant} /></div>
    </div>
  );
}

function Applications({ active, participant }: { active: boolean; participant: string | null }) {
  const { eventId, summary, execute, blocked, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const r = useWorkspaceData<ParticipantsPage>(workspacePath(eventId, 'participants') + (participant ? `?participantId=${encodeURIComponent(participant)}` : ''), active);
  const selected = nav.params.get('entryId');
  const entry = r.data?.items.find((e) => e.id === selected);
  const [adding, setAdding] = useState(false);
  const [userId, setUser] = useState(''), [carId, setCar] = useState(''), [skinId, setSkin] = useState('');
  const canAdd = r.data?.registrations.some((reg) => reg.actions.some((a) => a.code === 'add' && a.enabled));
  return (
    <div className="lsr-stack">
      <AsyncView resource={r}>
        {(data) => (
          <>
            {!!data.registrations.length && (
              <Panel title="Окна регистрации" actions={canAdd ? <Button size="sm" variant="primary" onClick={() => setAdding(true)}>＋ Добавить пилота</Button> : undefined} body={false}>
                <div className="lsr-rows">
                  {data.registrations.map((reg) => (
                    <div className="lsr-row-item" key={reg.id}>
                      <div><b>{modeLabels[reg.config?.mode ?? ''] ?? reg.config?.mode ?? 'Регистрация'}{reg.config?.capacity != null ? ` · мест ${reg.config.capacity}` : ''}</b>
                        <small>Приём {shortDateTime(reg.config?.opensAt, timezone)} — {shortDateTime(reg.config?.closesAt, timezone)}{reg.config?.withdrawalClosesAt ? ` · снятие до ${shortDateTime(reg.config.withdrawalClosesAt, timezone)}` : ''} · ключ {reg.key}</small></div>
                      <StatusBadge status={reg.displayStatus} small />
                    </div>
                  ))}
                </div>
              </Panel>
            )}
            <Panel title="Заявки" sub={`Допущено ${summary.activity.applications.accepted} · ожидают решения ${summary.activity.applications.pending}`} body={false}>
              {!data.items.length ? <EmptyState compact>{participant ? 'У пилота нет заявок в этом событии.' : 'Заявок нет.'}</EmptyState> : (
                <Table label="Заявки">
                  <thead><tr><th>Пилот</th><th>Статус заявки</th><th>Машина / скин</th><th className="lsr-hide-sm">Подана</th><th aria-hidden="true" /></tr></thead>
                  <tbody>
                    {data.items.map((e) => (
                      <tr key={e.id} {...clickableRow(() => nav.setParam('entryId', e.id))}>
                        <td><button type="button" className="lsr-link" style={{ color: 'var(--lsr-ink)' }} onClick={() => nav.setParam('entryId', e.id)}>{name(e)}</button></td>
                        <td><StatusBadge status={{ code: e.status, label: entryLabels[e.status] ?? e.status }} tone={recordTone(e.status, entryTones)} small /></td>
                        <td>{e.car?.title ?? 'Не выбрана'}{e.skin && <div className="lsr-minor">{e.skin.title ?? 'Название скина не сохранено'}</div>}</td>
                        <td className="lsr-hide-sm lsr-num">{shortDateTime(e.createdAt, timezone)}</td>
                        <td><TextLink onClick={() => nav.setParam('entryId', e.id)}>Открыть →</TextLink></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <LoadMore hasMore={!!data.nextAfterId} busy={r.busy} onClick={() => void r.load(data.nextAfterId!)} />
            </Panel>
          </>
        )}
      </AsyncView>
      {entry && <EntryDialog key={entry.id} entry={entry} refresh={() => r.load()} close={() => nav.setParam('entryId', null)} />}
      <Dialog open={adding} onClose={() => !blocked && setAdding(false)} title="Добавить пилота в состав" description="Доступно для окон регистрации с фиксированным составом, пока регистрация открыта."
        actions={<>
          <Button disabled={blocked} onClick={() => setAdding(false)}>Назад</Button>
          {r.data?.registrations.map((reg) => (
            <ActionButton key={reg.id} variant="primary" action={reg.actions.find((a) => a.code === 'add')} disabled={blocked || !userId}
              onClick={() => void execute(`/registrations/${reg.key}/roster`, { expectedVersion: summary.version, userId, ...(carId ? { carId } : {}), ...(skinId ? { skinId } : {}) }).then((ok) => { if (ok) { setAdding(false); void r.load(); } })}>
              Добавить · {reg.displayStatus.label}
            </ActionButton>
          ))}
        </>}>
        {adding && <RosterFields userId={userId} carId={carId} skinId={skinId} setUser={setUser} setCar={setCar} setSkin={setSkin} disabled={blocked} />}
      </Dialog>
    </div>
  );
}

function Picture({ item, label }: { item: Item | null; label: string }) {
  if (!item) return null;
  return <div className="lsr-hstack" style={{ gap: 10 }}>{item.imageUrl && <img src={new URL(item.imageUrl, getApiBaseUrl()).href} alt="" loading="lazy" style={{ width: 72, height: 44, objectFit: 'contain' }} />}<span><span className="lsr-muted">{label}: </span>{item.title ?? 'Название не сохранено'}</span></div>;
}

/** Review, rejection and removal keep the typed reason and the command key until the server answers. */
function EntryDialog({ entry: e, refresh, close }: { entry: Entry; refresh: () => Promise<void>; close: () => void }) {
  const { eventId, summary, execute, blocked, timezone } = useWorkspace();
  const nav = useWorkspaceNav();
  const [operation, setOperation] = useState<'REJECTED' | 'remove' | null>(null);
  const [reason, setReason] = useState('');
  const act = (decision: 'ACCEPTED' | 'REJECTED' | 'remove') =>
    execute(`/registrations/${e.registrationKey}/entries/${e.id}/${decision === 'remove' ? 'remove' : 'review'}`, {
      expectedVersion: summary.version, ...(decision === 'remove' ? {} : { decision }), ...(decision === 'ACCEPTED' ? {} : { reason }),
    }).then((ok) => { if (ok) { setOperation(null); setReason(''); void refresh(); } });
  const review = e.actions.find((a) => a.code === 'review'), remove = e.actions.find((a) => a.code === 'remove');
  return (
    <Dialog open onClose={() => !blocked && close()} title={name(e)} description={`${entryLabels[e.status] ?? e.status} · заявка №${e.id} · окно ${e.registrationKey}`}
      actions={<>
        <Button disabled={blocked} onClick={close}>Закрыть</Button>
        {operation ? (
          <>
            <Button disabled={blocked} onClick={() => setOperation(null)}>Назад</Button>
            <ActionButton variant="danger-solid" action={operation === 'remove' ? remove : review} disabled={blocked || !reason.trim()} onClick={() => void act(operation)}>{operation === 'remove' ? 'Снять пилота' : 'Отклонить заявку'}</ActionButton>
          </>
        ) : (
          <>
            {e.status === 'PENDING' && <><ActionButton action={review} disabled={blocked} onClick={() => setOperation('REJECTED')}>Отклонить</ActionButton><ActionButton variant="primary" action={review} disabled={blocked} onClick={() => void act('ACCEPTED')}>Принять</ActionButton></>}
            {e.status === 'ACCEPTED' && <ActionButton action={remove} disabled={blocked} onClick={() => setOperation('remove')}>Снять</ActionButton>}
          </>
        )}
      </>}>
      <div className="lsr-muted">Подана {shortDateTime(e.createdAt, timezone)}</div>
      <Picture item={e.car} label="Машина" />
      <Picture item={e.skin} label="Скин" />
      <div className="lsr-hstack" style={{ gap: 16 }}>
        <TextLink to={`/users?userId=${e.participantId}&eventId=${eventId}`}>Профиль ↗</TextLink>
        <TextLink onClick={() => { close(); nav.section('servers', { view: 'presence', participantId: e.participantId }); }}>Подключения</TextLink>
        <TextLink onClick={() => { close(); nav.section('results', { participantId: e.participantId }); }}>Результаты и рейтинг</TextLink>
      </div>
      <div>
        <div className="lsr-eyebrow" style={{ marginBottom: 6 }}>История заявки</div>
        {e.reviews.length || e.withdrawnAt || e.removedAt ? (
          <Timeline items={[
            ...e.reviews.map((r) => ({ title: entryLabels[r.decision] ?? r.decision, detail: r.reason, at: shortDateTime(r.decidedAt, timezone) })),
            ...(e.withdrawnAt ? [{ title: 'Снялся', at: shortDateTime(e.withdrawnAt, timezone) }] : []),
            ...(e.removedAt ? [{ title: 'Снят администратором', at: shortDateTime(e.removedAt, timezone) }] : []),
          ]} />
        ) : <div className="lsr-mutedline">Решений администратора нет.</div>}
      </div>
      {operation && <TextArea autoFocus label={operation === 'remove' ? 'Причина снятия' : 'Причина отказа'} rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} />}
    </Dialog>
  );
}

function AttendanceTable({ active, participant }: { active: boolean; participant: string | null }) {
  const { eventId } = useWorkspace();
  const nav = useWorkspaceNav();
  const r = useWorkspaceData<Attendance>(workspacePath(eventId, 'attendance') + (participant ? `?participantId=${encodeURIComponent(participant)}` : ''), active);
  return (
    <Panel title="Фактическое участие" sub="Участие, зафиксированное этапами события. Подключения к серверу — в разделе «Серверы и подключения»." body={false}>
      <AsyncView resource={r} isEmpty={(d) => !d.items.length} empty={<EmptyState compact>Фактическое участие пока не зафиксировано.</EmptyState>}>
        {(data) => (
          <>
            <Table label="Фактическое участие">
              <thead><tr><th>Пилот</th><th>Этапы и гонки</th><th aria-hidden="true" /></tr></thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id}>
                    <td className="lsr-primary"><TextLink to={`/users?userId=${e.participantId}&eventId=${eventId}`}>{e.identity?.displayName ?? `Пилот ${e.participantId}`}</TextLink></td>
                    <td><div className="lsr-chiplist">{e.stages.map((s) => <button key={s.key} type="button" className="lsr-pillbtn" onClick={() => nav.race(s.key)}>{s.title}</button>)}</div></td>
                    <td><TextLink size="sm" onClick={() => nav.section('servers', { view: 'presence', participantId: e.participantId })}>Подключения</TextLink></td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <LoadMore hasMore={!!data.nextAfterId} busy={r.busy} onClick={() => void r.load(data.nextAfterId!)} />
          </>
        )}
      </AsyncView>
    </Panel>
  );
}
