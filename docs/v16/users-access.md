# Пилоты, организаторы и доступы, достижения, вход (v16)

Макет: `renderUsers`, `renderAccess`, `renderAchievements` в `design/LeagueSimRacing_Admin_All_Sections_v16.html`. Экрана входа в макете нет: карточка входа собрана на токенах v16 (`--lsr-bg`, `lsr-brandmark`).

Код: `admin/src/pages/users/**`, `admin/src/pages/access/**`, `admin/src/pages/achievements/**`, `admin/src/pages/auth/**`. Стили — `users.v16.css`, `access.v16.css`, `auth.v16.css` (префиксы `lsr-users-`, `lsr-access-`, `lsr-auth-`). Mock: `admin/dev/mock-api/modules/users.mjs`, `access.mjs`.

## Пилоты (`/users`)

Адрес: `?q=` и `?page=` — позиция списка, `?userId=` — профиль, `&tab=` — вкладка профиля, `&eventId=` — возврат к участникам события (ссылки из событий и матчмейкинга не менялись).

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Заголовок «Пилоты», крошки | — | — | — | — |
| KPI «Пилотов в выборке» | `GET /admin/users?q&page&pageSize=20` | `pagination.total` | — | — |
| KPI «Показано», «Профиль заполнен / не заполнен» (вместо «Активность сегодня», «С ограничениями», «Требуют внимания») | тот же ответ | `items.length`, `items[].complete` (только текущая страница, подписано) | — | — |
| Поиск «Имя, SteamID или ID» | тот же запрос | `q` (debounce 350 мс, Enter/blur — сразу) | ввод | — |
| Таблица: Пилот, SteamID | `items[]` | `presentation.displayName`, `presentation.avatarUrl`, `userId`, `shortName`, `steamId` | строка открывает профиль | — |
| Колонки PR, SR, Гонок, Последняя активность | **нет в API списка** | — | заменены на Страна, Discord, Профиль (`country`, `discord`, `complete`) | — |
| Фильтры «Все / Без ограничений / Внимание» | **нет в API** (`/admin/users` не фильтрует по санкциям) | — | не показываются | — |
| Пагинация | `pagination.page/totalPages/total` | — | «← Назад / Далее →» | `page=` |
| Шапка профиля: имя, бейдж, «ID · страна» | `GET /admin/users/{id}` | `presentation`, `complete`, `shortName`, `country`, `steamId` | «Открыть на сайте», «Редактировать профиль» (`actions.edit` или `actions.uploadAvatar`) | — |
| Вкладка «Профиль» → «Карточка пилота» | тот же ответ | имя, SteamID, имя/фамилия, три буквы, страна, имя в Steam, Discord, YouTube, `createdAt`, `updatedAt`, `enabledGames`, `missingFields` | — | — |
| «Последняя активность» | **нет в API профиля** (сессии — отдельная вкладка) | — | не показывается | — |
| «Текущее состояние»: Ограничения | `GET /admin/sanctions?userId&state=active&limit=5` | `items.length`, `nextAfterId` («5+») | ссылка «Ограничения и жалобы →» | — |
| «Текущее состояние»: Стартов, Побед, DNF | `GET /admin/users/{id}/history/participations?limit=5&page=1` | `totals.races/wins/dnf` | — | — |
| «Текущие рейтинги» PR/SR | `GET /admin/users/{id}/history/rating?gameCode&disciplineCode&limit=1` (кольцо; для AC ещё тоге) | `current.pilot.value`, `current.safety.value` | выбор игры | — |
| «Последние выступления», «Действующие ограничения» | те же два запроса | дата, событие, место, `finishStatus`; тип, причина, `endsAt` | ссылки на вкладки | — |
| «Выступления» (Выступления / Заявки / Матчмейкинг) | `history/participations` (page), `history/registrations`, `history/matchmaking` (cursor `afterId`) | как в прежнем компоненте | «Открыть» → диалог результатов (`ResultRevisions`), ссылки в судейство/runtime | — |
| Колонка «Сплит» | **нет в API истории** | — | не показывается | — |
| «Рейтинги»: KPI PR, SR, дисциплина, игра + история | `history/rating` (sequence `afterSequence`) | `current`, `items[].pilot/safety.before/after/delta`, `kind`, `reason`, `race` | выбор игры/дисциплины, графики по показанной странице | — |
| «Сессии и аудит» (Сессии входа / Игровые подключения / Журнал / Уведомления) | `history/sessions` (page), `history/presence`, `GET /admin/audit?subjectId|actorId&action&from&to` (cursor), `history/notifications` | как раньше | фильтры журнала | — |
| «Ограничения и жалобы» | `GET /admin/sanctions?userId`, `GET /admin/officiating/protests?userId&relation=authored|accused`, `GET /admin/officiating/protests/{id}` | только чтение | «Открыть судейство», диалог жалобы | — |
| «Каталог и доступы» (Скины / Каталог / Настройки / Уведомления / Роли и доступы) | `/skins/admin?ownerType=user&ownerId`, `/admin/catalog/items?createdByUserId`, профиль, `history/preferences`, `/admin/access/grants?subjectId` | как раньше | «Управление доступом» → `/access?userId=` | — |
| «Чаты» (нет в макете, сохранено) | `<ChatsPage userId>` во `EmbeddedContext` | — | — | API раздела «Чаты» |
| Редактор профиля (боковая панель) | `GET /admin/users/{id}`, `GET /site/countries` | поля профиля, `version`, `actions` | «Сохранить профиль» — только изменённые поля | `PATCH /admin/users/{id}`, `If-Match: version` |
| Аватар | тот же профиль | `presentation.avatarUrl`, `actions.uploadAvatar/deleteAvatar` | загрузка JPEG/PNG ≤ 5 МБ, удаление | `POST` / `DELETE /admin/users/{id}/avatar`, `If-Match: version` |
| Профиль изменён другим | realtime `profiles` → `GET /admin/users/{id}` | `version` | «Заменить форму актуальным профилем» | — |

