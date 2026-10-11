import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasPlatformPermission } from '../../shared/access';
import { apiFetch } from '../../shared/api';
import { hasAny } from '../../shared/format';
import { useRealtimeRefresh } from '../../shared/realtime';
import type { AccessOrganizer, AdminAccess, PublicationDetails } from '../../shared/types';
import {
  Button, EmptyState, ErrorState, Kpis, LoadingBlock, PageHeader, Panel, PillButtons, SearchInput, StatusBadge, Table, TableFoot, Tabs, Toolbar,
  clickableRow, dateTime, usePageChrome,
} from '../../ui/v16';
import { PlacementOrder } from './PlacementOrder';
import { PublicationEditor } from './PublicationEditor';
import {
  kindLabel, livePlacements, organizerName, placementDefinition, publicationStatus, toLoadError, type LoadError,
} from './siteModel';
import './site.v16.css';

type Filter = 'all' | 'published' | 'scheduled' | 'draft';
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Все' }, { value: 'published', label: 'Опубликованы' }, { value: 'scheduled', label: 'Запланированы' }, { value: 'draft', label: 'Черновики' },
];
type Page = { items: PublicationDetails[]; nextAfterId: string | null };

export function SitePage({ access }: { access: AdminAccess }) {
  const location = useLocation();
  const editorPath = location.pathname.startsWith('/site/') ? location.pathname.slice('/site/'.length).split('/')[0] : '';
  const [items, setItems] = useState<PublicationDetails[] | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [loading, setLoading] = useState(false);
  const [organizers, setOrganizers] = useState<AccessOrganizer[]>([]);
  const generation = useRef(0);

  // The list API is cursor-paginated but has no search/status filters, so the client reads every page
  // (search, status filters, KPIs and slide titles work on the complete set).
  const load = useCallback(async () => {
    const revision = ++generation.current;
    setLoading(true);
    try {
      const all: PublicationDetails[] = [];
      let after: string | null = null;
      do {
        const page: Page = await apiFetch<Page>(`/admin/publications?limit=100${after ? `&afterId=${encodeURIComponent(after)}` : ''}`);
        all.push(...page.items);
        after = page.nextAfterId;
      } while (after);
      if (revision !== generation.current) return;
      setItems(all); setError(null);
    } catch (e) {
      if (revision === generation.current) setError(toLoadError(e));
    } finally {
      if (revision === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void apiFetch<AccessOrganizer[]>('/admin/access/organizers').then(setOrganizers).catch(() => setOrganizers([]));
  }, [load]);
  useRealtimeRefresh(['publications'], () => load());

  if (editorPath) {
    if (editorPath === 'new') return <PublicationEditor key="new" access={access} item={null} latest={null} organizers={organizers} onSaved={load} />;
    const item = items?.find(({ entry }) => entry.id === editorPath) ?? null;
    if (item) return <EditorHost key={editorPath} access={access} item={item} latest={item} organizers={organizers} onSaved={load} />;
    return <EditorState loading={!items && !error} error={error} retry={load} />;
  }
  return <PublicationList access={access} items={items} error={error} loading={loading} organizers={organizers} reload={load} />;
}

/** Keeps the publication that opened the form; later list refreshes only feed the version-change notice. */
function EditorHost(props: Parameters<typeof PublicationEditor>[0]) {
  const [initial] = useState(props.item);
  return <PublicationEditor {...props} item={initial} />;
}

function EditorState({ loading, error, retry }: { loading: boolean; error: LoadError | null; retry: () => void }) {
  const navigate = useNavigate();
  usePageChrome({ back: { label: 'Публикации', to: '/site' }, crumbs: [{ label: 'Сайт и публикации', to: '/site' }, { label: 'Публикация' }] });
  if (loading) return <Panel><LoadingBlock rows={6} label="Загрузка публикации" /></Panel>;
  if (error) return <ErrorState error={error.message} status={error.status} onRetry={retry} />;
  return <EmptyState title="Публикация не найдена" action={<Button onClick={() => navigate('/site')}>← К публикациям</Button>}>Возможно, она удалена или ссылка устарела.</EmptyState>;
}

function PublicationList({ access, items, error, loading, organizers, reload }: {
  access: AdminAccess; items: PublicationDetails[] | null; error: LoadError | null; loading: boolean; organizers: AccessOrganizer[]; reload: () => Promise<void>;
}) {
  usePageChrome({ crumbs: [{ label: 'Сайт и публикации' }] });
  const navigate = useNavigate();
  const canReorder = hasPlatformPermission(access, 'publications.reorder.all');
  const canCreate = hasAny(access, ['news.write.all', 'news.write.scoped', 'catalog.manage.all']);
  const [tab, setTab] = useState<'publications' | 'order'>('publications');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const all = useMemo(() => items ?? [], [items]);
  const count = (status: string) => all.filter((item) => item.entry.status === status).length;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((item) => (filter === 'all' || item.entry.status === filter) && (!q || [
      item.revision.title, item.revision.summary, item.entry.slug, item.entry.id,
      ...livePlacements(item).map((p) => `${placementDefinition(p.placementCode)?.group ?? ''} ${placementDefinition(p.placementCode)?.label ?? p.placementCode}`),
    ].join(' ').toLowerCase().includes(q)));
  }, [all, filter, query]);

  return (
    <>
      <PageHeader overline="Администрирование" title="Сайт и публикации" description="Редакция, размещения и расписание публикаций"
        actions={<>
          <Button disabled={loading} onClick={() => void reload()}>{loading ? 'Обновление…' : 'Обновить'}</Button>
          {canCreate && <Button variant="primary" onClick={() => navigate('/site/new')}>+ Создать публикацию</Button>}
        </>} />
      <Kpis items={[
        { label: 'Всего материалов', value: items ? all.length : '—' },
        { label: 'Опубликовано', value: items ? count('published') : '—' },
        { label: 'Запланировано', value: items ? count('scheduled') : '—' },
        { label: 'Черновики', value: items ? count('draft') : '—' },
      ]} />
      <Tabs variant="module" label="Разделы сайта" value={tab} onChange={setTab} items={[{ key: 'publications', label: 'Публикации' }, { key: 'order', label: 'Порядок слайдов', hidden: !canReorder }]} />
      {tab === 'order' && canReorder ? (
        items ? <PlacementOrder items={all} onSaved={reload} /> : error ? <ErrorState error={error.message} status={error.status} onRetry={() => void reload()} /> : <Panel><LoadingBlock rows={4} /></Panel>
      ) : (
        <Panel title="Материалы сайта" body={false}>
          <Toolbar>
            <SearchInput wide value={query} onChange={setQuery} placeholder="Название, описание или размещение" />
            <PillButtons label="Статус публикации" value={filter} onChange={setFilter} options={filters} />
          </Toolbar>
          {items && error && <div className="lsr-panel-body"><ErrorState error={error.message} status={error.status} onRetry={() => void reload()} compact /></div>}
          {!items ? (
            error ? <div className="lsr-panel-body"><ErrorState error={error.message} status={error.status} onRetry={() => void reload()} compact /></div> : <div className="lsr-panel-body"><LoadingBlock rows={5} label="Загрузка публикаций" /></div>
          ) : !all.length ? (
            <EmptyState title="Публикаций пока нет" action={canCreate ? <Button variant="primary" onClick={() => navigate('/site/new')}>+ Создать публикацию</Button> : undefined}>Создайте материал и выберите, где он появится на сайте.</EmptyState>
          ) : !rows.length ? (
            <EmptyState compact title="Ничего не найдено">Измените запрос или фильтр статуса.</EmptyState>
          ) : (
            <>
              <Table variant="module" label="Публикации">
                <thead><tr><th>Публикация</th><th>Размещение</th><th>Организатор</th><th>Начало</th><th>Статус</th></tr></thead>
                <tbody>
                  {rows.map((item) => {
                    const status = publicationStatus(item);
                    const places = livePlacements(item).filter((p) => p.enabled);
                    return (
                      <tr key={item.entry.id} {...clickableRow(() => navigate(`/site/${item.entry.id}`))}>
                        <td><div className="lsr-primary">{item.revision.title || item.entry.slug}</div><div className="lsr-minor">{kindLabel(item.entry.publicationKind)} · {item.entry.slug}</div></td>
                        <td>{places.length ? places.map((p) => placementDefinition(p.placementCode)?.short ?? p.placementCode).join(' · ') : '—'}</td>
                        <td>{organizerName(item.entry.accessOrganizerId, organizers)}</td>
                        <td className="lsr-nowrap">{dateTime(item.entry.scheduledPublishAt ?? item.entry.publishedAt)}</td>
                        <td><StatusBadge variant="badge" status={status.status} tone={status.tone} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <TableFoot><span>Показано {rows.length} из {all.length}</span><span>Строка открывает редактор публикации</span></TableFoot>
            </>
          )}
        </Panel>
      )}
    </>
  );
}
