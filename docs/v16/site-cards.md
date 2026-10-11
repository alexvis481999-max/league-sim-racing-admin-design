# Сайт и публикации · Оформление карточек: соответствие макета v16 и API

Источники: [ADMIN_API_MAP.md](../../ADMIN_API_MAP.md) («Управление публикациями»), клиентские типы `admin/src/shared/types.ts` (`PublicationDetails`, `ContentRevisionPlacement`), `admin/src/pages/site/*`, `admin/src/pages/card-studio/*`.
Макет: `renderSite`, `newsPlaces`, `newsOverridesEditor`, `newsPreviewV16`, `normalizeNewsForm`, `renderCards`; CSS `news-*`, `adm-*`.

Обозначения: «—» — только чтение. **Нет API** — элемент макета не заполняется существующим контрактом и не показан (или заменён реальным полем).

Все команды публикаций идут с `Idempotency-Key`. Неподтверждённая команда (сетевой сбой / 5xx) повторяется с тем же ключом и тем же телом; ответ 2xx/4xx освобождает ключ (`usePublicationCommands` в `siteModel.ts`).

## Список публикаций (`/site`)

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Заголовок, «+ Создать публикацию» | `AdminAccess` | `news.write.all` / `news.write.scoped` / `catalog.manage.all` | Переход к созданию | — (маршрут `/site/new`) |
| «Обновить» | — | — | Перечитать список | `GET /admin/publications?limit=100&afterId=…` |
| KPI «Всего / Опубликовано / Запланировано / Черновики» | все страницы списка | `entry.status` | — | — |
| Вкладка «Порядок слайдов» | `AdminAccess` (платформенный грант) | `publications.reorder.all` | Показ вкладки | — |
| Поиск «Название, описание или размещение» | загруженный список (фильтр на клиенте) | `revision.title`, `revision.summary`, `entry.slug`, `entry.id`, коды размещений | Ввод | — |
| Фильтр «Все / Опубликованы / Запланированы / Черновики» | загруженный список | `entry.status` = `published` / `scheduled` / `draft` (`review`, `archived` — в «Все») | Выбор | — |
| Колонка «Публикация» | `PublicationDetails` | `revision.title` (иначе `entry.slug`); подпись — `entry.publicationKind` + `entry.slug` | Клик по строке → редактор | маршрут `/site/{entry.id}` |
| Колонка «Размещение» | `currentPlacements ?? placements` | `placementCode` (enabled) → подпись места | — | — |
| Колонка «Организатор» | `entry.accessOrganizerId` + `GET /admin/access/organizers` | `name`; `null` → «League Sim Racing» (владелец — платформа) | — | — |
| Колонка «Начало» | `entry` | `scheduledPublishAt ?? publishedAt` (локальное время браузера; у публикации нет часового пояса) | — | — |
| Колонка «Статус» | `entry` | `status`; `published` при `currentRevisionId ≠ revision.id` → «Опубликована · есть черновик» | — | — |

Список API постраничный (`nextAfterId`), но без серверных фильтров/поиска, поэтому клиент по-прежнему читает все страницы (поиск, фильтры, KPI и названия в порядке слайдов работают по полному набору). Состояния: загрузка, ошибка с повтором, 403 «Недостаточно прав» (не пустой список), пусто, «Ничего не найдено».