Состояния: загрузка — скелетоны; пусто — «Пользователи не найдены» / «Записей пока нет.»; нет значения — «—»; ошибка — `ErrorState` с «Повторить»; 403 — «Недостаточно прав» (никогда не пустая таблица).

## Организаторы и доступы (`/access`)

Адрес: `?tab=users|roles`, `?organizer=<id|new>` — карточка организатора, `?userId=` — доступы пользователя (прежний вход из профиля сохранён).

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| «＋ Организатор» | права `organizers.write.all` | — | новая карточка | — |
| «Обновить» (нет в макете, сохранено) | — | — | перечитать роли и организаторов | — |
| Вкладка «Организаторы»: поиск, «Все / Активные / Выключенные» | `GET /admin/access/organizers?includeInactive=true` (массив, без пагинации — фильтр на клиенте честный) | `name`, `code`, `id`, `active` | — | — |
| Колонки «Разрешённые типы», «Квота» | тот же ответ | `settings.allowedEventRuntimeTypes`, `settings.max*`, `usage`, `remaining`, `quotaEnforcementMode`; `null` = «Без ограничений» | — | — |
| Колонка «Доступы» («N ролей») | **нет в API** (grants читаются только по `subjectId`) | — | заменена на «Доступ к записи»: Настроить / Оформление / Просмотр (`actions.edit/editPresentation`) | — |
| Карточка: KPI Состояние, События, Одновременно, Разрешённые типы | запись организатора | `active`, `usage.*` / `settings.max*`, `remaining.*` | — | — |
| «Основное» | запись | `name`, `code`, `active`, `description` | «Сохранить изменения» | `PUT /admin/access/organizers/{id}` (`If-Match`, `Idempotency-Key`) или `POST /admin/access/organizers` |
| «Настройки и квоты» | запись | `quotaEnforcementMode`, `maxEvents`, `maxRaceEvents`, `maxConcurrentEvents`, `maxConcurrentRaces` (пусто = без лимита, иначе целое > 0), разрешённые типы/режимы тоге/парные заезды | тот же | тот же |
| «Права» (участники организатора) | **нет в API** | — | вкладка не показывается | — |
| «Оформление»: ссылки, тема JSON, предпросмотр | запись | `settings.websiteUrl`, `settings.discordUrl`, `settings.theme` | тот же; для владельца без `actions.edit` — только Основное (название, описание) и Оформление | `PUT /admin/access/organizers/{id}/presentation` с `{name, description, theme, websiteUrl, discordUrl}` (`If-Match`, `Idempotency-Key`) |
| Вкладка «Доступы пользователей» (общая таблица выданных прав в макете) | **общего списка grants нет в API**; показан поиск пользователей `GET /admin/users?q&page&pageSize=20` | `userId`, `steamId`, `presentation` | «Роли и доступы» → карточка | — |
| Карточка пользователя: «Роли», фильтр «Все / Действует / Запланирован / Истёк / Отозван» | `GET /admin/access/grants?subjectId=` | `roleCode`, `scopeType/scopeId`, `validFrom/validTo`, `status` (серверный), `constraints` | «Изменить», «Отозвать», «История» | `PUT /admin/access/grants/{id}` / `DELETE /admin/access/grants/{id}` (`If-Match`, `Idempotency-Key`, DELETE без тела); `GET /admin/access/grants/{id}/history` |
| «Выдать роль» | `GET /admin/access/roles` | роль → область → организатор / ID события → срок (московское время) → ограничения роли | «Выдать роль» / «Сохранить доступ» | `POST /admin/access/grants` / `PUT …/{id}` |
| «Пароль админки» (нет в макете, сохранено) | — | `userId`, `adminPassword` | «Установить пароль», «Удалить пароль» | `PUT /admin/auth/password`, `DELETE /admin/auth/password/{userId}` |
| Вкладка «Роли» — матрица | `GET /admin/access/roles` | `title`, `code`, `scopeTypes`, `description`, `permissions` | раскрытие списка разрешений | — |

