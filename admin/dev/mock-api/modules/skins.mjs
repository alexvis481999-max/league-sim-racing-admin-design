// Dev-only skins (`/skins/admin*`). Shapes follow `Skin` in admin/src/pages/skins/skinModel.ts and ADMIN_API_MAP.md.
// Values are synthetic. PATCH and moderation check `expectedVersion` against `metadataVersion`.
const minutes = (iso, n) => new Date(Date.parse(iso) + n * 60_000).toISOString();
const users = {
  701: { id: '701', firstName: null, lastName: null, steamName: 'Vortex' },
  702: { id: '702', firstName: 'Ирина', lastName: 'Соколова', steamName: 'irina_s' },
  733: { id: '733', firstName: 'Марк', lastName: 'Орлов', steamName: 'Marko77' },
  740: { id: '740', firstName: null, lastName: null, steamName: 'NightShift' },
};

export function register(on, { fail, page, NOW }) {
  let seq = 140;
  const skin = (id, carCode, displayName, patch = {}) => {
    const createdByUser = users[patch.createdBy ?? 701];
    delete patch.createdBy;
    const folderName = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `skin_${id}`;
    return {
      id, gameCode: 'assetto_corsa', carCode, displayName, folderName,
      previewUrl: null, previewBucket: null, previewObjectKey: null,
      archiveUrl: `https://storage.example.test/skins/${carCode}/${folderName}.zip`, archiveBucket: 'skins', archiveObjectKey: `${carCode}/${folderName}.zip`,
      archiveChecksumSha256: null, archiveSizeBytes: String(4_200_000 + id * 13_000), ownerType: 'platform', ownerId: null, visibility: 'public',
      isActive: true, active: true, createdByUserId: createdByUser.id, version: 1, metadataVersion: 1, tags: ['ac'], deletedAt: null,
      moderation: { blocked: false, reason: '' }, allowedActions: { edit: true, moderate: true, download: true },
      createdByUser, ownerUser: null, createdAt: minutes(NOW, -60 * 24 * (40 - id % 30)), updatedAt: minutes(NOW, -60 * 24 * (6 + id % 9)),
      ...patch,
    };
  };
  const skins = [
    skin(101, 'porsche_911_gt3_r', 'LSR Blue #24', { tags: ['ac', 'gt3', 'lsr'], version: 3, metadataVersion: 5 }),
    skin(102, 'bmw_m4_gt3', 'BMW Team White', { ownerType: 'user', ownerId: '733', visibility: 'private', ownerUser: users[733], createdBy: 733, moderation: { blocked: true, reason: 'Логотип стороннего спонсора без разрешения' } }),
    skin(103, 'bmw_m4_gt3', 'Official Livery #1', { ownerType: 'official', visibility: 'official', allowedActions: { edit: false, moderate: true, download: true } }),
    skin(104, 'ferrari_488_gt3', 'Scuderia Night', { ownerType: 'organizer', ownerId: '1', tags: ['ac', 'gt3'], createdBy: 702 }),
    skin(105, 'audi_r8_lms', 'Phoenix Orange', { tags: ['ac', 'gt3'], active: false, isActive: false }),
    skin(106, 'toyota_ae86', 'Fujiwara Tofu', { ownerType: 'user', ownerId: '740', ownerUser: users[740], createdBy: 740, tags: ['ac', 'touge'] }),
    skin(107, 'mazda_rx7_fd', 'Red Suns', { ownerType: 'organizer', ownerId: '1', tags: ['ac', 'touge'], createdBy: 702 }),
    skin(108, 'toyota_ae86', 'Akina Speed Stars', { ownerType: 'user', ownerId: '733', ownerUser: users[733], createdBy: 733, deletedAt: minutes(NOW, -60 * 24), active: false, isActive: false }),
    skin(109, 'bmw_m4_gt4', 'GT4 Academy', { tags: ['ac', 'gt4'] }),
    skin(110, 'porsche_911_gt3_r', 'Martini Classic', { ownerType: 'official', visibility: 'official', version: 2, metadataVersion: 2, allowedActions: { edit: false, moderate: true, download: true } }),
    ...Array.from({ length: 34 }, (_, i) => skin(111 + i, ['bmw_m4_gt3', 'ferrari_488_gt3', 'audi_r8_lms', 'porsche_911_gt3_r'][i % 4], `Club Livery ${i + 1}`, { ownerType: 'user', ownerId: '733', ownerUser: users[733], createdBy: 733, visibility: i % 3 ? 'public' : 'private' })),
  ];
  const histories = new Map(skins.map((s) => [s.id, Array.from({ length: s.metadataVersion }, (_, i) => ({
    metadataVersion: i + 1, version: String(Math.min(s.version, i + 1)), displayName: i === s.metadataVersion - 1 ? s.displayName : `${s.displayName} (ред. ${i + 1})`, carCode: s.carCode, tags: s.tags,
    active: true, changedAt: i === 0 ? null : minutes(s.createdAt, i * 60 * 24 * 3), actorId: i === 0 ? null : '701', archiveUrl: i < s.version ? s.archiveUrl : null,
  })).reverse()]));
  const find = (id) => skins.find((s) => String(s.id) === String(id));
  const conflict = () => fail(409, 'skin_version_conflict', 'Скин уже изменён. Обновите карточку и повторите.');

  on('GET', '/skins/admin', ({ q }) => {
    const search = (q.get('q') ?? '').toLowerCase();
    const rows = skins.filter((s) => (!q.get('carCode') || s.carCode === q.get('carCode'))
      && (!q.get('ownerType') || s.ownerType === q.get('ownerType'))
      && (!q.get('ownerId') || s.ownerId === q.get('ownerId'))
      && (!q.get('gameCode') || s.gameCode === q.get('gameCode'))
      && (!search || `${s.displayName} ${s.carCode} ${s.id} ${s.folderName}`.toLowerCase().includes(search)));
    return page(rows, q, 40);
  });
  on('POST', '/skins/admin', () => {
    const created = skin(++seq + 1000, 'bmw_m4_gt3', `Новый скин ${seq}`, { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    skins.unshift(created);
    histories.set(created.id, [{ metadataVersion: 1, version: '1', displayName: created.displayName, carCode: created.carCode, tags: created.tags, active: true, changedAt: created.createdAt, actorId: '701', archiveUrl: created.archiveUrl }]);
    return created;
  });
  on('GET', '/skins/admin/:id', ({ p }) => {
    const s = find(p.id);
    return s ? { ...s, history: histories.get(s.id) ?? [] } : fail(404, 'skin_not_found', 'Скин не найден');
  });
  on('PATCH', '/skins/admin/:id', ({ p, body }) => {
    const s = find(p.id);
    if (!s) return fail(404, 'skin_not_found', 'Скин не найден');
    if (!s.allowedActions.edit) return fail(403, 'forbidden', 'Недостаточно прав для изменения скина');
    if (body?.expectedVersion !== s.metadataVersion) return conflict();
    const patch = body.patch ?? {};
    for (const key of ['displayName', 'carCode', 'tags', 'visibility']) if (patch[key] !== undefined) s[key] = patch[key];
    if (patch.active !== undefined) { s.active = patch.active; s.isActive = patch.active; }
    s.metadataVersion += 1; s.updatedAt = new Date().toISOString();
    histories.get(s.id)?.unshift({ metadataVersion: s.metadataVersion, version: String(s.version), displayName: s.displayName, carCode: s.carCode, tags: s.tags, active: s.active, changedAt: s.updatedAt, actorId: '701', archiveUrl: s.archiveUrl });
    return s;
  });
  on('POST', '/skins/admin/:id/moderation', ({ p, body }) => {
    const s = find(p.id);
    if (!s) return fail(404, 'skin_not_found', 'Скин не найден');
    if (body?.expectedVersion !== s.metadataVersion) return conflict();
    if (!String(body.reason ?? '').trim()) return fail(400, 'validation_error', 'Укажите причину решения');
    s.moderation = { blocked: !!body.blocked, reason: body.reason };
    s.metadataVersion += 1; s.updatedAt = new Date().toISOString();
    return s;
  });
}
