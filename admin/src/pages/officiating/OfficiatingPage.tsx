import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiDownload, apiFetch, subscribeAdminAuthChanged } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import { Button, Dialog, EmbeddedContext, EmptyState, ErrorState, Fields, FilterButtons, LoadingBlock, LoadMore, Meta, MetaGrid, Notice, PageHeader, Panel, RecordHead, RecordTopline, SelectField, StatusBadge, StepList, Table, TextArea, TextField, TextLink, Toolbar, clickableRow, recordTone, shortDateTime, usePageChrome } from '../../ui/v16';
import {
  decisionTones, effectLabel, effectRule, labels, parseSource, reportStatuses, reportTones, reportTransitions, safeLink, sourceLabel, targetLabel,
  type Decision, type MatchOwner, type PageData, type Report, type ReportHistory, type Rules,
} from './officiating-model';
import './officiating.v16.css';

type Failure = { message: string; status: number | null };
const failure = (e: unknown): Failure => ({ message: e instanceof Error ? e.message : 'Операция не выполнена', status: e instanceof ApiError ? e.status : null });
const badge = (status: string, tones: typeof reportTones) => <StatusBadge variant="badge" status={{ code: status, label: labels[status] ?? status }} tone={recordTone(status, tones)} />;

/**
 * Officiating: protest queue, protest card with moderation, penalty rules and the decision lifecycle (draft → issue / cancel).
 * Embedded in the event journal with `initialEventId` (no page chrome, queue filtered by the event).
 * Commands keep one Idempotency-Key until the server answers; a lost answer is retried with the same key and body.
 */
