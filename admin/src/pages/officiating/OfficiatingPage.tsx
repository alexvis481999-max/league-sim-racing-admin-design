import { ListRecord, BackAction, RefreshAction, ListToolbar, FilterButtons, MoreFilters } from '../../shared/ui';
import {useRealtimeRefresh} from '../../shared/realtime';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { ApiError, apiDownload, apiFetch, subscribeAdminAuthChanged } from '../../shared/api';
import { Page, Section } from '../../shared/ui';

type Report = { replayUploadId?: string; id: string; status: string; reason: string; submittedById: string; accusedId: string | null; incidentLocation: string; videoUrl: string | null; context: { eventId?: string; source: { id: string }; participantIds: string[] }; comments?: { id: string; authorId: string; body: string; createdAt: string }[] };
type Decision = { id: string; status: string; version: string; reason: string; source: { id: string }; effect: { type: string; participantId?: string; target?: { type: string; splitIndex?: number; occurrence?: number }; milliseconds?: number; participantIds?: string[]; winnerId?: string | null }; supersedesDecisionId: string | null };
type Rules = { rulesVersion: string; resultId: string; rules: { ruleCode: string; title: string; description: string; values: number[] }[] };
type PageData<T> = { items: T[]; nextAfterId: string | null };
const labels: Record<string, string> = { submitted: 'Отправлено', under_review: 'На рассмотрении', needs_info: 'Нужны сведения', resolved: 'Рассмотрено', rejected: 'Отклонено', withdrawn: 'Отозвано', duplicate: 'Дубликат', draft: 'Черновик', approved: 'Ожидает вынесения', applied: 'Вынесено', cancelled: 'Отменено', superseded: 'Заменено' };
const safeLink = (value: string | null) => { try { const u = new URL(value ?? ''); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; } };

