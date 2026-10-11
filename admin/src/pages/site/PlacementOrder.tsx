import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../shared/api';
import type { PublicationDetails, PublicationPlacementCode } from '../../shared/types';
import { Button, ErrorState, LoadingBlock, Notice, Panel, StatusBadge } from '../../ui/v16';
import { isSliderPlacement } from './publicationForm';
import { errorText, placementDefinitions, placementTitle, publicationStatus, toLoadError, usePublicationCommands, type LoadError } from './siteModel';

type OrderState = { ids: string[]; saved: string[]; version: number | undefined; loading: boolean; error: LoadError | null; saveError: string; saving: boolean };
const sliders = placementDefinitions.filter(({ code }) => isSliderPlacement(code));

/** Slide order is a separate versioned configuration per placement code (GET/POST /admin/publications/placements/{code}/order). */
export function PlacementOrder({ items, onSaved }: { items: PublicationDetails[]; onSaved: () => Promise<void> }) {
  const command = usePublicationCommands();
  const [orders, setOrders] = useState<Partial<Record<PublicationPlacementCode, OrderState>>>({});
  const byId = useMemo(() => new Map(items.map((item) => [item.entry.id, item])), [items]);
  const patch = (code: PublicationPlacementCode, value: Partial<OrderState>) => setOrders((current) => ({ ...current, [code]: { ...(current[code] ?? { ids: [], saved: [], version: undefined, loading: true, error: null, saveError: '', saving: false }), ...value } }));

  function load(code: PublicationPlacementCode, active: () => boolean = () => true) {
    patch(code, { loading: true, error: null });
    apiFetch<{ ids: string[]; version: number }>(`/admin/publications/placements/${code}/order`)
      .then((order) => { if (active()) patch(code, { ids: order.ids, saved: order.ids, version: order.version, loading: false }); })
      .catch((error) => { if (active()) patch(code, { loading: false, error: toLoadError(error) }); });
  }

  useEffect(() => {
    let alive = true;
    sliders.forEach(({ code }) => load(code, () => alive));
    return () => { alive = false; };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (code: PublicationPlacementCode, index: number, direction: -1 | 1) => {
    const ids = [...(orders[code]?.ids ?? [])]; const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    patch(code, { ids });
  };

  async function save(code: PublicationPlacementCode) {
    const order = orders[code];
    if (!order) return;
    patch(code, { saving: true, saveError: '' });
    try {
      await command(`/admin/publications/placements/${code}/order`, { expectedVersion: order.version, ids: order.ids });
      patch(code, { saving: false });
      await onSaved();
    } catch (error) {
      patch(code, { saving: false, saveError: errorText(error) });
    }
  }

  return (
    <div className="lsr-stack">
      {sliders.map(({ code }) => {
        const order = orders[code];
        const dirty = !!order && order.ids.join() !== order.saved.join();
        return (
          <Panel key={code} title={placementTitle(code)} body={false}
            actions={order && !order.loading && !order.error ? <>
              {dirty && <Button size="sm" variant="plain" disabled={order.saving} onClick={() => patch(code, { ids: order.saved })}>Отменить</Button>}
              <Button size="sm" variant="primary" disabled={!dirty || order.saving} onClick={() => void save(code)}>{order.saving ? 'Сохранение…' : 'Сохранить порядок'}</Button>
            </> : undefined}>
            <div className="lsr-panel-body" style={{ paddingBottom: 6 }}>
              <Notice>Порядок хранится в отдельной конфигурации размещения и сохраняется с проверкой версии. Показаны опубликованные материалы этого блока.</Notice>
              {order?.saveError && <div style={{ marginTop: 10 }}><Notice tone="danger">{order.saveError}</Notice></div>}
            </div>
            {!order || order.loading ? <div className="lsr-panel-body"><LoadingBlock rows={3} label="Загрузка порядка" /></div>
              : order.error ? <div className="lsr-panel-body"><ErrorState error={order.error.message} status={order.error.status} onRetry={() => load(code)} compact /></div>
              : !order.ids.length ? <div className="lsr-panel-body"><span className="lsr-muted">В этом блоке пока нет опубликованных материалов.</span></div>
              : (
                <ol className="lsr-site-order" aria-label={`Порядок: ${placementTitle(code)}`}>
                  {order.ids.map((id, index) => {
                    const item = byId.get(id);
                    const status = item ? publicationStatus(item) : null;
                    return (
                      <li key={id} className="lsr-row-item">
                        <div style={{ minWidth: 0 }}>
                          <b>{index + 1}. {item?.revision.title ?? `Публикация ${id}`}</b>
                          <small>{item ? item.entry.slug : 'Нет в загруженном списке публикаций'}</small>
                        </div>
                        <div className="lsr-hstack">
                          {status && <StatusBadge variant="badge" status={status.status} tone={status.tone} />}
                          <Button size="sm" aria-label={`Поднять: ${item?.revision.title ?? id}`} disabled={!index || order.saving} onClick={() => move(code, index, -1)}>↑ Вверх</Button>
                          <Button size="sm" aria-label={`Опустить: ${item?.revision.title ?? id}`} disabled={index === order.ids.length - 1 || order.saving} onClick={() => move(code, index, 1)}>↓ Вниз</Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
          </Panel>
        );
      })}
    </div>
  );
}