## Редактор публикации (`/site/new`, `/site/{id}`)

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Крошки, «← Публикации» | маршрут | `revision.title` | Назад | — |
| Заголовок | форма ← `revision.title` | `publication.title` (обязательно, ≤ 220) | Ввод | в теле POST/PATCH |
| Организатор | `GET /admin/access/organizers` + права | `ownerType`/`ownerId`; платформа — при `news.write.all`/`catalog.manage.all`, иначе организаторы из грантов `news.write.scoped`/`news.publish.scoped`; после создания заблокирован | Выбор | в теле POST |
| Тип (нет в макете) | `entry.publicationKind` | `news`/`announcement`/`result`/`update`/`promo` | Выбор | `publication.kind` |
| Статус (в макете — селект) | `entry.status` | только показ в правой панели; меняется командами жизненного цикла | — | — |
| Краткое описание | `revision.summary` | обязателен для публикации | Ввод | `publication.summary` |
| Основное изображение (нет в макете) | `entry.coverAssetId` | выбор из фотокаталога (`PhotoCatalogDialog`) → asset id; превью — `/content-assets/{id}/file` | Выбрать / Убрать | `publication.coverAssetId` |
| Основной текст (нет в макете) | `revision.body` | `RichDescriptionEditor` (картинки нормализуются в `/content-assets/{id}/file`); для `promo` — простой текст, необязателен | Ввод | `publication.body` |
| «Где показывать материал» | `placements[]` | 5 кодов: `home.feed`, `home.hero`, `home.promo`, `touge.feed`, `touge.featured_news` | Переключатели | `publication.placements[]` |
| «Индивидуальные настройки карточек» → «Настроить отдельно» / «Сбросить к общему» / «Поля ▾» | `ContentRevisionPlacement` | `customized` = есть любое переопределение; сброс отправляет `null`/`[]`/`{}` | Переключение | в `placements[]` |
| … «Заголовок только здесь» | | `titleOverride` | Ввод | `placements[].titleOverride` |
| … «Подзаголовок» макета | | `eyebrowOverride` («Рубрика над заголовком»; пусто = тип публикации) | Ввод | `placements[].eyebrowOverride` |
| … «Описание» | | `summaryOverride` | Ввод | `placements[].summaryOverride` |
| … «Ссылка на обложку» макета | | `imageAssetId` — только asset из фотокаталога (произвольного URL в модели нет) | Выбрать / Убрать | `placements[].imageAssetId` |
| … «Надпись кнопки» макета | | `actions[]` `{role, label, url, newTab}` — только для слайдеров (`home.hero` — 2 кнопки, остальные — 1); неполная кнопка блокирует публикацию | Ввод | `placements[].actions` |
| … «Компоновка» | | `presentation.<surface>.layout`: `overlay` / `panel` / `minimal` («По умолчанию» макета = общее оформление, т. е. без переопределения) | Выбор | `placements[].presentation` |
| … «Выравнивание текста», «Размер заголовка, px» | | `textAlign`, `titleSize` | Выбор / ползунок | `presentation` |
| … «Цвет фона», «Акцентный цвет» | | `themes.{dark,light}.surface`, `accentColor` (отдельно для тёмной и светлой темы сайта) | Палитра | `presentation` |
| … «Показывать описание», «Показывать дату» | | `showSummary`, `showDate` (+ `showImage`, `showEyebrow`) | Флажки | `presentation` |
| … (нет в макете) | | `imagePosition`, `verticalAlign`, `titleColor`, `textColor`, `borderColor`, `overlayColor`, `overlayOpacity`, `previewTheme` | — | `presentation` |
| «Дата публикации» | форма | режим «Сразу / С даты / Период»; `publishStartsAt`, `publishEndsAt` → `publication.startsAt/endsAt` и `placements[].startsAt/endsAt` | Выбор | тело POST/PATCH; `schedule.startsAt` |
| «Ссылка / путь» | `entry.slug` | генерируется из заголовка при создании, далее только показ («Адрес») | — | `publication.slug` |
| «Отменить» | — | — | Назад без сохранения | — |
| «Сохранить черновик» / «Сохранить изменения» | `allowedActions.edit` | — | Сохранить | `POST /admin/publications` или `PATCH /admin/publications/{id}` `{expectedVersion, publication}` |
| «Опубликовать» | `allowedActions.publish` | дата начала в будущем → отложенная | Сохранить и опубликовать | затем `POST …/{id}/publish {expectedVersion, endsAt}` или `POST …/{id}/schedule {expectedVersion, startsAt, endsAt}` (версия из ответа сохранения) |
| «Снять с публикации» (нет в макете) | `entry.status ∈ {published, scheduled}` | — | Клик | `POST …/{id}/unpublish {expectedVersion}` |
| «Удалить» (было в строке таблицы) | `allowedActions.delete` | диалог подтверждения | Подтверждение | `DELETE …/{id} {expectedVersion}` |
| «Предпросмотр карточек на сайте» | форма | для каждого включённого места: превью `publication-preview.html` публичного сайта (`VITE_SITE_URL`) через `postMessage`; метка «Индивидуальное оформление» / «Общие настройки» | — | — |
| Статус, Опубликована, Отложена на, Адрес, Версия | `entry`, `version` | `status`, `publishedAt`, `scheduledPublishAt`, `slug`, `version` | — | — |