Ошибки команд переводятся по `error.code`: `last_platform_owner`, `version_conflict`, `version_required`, `grant_revoked`, `access_denied`, `organizer_code_exists`. Повтор неподтверждённой команды использует тот же `Idempotency-Key` (отпечаток: путь, метод, тело, версия).

## Достижения (`/achievements`)

| Элемент макета | Источник | Действие |
| --- | --- | --- |
| «Пока нет функций управления» | **нет в API** | — |
| «Что понадобится»: шаблоны, выдачи, история | текст | кнопок «Создать»/«Выдать» нет |

## Вход (`/login`, `/auth/steam/callback`)

| Элемент | Источник | Действие | Команда API |
| --- | --- | --- | --- |
| «Войти через Steam» | — | переход | `GET /admin/auth/steam` |
| Карточка Steam (аватар, имя, Steam ID) | `GET /users/me` (user token) | «Сменить» сбрасывает шаг | — |
| «Пароль админки», «Войти в админку» | — | вход | `POST /admin/auth/login` |
| Ошибка выхода / сессии | `location.state.authError` | — | — |
| Callback | `?code` / `?error` | обмен кода один раз, затем `/login`; ошибка — «Повторить вход» | `POST /auth/exchange` |

## Нет в API

- Список пилотов: PR, SR, число гонок, последняя активность, наличие ограничений; фильтр по ограничениям.
- Профиль: «Последняя активность», сплит в истории выступлений.
- Организатор: число ролей/участников, список grants по организатору (`/admin/access/grants` принимает только `subjectId`).
- Общая таблица выданных прав всех пользователей.
- Достижения: любые запросы.

## Mock API

- `users.mjs`: `/admin/users`, `/admin/users/{id}` (PATCH и аватар проверяют `If-Match`), `/admin/users/{id}/history/{section}` (page / cursor / sequence), `/site/countries`, чтение `/admin/sanctions`.
- `access.mjs`: роли, grants (статусы, история, `last_platform_owner`, версии), организаторы (POST, PUT, `/presentation`), пароль админки.
- Ядро (`server.mjs`) регистрирует `GET /admin/access/organizers` раньше модулей и отдаёт упрощённую форму (`limits`, `quotaEnforcementMode` на верхнем уровне, `actions: []`), которая не совпадает с `OrganizerRecord` (`settings`, `usage`, `remaining`, `actions.edit/editPresentation`). С ним вкладка «Организаторы» не отрисуется. Нужно в ядре удалить этот маршрут (модуль `access.mjs` отдаёт полную форму) или привести его к `OrganizerRecord`. Для проверки использовалась копия сервера без этого маршрута.
- Аудит, протесты, скины, каталог, чаты в профиле обслуживают модули соответствующих разделов.
