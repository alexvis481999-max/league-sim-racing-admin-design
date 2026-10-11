import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../shared/api';
import { useRealtimeRefresh } from '../../shared/realtime';
import type { AccessOrganizer, CatalogItem } from '../../shared/types';
import { useDebouncedValue } from '../../shared/ui';
import { Button, EmptyState, ErrorState, Panel, SearchInput, Skeleton, StatusBadge, Table, TableFoot, clickableRow, shortDateTime } from '../../ui/v16';
import { catalogActorLabel } from './catalogActor';
import { loadError, type LoadError } from './catalogData';
import {
  GAME_LABELS, catalogItemImageUrl, isGameTag, itemInfo, itemProblem, ownerLabel, statusLike, statusTone, toggleFilterTag, usageLabel,
  type CarBrand, type CatalogPage, type KindDef,
} from './catalogModel';
import { ChipFilter, InlineTags, Thumb } from './catalogUi';

const PAGE_SIZE = 40;
const GAME_FILTERS = [{ value: '', label: 'Все игры' }, { value: 'ac', label: 'AC' }, { value: 'acc', label: 'ACC' }, { value: 'iracing', label: 'iRacing' }] as const;

type Props = {
  def: KindDef;
  search: string;
  onSearch: (value: string) => void;
  tags: string[];
  onTags: (value: string[]) => void;
  tagOptions: string[];
  organizerById: Map<string, AccessOrganizer>;
  brandByCode: Map<string, CarBrand>;
  onCreate: () => void;
};

