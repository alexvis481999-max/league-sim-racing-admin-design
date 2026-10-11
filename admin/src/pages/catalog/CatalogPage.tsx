import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AdminAccess, CatalogItem } from '../../shared/types';
import { Button, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Panel, Tabs, usePageChrome } from '../../ui/v16';
import { SkinDetails } from '../skins/SkinDetails';
import { SkinCreatePage, SkinsList, type Skin } from '../skins/SkinsPage';
import { CatalogEditor } from './CatalogEditor';
import { CatalogItemsPanel } from './CatalogList';
import { itemFromDetails, useCatalogDetails, useCatalogReferences, useTagOptions } from './catalogData';
import { KINDS, catalogListPath, kindDef, normalizeVisibleTags, type KindDef } from './catalogModel';
import './catalog.v16.css';

/** `/media-catalog` — list by kind (`?kind=`), `/new?kind=`, `/item/:id`, `/skin/:id`. */
export function CatalogPage({ access }: { access: AdminAccess }) {
  return (
    <Routes>
      <Route index element={<CatalogListPage />} />
      <Route path="new" element={<CatalogCreateRoute access={access} />} />
      <Route path="item/:id" element={<CatalogItemRoute access={access} />} />
      <Route path="skin/:id" element={<SkinRoute />} />
      <Route path="*" element={<Navigate to="/media-catalog" replace />} />
    </Routes>
  );
}

const HELP: Record<string, string> = {
  car: 'ZIP-архив машины, марка и ровно один тег игры. Фото карточки и скины машины редактируются в её карточке.',
  track: 'ZIP-архив трассы; конфигурации читаются из ui_track.json. Для тоге к каждой конфигурации загружается файл зон.',
  skin: 'ZIP-архив ливреи с ui_skin.json и превью. Доступ, модерация и история — в карточке скина.',
  photo: 'Изображение для публикаций и карточек. Файл прикрепляется после подтверждения загрузки.',
  plugin: 'ZIP-архив плагина и тег игры. Новый архив создаёт новую версию материала.',
  car_set: 'Состав из машин выбранной игры, без файлов. Сохранённые события используют свою версию набора.',
  weather_preset: 'Параметры погоды без файлов: графика, температуры и их разброс.',
};

function CatalogListPage() {
  usePageChrome({ crumbs: [{ label: 'Игровой каталог' }] });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const def = kindDef(params.get('kind'));
  const search = params.get('search') ?? '';
  const tags = useMemo(() => normalizeVisibleTags((params.get('tags') ?? '').split(',')), [params]);
  const refs = useCatalogReferences();
  const tagOptions = useTagOptions(def.kind);
  const organizerById = useMemo(() => new Map(refs.organizers.map((organizer) => [organizer.id, organizer])), [refs.organizers]);
  const brandByCode = useMemo(() => new Map(refs.carBrands.map((brand) => [brand.code, brand])), [refs.carBrands]);
  const update = (patch: Record<string, string>) => setParams((old) => {
    const next = new URLSearchParams(old);
    for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); }
    return next;
  }, { replace: true });
  const create = () => navigate(`/media-catalog/new?kind=${def.kind}`);

  return (
    <>
      <PageHeader
        overline="Администрирование"
        title="Игровой каталог"
        description="Машины, трассы, скины и игровые материалы"
        actions={<Button variant="primary" onClick={create}>＋ Добавить материал</Button>}
      />
      <div className="lsr-cat-note">
        <Notice>Файл прикрепляется к материалу после подтверждения загрузки при сохранении карточки; установка на игровой сервер, версии и связи видны в карточке материала.</Notice>
      </div>
      <Tabs variant="module" label="Типы материалов" items={KINDS.map((item) => ({ key: item.kind, label: item.label }))} value={def.kind} onChange={(kind) => update({ kind, tags: '' })} />
      {def.kind === 'skin'
        ? <SkinsList search={search} onSearch={(value) => update({ search: value })} onCreate={create} />
        : <CatalogItemsPanel def={def} search={search} onSearch={(value) => update({ search: value })} tags={tags} onTags={(value) => update({ tags: value.join(',') })} tagOptions={tagOptions.options} organizerById={organizerById} brandByCode={brandByCode} onCreate={create} />}
      <div className="lsr-cols-equal lsr-cat-help">
        <Panel title="Зависимости" shadow><p>Материал может использоваться в событиях, чемпионатах, сетах машин и публикациях. Связи и версии видны в карточке материала; удаление убирает материал только из нового выбора.</p></Panel>
        <Panel title={`Состав и загрузка · ${def.label}`} shadow><p>{HELP[def.kind]}</p></Panel>
      </div>
    </>
  );
}

function useEditorRefs(def: KindDef) {
  const refs = useCatalogReferences();
  const tags = useTagOptions(def.kind);
  return { refs, tags };
}

function CatalogCreateRoute({ access }: { access: AdminAccess }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const def = kindDef(params.get('kind'));
  const { refs, tags } = useEditorRefs(def);
  const back = () => navigate(catalogListPath(def.kind));
  if (def.kind === 'skin') return <SkinCreatePage access={access} initialCarCode={params.get('carCode') ?? ''} onLeave={back} />;
  return <CatalogEditor key={def.kind} access={access} def={def} item={null} {...refs} tagOptions={tags.options} onItemChange={() => undefined} onTagsChanged={() => void tags.reload()} onLeave={back} />;
}

function CatalogItemRoute({ access }: { access: AdminAccess }) {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fromState = (location.state as { item?: CatalogItem } | null)?.item;
  const [item, setItem] = useState<CatalogItem | null>(fromState?.id === id ? fromState : null);
  const details = useCatalogDetails(id, item?.revision);
  useEffect(() => {
    if (item) return;
    const hydrated = itemFromDetails(details.data);
    if (hydrated) setItem(hydrated);
  }, [details.data, item]);
  const def = kindDef(item?.kind ?? new URLSearchParams(location.search).get('kind'));
  const { refs, tags } = useEditorRefs(def);

  if (!item) {
    const list = catalogListPath(def.kind);
    return (
      <>
        <RouteChrome list={list} />
        {details.loading ? <LoadingBlock rows={6} label="Загрузка материала" />
          : details.error?.status === 404 ? <EmptyState title="Материал не найден" action={<Button to={list}>К списку</Button>}>Возможно, он удалён из каталога.</EmptyState>
            : details.error ? <ErrorState error={details.error.message} status={details.error.status} />
              : <EmptyState title="Нет данных карточки" action={<Button to={list}>К списку</Button>}>Ответ API не содержит полей карточки. Откройте материал из списка.</EmptyState>}
      </>
    );
  }
  return (
    <CatalogEditor
      key={item.id}
      access={access}
      def={def}
      item={item}
      details={details}
      {...refs}
      tagOptions={tags.options}
      onItemChange={setItem}
      onTagsChanged={() => void tags.reload()}
      onLeave={() => navigate(catalogListPath(def.kind))}
    />
  );
}

function RouteChrome({ list }: { list: string }) {
  usePageChrome({ crumbs: [{ label: 'Игровой каталог', to: list }, { label: 'Материал' }], back: { label: 'К списку', to: list } });
  return null;
}

function SkinRoute() {
  const { id = '' } = useParams();
  const location = useLocation();
  const state = location.state as { skin?: Skin; from?: string } | null;
  return <SkinDetails key={id} skinId={id} initial={state?.skin && String(state.skin.id) === id ? state.skin : null} backTo={state?.from ?? catalogListPath('skin')} />;
}
