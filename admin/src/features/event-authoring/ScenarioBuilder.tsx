import { initialSettings } from './initial-settings';
import { useRef, useState, type ReactNode } from 'react';
import { useScenarioBuilder } from './useScenarioBuilder';
import { RichDescriptionEditor } from '../../shared/RichContent';
import { EventCardFields } from '../../pages/events/current/EventCardFields';
import type { Document, Draft, Resolution, Settings } from './types';
import { Field } from './Fields';
import { EditingRestrictions, FieldCapabilities, FieldFocus, FieldIssues, read, write } from './form-state';
import { ParticipantFields, ProgramFields, ConditionsFields } from './ScenarioFields';
import { Button, EmptyState, LoadingBlock, Notice, PageHeader, Panel } from '../../ui/v16';

type Step = 'base' | 'program' | 'conditions' | 'participants' | 'appearance' | 'review';
/** Steps of the v16 creator; base and appearance are both parts of the server section "description". */
const steps: { id: Step; label: string; section: string }[] = [
  { id: 'base', label: 'Основное', section: 'description' },
  { id: 'program', label: 'Программа', section: 'program' },
  { id: 'conditions', label: 'Машины и условия', section: 'conditions' },
  { id: 'participants', label: 'Участие и очки', section: 'participants' },
  { id: 'appearance', label: 'Внешний вид', section: 'description' },
  { id: 'review', label: 'Проверка', section: 'review' },
];
const programLabel: Record<string, string> = { weekly: 'Расписание и недели', championship: 'Этапы', double_elimination_tournament: 'Сетка' };
const help: Record<Step, string> = {
  base: 'Название и описание видят участники на странице события. Игра, организатор и часовой пояс берутся из выбранного контекста.',
  program: 'Соберите программу заездов. Практика и квалификация перед гонкой — фазы одной сессии. В чемпионате список машин общий.',
  participants: 'Допуск в серию и запись на отдельную гонку — разные действия. Здесь задаются правила участия, зачёта и рейтинга.',
  conditions: 'Выберите класс машин и погоду из каталога или создайте свои. Помощники и плагины серии задаются один раз.',
  appearance: 'Обложка и оформление карточек на сайте. Предпросмотр использует рендер публичного сайта.',
  review: 'Проверьте программу перед публикацией. Черновик можно сохранить незаполненным; публикация станет доступна после полной проверки.',
};
export interface ScenarioBuilderProps {
  descriptionOnly?: boolean;
  edit?: { eventId: string; expectedVersion: string };
  onEdited?: () => void;
  draftId?: string;
  initialDocument?: Document;
  onSaved?: (draft: Draft) => void;
  onPublished?: (eventId: string) => void;
  onClose?: () => void;
  /** Page heading in edit mode: the event settings screen owns the title and the tabs under it. */
  heading?: { title: string; description?: string; below?: ReactNode; extraActions?: ReactNode };
  initialStep?: Step;
}
export function ScenarioBuilder({ descriptionOnly = false, draftId, initialDocument, onSaved, onPublished, onClose, edit, onEdited, heading, initialStep }: ScenarioBuilderProps) {
  const scenarioInputs = useRef(new Map<string, Settings>());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const builder = useScenarioBuilder({ draftId, initialDocument, onSaved, onPublished, edit, onEdited, descriptionOnly });
  const { publicationPending, editRestrictions, document, draft, catalog, organizers, setSection, resolution, error, setError, notice, busy, loading, uploads, current, update, settings, organizerId, descriptor, save } = builder;
  const [step, setStep] = useState<Step>(initialStep ?? (descriptionOnly ? 'base' : 'base'));
  const visible = steps.filter((s) => (descriptionOnly ? ['base', 'appearance', 'review'].includes(s.id) : !descriptor || descriptor.sections.includes(s.section)));
  const active = visible.some((s) => s.id === step) ? step : visible[0]?.id ?? 'base';
  const index = visible.findIndex((s) => s.id === active);
  const ready = !!descriptor && !!organizerId && !picking;
  const disabled = busy || publicationPending;
  const props = { value: document.settings, onChange: settings, disabled };
  const go = (id: Step) => { setStep(id); setSection(steps.find((s) => s.id === id)!.section); setVisited((old) => new Set([...old, id])); window.scrollTo?.({ top: 0, behavior: 'instant' as ScrollBehavior }); };
  const title = String(read(document.settings, 'event.title') || '') || descriptor?.title || 'Создание события';
  const organizerName = organizers.find((o) => o.id === organizerId)?.name ?? (organizerId ? `#${organizerId}` : 'Не выбран');
  const chooseScenario = (code: string) => {
    const item = catalog?.items.find((x) => x.code === code);
    if (!item) return;
    if (document.scenarioCode === code) { setPicking(false); return; }
    if (document.scenarioCode) scenarioInputs.current.set(document.scenarioCode, structuredClone(document.settings));
    const next = structuredClone(scenarioInputs.current.get(item.code) ?? initialSettings(item));
    next.event = { ...(next.event as Settings), ...((document.settings.event ?? {}) as Settings), gameCode: item.gameCode, disciplineCode: (item.defaults.event as Settings).disciplineCode };
    setVisited(new Set());
    setStep('base');
    setPicking(false);
    update({ ...document, scenarioCode: item.code, settings: next });
  };
  const stepState = (s: (typeof steps)[number]) => {
    const issues = s.id === 'review' ? resolution?.issues ?? [] : resolution?.issues.filter((i) => i.sectionId === s.section) ?? [];
    const checked = visited.has(s.id) && !!resolution;
    if (checked && issues.some((i) => i.severity === 'error')) return { cls: 'is-error', status: 'Нужно исправить или заполнить поля' };
    if (checked && !issues.length && (s.id !== 'review' || resolution?.canPublish)) return { cls: 'is-done', status: 'Раздел заполнен' };
    return { cls: '', status: 'Раздел ещё не проверен' };
  };
  const actions = edit ? (
    <>
      {heading?.extraActions}
      <Button variant="primary" disabled={disabled || loading || (!!edit && !resolution?.canPublish)} onClick={() => void save(false)}>{busy ? 'Сохранение…' : 'Сохранить изменения'}</Button>
    </>
  ) : (
    <>
      {onClose && <Button disabled={disabled} onClick={onClose}>← К событиям</Button>}
      {descriptor && !picking && <Button disabled={disabled} onClick={() => setPicking(true)}>Сменить тип</Button>}
      <Button disabled={disabled || loading || !!draft?.publishedEventId} onClick={() => void save(false)}>Сохранить черновик</Button>
      <Button variant="primary" disabled={busy || loading || (!resolution?.canPublish && !publicationPending) || !catalog || !!draft?.publishedEventId} onClick={() => void save(true)}>{publicationPending ? 'Проверить публикацию' : 'Проверить и опубликовать'}</Button>
    </>
  );

  return (
    <FieldFocus.Provider value={focusPath}>
      <FieldIssues.Provider value={resolution?.issues ?? []}>
        <EditingRestrictions.Provider value={editRestrictions}>
          <FieldCapabilities.Provider value={descriptor}>
            {heading ? <PageHeader title={heading.title} description={heading.description} actions={actions} /> : (
              <PageHeader overline={`Создание события${descriptor ? ' / ' + descriptor.title : ''}`} title={title}
                description={descriptor ? help.program : 'Организатор → тип события → настройки. Доступные варианты определяет сервер с учётом прав и ограничений.'} actions={actions} />
            )}
            {heading?.below}
            <div className="lsr-stack is-tight" style={{ marginBottom: 14 }}>
              {error && <Notice tone="danger" actions={<Button size="sm" onClick={() => setError('')}>Скрыть</Button>}>{error}</Notice>}
              {notice && <Notice tone="neutral" role="status">{notice}</Notice>}
              {editRestrictions?.structureLocked && <Notice tone="warning">Структура события заблокирована сервером: добавлять и удалять недели/этапы нельзя{editRestrictions.scheduleLocked ? ', расписание также заблокировано' : ''}.</Notice>}
            </div>
            {(!descriptor || !organizerId || picking) && !descriptionOnly ? (
              <Picker catalog={catalog} organizers={organizers} organizerId={organizerId} scenarioCode={document.scenarioCode} disabled={disabled || !!edit}
                onOrganizer={(id) => settings(write(document.settings, 'event.organizerId', id))} onScenario={chooseScenario} onCancel={descriptor && organizerId ? () => setPicking(false) : undefined} />
            ) : null}
            {ready && (
              <>
                <div className="lsr-contextbar">
                  <span>Игра: <b>{catalog?.games.find((g) => g.code === descriptor.gameCode)?.title ?? descriptor.gameCode}</b> &nbsp;/&nbsp; Организатор: <b>{organizerName}</b> &nbsp;/&nbsp; Тип: <b>{descriptor.title}</b></span>
                  {!edit && <Button size="sm" disabled={disabled} onClick={() => setPicking(true)}>Изменить</Button>}
                </div>
                <nav className="lsr-steps" aria-label="Разделы конструктора" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0,1fr))` }}>
                  {visible.map((s, i) => {
                    const state = stepState(s);
                    return (
                      <button key={s.id} type="button" className={`${s.id === active ? 'is-active' : ''} ${state.cls}`} aria-current={s.id === active ? 'step' : undefined} title={state.status} onClick={() => go(s.id)}>
                        <span className="lsr-step-num">{state.cls === 'is-done' ? '✓' : state.cls === 'is-error' ? '!' : i + 1}</span>
                        {s.id === 'program' ? programLabel[descriptor.code] ?? s.label : s.label}
                      </button>
                    );
                  })}
                </nav>
                <div className="lsr-cols-settings" style={{ gridTemplateColumns: 'minmax(0,1fr) 285px' }}>
                  <div className="lsr-stack" onChangeCapture={() => setVisited((old) => new Set([...old, active]))}>
                    {loading ? <Panel><LoadingBlock rows={6} label="Загружаем черновик" /></Panel> : (
                      <>
                        {active === 'program' && <ProgramFields {...props} descriptor={descriptor} previewBlocks={resolution?.preview?.blocks} />}
                        {active === 'participants' && <ParticipantFields {...props} descriptor={descriptor} />}
                        {active === 'conditions' && <ConditionsFields {...props} descriptor={descriptor} />}
                        {active === 'base' && (
                          <>
                            <section className="lsr-formgroup">
                              <h3>Основная информация</h3>
                              <p>Игра, организатор и часовой пояс события берутся из выбранного контекста.</p>
                              <Field {...props} disabled={disabled || descriptionOnly} path="event.title" label="Название события" />
                            </section>
                            <section className="lsr-formgroup">
                              <h3>Описание для участников</h3>
                              <p>Описание страницы события: форматирование, ссылки, таблицы и изображения.</p>
                              {document.pendingImages.map((name, i) => (
                                <Notice key={i} tone="warning" actions={<Button size="sm" disabled={disabled || uploads.current.has(name)} onClick={() => {
                                  if (!window.confirm('Отменить незавершённую вставку? Если загрузка ещё идёт, дождитесь её завершения.')) return;
                                  update({ ...document, pendingImages: document.pendingImages.filter((_, n) => n !== i) });
                                }}>Убрать</Button>}>Незавершённая загрузка: {name}. Если файл не загрузился, вставьте его снова.</Notice>
                              ))}
                              <fieldset data-field-path="event.description" disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
                                <RichDescriptionEditor disabled={disabled} value={String(read(document.settings, 'event.description') ?? '')}
                                  onChange={(html) => update({ ...current.current, settings: write(current.current.settings, 'event.description', html) })}
                                  onImagePending={(name, pending, failed) => {
                                    if (pending) uploads.current.add(name); else uploads.current.delete(name);
                                    update({ ...current.current, pendingImages: pending ? [...current.current.pendingImages, name] : failed ? current.current.pendingImages : current.current.pendingImages.filter((item) => item !== name) });
                                  }}
                                  ownerOrganizerId={organizerId} gameCode={descriptor.gameCode} />
                              </fieldset>
                            </section>
                          </>
                        )}
                        {active === 'appearance' && (
                          <section className="lsr-formgroup">
                            <h3>Карточка события</h3>
                            <p>Короткое описание, обложка и оформление карточек на сайте.</p>
                            <EventCardFields displaySchedule={resolution?.preview?.displaySchedule ?? null} value={document.settings} onChange={settings} disabled={disabled || descriptionOnly} scenarioCode={descriptor.code} />
                          </section>
                        )}
                        {active === 'review' && <Review resolution={resolution} go={(section, path) => {
                          const target = steps.find((s) => s.section === section && visible.includes(s));
                          if (target && section !== 'format') go(target.id);
                          setFocusPath(path);
                          requestAnimationFrame(() => {
                            const el = window.document.querySelector<HTMLElement>('[data-field-path="' + CSS.escape(path) + '"]');
                            el?.scrollIntoView?.({ block: 'center' });
                            el?.querySelector<HTMLElement>('input,button,select,textarea')?.focus();
                          });
                        }} />}
                      </>
                    )}
                    <div className="lsr-panel lsr-savebar">
                      <span className="lsr-muted">{visible[index]?.label} · {resolution ? (resolution.canPublish ? 'проверка пройдена' : `замечаний: ${resolution.issues.length}`) : 'проверяем на сервере…'}</span>
                      <div className="lsr-hstack" style={{ gap: 8 }}>
                        <Button disabled={index <= 0} onClick={() => go(visible[index - 1].id)}>← Назад</Button>
                        {index < visible.length - 1 ? <Button variant="primary" onClick={() => go(visible[index + 1].id)}>Продолжить →</Button>
                          : edit ? <Button variant="primary" disabled={disabled || !resolution?.canPublish} onClick={() => void save(false)}>Сохранить изменения</Button>
                          : <Button variant="primary" disabled={busy || loading || (!resolution?.canPublish && !publicationPending) || !!draft?.publishedEventId} onClick={() => void save(true)}>Опубликовать</Button>}
                      </div>
                    </div>
                  </div>
                  <aside className="lsr-stack lsr-sticky">
                    <Panel title={edit ? 'Сводка изменений' : 'Сводка черновика'}>
                      <table className="lsr-quicklist"><tbody>
                        <tr><td>Тип</td><td>{descriptor.title}</td></tr>
                        <tr><td>Организатор</td><td>{organizerName}</td></tr>
                        <tr><td>Игра</td><td>{catalog?.games.find((g) => g.code === descriptor.gameCode)?.title ?? descriptor.gameCode}</td></tr>
                        {descriptor.code === 'weekly' && <tr><td>Недель</td><td>{((read(document.settings, 'weekly.weeks') as unknown[]) ?? []).length}</td></tr>}
                        {descriptor.code === 'weekly' && <tr><td>Запусков / неделю</td><td>{Object.values((read(document.settings, 'weekly.dayTimes') ?? {}) as Record<string, string[]>).reduce((n, l) => n + l.length, 0)}</td></tr>}
                        {descriptor.code === 'championship' && <tr><td>Этапов</td><td>{((read(document.settings, 'stages') as unknown[]) ?? []).length}</td></tr>}
                        <tr><td>Блоков по расчёту</td><td>{resolution?.preview ? resolution.preview.blocks.length : '—'}</td></tr>
                      </tbody></table>
                    </Panel>
                    <Panel title="Как заполнить">
                      <div className="lsr-mutedline" style={{ fontSize: 13 }}>{help[active]}</div>
                      {resolution?.preview && resolution.preview.blocks.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div className="lsr-eyebrow" style={{ marginBottom: 6 }}>Расчёт по настройкам</div>
                          {resolution.preview.blocks.slice(0, 3).map((b) => <div key={b.key} className="lsr-mutedline">{b.title}: {new Date(b.schedule.startsAt).toLocaleString('ru-RU')}{b.requiredServers > 0 ? ` · серверов: ${b.requiredServers}` : ''}</div>)}
                          {resolution.preview.blocks.length > 3 && <div className="lsr-mutedline">Всего блоков: {resolution.preview.blocks.length}. Полный календарь — в «Проверке».</div>}
                        </div>
                      )}
                      {resolution?.issues.filter((i) => i.sectionId === visible[index]?.section).map((issue, i) => (
                        <div key={i} style={{ marginTop: 8 }}><Notice tone={issue.severity === 'error' ? 'danger' : 'warning'}>{issue.message}</Notice></div>
                      ))}
                    </Panel>
                  </aside>
                </div>
              </>
            )}
          </FieldCapabilities.Provider>
        </EditingRestrictions.Provider>
      </FieldIssues.Provider>
    </FieldFocus.Provider>
  );
}

type Catalog = NonNullable<ReturnType<typeof useScenarioBuilder>['catalog']>;
function Picker({ catalog, organizers, organizerId, scenarioCode, disabled, onOrganizer, onScenario, onCancel }: { catalog: Catalog | null; organizers: { id: string; name: string }[]; organizerId: string; scenarioCode: string | null; disabled: boolean; onOrganizer: (id: string) => void; onScenario: (code: string) => void; onCancel?: () => void }) {
  if (!catalog) return <Panel><LoadingBlock rows={4} label="Загружаем доступные сценарии" /></Panel>;
  return (
    <div className="lsr-stack">
      <section className="lsr-formgroup">
        <h3>1. Организатор</h3>
        <p>Игра: {catalog.games.map((g) => g.title).join(', ')}. Организатор определяет лимиты и доступные типы событий.</p>
        {organizers.length ? (
          <div className="lsr-cards-inline" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }} data-field-path="event.organizerId">
            {organizers.map((o) => (
              <button key={o.id} type="button" disabled={disabled} className={`lsr-item-line is-clickable${o.id === organizerId ? ' is-active' : ''}`} style={{ background: o.id === organizerId ? undefined : '#fff', textAlign: 'left' }} aria-pressed={o.id === organizerId} onClick={() => onOrganizer(o.id)}>
                <span><b>{o.name}</b><div className="lsr-mutedline">ID {o.id}</div></span><span className="lsr-chev">{o.id === organizerId ? '✓' : '›'}</span>
              </button>
            ))}
          </div>
        ) : <EmptyState compact>Нет доступных организаторов.</EmptyState>}
      </section>
      {organizerId && (
        <section className="lsr-formgroup">
          <h3>2. Тип события</h3>
          <p>Доступные сценарии и причины недоступности приходят с сервера.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 10 }} data-field-path="scenarioCode">
            {catalog.items.map((item) => (
              <button key={item.code} type="button" disabled={disabled || !item.enabled} title={item.reason ?? undefined} className={`lsr-item-line is-clickable${item.code === scenarioCode ? ' is-active' : ''}`} style={{ background: item.code === scenarioCode ? undefined : '#fff', textAlign: 'left', alignItems: 'flex-start' }} aria-pressed={item.code === scenarioCode} onClick={() => onScenario(item.code)}>
                <span><b>{item.title}</b><div className="lsr-mutedline">{item.enabled ? 'Выбрать тип →' : item.reason}</div></span>
              </button>
            ))}
          </div>
          {onCancel && <div style={{ marginTop: 12 }}><Button onClick={onCancel}>Отмена</Button></div>}
        </section>
      )}
    </div>
  );
}

function Review({ resolution, go }: { resolution: Resolution | null; go: (section: string, path: string) => void }) {
  if (!resolution) return <Panel title="Проверка"><LoadingBlock rows={3} label="Проверяем текущую конфигурацию" /></Panel>;
  const fmt = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('ru-RU') : '—');
  return (
    <div className="lsr-stack">
      <Panel title="Замечания проверки">
        {resolution.issues.length ? (
          <div className="lsr-stack is-tight">
            {resolution.issues.map((issue, i) => (
              <Notice key={i} tone={issue.severity === 'error' ? 'danger' : 'warning'}><button type="button" className="lsr-link" style={{ color: 'inherit', whiteSpace: 'normal' }} onClick={() => go(issue.sectionId, issue.path)}>{issue.message}</button></Notice>
            ))}
          </div>
        ) : resolution.canPublish ? <Notice>Конфигурация готова к публикации.</Notice> : <div className="lsr-mutedline">Замечаний нет.</div>}
        {resolution.warnings?.map((w) => <div key={w.code} style={{ marginTop: 8 }}><Notice tone="warning">{w.message ?? w.code}</Notice></div>)}
      </Panel>
      <Panel title="Программа события" body={false}>
        {resolution.preview?.blocks.length ? (
          <div className="lsr-tablewrap"><table className="lsr-table"><thead><tr><th>Блок</th><th>Старт</th><th>Окончание (оценка)</th><th>Серверов</th></tr></thead><tbody>
            {resolution.preview.blocks.map((b) => <tr key={b.key}><td className="lsr-primary">{b.title}</td><td className="lsr-num">{fmt(b.schedule.startsAt)}</td><td className="lsr-num">{b.schedule.estimatedEndsAt ? fmt(b.schedule.estimatedEndsAt) : 'до завершения'}</td><td className="lsr-num">{b.requiredServers || '—'}</td></tr>)}
          </tbody></table></div>
        ) : <EmptyState compact>Предпросмотр расписания не сформирован.</EmptyState>}
      </Panel>
      {!!resolution.preview?.registrations?.length && (
        <Panel title="Регистрация" body={false}>
          <div className="lsr-rows">{resolution.preview.registrations.map((r, i) => <div className="lsr-row-item" key={r.key}><div><b>Регистрация {i + 1}{r.config.capacity !== null ? ` · мест: ${r.config.capacity}` : ''}</b><small>Открытие: {r.config.opensAt ? fmt(r.config.opensAt) : 'без ограничений'} · закрытие: {fmt(r.config.closesAt)}</small></div></div>)}</div>
        </Panel>
      )}
    </div>
  );
}