Если список обновился (realtime `publications`) и версия записи изменилась после открытия формы — предупреждение; сохранение проверяет `expectedVersion` на сервере. Состояния редактора: загрузка, ошибка/403, «Публикация не найдена».

## Порядок слайдов

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Панель на каждое место-слайдер | `home.hero`, `home.promo`, `touge.featured_news` | — | — | `GET /admin/publications/placements/{code}/order` → `{ids, version}` |
| Строка «N. Название», slug, статус | `ids` + загруженный список | `revision.title`, `entry.slug`, `entry.status`; неизвестный id — «Нет в загруженном списке» | — | — |
| «↑ Вверх» (+ «↓ Вниз») | локальный порядок | — | Перестановка | — |
| «Сохранить порядок» / «Отменить» | `version` места | — | Сохранить | `POST …/placements/{code}/order {expectedVersion, ids}` |

Ленты (`home.feed`, `touge.feed`) отдельного порядка не имеют, как и в прежнем клиенте.

## Оформление карточек (`/event-cards`)

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Пояснение «без второй параллельной конфигурации» | — | — | — | — |
| Поиск «Название события или ID» | серверный фильтр | `q` | Ввод (с задержкой) | `GET /admin/events?limit=20&view=list&q=…` |
| Колонка «Событие» | `EventSummary` | `title`, `id` | Клик по строке → предпросмотр | — |
| Колонка «Тип» | `EventSummary` | `scenarioTitle`, иначе подпись `scenarioCode` | — | — |
| Колонка «Организатор» | `organizerId` + `GET /admin/access/organizers` | `name` | — | — |
| Колонка «Оформление» (нет в макете) | `presentation.cardAppearance` | «Собственное» / «Стандартное» | — | — |
| «Открыть редактор →» | — | — | Переход | маршрут `/events/{id}?section=appearance` (сохранение — команда редактирования события) |
| «Показать ещё» | курсор | `nextAfterId` | Клик | `afterId=…` |
| «Где настраивается карточка» | — | `event.presentation`: `coverUrl`, `subtitle`, `cardAppearance` | Ссылка на редактор | — |
| «Предпросмотр» | выбранное событие | сохранённое `cardAppearance` (нормализованное), рендер `event-card-preview` публичного сайта | — | — |
| «Все шаблоны» (замена прежней песочницы) | выбранное событие | все шаблоны карточек с данными и сохранённым оформлением события, только просмотр, переключатель темы | Показать/скрыть | — |

Прежняя страница показывала все шаблоны с вымышленным событием («Grand Prix of Siberia») и редактор, который ничего не сохранял. По макету и правилам (нет демо-данных, нет неработающих настроек) песочница заменена каталогом реальных событий; редактор оформления остаётся в событии (вкладка «Внешний вид», конструктор события → шаг «Внешний вид»). Панель редактора `EventCardStudioPanel` (используется `EventCardFields` в конструкторе) перерисована классами v16 без изменения пропсов и поведения; экспорты `PublicEventCardPreview`, `FONT_OPTIONS`, `CardTemplateRenderer`, `toEventCardSourceFromForm`, `formatCardDate` не менялись.

## Нет в API

- Общие для публикации «Подзаголовок» и «Текст кнопки» (кнопки есть только у размещений-слайдеров; подзаголовок — только `eyebrowOverride` размещения).
- Произвольная «Ссылка на обложку» размещения: модель хранит только `imageAssetId` из фотокаталога.
- Редактируемые «Статус» и «Ссылка / путь»: статус меняется командами `publish`/`schedule`/`unpublish`, `slug` задаётся при создании.
- Серверные поиск/фильтр/счётчики списка публикаций — список читается целиком (лимит 100 на страницу).
- Порядок для лент (`home.feed`, `touge.feed`).
- Отдельное право на снятие с публикации: `allowedActions` содержит только `edit`, `publish`, `delete`; кнопка доступна для опубликованных/запланированных, решение — за сервером.
- Отдельная платформенная конфигурация карточек событий (оформление хранится только в событии).

## Проверка

- Mock API: `admin/dev/mock-api/modules/site.mjs` — синтетические публикации всех статусов, версии и порядок мест; команды проверяют `expectedVersion`. Для вкладки «Порядок слайдов» в моке нужно право `publications.reorder.all` (в базовом доступе мока его нет).
- Превью публичного сайта (iframe на `VITE_SITE_URL`) без запущенного сайта пустые — это ожидаемо.
