import { useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import { useDebouncedValue } from '../../shared/ui';
import type { PublicEvent } from '../../../../shared/public-event';
import { eventCardSource } from '../events/current/EventCardFields';
import type { EventSummary } from '../events/current/event-api';
import { scenarioLabel, useOrganizerNames } from '../events/current/event-labels';
import {
  Button, EmptyState, ErrorState, LoadMore, LoadingBlock, Notice, PageHeader, Panel, SearchInput, StatusBadge, Table, TableFoot, TextLink, Toolbar,
  clickableRow, usePageChrome,
} from '../../ui/v16';
import { EventCardStudioPanel, PublicEventCardPreview } from './EventCardStudio';
import { normalizeEventCardStudioConfig } from './eventCardConfig';
import './card-studio.v16.css';

type Page = { items: EventSummary[]; nextAfterId: string | null };
const editorLink = (id: string) => `/events/${encodeURIComponent(id)}?section=appearance`;

/**
 * Catalog of public event cards. The card appearance lives in event.presentation and is edited on the event
 * («Внешний вид»); this page lists events, shows their saved cards and links to that editor — no parallel configuration.
 */
export function EventCardStudioPage() {
  usePageChrome({ crumbs: [{ label: 'Оформление карточек' }] });
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const [items, setItems] = useState<EventSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; status: number | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allTemplates, setAllTemplates] = useState(false);
  const generation = useRef(0);
  const organizers = useOrganizerNames();

  async function load(more = false) {
    const revision = ++generation.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20', view: 'list' });
      if (q) params.set('q', q);
      if (more && cursor) params.set('afterId', cursor);
      const page = await apiFetch<Page>('/admin/events?' + params);
      if (revision !== generation.current) return;
      setItems((old) => (more && old ? [...old, ...page.items] : page.items));
      setCursor(page.nextAfterId);
      setError(null);
    } catch (e) {
      if (revision === generation.current) setError({ message: e instanceof ApiError && e.status === 403 ? 'Недостаточно прав для просмотра событий.' : e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : null });
    } finally {
      if (revision === generation.current) setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeRefresh(['events'], () => load());

  const selected = items?.find((item) => item.id === selectedId) ?? items?.[0] ?? null;
  const config = selected ? normalizeEventCardStudioConfig(selected.presentation?.cardAppearance) : null;
  const source = selected ? eventCardSource(selected as unknown as PublicEvent) : null;

  return (
    <>
      <PageHeader overline="Администрирование" title="Оформление карточек" description="Карточки событий на сайте и переход к их редактору" />
      <div className="lsr-cards-intro">
        <Notice>Редактор карточки встроен во вкладку «Внешний вид» конкретного события. Здесь — каталог карточек для быстрого доступа к оформлению, без второй параллельной конфигурации.</Notice>
      </div>
      <Panel title="Карточки событий" body={false}>
        <Toolbar>
          <SearchInput wide value={query} onChange={setQuery} placeholder="Название события или ID" />
        </Toolbar>
        {items && error && <div className="lsr-panel-body"><ErrorState error={error.message} status={error.status} onRetry={() => void load()} compact /></div>}
        {!items ? (
          error ? <div className="lsr-panel-body"><ErrorState error={error.message} status={error.status} onRetry={() => void load()} compact /></div> : <div className="lsr-panel-body"><LoadingBlock rows={5} label="Загрузка событий" /></div>
        ) : !items.length ? (
          <EmptyState compact title={q ? 'Ничего не найдено' : 'Событий пока нет'}>{q ? 'Измените запрос.' : 'Карточки появятся, когда будут созданы события.'}</EmptyState>
        ) : (
          <>
            <Table variant="module" label="Карточки событий">
              <thead><tr><th>Событие</th><th>Тип</th><th>Организатор</th><th>Оформление</th><th><span className="lsr-hide-sm">Редактор</span></th></tr></thead>
              <tbody>
                {items.map((item) => {
                  const custom = Boolean(item.presentation?.cardAppearance);
                  return (
                    <tr key={item.id} {...clickableRow(() => setSelectedId(item.id), item.id === selected?.id ? 'is-current' : '')} aria-selected={item.id === selected?.id}>
                      <td><div className="lsr-primary">{item.title}</div><div className="lsr-minor">ID {item.id}</div></td>
                      <td>{scenarioLabel(item.scenarioCode, item.scenarioTitle)}</td>
                      <td>{organizers[item.organizerId] ?? (item.organizerId ? `Организатор #${item.organizerId}` : '—')}</td>
                      <td><StatusBadge variant="badge" status={{ code: custom ? 'CUSTOM' : 'DEFAULT', label: custom ? 'Собственное' : 'Стандартное' }} tone={custom ? 'live' : 'scheduled'} /></td>
                      <td><TextLink to={editorLink(item.id)} label={`Открыть редактор карточки: ${item.title}`}>Открыть редактор →</TextLink></td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <LoadMore hasMore={!!cursor} busy={loading} onClick={() => void load(true)} />
            <TableFoot><span>Показано {items.length}{cursor ? '+' : ''}</span><span>Строка показывает карточку в предпросмотре</span></TableFoot>
          </>
        )}
      </Panel>

      <div className="lsr-cols-module lsr-cards-bottom">
        <Panel title="Где настраивается карточка" body={false}>
          <div className="lsr-panel-body"><p className="lsr-cards-lede">Обложка, подзаголовок, скрываемые элементы, типографика и цвета редактируются в рамках события и сохраняются вместе с его настройками. Это предотвращает рассинхронизацию внешнего вида.</p></div>
          <div className="lsr-rows">
            <div className="lsr-row-item"><div><b>Вкладка «Внешний вид» события</b><small>event.presentation: coverUrl, subtitle, cardAppearance</small></div>{selected && <TextLink to={editorLink(selected.id)}>Открыть →</TextLink>}</div>
            <div className="lsr-row-item"><div><b>Каталог событий на сайте</b><small>Карточка в сетке страницы событий</small></div><span className="lsr-small-tag">публичный сайт</span></div>
            <div className="lsr-row-item"><div><b>Главная страница</b><small>Карточка в блоке ближайших событий</small></div><span className="lsr-small-tag">публичный сайт</span></div>
          </div>
        </Panel>
        <Panel title="Предпросмотр" sub={selected ? selected.title : undefined}
          actions={selected ? <Button size="sm" variant={allTemplates ? 'soft' : 'default'} aria-pressed={allTemplates} onClick={() => setAllTemplates((v) => !v)}>Все шаблоны</Button> : undefined}
          foot="Рендер публичного сайта (VITE_SITE_URL) с сохранённым оформлением события; без запущенного сайта область остаётся пустой.">
          {!items ? <LoadingBlock rows={3} /> : !selected || !source || !config ? <EmptyState compact>Выберите событие в таблице.</EmptyState> : (
            <div className={`lsr-cards-mini is-${config.previewTheme}`}>
              <PublicEventCardPreview variant="events" source={source} config={config} modes={[source.eventMode]} compact publicEvent={source.publicEvent} />
            </div>
          )}
        </Panel>
      </div>

      {allTemplates && selected && source && config && (
        <div className="lsr-cards-templates">
          <Panel title={`Все шаблоны карточек · ${selected.title}`} sub="Сохранённое оформление события в каждом шаблоне сайта. Только просмотр — изменения вносятся в редакторе события."
            actions={<TextLink to={editorLink(selected.id)}>Открыть редактор →</TextLink>}>
            <EventCardStudioPanel key={selected.id} source={source} value={config} title="Шаблоны на сайте" showAllTemplates showEditor={false} publicEvent={source.publicEvent} />
          </Panel>
        </div>
      )}
    </>
  );
}
