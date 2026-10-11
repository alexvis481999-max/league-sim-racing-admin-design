# Игровой каталог и скины: соответствие макета v16 и API

Источники: [ADMIN_API_MAP.md](../../ADMIN_API_MAP.md) («Каталог, загрузки и скины» и приложение), клиентские типы `CatalogItem` / `ContentAsset` (`admin/src/shared/types.ts`), `Skin` (`admin/src/pages/skins/skinModel.ts`).
Макет: `design/LeagueSimRacing_Admin_All_Sections_v16.html` — `renderCatalog`, `CAT_TABS`, каталожные ветки `saveEdit` / `editingRecord`.

Код: `admin/src/pages/catalog/*` (список, карточка, данные), `admin/src/pages/skins/*` (вкладка «Скины», новый скин, карточка скина, скины машины), `admin/src/shared/ArchiveDropZone.tsx`, `admin/src/shared/TagEditor.tsx` (только каталог и скины). Стили: `catalog/catalog.v16.css`, `skins/skins.v16.css`, `shared/catalog/upload.v16.css`. Mock API: `admin/dev/mock-api/modules/catalog.mjs`, `skins.mjs`.

Обозначения: «—» в колонке команды — только чтение. Все JSON-команды отправляются с явным `Idempotency-Key` (`catalog/commandKeys.ts`): неподтверждённая команда (сеть, 5xx) повторяется тем же ключом и телом; подтверждённый ответ или 4xx освобождает ключ. Multipart-загрузки получают ключ в транспорте (`apiUploadFormData`).

## Маршруты

| Путь | Экран |
| --- | --- |
| `/media-catalog?kind=car\|track\|skin\|photo\|plugin\|car_set\|weather_preset&search=…&tags=…` | Список вида (вкладка из `CAT_TABS`, порядок макета); фильтры в URL |
| `/media-catalog/new?kind=…` | Новый материал (`kind=skin` — загрузка скина; `&carCode=` предзаполняет машину) |
| `/media-catalog/item/{id}` | Карточка материала (двухколоночная запись v16) |
| `/media-catalog/skin/{id}` | Карточка скина |
| `/skins/*` | Перенаправление на `/media-catalog?kind=skin` (без изменений, `AdminLayout`) |

Права: раздел виден при `catalog.manage.all` или `catalog.manage.scoped`. Владельцы новой карточки: платформа и «официальный контент» — только при `catalog.manage.all`; организаторы — все (при `.all`) или только из `organizerIdsFor(access, 'catalog.manage.scoped')`. Для скинов то же правило; изменение и модерация скина — по `allowedActions.edit/moderate` из ответа.

## Список (`/media-catalog`)

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Заголовок, «＋ Добавить материал» | права раздела | — | Переход | маршрут `/media-catalog/new?kind={вкладка}` |
| Информационная плашка | правило загрузки | — | — | — |
| Вкладки типов | `KINDS` (= `CAT_TABS`) | `kind` | Выбор (сбрасывает теги) | — |
| Панель «Материалы · {тип}», поиск | серверный фильтр | `search` (с задержкой 350 мс, Enter — сразу) | Ввод | `GET /admin/catalog/items?kind=…&search=…&limit=40` |
| Кнопки «Все игры / AC / ACC / iRacing» (на месте фильтров макета) | серверный фильтр тегов | тег игры в `tags` | Выбор | `…&tags=ac,…` |
| Строка «Теги» | `GET /admin/catalog/tags?kind=…` | теги вида без тегов игры | Переключение, «Сбросить теги» | `…&tags=…` |
| Колонка «Название» | `CatalogItem` | `title`, теги (игра + свои), вторая строка по виду: марка (`carBrandCode` → `/car-brands`) · игра · DLC; конфигурации трассы (`metadata.layouts`); число машин набора (`metadata.carIds`); погода (`graphics`, температуры, ветер); файл фото | Строка открывает карточку | маршрут `/media-catalog/item/{id}` |
| Миниатюра (только фото) | изображение по asset ID | `primaryImageAssetId` → `/content-assets/{id}/file` | — | — |
| «Код / ID» | `CatalogItem` | `code` | — | — |
| «Владелец» | `sourceType`, `submittedByOrganizerId` → `/admin/access/organizers` | — | — | — |
| «Использование» | `CatalogItem.usages[]` | первая связь `usageType: targetTitle`, «и ещё N» | — | — |
| «Добавил · обновлено» (добавлено к макету, было в старом списке) | `createdBy`, `createdByUserId`, `updatedAt` | — | — | — |
| «Статус» | `status` | `active` → «Активен», `disabled` → «Неактивен», `archived` → «В архиве»; вторая плашка при проблеме: `installStatus/sharedStatus = failed` («Ошибка установки», причина `installError` в подсказке), `storageStatus = missing` у неофициального («Нет файла») | — | — |
| «Показать ещё» | курсор | `nextAfterId` | Клик | `…&afterId=…` |
| Панели «Зависимости», «Состав и загрузка» | текст-подсказка по виду | — | — | — |