/** Paged list of one catalogue kind: `GET /admin/catalog/items?kind=…&search=…&tags=…&afterId=…`. */
export function CatalogItemsPanel({ def, search, onSearch, tags, onTags, tagOptions, organizerById, brandByCode, onCreate }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(search);
  const debounced = useDebouncedValue(query.trim());
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [nextAfterId, setNextAfterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const generation = useRef(0);
  const tagKey = tags.join(',');

  useEffect(() => { setQuery(search); }, [search]);
  const latest = useRef({ search, onSearch });
  useEffect(() => { latest.current = { search, onSearch }; });
  // Only a new debounced draft commits the search; an external change of `search` must not be overwritten by a stale draft.
  useEffect(() => { if (debounced !== latest.current.search) latest.current.onSearch(debounced); }, [debounced]);

  const load = useCallback(async (after?: string, silent = false) => {
    const revision = ++generation.current;
    if (!silent) { setLoading(true); if (!after) setItems([]); }
    const params = new URLSearchParams({ kind: def.kind, limit: String(PAGE_SIZE) });
    if (after) params.set('afterId', after);
    if (search.trim()) params.set('search', search.trim());
    if (tagKey) params.set('tags', tagKey);
    try {
      const data = await apiFetch<CatalogPage<CatalogItem>>(`/admin/catalog/items?${params}`);
      if (revision !== generation.current) return;
      setItems((old) => (after ? [...old, ...data.items] : data.items));
      setNextAfterId(data.nextAfterId);
      setError(null);
    } catch (caught) {
      if (revision === generation.current) setError(loadError(caught));
    } finally {
      if (revision === generation.current) setLoading(false);
    }
  }, [def.kind, search, tagKey]);

  useEffect(() => { void load(); const counter = generation; return () => { counter.current++; }; }, [load]);
  useRealtimeRefresh(['catalog'], () => load(undefined, true));

  const game = tags.find(isGameTag) ?? '';
  const extraOptions = useMemo(() => tagOptions.filter((tag) => !isGameTag(tag)), [tagOptions]);
  const selectedExtra = tags.filter((tag) => !isGameTag(tag));
  const filtered = !!search || tags.length > 0;
  const open = (item: CatalogItem) => navigate(`/media-catalog/item/${encodeURIComponent(item.id)}?kind=${def.kind}`, { state: { item } });

  return (
    <Panel title={`Материалы · ${def.label}`} body={false} shadow>
      <div className="lsr-toolbar lsr-cat-toolbar">
        <SearchInput value={query} onChange={setQuery} onCommit={(value) => onSearch(value)} placeholder="Название или код" label="Поиск материалов" wide />
        <ChipFilter label="Игра" value={game} options={GAME_FILTERS} onChange={(value) => onTags([...tags.filter((tag) => !isGameTag(tag)), ...(value ? [value] : [])])} />
      </div>
      {(extraOptions.length > 0 || selectedExtra.length > 0) && (
        <div className="lsr-cat-tagbar" role="group" aria-label="Теги">
          <span>Теги</span>
          {[...new Set([...selectedExtra, ...extraOptions])].slice(0, 30).map((tag) => (
            <button key={tag} type="button" className={`lsr-cat-chip is-sm${tags.includes(tag) ? ' is-active' : ''}`} aria-pressed={tags.includes(tag)} onClick={() => onTags(toggleFilterTag(tags, tag))}>{tag}</button>
          ))}
          {selectedExtra.length > 0 && <Button size="sm" variant="plain" onClick={() => onTags(tags.filter(isGameTag))}>Сбросить теги</Button>}
        </div>
      )}
      {error && !loading && <div className="lsr-panel-body"><ErrorState error={error.message} status={error.status} onRetry={() => void load()} /></div>}
      {!error && !loading && !items.length && (
        <EmptyState title={filtered ? 'Ничего не найдено' : `${def.label}: материалов пока нет`} action={filtered ? undefined : <Button variant="primary" onClick={onCreate}>＋ Добавить первый материал</Button>}>
          {filtered ? 'Измените поиск, игру или теги.' : 'Добавьте первый материал этого типа.'}
        </EmptyState>
      )}
      {(loading || items.length > 0) && !(error && !items.length) && (
        <Table variant="module" label={`Материалы · ${def.label}`}>
          <thead>
            <tr><th>Название</th><th>Код / ID</th><th className="lsr-hide-sm">Владелец</th><th className="lsr-hide-md">Использование</th><th className="lsr-hide-md">Добавил · обновлено</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {loading && !items.length && Array.from({ length: 6 }, (_, i) => (
              <tr key={i} aria-hidden="true"><td><Skeleton width="55%" height={14} /><Skeleton width="35%" height={11} style={{ marginTop: 6 }} /></td><td><Skeleton width={110} height={12} /></td><td className="lsr-hide-sm"><Skeleton width={90} height={12} /></td><td className="lsr-hide-md"><Skeleton width={80} height={12} /></td><td className="lsr-hide-md"><Skeleton width={120} height={12} /></td><td><Skeleton width={74} height={22} /></td></tr>
            ))}
            {items.map((item) => <ItemRow key={item.id} item={item} def={def} organizerById={organizerById} brandByCode={brandByCode} onOpen={() => open(item)} />)}
          </tbody>
        </Table>
      )}
      {items.length > 0 && (
        <TableFoot>
          <span>Показано {items.length}{nextAfterId ? '+' : ''}</span>
          {nextAfterId && <Button size="sm" disabled={loading} onClick={() => void load(nextAfterId)}>{loading ? 'Загрузка…' : 'Показать ещё'}</Button>}
        </TableFoot>
      )}
    </Panel>
  );
}

function ItemRow({ item, def, organizerById, brandByCode, onOpen }: { item: CatalogItem; def: KindDef; organizerById: Map<string, AccessOrganizer>; brandByCode: Map<string, CarBrand>; onOpen: () => void }) {
  const info = itemInfo(item, brandByCode);
  const problem = itemProblem(item);
  const visibleTags = item.tags.filter((tag) => !isGameTag(tag));
  const gameTags = item.tags.filter(isGameTag).map((tag) => GAME_LABELS[tag]);
  return (
    <tr {...clickableRow(onOpen)} aria-label={`Открыть ${item.title}`}>
      <td>
        <div className="lsr-cat-name">
          {def.kind === 'photo' && <Thumb src={catalogItemImageUrl(item)} alt="" />}
          <div style={{ minWidth: 0 }}>
            <b>{item.title}</b><InlineTags tags={[...gameTags, ...visibleTags]} />
            <div className="lsr-cat-mute">{info || '—'}</div>
          </div>
        </div>
      </td>
      <td><span className="lsr-cat-code">{item.code}</span></td>
      <td className="lsr-hide-sm">{ownerLabel(item, organizerById)}</td>
      <td className="lsr-hide-md lsr-cat-usage">
        {item.usages?.length
          ? <><div className="lsr-cat-ellipsis" title={item.usages.map((usage) => `${usageLabel(usage.usageType)}: ${usage.targetTitle}`).join(', ')}>{usageLabel(item.usages[0].usageType)}: {item.usages[0].targetTitle}</div>{item.usages.length > 1 && <div className="lsr-cat-mute">и ещё {item.usages.length - 1}</div>}</>
          : <span className="lsr-sub">Не используется</span>}
      </td>
      <td className="lsr-hide-md">{catalogActorLabel(item)}<div className="lsr-cat-mute">{shortDateTime(item.updatedAt)}</div></td>
      <td>
        <div className="lsr-cat-status">
          <StatusBadge status={statusLike(item.status)} tone={statusTone(item.status)} variant="badge" />
          {problem && <StatusBadge status={{ code: 'PROBLEM', label: problem.label }} tone="failed" variant="badge" title={problem.title} />}
        </div>
      </td>
    </tr>
  );
}