export function OfficiatingPage({initialEventId,visible=true}:{initialEventId?:string;visible?:boolean}={}) {
  const [reports, setReports] = useState<Report[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState(''), [filterEvent, setFilterEvent] = useState(initialEventId??new URLSearchParams(window.location.search).get('eventId')??''), [filterOrganizer, setFilterOrganizer] = useState('');
  const appliedFilter = useRef('');
  const [selected, setSelected] = useState<Report | null>(null), [history, setHistory] = useState<{ at: string; reason: string; to: string }[]>([]);
  const initialQuery=new URLSearchParams(window.location.search);
  const [matchmaking,setMatchmaking]=useState<{matchmakingId:string;matchId:string}|null>(()=>initialQuery.get('matchmakingId')&&initialQuery.get('matchId')?{matchmakingId:initialQuery.get('matchmakingId')!,matchId:initialQuery.get('matchId')!}:null);
  const [eventId, setEventId] = useState(initialEventId??initialQuery.get('eventId')??''), [resultId, setResultId] = useState(initialQuery.get('resultId')??'');
  const ownerPath=matchmaking?`/admin/matchmaking/${matchmaking.matchmakingId}/matches/${matchmaking.matchId}`:`/admin/events/${encodeURIComponent(eventId)}`;
  const rulesPath=matchmaking?`${ownerPath}/penalty-rules`:`${ownerPath}/penalty-rules?resultId=${encodeURIComponent(resultId)}`;
  const [decisions, setDecisions] = useState<Decision[]>([]), [decisionCursor, setDecisionCursor] = useState<string | null>(null), [rules, setRules] = useState<Rules | null>(null);
  const [ruleCode, setRuleCode] = useState(''), [participantId, setParticipantId] = useState(''), [value, setValue] = useState('');
  const [pairIds, setPairIds] = useState(''), [winnerId, setWinnerId] = useState('');
  const [split, setSplit] = useState('1'), [occurrence, setOccurrence] = useState('1'), [targetType, setTargetType] = useState('RACE_SESSION');
  const [reason, setReason] = useState(''), [resolution, setResolution] = useState(''), [duplicate, setDuplicate] = useState(''), [supersedes, setSupersedes] = useState<string | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<Decision | null>(null), [changeReason, setChangeReason] = useState('');
  const generation = useRef(0), active = useRef(false), running = useRef(false);
  const command = useRef<{ path: string; body: unknown; key: string; method: 'POST' | 'PATCH' } | null>(null);
  useEffect(() => { setEditing(null); setChangeReason(''); }, [eventId, selected?.id]);
  async function run(action: (valid: () => boolean) => Promise<void>) {
    if (running.current) return;
    const version = generation.current; running.current = true; setBusy(true); setError('');
    const valid = () => active.current && version === generation.current;
    try { await action(valid); } catch (e) { if (valid()) { setError(e instanceof Error ? e.message : 'Операция не выполнена'); if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408) { command.current = null; setPending(false); } } }
    finally { if (valid()) { running.current = false; setBusy(false); } }
  }
  async function loadReports(afterId?: string, status = filterStatus) {
    if (!afterId) { const params = new URLSearchParams(); if (status) params.set('status', status); if (filterEvent.trim()) params.set('eventId', filterEvent.trim()); if (filterOrganizer.trim()) params.set('organizerId', filterOrganizer.trim()); appliedFilter.current = params.toString(); }
    await run(async valid => { const page = await apiFetch<PageData<Report>>('/admin/officiating/protests?limit=30&' + appliedFilter.current + (afterId ? '&afterId=' + afterId : '')); if (valid()) { setReports(rows => afterId ? [...rows, ...page.items] : page.items); setCursor(page.nextAfterId); } });
  }
  useRealtimeRefresh(['reports','results'],()=>run(async valid => {
    const page = await apiFetch<PageData<Report>>('/admin/officiating/protests?limit=30&' + appliedFilter.current);
    if (!valid()) return;
    setReports(page.items); setCursor(page.nextAfterId);
    if (selected) {
      const details = await apiFetch<{ report: Report; history: typeof history }>('/admin/officiating/protests/' + selected.id);
      if (!valid()) return;
      setSelected(details.report); setHistory(details.history);
    }
    if (rules && (eventId || matchmaking)) {
      const page = await apiFetch<PageData<Decision>>(`${ownerPath}/decisions?limit=30`);
      if (valid()) { setDecisions(page.items); setDecisionCursor(page.nextAfterId); }
    }
  }),visible);
  useEffect(() => {
    active.current = true; void loadReports();
    const unsubscribe = subscribeAdminAuthChanged(() => { generation.current++; running.current = false; command.current = null; setPending(false); setBusy(false); setReports([]); setSelected(null); setHistory([]); setDecisions([]); setRules(null); });
    return () => { active.current = false; generation.current++; unsubscribe(); };
    // A new authenticated session must explicitly reload private materials.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function open(report: Report) {
    await run(async valid => {
      const details = await apiFetch<{ report: Report; history: typeof history }>('/admin/officiating/protests/' + report.id);
      if (!valid()) return;
      setSelected(details.report); setHistory(details.history); setParticipantId(details.report.accusedId ?? details.report.submittedById);
      setPairIds(details.report.context.participantIds.join(', ')); setWinnerId('');
      setResolution(''); setDuplicate(''); setRules(null); setDecisions([]); setSupersedes(null);
      setEventId(details.report.context.eventId ?? '');setMatchmaking(null);
      try { const id = details.report.context.source.id; const source = JSON.parse(id.slice(id.startsWith('race:') ? 5 : 4)); setResultId(String(source[0]));if(source[1]==='matchmaking'){const owner=await apiFetch<{matchmakingId:string;matchId:string}>(`/admin/matchmaking/matches/${source[2]}/context`);if(valid())setMatchmaking(owner);} if (id.startsWith('race:')) { setSplit(String(source[1])); setOccurrence(String(source[2])); setTargetType('RACE_SESSION'); } else setTargetType('RESULT'); } catch { setResultId(''); }
    });
  }
  async function loadDecisions(afterId?: string) {
    if ((!eventId && !matchmaking) || !resultId) return;
    await run(async valid => {
      const [catalog, page] = await Promise.all([apiFetch<Rules>(rulesPath), apiFetch<PageData<Decision>>(`${ownerPath}/decisions?limit=30${afterId ? '&afterId=' + afterId : ''}`)]);
      if (valid()) { setRules(catalog); setRuleCode(catalog.rules[0]?.ruleCode ?? ''); setDecisions(rows => afterId ? [...rows, ...page.items] : page.items); setDecisionCursor(page.nextAfterId); }
    });
  }
  async function send(path: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    if (command.current && command.current.path !== path) return;
    command.current ??= { path, body, method, key: crypto.randomUUID() }; setPending(true);
    await run(async valid => {
      const request = command.current!;
      await apiFetch(request.path, { method: request.method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.key }, body: JSON.stringify(request.body) });
      if (!valid()) return;
      command.current = null; setPending(false); setEditing(null);
      if (selected) { const details = await apiFetch<{ report: Report; history: typeof history }>('/admin/officiating/protests/' + selected.id); if (valid()) { setSelected(details.report); setHistory(details.history); } }
      if (eventId || matchmaking) { const page = await apiFetch<PageData<Decision>>(`${ownerPath}/decisions?limit=30`); if (valid()) { setDecisions(page.items); setDecisionCursor(page.nextAfterId); } }
    });
  }
  const rule = rules?.rules.find(item => item.ruleCode === ruleCode);
  const draft = () => editing ? send(`${ownerPath}/decisions/${editing.id}`, {
    expectedVersion: editing.version, reason, changeReason,
    ruleCode, rulesVersion: rules?.rulesVersion, participantId,
    ...(ruleCode === 'match_outcome' ? { participantIds: pairIds.split(',').map(id => id.trim()).filter(Boolean), winnerId: winnerId.trim() || null } : {}),
    target: targetType === 'RESULT' ? { type: 'RESULT' } : { type: 'RACE_SESSION', splitIndex: Number(split), occurrence: Number(occurrence) },
    ...(ruleCode === 'time_penalty' ? { value: Number(value) } : {})
  }, 'PATCH') : send(`${ownerPath}/decisions`, { resultId, ruleCode, rulesVersion: rules?.rulesVersion, participantId,
    ...(ruleCode === 'match_outcome' ? { participantIds: pairIds.split(',').map(id => id.trim()).filter(Boolean), winnerId: winnerId.trim() || null } : {}),
    target: targetType === 'RESULT' ? { type: 'RESULT' } : { type: 'RACE_SESSION', splitIndex: Number(split), occurrence: Number(occurrence) },
    ...(ruleCode === 'time_penalty' ? { value: Number(value) } : {}), reason, submitted: false, reportId: selected?.id ?? null, supersedesDecisionId: supersedes });
  return <Page embedded={!!initialEventId} title="Судейство"><Stack spacing={3}>
    {error && <Alert severity="error">{error}</Alert>}
    {pending && <Alert severity="warning">Команда ожидает подтверждения. <Button disabled={busy} onClick={() => { if (command.current) void send(command.current.path, command.current.body); }}>Повторить ту же команду</Button></Alert>}
    <Section embedded title="Протесты" actions={<RefreshAction loading={busy || pending} onClick={() => void loadReports()}/>}>
      <ListToolbar>
        <FilterButtons label="Статус" value={filterStatus} disabled={busy || pending} onChange={value => { setFilterStatus(value); void loadReports(undefined, value); }} options={[{ value: '', label: 'Все' }, ...['submitted', 'under_review', 'needs_info', 'resolved', 'rejected', 'withdrawn', 'duplicate'].map(value => ({ value, label: labels[value] }))]} />
        {!initialEventId&&<MoreFilters count={[filterEvent, filterOrganizer].filter(Boolean).length}>
          <TextField size="small" label="Событие" value={filterEvent} onChange={e => setFilterEvent(e.target.value)} disabled={busy || pending}/>
          <TextField size="small" label="Организатор" value={filterOrganizer} onChange={e => setFilterOrganizer(e.target.value)} disabled={busy || pending}/>
          <Button disabled={busy || pending} onClick={() => void loadReports()}>Применить</Button>
        </MoreFilters>}
      </ListToolbar>
      <Stack spacing={0}>{reports.map(row => <ListRecord key={row.id} id={row.id} title={row.reason.slice(0,140)} meta={labels[row.status]} disabled={busy||pending} onOpen={()=>void open(row)} openLabel={`№${row.id} · ${labels[row.status]} · ${row.reason.slice(0,140)}`}/>)}{cursor && <Button disabled={busy || pending} onClick={() => void loadReports(cursor)}>Ещё протесты</Button>}</Stack>
    </Section>
    {selected && <Section embedded={!!initialEventId} title={'Протест №' + selected.id} actions={<BackAction label="К протестам" disabled={busy||pending} onClick={()=>setSelected(null)}/>}><Stack spacing={2}>
      <Chip label={labels[selected.status]} /><Typography sx={{ whiteSpace: 'pre-wrap' }}>{selected.reason}</Typography>
      <Typography>Автор #{selected.submittedById} · Обвиняемый {selected.accusedId ? '#' + selected.accusedId : 'не указан'} · {selected.incidentLocation}</Typography>
      {selected.replayUploadId && <Button disabled={busy} onClick={() => void run(async valid => { const file = await apiDownload('/admin/officiating/protests/' + selected.id + '/replay', 'replay.acreplay'); if (!valid()) return; const url = URL.createObjectURL(file.blob), link = document.createElement('a'); link.href = url; link.download = 'replay.acreplay'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })}>Скачать реплей</Button>}
      {safeLink(selected.videoUrl) && <a href={safeLink(selected.videoUrl)!} target="_blank" rel="noopener noreferrer">Материал обращения</a>}
      {selected.comments?.map(row => <Typography key={row.id} sx={{ whiteSpace: 'pre-wrap' }}>#{row.authorId} · {row.createdAt}: {row.body}</Typography>)}
      {history.map((row, i) => <Typography key={i} variant="caption">{row.at} · {labels[row.to]} · {row.reason}</Typography>)}
      <TextField label="Обоснование рассмотрения / переоткрытия" multiline value={resolution} onChange={e => setResolution(e.target.value)} disabled={busy || pending} />
      <TextField label="Номер рассмотренного дубликата" value={duplicate} onChange={e => setDuplicate(e.target.value)} disabled={busy || pending} />
      <Stack direction="row" flexWrap="wrap">{['under_review', 'needs_info', 'resolved', 'rejected', 'duplicate'].map(status => <Button key={status} disabled={busy || pending || !resolution.trim() || (status === 'duplicate' && !duplicate)} onClick={() => void send(`/admin/officiating/protests/${selected.id}/status`, { status, resolutionReason: resolution, duplicateOfProtestId: status === 'duplicate' ? duplicate : null })}>{labels[status]}</Button>)}</Stack>
    </Stack></Section>}
    <Section embedded={!!initialEventId} title="Решения события"><Stack spacing={2}>
      <Stack direction="row" spacing={2}><TextField label={matchmaking?"Матч":"Событие"} value={matchmaking?matchmaking.matchId:eventId} onChange={e => { setEventId(e.target.value); setRules(null); setDecisions([]); }} disabled={!!initialEventId || busy || pending}/><TextField label="Результат" value={resultId} onChange={e => { setResultId(e.target.value); setRules(null); }} disabled={busy || pending}/><Button disabled={busy || pending || (!eventId&&!matchmaking) || !resultId} onClick={() => void loadDecisions()}>Загрузить правила и решения</Button></Stack>
      {rules && <Stack spacing={2}>
        <Typography>Версия правил: {rules.rulesVersion}{editing ? ` · Редактирование №${editing.id}` : supersedes ? ` · Замена решения №${supersedes}` : ''}</Typography>
        <TextField select label="Решение" value={ruleCode} onChange={e => { setRuleCode(e.target.value); setValue(''); }} disabled={busy || pending}>{rules.rules.map(row => <MenuItem key={row.ruleCode} value={row.ruleCode}>{row.title}</MenuItem>)}</TextField>
        <Typography>{rule?.description}</Typography><TextField label="Пилот" value={participantId} onChange={e => setParticipantId(e.target.value)} disabled={busy || pending}/>
        {ruleCode === 'match_outcome' && <><TextField label="Участники пары через запятую" value={pairIds} onChange={e => setPairIds(e.target.value)} disabled={busy || pending}/><TextField label="Победитель (пусто — без результата)" value={winnerId} onChange={e => setWinnerId(e.target.value)} disabled={busy || pending}/></>}
        <TextField select label="Область результата" value={targetType} onChange={e => setTargetType(e.target.value)} disabled={busy || pending}><MenuItem value="RACE_SESSION">Конкретная гонка</MenuItem><MenuItem value="RESULT">Результат целиком</MenuItem></TextField>
        {targetType === 'RACE_SESSION' && <Stack direction="row" spacing={2}><TextField label="Сплит" type="number" value={split} onChange={e => setSplit(e.target.value)} disabled={busy || pending}/><TextField label="Заезд" type="number" value={occurrence} onChange={e => setOccurrence(e.target.value)} disabled={busy || pending}/></Stack>}
        {!!rule?.values.length && <TextField select label="Штраф, секунды" value={value} onChange={e => setValue(e.target.value)} disabled={busy || pending}>{rule.values.map(ms => <MenuItem key={ms} value={String(ms)}>{ms / 1000}</MenuItem>)}</TextField>}
        <TextField label="Обоснование решения / отмены" multiline value={reason} onChange={e => setReason(e.target.value)} disabled={busy || pending}/>
        {editing && <TextField label="Причина изменения" value={changeReason} onChange={e => setChangeReason(e.target.value)} disabled={busy || pending}/>}
        <Button disabled={busy || pending || !reason.trim() || !participantId || !ruleCode || (!!rule?.values.length && !value) || (!!editing && !changeReason.trim())} onClick={() => void draft()}>{editing ? 'Сохранить изменения' : 'Сохранить черновик'}</Button>
        {editing && <Button disabled={busy || pending} onClick={() => setEditing(null)}>Закрыть редактирование</Button>}
      </Stack>}
      {decisions.map(row => <Stack key={row.id} direction="row" spacing={2} alignItems="center"><Typography>№{row.id} · {labels[row.status]} · {row.reason}</Typography>
        {row.status === 'draft' && <Button disabled={busy || pending} onClick={() => void run(async valid => {
          const catalog = await apiFetch<Rules>(matchmaking?`${ownerPath}/penalty-rules`:`${ownerPath}/penalty-rules?resultId=${encodeURIComponent(row.source.id)}`);
          if (!valid()) return;
          setRules(catalog); setResultId(row.source.id); setEditing(row); setReason(row.reason); setChangeReason(''); setSupersedes(null);
          setRuleCode(({ NOTE: 'note', WARNING: 'warning', ADD_TIME_PENALTY: 'time_penalty', DISQUALIFY: 'disqualification', SET_MATCH_OUTCOME: 'match_outcome' } as Record<string, string>)[row.effect.type] ?? '');
          setParticipantId(row.effect.participantId ?? row.effect.participantIds?.[0] ?? ''); setValue(String(row.effect.milliseconds ?? ''));
          setPairIds(row.effect.participantIds?.join(', ') ?? ''); setWinnerId(row.effect.winnerId ?? '');
          setTargetType(row.effect.target?.type ?? 'RESULT'); setSplit(String(row.effect.target?.splitIndex ?? 1)); setOccurrence(String(row.effect.target?.occurrence ?? 1));
        })}>Редактировать черновик</Button>}
        {['draft', 'submitted', 'approved'].includes(row.status) && <Button disabled={busy || pending} onClick={() => void send(`${ownerPath}/decisions/${row.id}/issue`, { expectedVersion: row.version })}>Вынести решение</Button>}
        {row.status === 'applied' && <Button disabled={busy || pending} onClick={() => { setSupersedes(row.id); setResultId(row.source.id); setParticipantId(row.effect.participantId ?? ''); setReason(''); }}>Подготовить замену</Button>}
        {!['cancelled', 'superseded'].includes(row.status) && <Button disabled={busy || pending || !reason.trim()} onClick={() => void send(`${ownerPath}/decisions/${row.id}/cancel`, { reason })}>Отменить с указанной причиной</Button>}
      </Stack>)}
      {decisionCursor && <Button disabled={busy || pending} onClick={() => void loadDecisions(decisionCursor)}>Ещё решения</Button>}
    </Stack></Section>
  </Stack></Page>;
}