Состояния: скелет строк при загрузке; «Ничего не найдено» при фильтрах; «материалов пока нет» с кнопкой создания; ошибка с «Повторить»; 403 — «Недостаточно прав» (не пустой список). Realtime: домен `catalog` перечитывает текущую страницу без сброса.

## Карточка материала (`/media-catalog/item/{id}`)

Источник записи: строка списка (state навигации); при прямой ссылке — `GET /admin/catalog/items/{id}`, если ответ содержит поля карточки (`id`, `kind`, `title`). Иначе — «Нет данных карточки»; 404 — «Материал не найден».

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Крошки, «← К списку» | `usePageChrome` | `title`, вкладка | Переход | — |
| Заголовок записи | `CatalogItem` | вид · `code`, `title` | — | — |
| «Просмотр», «ZIP» | asset | URL изображения по `primaryImageAssetId`; `archiveAsset.publicUrl` | Ссылка | — |
| «Удалить» → диалог «Убрать из нового выбора?» | `revision` | `expectedVersion` | Подтверждение | `DELETE /admin/catalog/items/{id}` `{expectedVersion}`; ошибка сервера (например `catalog_item_in_use`) остаётся на странице |
| Панель «Карточка материала»: ZIP-архив / изображение | загрузка | файл | Выбор/перетаскивание → временная сессия | `POST /admin/content-upload-sessions` (multipart `file`, `assetKind`, `ownerType`, `ownerId?`); замена файла — `DELETE /admin/content-upload-sessions/{id}` прежней сессии |
| Название | форма | `title` | Ввод | в PATCH |
| Код | `code` | только чтение у существующей карточки | — | — |
| Владелец | `ownerFromItem` | только чтение у существующей карточки | — | — |
| Доступность | `status` | `active` / `disabled` (+ `archived`, если пришёл) | Выбор | в PATCH |
| Марка (машины, обязательна) | `/admin/catalog/car-brands` по регионам | `carBrandCode` | Выбор | в PATCH |
| Игра (погода, наборы) / Теги (остальные) | `GET /admin/catalog/tags?kind=…` | `tags`; ровно один тег игры, кроме фото | Ввод, подсказки | в PATCH |
| Дополнение Assetto Corsa (официальные машины/трассы с тегом ac) | `/admin/catalog/official-dlcs` | `officialDlcCode` | Выбор | в `versions` |
| Параметры погоды | `metadata` | `graphics`, температуры, разброс | Ввод | в `versions` |
| Машины класса (наборы) | все страницы `GET /admin/catalog/items?kind=car&tags={игра}&limit=100` | `metadata.carIds` | Выбор | в `versions` |
| Конфигурации трассы | `metadata.layouts` | `code`, `title`, `pitboxes` (целое > 0); остальные поля конфигурации (зоны тоге) сохраняются | Ввод | в `versions` |
| Metadata JSON (прочие виды) | `metadata` | JSON-объект | Ввод | в `versions` |
| «Сохранить изменения» | форма | — | Сохранение | 1) `POST /admin/content-upload-sessions/{id}/confirm` → `asset.id`; 2) если изменились архив, metadata или DLC — `POST /admin/catalog/items/{id}/versions` `{expectedVersion: revision, archiveAssetId, metadata, officialDlcCode}`; 3) `PATCH /admin/catalog/items/{id}` `{expectedVersion: revision (новая), patch: {title, description: null, carBrandCode, tags, primaryImageAssetId, status}}`. Подтверждённый, но не привязанный asset удаляется `DELETE /admin/content-assets/{id}` |
| «Отменить» / уход со страницы | временная сессия | — | — | `DELETE /admin/content-upload-sessions/{id}` |
| Панель «Файлы и зависимости»: фото карточки (машины, трассы) | `primaryImageAsset` | — | «Добавить/Заменить фото», «Удалить фото» | сессия → confirm → `PATCH {expectedVersion, patch: {primaryImageAssetId}}`; удаление — `patch: {primaryImageAssetId: null}` |
| Идентификатор, ID записи, игра, владелец | `CatalogItem` | `code`, `id`, `revision`, `gameCode`/тег | — | — |
| Архив / файл | `archiveAsset` (для фото — `primaryImageAsset`) | `fileName`, `sizeBytes`; «Скачать ZIP» | Ссылка | — |
| Хранилище | `storageStatus` | — | — | — |
| Игровой сервер | `sharedStatus`, `installStatus`, `installError`, `installedAt` | — | «Установить» (машины/трассы с тегом ac, файл есть, установка не `present`) | `POST /admin/catalog/items/{id}/install-shared` `{}`; ошибка демона показывается в карточке |
| Предупреждение | `usages.length` | — | — | — |
| Панель «Конфигурации и зоны тоге» (трассы) | `metadata.layouts[].tougeZones` | `status`, `checksumSha256`, `updatedAt`, `error` | «Загрузить/Заменить разметку» | сессия `assetKind=touge_zones` → confirm → `POST /admin/catalog/items/{id}/layouts/{layout\|default}/touge-zones` `{expectedVersion, assetId}` |
|  |  |  | «Скачать конфиг» | `GET …/touge-zones` → `{url, fileName}`, затем чтение `url` |
| Панель «Скины машины» (машины) | `GET /skins/admin?carCode={code}&limit=100` | строки скинов | Строка → карточка скина (возврат «← К машине»); «＋ Добавить скин» | маршрут `/media-catalog/new?kind=skin&carCode=…` |
| Панель «Версии и использование» | `GET /admin/catalog/items/{id}` (перечитывается при новой `revision`) | `CatalogItem.usages[]`; `usages[]` ответа (`ownerType`, `ownerId`, `versionId`); `versions[]` (`id`, `checksumSha256`, `createdAt`) | Ссылка на событие | — |