export function OfficiatingPage({ initialEventId, visible = true }: { initialEventId?: string; visible?: boolean } = {}) {
  const embedded = !!initialEventId;
  const initialQuery = useRef(new URLSearchParams(window.location.search)).current;
  const [reports, setReports] = useState<Report[] | null>(null), [cursor, setCursor] = useState<string | null>(null), [listError, setListError] = useState<Failure | null>(null);
  const [filterStatus, setFilterStatus] = useState(''), [filterEvent, setFilterEvent] = useState(initialEventId ?? initialQuery.get('eventId') ?? ''), [filterOrganizer, setFilterOrganizer] = useState('');
  const appliedFilter = useRef('');
  const [selected, setSelected] = useState<Report | null>(null), [history, setHistory] = useState<ReportHistory>([]);
  const [matchmaking, setMatchmaking] = useState<MatchOwner | null>(() => initialQuery.get('matchmakingId') && initialQuery.get('matchId') ? { matchmakingId: initialQuery.get('matchmakingId')!, matchId: initialQuery.get('matchId')! } : null);
  const [eventId, setEventId] = useState(initialEventId ?? initialQuery.get('eventId') ?? ''), [resultId, setResultId] = useState(initialQuery.get('resultId') ?? '');
  const ownerPath = matchmaking ? `/admin/matchmaking/${matchmaking.matchmakingId}/matches/${matchmaking.matchId}` : `/admin/events/${encodeURIComponent(eventId)}`;
  const rulesPath = (forResult: string) => (matchmaking ? `${ownerPath}/penalty-rules` : `${ownerPath}/penalty-rules?resultId=${encodeURIComponent(forResult)}`);
  const [decisions, setDecisions] = useState<Decision[]>([]), [decisionCursor, setDecisionCursor] = useState<string | null>(null), [rules, setRules] = useState<Rules | null>(null);
  const [ruleCode, setRuleCode] = useState(''), [participantId, setParticipantId] = useState(''), [value, setValue] = useState('');
  const [pairIds, setPairIds] = useState(''), [winnerId, setWinnerId] = useState('');
  const [split, setSplit] = useState('1'), [occurrence, setOccurrence] = useState('1'), [targetType, setTargetType] = useState('RACE_SESSION');
  const [reason, setReason] = useState(''), [resolution, setResolution] = useState(''), [duplicate, setDuplicate] = useState(''), [supersedes, setSupersedes] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null), [busy, setBusy] = useState(false), [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<Decision | null>(null), [changeReason, setChangeReason] = useState('');
  const [issueTarget, setIssueTarget] = useState<Decision | null>(null), [cancelTarget, setCancelTarget] = useState<Decision | null>(null), [cancelReason, setCancelReason] = useState('');
  const generation = useRef(0), active = useRef(false), running = useRef(false);
  const command = useRef<{ path: string; body: unknown; key: string; method: 'POST' | 'PATCH' } | null>(null);
  const locked = busy || pending;
  useEffect(() => { setEditing(null); setChangeReason(''); }, [eventId, selected?.id]);

  async function run(action: (valid: () => boolean) => Promise<void>) {
    if (running.current) return false;
    const version = generation.current; running.current = true; setBusy(true); setError(null);
    const valid = () => active.current && version === generation.current;
    let ok = false;
    try { await action(valid); ok = true; } catch (e) {
      if (valid()) { setError(failure(e)); if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408) { command.current = null; setPending(false); } }
    } finally { if (valid()) { running.current = false; setBusy(false); } }
    return ok;
  }
  async function loadReports(afterId?: string, status = filterStatus) {
    if (!afterId) {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (filterEvent.trim()) params.set('eventId', filterEvent.trim());
      if (filterOrganizer.trim()) params.set('organizerId', filterOrganizer.trim());
      appliedFilter.current = params.toString();
    }
    setListError(null);
    await run(async (valid) => {
      try {
        const page = await apiFetch<PageData<Report>>('/admin/officiating/protests?limit=30&' + appliedFilter.current + (afterId ? '&afterId=' + afterId : ''));
        if (valid()) { setReports((rows) => (afterId && rows ? [...rows, ...page.items] : page.items)); setCursor(page.nextAfterId); }
      } catch (e) { if (valid()) setListError(failure(e)); }
    });
  }
  async function reloadDecisions(valid: () => boolean) {
    const page = await apiFetch<PageData<Decision>>(`${ownerPath}/decisions?limit=30`);
    if (valid()) { setDecisions(page.items); setDecisionCursor(page.nextAfterId); }
  }
  async function reloadReport(id: string, valid: () => boolean) {
    const details = await apiFetch<{ report: Report; history: ReportHistory }>('/admin/officiating/protests/' + id);
    if (valid()) { setSelected(details.report); setHistory(details.history); }
  }
  useRealtimeRefresh(['reports', 'results'], () => run(async (valid) => {
    const page = await apiFetch<PageData<Report>>('/admin/officiating/protests?limit=30&' + appliedFilter.current);
    if (!valid()) return;
    setReports(page.items); setCursor(page.nextAfterId);
    if (selected) await reloadReport(selected.id, valid);
    if (rules && (eventId || matchmaking)) await reloadDecisions(valid);
  }), visible);
  useEffect(() => {
    active.current = true; void loadReports().then(() => { if ((eventId || matchmaking) && resultId) void loadDecisions(); });
    const unsubscribe = subscribeAdminAuthChanged(() => { generation.current++; running.current = false; command.current = null; setPending(false); setBusy(false); setReports(null); setSelected(null); setHistory([]); setDecisions([]); setRules(null); });
    // Unmount (and the StrictMode remount) invalidates in-flight work, so it must also release the run lock.
    return () => { active.current = false; generation.current++; running.current = false; unsubscribe(); };
    // A new authenticated session must explicitly reload private materials.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(report: Report) {
    await run(async (valid) => {
      const details = await apiFetch<{ report: Report; history: ReportHistory }>('/admin/officiating/protests/' + report.id);
      if (!valid()) return;
      setSelected(details.report); setHistory(details.history); setParticipantId(details.report.accusedId ?? details.report.submittedById);
      setPairIds(details.report.context.participantIds.join(', ')); setWinnerId('');
      setResolution(''); setDuplicate(''); setRules(null); setDecisions([]); setSupersedes(null);
      setEventId(details.report.context.eventId ?? ''); setMatchmaking(null);
      const source = parseSource(details.report.context.source.id);
      setResultId(source?.resultId ?? '');
      if (source?.matchId) { const owner = await apiFetch<MatchOwner>(`/admin/matchmaking/matches/${source.matchId}/context`); if (valid()) setMatchmaking(owner); }
      if (source?.split) { setSplit(source.split); setOccurrence(source.occurrence ?? '1'); setTargetType('RACE_SESSION'); } else if (source) setTargetType('RESULT');
    });
  }
  async function loadDecisions(afterId?: string) {
    if ((!eventId && !matchmaking) || !resultId) return;
    await run(async (valid) => {
      const [catalog, page] = await Promise.all([apiFetch<Rules>(rulesPath(resultId)), apiFetch<PageData<Decision>>(`${ownerPath}/decisions?limit=30${afterId ? '&afterId=' + afterId : ''}`)]);
      if (valid()) {
        setRules(catalog); if (!afterId) setRuleCode(catalog.rules[0]?.ruleCode ?? '');
        setDecisions((rows) => (afterId ? [...rows, ...page.items] : page.items)); setDecisionCursor(page.nextAfterId);
      }
    });
  }
  async function send(path: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    if (command.current && command.current.path !== path) return false;
    command.current ??= { path, body, method, key: crypto.randomUUID() }; setPending(true);
    return run(async (valid) => {
      const request = command.current!;
      await apiFetch(request.path, { method: request.method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.key }, body: JSON.stringify(request.body) });
      if (!valid()) return;
      command.current = null; setPending(false); setEditing(null);
      if (selected) await reloadReport(selected.id, valid);
      if (eventId || matchmaking) await reloadDecisions(valid);
    });
  }
  const rule = rules?.rules.find((item) => item.ruleCode === ruleCode);
  const effectFields = () => ({
    ruleCode, rulesVersion: rules?.rulesVersion, participantId,
    ...(ruleCode === 'match_outcome' ? { participantIds: pairIds.split(',').map((id) => id.trim()).filter(Boolean), winnerId: winnerId.trim() || null } : {}),
    target: targetType === 'RESULT' ? { type: 'RESULT' } : { type: 'RACE_SESSION', splitIndex: Number(split), occurrence: Number(occurrence) },
    // The catalogue decides whether a rule takes a value: only listed values are offered and sent.
    ...(rule?.values.length ? { value: Number(value) } : {}),
  });
  const saveDraft = () => (editing
    ? send(`${ownerPath}/decisions/${editing.id}`, { expectedVersion: editing.version, reason, changeReason, ...effectFields() }, 'PATCH')
    : send(`${ownerPath}/decisions`, { resultId, ...effectFields(), reason, submitted: false, reportId: selected?.id ?? null, supersedesDecisionId: supersedes })
  ).then((ok) => { if (ok) { setReason(''); setChangeReason(''); setSupersedes(null); } });
  const editDraft = (row: Decision) => run(async (valid) => {
    const catalog = await apiFetch<Rules>(rulesPath(row.source.id));
    if (!valid()) return;
    setRules(catalog); setResultId(row.source.id); setEditing(row); setReason(row.reason); setChangeReason(''); setSupersedes(null);
    setRuleCode(effectRule[row.effect.type] ?? '');
    setParticipantId(row.effect.participantId ?? row.effect.participantIds?.[0] ?? ''); setValue(String(row.effect.milliseconds ?? ''));
    setPairIds(row.effect.participantIds?.join(', ') ?? ''); setWinnerId(row.effect.winnerId ?? '');
    setTargetType(row.effect.target?.type ?? 'RESULT'); setSplit(String(row.effect.target?.splitIndex ?? 1)); setOccurrence(String(row.effect.target?.occurrence ?? 1));
  });
  const prepareReplacement = (row: Decision) => { setEditing(null); setSupersedes(row.id); setResultId(row.source.id); setParticipantId(row.effect.participantId ?? ''); setReason(''); };
  const downloadReplay = (report: Report) => run(async (valid) => {
    const file = await apiDownload('/admin/officiating/protests/' + report.id + '/replay', 'replay.acreplay');
    if (!valid()) return;
    const url = URL.createObjectURL(file.blob), link = document.createElement('a');
    link.href = url; link.download = file.fileName ?? 'replay.acreplay'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const flat = embedded ? 'lsr-off-flat' : undefined;

  const notices = (
    <>
      {error && <ErrorState error={error.message} status={error.status === 403 ? null : error.status} />}
      {pending && <Notice tone="warning" role="status" actions={<Button size="sm" disabled={busy} onClick={() => { if (command.current) void send(command.current.path, command.current.body); }}>Повторить ту же команду</Button>}>Команда ожидает подтверждения сервера. Повтор отправит её с тем же ключом и телом.</Notice>}
    </>
  );

  const decisionContext = (stacked: boolean) => (
    <div className={`lsr-off-context${stacked ? ' is-stacked' : ''}`}>
      <TextField label={matchmaking ? 'Матч' : 'Событие'} value={matchmaking ? matchmaking.matchId : eventId} disabled={embedded || !!matchmaking || locked} onChange={(e) => { setEventId(e.target.value); setRules(null); setDecisions([]); }} />
      <TextField label="Результат" value={resultId} disabled={locked} onChange={(e) => { setResultId(e.target.value); setRules(null); }} />
      <Button disabled={locked || (!eventId && !matchmaking) || !resultId} onClick={() => void loadDecisions()}>Загрузить правила и решения</Button>
    </div>
  );
  const decisionForm = rules && (
    <div>
      <div className="lsr-off-mode">Версия правил {rules.rulesVersion} · результат {rules.resultId}{editing ? ` · редактирование черновика №${editing.id}` : supersedes ? ` · замена решения №${supersedes}` : ''}</div>
      {!rules.rules.length ? <EmptyState compact>Для этого результата нет доступных правил.</EmptyState> : (
        <>
          <Fields>
            <SelectField full label="Правило / решение" value={ruleCode} disabled={locked} help={rule?.description} onChange={(e) => { setRuleCode(e.target.value); setValue(''); }} options={rules.rules.map((r) => ({ value: r.ruleCode, label: r.title }))} />
            <TextField label="Пилот" value={participantId} disabled={locked} help={selected ? `Участники протеста: ${selected.context.participantIds.join(', ') || '—'}` : 'ID участника'} onChange={(e) => setParticipantId(e.target.value)} />
            {rule?.values.length ? <SelectField label="Штраф, секунды" value={value} disabled={locked} onChange={(e) => setValue(e.target.value)} options={[{ value: '', label: 'Выберите значение' }, ...rule.values.map((ms) => ({ value: String(ms), label: String(ms / 1000) }))]} /> : <div />}
            {ruleCode === 'match_outcome' && <>
              <TextField label="Участники пары через запятую" value={pairIds} disabled={locked} onChange={(e) => setPairIds(e.target.value)} />
              <TextField label="Победитель (пусто — без результата)" value={winnerId} disabled={locked} onChange={(e) => setWinnerId(e.target.value)} />
            </>}
            <SelectField label="Область результата" value={targetType} disabled={locked} onChange={(e) => setTargetType(e.target.value)} options={[{ value: 'RACE_SESSION', label: 'Конкретная гонка' }, { value: 'RESULT', label: 'Результат целиком' }]} />
            <div />
            {targetType === 'RACE_SESSION' && <>
              <TextField label="Сплит" type="number" min={1} value={split} disabled={locked} onChange={(e) => setSplit(e.target.value)} />
              <TextField label="Заезд" type="number" min={1} value={occurrence} disabled={locked} onChange={(e) => setOccurrence(e.target.value)} />
            </>}
            <TextArea full label="Обоснование решения" help="Обязательное поле" rows={4} value={reason} disabled={locked} onChange={(e) => setReason(e.target.value)} />
            {editing && <TextField full label="Причина изменения" value={changeReason} disabled={locked} onChange={(e) => setChangeReason(e.target.value)} />}
          </Fields>
          <div className="lsr-form-actions">
            {editing && <Button disabled={locked} onClick={() => setEditing(null)}>Закрыть редактирование</Button>}
            {supersedes && !editing && <Button disabled={locked} onClick={() => setSupersedes(null)}>Отменить замену</Button>}
            <Button variant="primary" disabled={locked || !reason.trim() || !participantId || !ruleCode || (!!rule?.values.length && !value) || (!!editing && !changeReason.trim())} onClick={() => void saveDraft()}>{editing ? 'Сохранить изменения' : 'Сохранить черновик'}</Button>
          </div>
        </>
      )}
    </div>
  );
  const decisionTable = (
    <>
      {!rules ? <EmptyState compact>Выберите событие и результат и загрузите правила — решения привязаны к конкретному результату.</EmptyState>
        : !decisions.length ? <EmptyState compact>Решений по этому владельцу результата пока нет.</EmptyState> : (
          <Table variant="module" label="Судейские решения">
            <thead><tr><th>Решение</th><th>Пилот</th><th>Область</th><th>Результат</th><th>Статус</th><th /></tr></thead>
            <tbody>
              {decisions.map((row) => (
                <tr key={row.id}>
                  <td><div className="lsr-primary">№{row.id} · {effectLabel(row.effect, rules)}</div><div className="lsr-minor" style={{ overflowWrap: 'anywhere' }}>{row.reason}{row.supersedesDecisionId ? ` · заменяет №${row.supersedesDecisionId}` : ''}</div></td>
                  <td className="lsr-mono">{row.effect.participantId ?? row.effect.participantIds?.join(', ') ?? '—'}</td>
                  <td className="lsr-nowrap">{targetLabel(row.effect.target)}</td>
                  <td className="lsr-mono">{row.source.id}</td>
                  <td>{badge(row.status, decisionTones)}</td>
                  <td>
                    <div className="lsr-off-rowactions">
                      {row.status === 'draft' && <Button size="sm" disabled={locked} onClick={() => void editDraft(row)}>Редактировать черновик</Button>}
                      {['draft', 'submitted', 'approved'].includes(row.status) && <Button size="sm" variant="primary" disabled={locked} onClick={() => setIssueTarget(row)}>Вынести решение</Button>}
                      {row.status === 'applied' && <Button size="sm" disabled={locked} onClick={() => prepareReplacement(row)}>Подготовить замену</Button>}
                      {!['cancelled', 'superseded'].includes(row.status) && <Button size="sm" variant="danger" disabled={locked} onClick={() => { setCancelTarget(row); setCancelReason(''); }}>Отменить</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      <LoadMore hasMore={!!decisionCursor} busy={locked} label="Ещё решения" onClick={() => void loadDecisions(decisionCursor!)} />
    </>
  );

  const queue = (
    <Panel title="Очередь протестов" body={false} className={flat} actions={<Button size="sm" disabled={locked} onClick={() => void loadReports()}>{busy ? 'Обновление…' : 'Обновить'}</Button>}>
      <Toolbar>
        <FilterButtons label="Статус протеста" value={filterStatus} disabled={locked} onChange={(next) => { setFilterStatus(next); void loadReports(undefined, next); }}
          options={[{ value: '', label: 'Все' }, ...reportStatuses.map((s) => ({ value: s, label: labels[s] }))]} />
        {!embedded && (
          <form className="lsr-off-filters" onSubmit={(e) => { e.preventDefault(); void loadReports(); }}>
            <input aria-label="Событие" placeholder="ID события" value={filterEvent} disabled={locked} onChange={(e) => setFilterEvent(e.target.value)} />
            <input aria-label="Организатор" placeholder="ID организатора" value={filterOrganizer} disabled={locked} onChange={(e) => setFilterOrganizer(e.target.value)} />
            <Button size="sm" type="submit" disabled={locked}>Применить</Button>
          </form>
        )}
      </Toolbar>
      {listError && <div style={{ padding: embedded ? 0 : 16 }}><ErrorState error={listError.message} status={listError.status} onRetry={() => void loadReports()} compact={!!reports} /></div>}
      {!reports && !listError && <div style={{ padding: embedded ? 0 : 16 }}><LoadingBlock rows={4} label="Загрузка протестов" /></div>}
      {reports && !reports.length && <EmptyState compact>{appliedFilter.current ? 'Протестов по выбранным условиям нет.' : 'Протестов пока нет.'}</EmptyState>}
      {!!reports?.length && (
        <Table variant="module" label="Протесты">
          <thead><tr><th>Протест</th><th>Событие</th><th>Заявитель</th><th>Участник</th><th>Создан</th><th>Статус</th></tr></thead>
          <tbody>
            {reports.map((row) => (
              <tr key={row.id} {...clickableRow(() => { if (!locked) void open(row); })}>
                <td style={{ maxWidth: 420 }}>
                  <button type="button" className="lsr-off-open" disabled={locked} aria-label={`№${row.id} · ${labels[row.status] ?? row.status} · ${row.reason.slice(0, 140)}`} onClick={() => void open(row)}>{row.reason.length > 90 ? row.reason.slice(0, 90) + '…' : row.reason}</button>
                  <div className="lsr-minor">№{row.id} · {row.incidentLocation}</div>
                </td>
                <td>{row.context.eventId ? (embedded ? `№${row.context.eventId}` : <TextLink size="sm" to={`/events/${encodeURIComponent(row.context.eventId)}`}>№{row.context.eventId}</TextLink>) : parseSource(row.context.source.id)?.matchId ? `Матч №${parseSource(row.context.source.id)!.matchId}` : '—'}</td>
                <td className="lsr-mono">#{row.submittedById}</td>
                <td className="lsr-mono">{row.accusedId ? '#' + row.accusedId : 'не указан'}</td>
                <td className="lsr-nowrap">{shortDateTime(row.createdAt)}</td>
                <td>{badge(row.status, reportTones)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <LoadMore hasMore={!!cursor} busy={locked} label="Ещё протесты" onClick={() => void loadReports(cursor!)} />
    </Panel>
  );

  const listView = (
    <>
      {queue}
      <div className="lsr-cols-module" style={{ marginTop: embedded ? 0 : 16 }}>
        <Panel title="Судейские решения" sub="Решение привязано к результату, пилоту, сплиту и заезду. Изменение черновика требует причины и текущей версии." className={flat} body={false}>
          <div style={{ padding: embedded ? '0 0 12px' : '14px 16px' }}>{decisionContext(false)}</div>
          {decisionTable}
        </Panel>
        <Panel title={editing ? `Черновик №${editing.id}` : supersedes ? `Замена решения №${supersedes}` : 'Новое решение'} className={flat}>
          {decisionForm || <p className="lsr-mutedline" style={{ margin: 0 }}>Правила судейства загружаются для выбранного результата: допустимые решения и значения штрафов задаёт регламент, а не форма. История результата хранит ревизии отдельно от решений.</p>}
        </Panel>
      </div>
    </>
  );

  const detailView = selected && (
    <ProtestCard report={selected} history={history} embedded={embedded} locked={locked} busy={busy}
      onBack={() => setSelected(null)} onDownload={() => void downloadReplay(selected)}
      review={
        <Panel title="Рассмотрение" className={flat}>
          <div className="lsr-stack">
            <TextArea label="Обоснование рассмотрения / переоткрытия" rows={3} value={resolution} disabled={locked} onChange={(e) => setResolution(e.target.value)} />
            <TextField label="Номер рассмотренного дубликата" help="Только для статуса «Дубликат»" value={duplicate} disabled={locked} onChange={(e) => setDuplicate(e.target.value)} />
          </div>
          <div className="lsr-off-statuses">
            {reportTransitions.map((status) => (
              <Button key={status} size="sm" variant={status === 'resolved' ? 'primary' : status === 'rejected' ? 'danger' : 'default'} disabled={locked || status === selected.status || !resolution.trim() || (status === 'duplicate' && !duplicate)}
                onClick={() => void send(`/admin/officiating/protests/${selected.id}/status`, { status, resolutionReason: resolution, duplicateOfProtestId: status === 'duplicate' ? duplicate : null })}>{labels[status]}</Button>
            ))}
          </div>
        </Panel>
      }
      decision={
        <Panel title={editing ? `Черновик №${editing.id}` : supersedes ? `Замена решения №${supersedes}` : 'Решение'} className={flat}>
          <div className="lsr-stack">{decisionContext(true)}{decisionForm}</div>
        </Panel>
      }
      decisions={<Panel title={matchmaking ? `Решения матча №${matchmaking.matchId}` : `Решения события №${eventId || '—'}`} className={flat} body={false}>{decisionTable}</Panel>}
    />
  );

  const dialogs = (
    <>
      <Dialog open={!!issueTarget} onClose={() => !locked && setIssueTarget(null)} title={`Вынести решение №${issueTarget?.id ?? ''}?`}
        description="Вынесенное решение применяется к результату и создаёт новую ревизию. Отменить его можно только отдельной командой с причиной."
        actions={<><Button disabled={locked} onClick={() => setIssueTarget(null)}>Назад</Button><Button variant="primary" disabled={locked} onClick={() => { const row = issueTarget!; void send(`${ownerPath}/decisions/${row.id}/issue`, { expectedVersion: row.version }).then((ok) => { if (ok) setIssueTarget(null); }); }}>Вынести</Button></>}>
        {issueTarget && <MetaGrid columns={2}><Meta label="Решение">{effectLabel(issueTarget.effect, rules)}</Meta><Meta label="Пилот">{issueTarget.effect.participantId ?? '—'}</Meta><Meta label="Область">{targetLabel(issueTarget.effect.target)}</Meta><Meta label="Версия">{issueTarget.version}</Meta></MetaGrid>}
      </Dialog>
      <Dialog open={!!cancelTarget} onClose={() => !locked && setCancelTarget(null)} title={`Отменить решение №${cancelTarget?.id ?? ''}`} description="Причина отмены обязательна и сохраняется в истории решения."
        actions={<><Button disabled={locked} onClick={() => setCancelTarget(null)}>Назад</Button><Button variant="danger-solid" disabled={locked || !cancelReason.trim()} onClick={() => { const row = cancelTarget!; void send(`${ownerPath}/decisions/${row.id}/cancel`, { reason: cancelReason }).then((ok) => { if (ok) setCancelTarget(null); }); }}>Отменить решение</Button></>}>
        {cancelTarget && <div className="lsr-stack">{error && <ErrorState error={error.message} status={error.status} />}<TextArea label="Причина отмены" rows={3} value={cancelReason} disabled={locked} onChange={(e) => setCancelReason(e.target.value)} /></div>}
      </Dialog>
    </>
  );

  const content = <>{notices}{detailView || listView}{dialogs}</>;
  if (embedded) return <EmbeddedContext.Provider value><div className="lsr-stack lsr-off-embedded">{content}</div></EmbeddedContext.Provider>;
  return (
    <div className="lsr-stack" style={{ gap: 0 }}>
      <Chrome selected={selected} />
      <PageHeader overline="Администрирование" title="Судейство" description="Протесты, доказательства и судейские решения" />
      <div className="lsr-stack">{content}</div>
    </div>
  );
}

function Chrome({ selected }: { selected: Report | null }) {
  usePageChrome({ crumbs: selected ? [{ label: 'Судейство' }, { label: `Протест №${selected.id}` }] : [{ label: 'Судейство' }] });
  return null;
}

function ProtestCard({ report, history, embedded, locked, busy, onBack, onDownload, review, decision, decisions }: {
  report: Report; history: ReportHistory; embedded: boolean; locked: boolean; busy: boolean; onBack: () => void; onDownload: () => void; review: ReactNode; decision: ReactNode; decisions: ReactNode;
}) {
  const video = safeLink(report.videoUrl);
  const meta = [report.context.eventId ? `Событие №${report.context.eventId}` : null, sourceLabel(report.context.source.id), report.createdAt ? `создан ${shortDateTime(report.createdAt)}` : null].filter(Boolean).join(' · ');
  return (
    <div className="lsr-stack">
      <div>
        <RecordTopline back={{ label: 'Протесты', onClick: onBack }} disabled={locked} current={`№${report.id}`} />
        <RecordHead title={`Протест №${report.id} · ${report.incidentLocation}`} badges={badge(report.status, reportTones)} meta={meta} />
      </div>
      <div className="lsr-cols-module">
        <Panel title="Материалы протеста" className={embedded ? 'lsr-off-flat' : undefined}>
          <MetaGrid columns={2}>
            <Meta label="Заявитель">#{report.submittedById}</Meta>
            <Meta label="Участник">{report.accusedId ? `#${report.accusedId}` : 'не указан'}</Meta>
            <Meta label="Место инцидента">{report.incidentLocation || '—'}</Meta>
            <Meta label="Источник">{sourceLabel(report.context.source.id)}</Meta>
          </MetaGrid>
          <div className="lsr-off-label">Описание ситуации</div>
          <p className="lsr-off-desc">{report.reason}</p>
          <div className="lsr-off-divider" />
          <h3 className="lsr-off-h3">Доказательства</h3>
          {!report.replayUploadId && !video && <div className="lsr-mutedline">Реплей и видео не приложены.</div>}
          {report.replayUploadId && <div className="lsr-off-item"><div><b>Реплей заезда</b><small>Файл загружен заявителем</small></div><Button size="sm" disabled={busy} onClick={onDownload}>Скачать реплей</Button></div>}
          {video && <div className="lsr-off-item"><div><b>Видео</b><small>{video}</small></div><a className="lsr-btn is-sm" href={video} target="_blank" rel="noopener noreferrer">Материал обращения ↗</a></div>}
          {!!report.comments?.length && <>
            <div className="lsr-off-divider" />
            <h3 className="lsr-off-h3">Комментарии</h3>
            <StepList items={report.comments.map((c) => ({ key: c.id, title: `#${c.authorId} · ${shortDateTime(c.createdAt)}`, detail: <span style={{ whiteSpace: 'pre-wrap' }}>{c.body}</span> }))} />
          </>}
          <div className="lsr-off-divider" />
          <h3 className="lsr-off-h3">История рассмотрения</h3>
          <StepList items={[
            { title: 'Создан протест', detail: `${report.createdAt ? shortDateTime(report.createdAt) : 'Время создания не передано'} · заявитель #${report.submittedById}` },
            ...history.map((row) => ({ title: labels[row.to] ?? row.to, detail: `${shortDateTime(row.at)} · ${row.reason}` })),
          ]} />
        </Panel>
        <div className="lsr-stack">{review}{decision}</div>
      </div>
      {decisions}
    </div>
  );
}
