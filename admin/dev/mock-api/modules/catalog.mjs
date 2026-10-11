// Dev-only game catalogue (`/admin/catalog/*`, `/admin/content-upload-sessions/*`, `/admin/content-assets/*`).
// Shapes follow CatalogItem / ContentAsset in admin/src/shared/types.ts and ADMIN_API_MAP.md «Каталог, загрузки и скины».
// Values are synthetic. Commands check `expectedVersion` against `revision` and change local state only.
const actors = {
  701: { id: '701', firstName: null, lastName: null, steamName: 'Vortex', steamAvatar: null },
  702: { id: '702', firstName: 'Ирина', lastName: 'Соколова', steamName: 'irina_s', steamAvatar: null },
  715: { id: '715', firstName: null, lastName: null, steamName: 'touge_master', steamAvatar: null },
};
const minutes = (iso, n) => new Date(Date.parse(iso) + n * 60_000).toISOString();
const sha = (seed) => Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(seed.charCodeAt(i % seed.length) + i * 7) % 16]).join('');

export function register(on, { fail, page, NOW }) {
  let seq = 900;
  const asset = (id, fileName, assetKind, sizeBytes) => ({
    id, storageProvider: 'beget_s3', fileName, mimeType: assetKind === 'image' ? 'image/webp' : assetKind === 'touge_zones' ? 'application/json' : 'application/zip',
    sizeBytes, assetKind, publicUrl: `https://storage.example.test/catalog/${fileName}`, objectKey: `catalog/${fileName}`, createdAt: minutes(NOW, -60 * 24 * 12),
  });
  const usage = (id, usageType, targetId, targetTitle) => ({
    id, usageType, targetId, targetTitle, placement: null, url: usageType === 'event' ? `/events/${targetId}` : null,
    createdAt: minutes(NOW, -60 * 24 * 5), updatedAt: minutes(NOW, -60 * 24 * 5), createdByUserId: '701', updatedByUserId: null,
  });
  const item = (kind, code, title, patch = {}) => {
    const id = patch.id ?? `${kind}-${code}`;
    const archive = patch.archive === false ? null : patch.archive ?? (['car', 'track', 'plugin'].includes(kind) && patch.sourceType !== 'official' ? asset(`a-${id}`, `${code}.zip`, 'archive', 18_400_000 + code.length * 731_000) : null);
    const image = patch.image ?? null;
    delete patch.archive; delete patch.image;
    const createdBy = actors[patch.createdByUserId ?? 701];
    return {
      id, revision: 1, currentVersionId: `v-${id}-1`, ownerType: 'platform', ownerId: null, gameCode: 'assetto_corsa', officialDlcCode: null,
      kind, code, slug: code.replace(/_/g, '-'), contentCode: code, title, currentTitle: title, description: null, carBrandCode: null,
      sourceType: 'platform', officialDlc: null, submittedByOrganizerId: null, tags: ['ac'], usages: [], metadata: {},
      archiveAssetId: archive?.id ?? null, primaryImageAssetId: image?.id ?? null, status: 'active',
      storageStatus: archive || image ? 'present' : kind === 'car' || kind === 'track' ? 'not_applicable' : 'not_applicable',
      sharedStatus: kind === 'car' || kind === 'track' ? (archive ? 'present' : 'not_applicable') : 'not_applicable',
      installStatus: kind === 'car' || kind === 'track' ? (archive ? 'installed' : 'not_applicable') : 'not_applicable',
      installError: null, installedAt: archive ? minutes(NOW, -60 * 24 * 10) : null, archiveAsset: archive, primaryImageAsset: image,
      createdAt: minutes(NOW, -60 * 24 * 30), updatedAt: minutes(NOW, -60 * 24 * 3), createdByUserId: createdBy.id, updatedByUserId: null, createdBy, updatedBy: null,
      ...patch,
    };
  };

  const brands = [
    { code: 'bmw', title: 'BMW', region: 'european' }, { code: 'porsche', title: 'Porsche', region: 'european' }, { code: 'ferrari', title: 'Ferrari', region: 'european' },
    { code: 'audi', title: 'Audi', region: 'european' }, { code: 'ford', title: 'Ford', region: 'american' }, { code: 'chevrolet', title: 'Chevrolet', region: 'american' },
    { code: 'toyota', title: 'Toyota', region: 'asian' }, { code: 'mazda', title: 'Mazda', region: 'asian' }, { code: 'nissan', title: 'Nissan', region: 'asian' },
  ];
  const dlcs = [
    { code: 'ready_to_race', title: 'Ready To Race Pack', storeUrl: 'https://store.example.test/rtr' },
    { code: 'porsche_pack_1', title: 'Porsche Pack I', storeUrl: 'https://store.example.test/porsche1' },
    { code: 'japanese_pack', title: 'Japanese Pack', storeUrl: 'https://store.example.test/japanese' },
  ];

  const layout = (code, title, extra = {}) => ({ code, title, isDefault: code === '' || extra.isDefault === true, ...extra });
  const items = [
    item('car', 'bmw_m4_gt3', 'BMW M4 GT3', { carBrandCode: 'bmw', tags: ['ac', 'gt3'], usages: [usage('u1', 'event', '1042', 'GT3 Weekly · Monza'), usage('u2', 'championship', '17', 'GT3 Championship 2026')], revision: 4 }),
    item('car', 'ks_porsche_911_gt3_r', 'Porsche 911 GT3 R', { carBrandCode: 'porsche', sourceType: 'official', officialDlcCode: 'porsche_pack_1', officialDlc: dlcs[1], tags: ['ac', 'gt3'], usages: [usage('u3', 'event', '1042', 'GT3 Weekly · Monza')] }),
    item('car', 'ferrari_488_gt3', 'Ferrari 488 GT3', { carBrandCode: 'ferrari', tags: ['ac', 'gt3'], revision: 2 }),
    item('car', 'audi_r8_lms', 'Audi R8 LMS', { carBrandCode: 'audi', tags: ['ac', 'gt3'], installStatus: 'failed', sharedStatus: 'failed', installError: 'Демон игрового сервера не ответил за 30 секунд' }),
    item('car', 'bmw_m4_gt4', 'BMW M4 GT4', { carBrandCode: 'bmw', tags: ['ac', 'gt4'] }),
    item('car', 'toyota_ae86', 'Toyota AE86', { carBrandCode: 'toyota', tags: ['ac', 'touge'], ownerType: 'organizer', ownerId: '1', sourceType: 'community', submittedByOrganizerId: '1', createdByUserId: 715 }),
    item('car', 'mazda_rx7_fd', 'Mazda RX-7 FD', { carBrandCode: 'mazda', tags: ['ac', 'touge'], ownerType: 'organizer', ownerId: '1', sourceType: 'community', submittedByOrganizerId: '1', createdByUserId: 715, status: 'disabled' }),
    item('car', 'gr86_cup', 'Toyota GR86 Cup', { carBrandCode: 'toyota', tags: ['acc', 'cup'], gameCode: 'assetto_corsa_competizione', storageStatus: 'missing', archive: false, archiveAssetId: null, sharedStatus: 'not_applicable', installStatus: 'not_applicable' }),
    ...Array.from({ length: 36 }, (_, i) => item('car', `club_car_${String(i + 1).padStart(2, '0')}`, `Club Car ${i + 1}`, { carBrandCode: brands[i % brands.length].code, tags: ['ac', 'club'], createdByUserId: 702, updatedAt: minutes(NOW, -60 * 24 * (20 + i)) })),
    item('track', 'ks_monza', 'Monza', { sourceType: 'official', tags: ['ac', 'circuit'], metadata: { layouts: [layout('', 'Grand Prix', { pitboxes: 30 }), layout('junior', 'Junior', { pitboxes: 16 })] }, usages: [usage('u4', 'event', '1042', 'GT3 Weekly · Monza')] }),
    item('track', 'ks_spa', 'Spa-Francorchamps', { sourceType: 'official', officialDlcCode: 'ready_to_race', officialDlc: dlcs[0], tags: ['ac', 'circuit'], metadata: { layouts: [layout('', 'Grand Prix', { pitboxes: 32 })] } }),
    item('track', 'akina', 'Akina', { tags: ['ac', 'touge'], ownerType: 'organizer', ownerId: '1', sourceType: 'community', submittedByOrganizerId: '1', createdByUserId: 715, revision: 3,
      metadata: { layouts: [layout('downhill', 'Downhill', { isDefault: true, pitboxes: 12, tougeZones: { status: 'present', checksumSha256: sha('akina-down'), updatedAt: minutes(NOW, -60 * 30) } }), layout('uphill', 'Uphill', { pitboxes: 12, tougeZones: { status: 'invalid', error: 'В файле нет зоны финиша' } })] },
      usages: [usage('u5', 'event', '1077', 'Touge Battle · Akina')] }),
    item('track', 'nordschleife', 'Nürburgring Nordschleife', { tags: ['ac', 'circuit'], metadata: { layouts: [layout('', 'Nordschleife')] }, installStatus: 'pending', sharedStatus: 'missing' }),
    item('track', 'drift_playground', 'Drift Playground', { tags: ['ac', 'drift'], status: 'disabled', metadata: {} }),
    item('photo', 'monza_cover', 'Monza · обложка', { tags: ['ac', 'cover'], image: asset('img-monza', 'monza_cover.webp', 'image', 482_000), storageStatus: 'present', usages: [usage('u6', 'news', '55', 'Итоги этапа в Монце')] }),
    item('photo', 'akina_night', 'Akina · ночь', { tags: ['touge'], image: asset('img-akina', 'akina_night.webp', 'image', 391_000), storageStatus: 'present' }),
    item('photo', 'gt3_grid', 'Стартовая решётка GT3', { tags: ['ac', 'gt3'], image: asset('img-grid', 'gt3_grid.webp', 'image', 612_000), storageStatus: 'present', createdByUserId: 702 }),
    item('plugin', 'session_reporter', 'AC Session Reporter', { tags: ['ac'], metadata: { version: '2.1' } }),
    item('plugin', 'real_penalty', 'Real Penalty', { tags: ['ac'], usages: [usage('u7', 'event', '1042', 'GT3 Weekly · Monza')] }),
    item('car_set', 'gt3_2026', 'GT3 · сезон 2026', { tags: ['ac'], metadata: { carIds: ['car-bmw_m4_gt3', 'car-ks_porsche_911_gt3_r', 'car-ferrari_488_gt3', 'car-audi_r8_lms'] }, usages: [usage('u8', 'championship', '17', 'GT3 Championship 2026')] }),
    item('car_set', 'touge_classics', 'Touge classics', { tags: ['ac'], metadata: { carIds: ['car-toyota_ae86', 'car-mazda_rx7_fd'] } }),
    item('weather_preset', 'clear_day', 'Ясный день', { tags: ['ac'], metadata: { graphics: '3_clear', ambientTemperature: 22, roadTemperature: 31, ambientVariation: 2, roadVariation: 2, windSpeed: 0 }, graphics: '3_clear', ambientTemperature: 22, roadTemperature: 31, windSpeed: 0 }),
    item('weather_preset', 'evening_clouds', 'Вечер, облачно', { tags: ['ac'], metadata: { graphics: '5_heavy_clouds', ambientTemperature: 16, roadTemperature: 20, ambientVariation: 1, roadVariation: 2, windSpeed: 3 }, graphics: '5_heavy_clouds', ambientTemperature: 16, roadTemperature: 20, windSpeed: 3 }),
    item('weather_preset', 'morning_fog', 'Утренний туман', { tags: ['ac'], status: 'disabled', metadata: { graphics: '7_fog', ambientTemperature: 11, roadTemperature: 13, ambientVariation: 1, roadVariation: 1, windSpeed: 1 }, graphics: '7_fog', ambientTemperature: 11, roadTemperature: 13, windSpeed: 1 }),
  ];
  const versions = new Map(items.map((x) => [x.id, Array.from({ length: x.revision }, (_, i) => ({ id: `v-${x.id}-${i + 1}`, checksumSha256: x.archiveAsset ? sha(x.id + i) : null, createdAt: minutes(x.createdAt, i * 60 * 24 * 4) }))]));
  const sessions = new Map();
  const find = (id) => items.find((x) => x.id === id);
  const bump = (x) => { x.revision += 1; x.currentVersionId = `v-${x.id}-${x.revision}`; x.updatedAt = new Date().toISOString(); x.updatedByUserId = '701'; x.updatedBy = actors[701]; };
  const conflict = () => fail(409, 'catalog_item_version_conflict', 'Материал уже изменён другим администратором. Обновите карточку и повторите.');
  const dependencies = (x) => x.usages.filter((u) => u.usageType === 'event' || u.usageType === 'championship').map((u) => ({ ownerType: u.usageType === 'event' ? 'EVENT' : 'CAR_SET_VERSION', ownerId: u.targetId, versionId: x.currentVersionId }));

  on('GET', '/admin/catalog/items', ({ q }) => {
    const search = (q.get('search') ?? '').toLowerCase();
    const tags = (q.get('tags') ?? '').split(',').filter(Boolean);
    const rows = items.filter((x) => (!q.get('kind') || x.kind === q.get('kind'))
      && (!search || `${x.title} ${x.code} ${x.id}`.toLowerCase().includes(search))
      && tags.every((t) => x.tags.includes(t))
      && (!q.get('createdByUserId') || String(x.createdByUserId) === q.get('createdByUserId')));
    return page(rows, q, 40);
  });
  on('POST', '/admin/catalog/items', ({ body }) => {
    if (!body?.title || !body?.kind) return fail(400, 'validation_error', 'Укажите название и тип материала');
    if (items.some((x) => x.kind === body.kind && x.code === body.code)) return fail(409, 'catalog_item_code_taken', `Код «${body.code}» уже занят`);
    const confirmed = [...sessions.values()].map((s) => s.asset).filter(Boolean);
    const archive = confirmed.find((a) => a.id === body.archiveAssetId) ?? null;
    const image = confirmed.find((a) => a.id === body.primaryImageAssetId) ?? null;
    const created = item(body.kind, body.code, body.title, {
      id: `${body.kind}-${body.code}-${++seq}`, description: body.description, carBrandCode: body.carBrandCode, sourceType: body.sourceType === 'official' ? 'official' : body.ownerType === 'organizer' ? 'community' : 'platform',
      ownerType: body.ownerType, ownerId: body.ownerId, submittedByOrganizerId: body.ownerId, officialDlcCode: body.officialDlcCode, officialDlc: dlcs.find((d) => d.code === body.officialDlcCode) ?? null,
      gameCode: body.gameCode, tags: body.tags ?? [], metadata: body.metadata ?? {}, status: body.status ?? 'active', archive: archive ?? false, image,
      archiveAssetId: archive?.id ?? null, primaryImageAssetId: image?.id ?? null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      ...(archive && body.tags?.includes('ac') && (body.kind === 'car' || body.kind === 'track') ? { sharedStatus: 'missing', installStatus: 'pending' } : {}),
    });
    items.unshift(created);
    versions.set(created.id, [{ id: created.currentVersionId, checksumSha256: archive ? sha(created.id) : null, createdAt: created.createdAt }]);
    return created;
  });
  on('GET', '/admin/catalog/items/:id', ({ p }) => {
    const x = find(p.id);
    return x ? { ...x, versions: versions.get(x.id) ?? [], usages: dependencies(x) } : fail(404, 'catalog_item_not_found', 'Материал не найден');
  });
  on('PATCH', '/admin/catalog/items/:id', ({ p, body }) => {
    const x = find(p.id);
    if (!x) return fail(404, 'catalog_item_not_found', 'Материал не найден');
    if (body?.expectedVersion !== x.revision) return conflict();
    const patch = body.patch ?? {};
    for (const key of ['title', 'description', 'carBrandCode', 'tags', 'status']) if (patch[key] !== undefined) x[key] = patch[key];
    if (patch.title) x.currentTitle = patch.title;
    if (patch.primaryImageAssetId !== undefined) {
      x.primaryImageAssetId = patch.primaryImageAssetId;
      x.primaryImageAsset = patch.primaryImageAssetId ? [...sessions.values()].map((s) => s.asset).find((a) => a?.id === patch.primaryImageAssetId) ?? asset(patch.primaryImageAssetId, 'image.webp', 'image', 200_000) : null;
    }
    bump(x);
    return x;
  });
  on('DELETE', '/admin/catalog/items/:id', ({ p, body }) => {
    const x = find(p.id);
    if (!x) return fail(404, 'catalog_item_not_found', 'Материал не найден');
    if (body?.expectedVersion !== x.revision) return conflict();
    items.splice(items.indexOf(x), 1);
    return { deleted: true };
  });
  on('POST', '/admin/catalog/items/:id/versions', ({ p, body }) => {
    const x = find(p.id);
    if (!x) return fail(404, 'catalog_item_not_found', 'Материал не найден');
    if (body?.expectedVersion !== x.revision) return conflict();
    if (body.archiveAssetId !== x.archiveAssetId) {
      const archive = [...sessions.values()].map((s) => s.asset).find((a) => a?.id === body.archiveAssetId) ?? null;
      x.archiveAssetId = body.archiveAssetId; x.archiveAsset = archive; x.storageStatus = archive ? 'present' : 'missing';
      if (x.tags.includes('ac') && (x.kind === 'car' || x.kind === 'track')) { x.sharedStatus = 'missing'; x.installStatus = 'pending'; }
    }
    x.metadata = body.metadata ?? x.metadata; x.officialDlcCode = body.officialDlcCode ?? null; x.officialDlc = dlcs.find((d) => d.code === x.officialDlcCode) ?? null;
    bump(x);
    versions.get(x.id)?.push({ id: x.currentVersionId, checksumSha256: x.archiveAsset ? sha(x.id + x.revision) : null, createdAt: x.updatedAt });
    return x;
  });
  on('POST', '/admin/catalog/items/:id/install-shared', ({ p }) => {
    const x = find(p.id);
    if (!x) return fail(404, 'catalog_item_not_found', 'Материал не найден');
    if (x.code === 'audi_r8_lms') return fail(503, 'runtime_daemon_unavailable', 'Демон игрового сервера недоступен. Повторите позже.');
    Object.assign(x, { sharedStatus: 'present', installStatus: 'installed', installError: null, installedAt: new Date().toISOString() });
    return x;
  });
  on('GET', '/admin/catalog/items/:id/layouts/:layout/touge-zones', ({ p }) => {
    const x = find(p.id);
    if (!x) return fail(404, 'catalog_item_not_found', 'Материал не найден');
    return { url: `https://storage.example.test/touge/${x.code}-${p.layout}.json`, fileName: `${x.code}-${p.layout}-touge-zones.json` };
  });
  on('POST', '/admin/catalog/items/:id/layouts/:layout/touge-zones', ({ p, body }) => {
    const x = find(p.id);
    if (!x) return fail(404, 'catalog_item_not_found', 'Материал не найден');
    if (body?.expectedVersion !== x.revision) return conflict();
    const layouts = Array.isArray(x.metadata.layouts) ? x.metadata.layouts : [];
    const target = layouts.find((l) => (l.code || 'default') === p.layout);
    if (!target) return fail(404, 'track_layout_not_found', 'Конфигурация трассы не найдена');
    target.tougeZones = { status: 'present', assetId: body.assetId, checksumSha256: sha(body.assetId + p.layout), updatedAt: new Date().toISOString() };
    bump(x);
    return x;
  });
  on('GET', '/admin/catalog/tags', ({ q }) => {
    const kind = q.get('kind');
    return [...new Set(items.filter((x) => !kind || x.kind === kind).flatMap((x) => x.tags))].sort();
  });
  on('GET', '/admin/catalog/car-brands', () => brands);
  on('GET', '/admin/catalog/official-dlcs', () => dlcs);

  on('POST', '/admin/content-upload-sessions', ({ req }) => {
    const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
    const session = { id, status: 'uploaded', assetKind: 'archive', fileName: 'upload.zip', sizeBytes: String(Number(req.headers['content-length'] ?? 0)), checksumSha256: sha(id), assetId: null, expiresAt: minutes(new Date().toISOString(), 60), asset: null };
    sessions.set(id, session);
    return publicView(session);
  });
  on('POST', '/admin/content-upload-sessions/:id/confirm', ({ p }) => {
    const session = sessions.get(p.id);
    if (!session) return fail(404, 'upload_session_not_found', 'Временная загрузка не найдена или истекла');
    if (!session.asset) session.asset = asset(`asset-${++seq}`, session.fileName, session.assetKind, Number(session.sizeBytes));
    session.status = 'confirmed'; session.assetId = session.asset.id;
    return { session: publicView(session), asset: session.asset };
  });
  function publicView(session) {
    const view = { ...session };
    delete view.asset;
    return view;
  }
  on('DELETE', '/admin/content-upload-sessions/:id', ({ p }) => { sessions.delete(p.id); return { deleted: true }; });
  on('DELETE', '/admin/content-assets/:id', () => ({ deleted: true }));
}