Новая карточка — та же форма в одну колонку («Основное»). Код заполняется из названия, после выбора файла — из имени файла; ручной ввод имеет приоритет. Проверки до запроса: марка у машины, изображение у фото, ZIP у неофициального архива, тег игры (ровно один, кроме фото), JSON metadata, места конфигураций. Сохранение: confirm → `POST /admin/catalog/items` (`kind, code, title, description: null, carBrandCode, sourceType, officialDlcCode, ownerType, ownerId, gameCode, tags, metadata, archiveAssetId, primaryImageAssetId, status`).

## Скины

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Вкладка «Скины»: поиск | серверный фильтр | `q` | Ввод | `GET /skins/admin?…&q=…&limit=40` |
| «Все владельцы» | серверный фильтр | `ownerType` | Выбор | `…&ownerType=…` |
| «Все игры / AC / ACC / iRacing» | серверный фильтр | `gameCode` | Выбор | `…&gameCode=…` |
| Строка: превью, название, теги, машина | `Skin` + `/games/assetto_corsa/cars` | `previewUrl` (+ `?v=version-updatedAt`), `displayName`, `tags`, `carCode` → `title` | Открыть | маршрут `/media-catalog/skin/{id}` |
| «Код / ID», «Владелец», «Доступ», «Добавил · обновлено» | `Skin` | `folderName`, `id`; `ownerType/ownerId/ownerUser` (+ организаторы); `visibility`; `createdByUser`, `updatedAt` | — | — |
| «Статус» | `Skin` | `deletedAt` → «Удалён владельцем»; иначе `active` → «Активен»/«Отключён»; `moderation.blocked` → «Заблокирован» (причина в подсказке) | — | — |
| «Показать ещё» | курсор | `nextAfterId` | Клик | `…&afterId=…` |
| Новый скин: ZIP | локальное чтение JSZip | `ui_skin.json` (`skinname`/`name`) → название | Выбор | — |
| Машина, владелец, доступ, теги | `/games/assetto_corsa/cars`, организаторы, `/admin/catalog/tags` | `carCode`, `ownerType/ownerId`, `visibility` (официальный → `official`), `tags` | «Добавить скин» | `POST /skins/admin` (multipart `archive, carCode, displayName, visibility, tags, ownerType, ownerId?`) |
| Карточка скина: заголовок, «Скачать текущий ZIP» | `GET /skins/admin/{id}` | `displayName`, `archiveUrl` (если `allowedActions.download ≠ false`) | Ссылка | — |
| Плашки «удалён владельцем», «заблокирован», «изменение недоступно» | `deletedAt`, `moderation`, `allowedActions.edit` | — | — | — |
| Форма: название, машина, доступ (не для официальных), «Доступен для нового выбора», теги | `Skin` | — | «Сохранить» | `PATCH /skins/admin/{id}` `{expectedVersion: metadataVersion, patch: {displayName, carCode, tags, active, visibility?}}`, затем перечитывание |
| История изменений | `history[]` | `metadataVersion`, `version`, `changedAt`, `actorId`, `displayName`, `carCode`, `tags`, `active`, `archiveUrl` | ZIP версии | — |
| Модерация (`allowedActions.moderate`) | `moderation` | причина обязательна | «Заблокировать для новых выборов» / «Снять блокировку» | `POST /skins/admin/{id}/moderation` `{expectedVersion: metadataVersion, blocked, reason}` |
| Панель «Файлы и состояние» | `Skin` | превью, `id`, `folderName`, `version`, `archiveSizeBytes`, `metadataVersion`, владелец, доступ, автор, даты, статус | — | — |

Контент пилота (`UserProfilePage`, `/skins/admin?ownerType=user&ownerId=…`) не менялся (вне раздела).

## Нет в API

- **Фильтр по статусу в списке каталога** (в макете «Активные / Выключенные / Проверка»): серверный параметр статуса для `GET /admin/catalog/items` не подтверждён клиентом (старый код отправлял `status` только в недостижимой ветке скинов). На месте фильтра — фильтр игры (`tags`), статус виден в колонке. Клиентская фильтрация загруженной страницы не используется, чтобы не выдавать неполный результат за полный.
- **Статус «Проверка» (moderation) у материалов каталога**: у `CatalogItem` нет статуса модерации; модерация есть только у скинов (`moderation.blocked`).
- **Общее количество материалов** не возвращается; подвал показывает «Показано N(+)».
- **Изображения в mock API**: `/content-assets/{id}/file` в mock не отдаёт файлы, вместо картинки показывается пустая рамка (так же выглядит недоступный файл в реальном API).
- **Описание (`description`)**: форма отправляет `null`, как и прежде (поле в старом коде было выключено); в макете поле есть, но редактирование описания не включено, чтобы не менять поведение сохранения.
- **Версии/зависимости**: тип ответа `GET /admin/catalog/items/{id}` описан клиентом только как `versions`/`usages`; `usages` в нём имеют форму `{ownerType, ownerId, versionId}`, а не `CatalogUsage`. Прямая ссылка на карточку работает, только если ответ дополнительно содержит поля `CatalogItem`.

## Ограничения и замеченные расхождения

- Выбор машин набора (ADMIN_API_MAP, «Ограничения», п. 6): запрос был типизирован как `CatalogItem[]`, а список отвечает `{items, nextAfterId}` — старый код ломался на постраничном ответе. Контракт не менялся: клиент принимает обе формы и читает все страницы (`limit=100`, курсор `afterId`, не более 50 страниц).
- `PATCH` без `expectedVersion` из старого `toggleUse` был недостижим (вид `skin` не открывался в редакторе каталога) и удалён вместе с кодом.
- Ошибка сохранения после подтверждения загрузки раньше не освобождала asset (исключение из `useAsyncState` обходило очистку). Теперь неиспользованный asset удаляется, если ни одна версия на него не сослалась.
- `window.confirm` удаления заменён диалогом v16; текст сохраняет смысл: сохранённые версии событий остаются доступны.
