# Серверы практики и игровые серверы: соответствие макета v16 и API

Источники: [ADMIN_API_MAP.md](../../ADMIN_API_MAP.md) («Серверы практики и runtime», приложение A/B), клиентские типы `admin/src/pages/practice-servers/practice-types.ts`, `admin/src/pages/runtime/runtime-monitoring.ts`.
Макет: `design/LeagueSimRacing_Admin_All_Sections_v16.html` — `renderPractice`, `practiceForm`, `practiceCarChoices`, `withPracticeDefaults`, `adminAction('practice-*')`, `renderRuntime`.

Обозначения: «—» в колонке команды — только чтение. **Нет API** — элемент макета не заполняется существующим контрактом; в интерфейсе вместо него честное состояние или другое реальное поле.

Общие правила раздела:

- Команды практики отправляются через `command()` (`features/standalone/GameFields.tsx`) с `Idempotency-Key`; неподтверждённая команда (сеть/5xx) остаётся в `pending` и повторяется тем же ключом и телом кнопкой «Повторить неподтверждённую команду». 4xx сбрасывает ключ; 409 на сохранении настроек включает режим конфликта.
- Доступность команд — только `allowedActions` сервера; недоступная кнопка неактивна с подсказкой. Создание — права `practice.manage.all|scoped`. Ссылка «Игровые серверы →» — права `events.override.all|monitoring.read`.
- Обновление: `subscribeAdminRefresh(['practice','runtime'])` для практики; `admin:runtime` / `runtime.snapshot` для игровых серверов с порядком по `checkedAt` (старый снимок не заменяет новый).
- Загрузка, пусто, «—», ошибка и 403 различаются: `LoadingBlock`/скелетон, `EmptyState`, `ErrorState` (403 → «Недостаточно прав»).

## Серверы практики: список (`/practice-servers`)

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| «＋ Создать сервер» | `AdminAccess` | `practice.manage.*` | Переход | маршрут `/practice-servers/new` |
| KPI «Серверов / Активные / На паузе / С ошибкой» | `GET /admin/practice-servers` | `total`; при неполной странице — `total` запросов с `status=ACTIVE|PAUSED|FAILED` | — | `GET /admin/practice-servers?page=1&pageSize=20&status=…` |
| Фильтры «Все / Активные / На паузе / Остановленные / С ошибкой» | серверный фильтр | `status` | Выбор (страница → 1) | `GET /admin/practice-servers?page=1&pageSize=20&status=…` |
| Строка: название, ID | `Server.config` | `title`, `id`, `disciplineCode` | Открыть (строка или ссылка) | маршрут `/practice-servers/{id}` |
| Состояние | `practiceServerStatus(Server)` | `status`, `currentCycle.resourceState`, `currentCycle.failure` | — | — |
| Трасса / конфигурация | `config.game.track` + каталог | `code`, `layoutCode` → `GET /games/{gameCode}/tracks` (`title`, `metadata.layouts`) | — | — |
| Участники → **Мест** | `config.practice` | `maxParticipants` | — | — |
| Текущий цикл | `currentCycle` | `startedAt` + `sessionDurationMinutes` (плановое окончание, только отображение), `runtimeSessionId` | — | — |
| Организатор | `config.organizerId` + `GET /admin/access/organizers` | `name` (иначе «Организатор №id») | — | — |
| Кнопка питания (нет в макете, сохранена) | `isPowered`, `allowedActions.start|stop` | `status`, `currentCycle` | «▶ Запустить» сразу; «⏹ Остановить» — диалог подтверждения | `POST /admin/practice-servers/{id}/start|stop` `{}` |
| Пагинация | `total` | `page`, `pageSize=20` | ← / → | `GET …?page=N&pageSize=20` |

## Сервер практики: Лайв (`/practice-servers/{id}`)

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Заголовок, статус, описание | `GET /admin/practice-servers/{id}` | `config.title`, `gameCode`, `disciplineCode`, `description` | — | — |
| Вкладки «Лайв / Журнал сессий / Настройки» | маршрут | `?tab=sessions`, `/edit` | Переход (с подтверждением при несохранённых правках) | — |
| KPI «Подключения» → **«Мест»** | `config.practice.maxParticipants`, `currentCycle.runtimeSessionId` | — | — | — |
| KPI «Состояние» | `practiceServerStatus` | — | — | — |
| KPI «Текущий цикл» | `currentCycle.startedAt` + длительность | плановое окончание | — | — |
| KPI «Следующий цикл» | `nextEligibleAt`, `status` | «Не раньше …», «По завершении», «На паузе», «Не запланирован» | — | — |
| «Текущая сессия»: трасса, игра, погода, длительность, машины, перезапуск | `config` + каталог | `game.track`, `game.environment.weather.presetCode` (→ `weather-presets`), `game.cars.allowedCarIds` (→ `cars`), `extraDelaySeconds` | — | — |
| Запуск цикла, состояние процесса, автозапуск | `currentCycle`, `status` | `startedAt`, `resourceState ?? state`, `status` | — | — |
| Предупреждения | `currentCycle.connectionLostAt`, `currentCycle.failure`, `lastCycle.failure` | потеря связи ≠ остановка | — | — |
| «Пауза после сессии» (ACTIVE) / «▶ Запустить сервер» | `allowedActions.pause|start` | — | Клик | `POST …/{id}/pause` или `…/start` `{}` + `Idempotency-Key` |
| «⏹ Принудительно остановить» | `allowedActions.stop` | — | Диалог «Принудительно остановить сервер?» | `POST …/{id}/stop` `{}` + `Idempotency-Key` |
| «↻ Перезапустить сервер» | `allowedActions.restart` | — | Диалог «Перезапустить сервер?» | `POST …/{id}/restart` `{}` (одна команда, не stop+start) |
| «Сервер и подключения» | `Server` | `maxParticipants`, дисциплина, статус, конфигурация, организатор, `runtimeSessionId`, `lastCycle`, `configVersion` | — | — |
| «Журнал игры →» | маршрут | — | Переход | `/service-journal?practiceServerId={id}` → `GET /admin/practice-servers/{id}/game-chat?limit=50[&afterId]` |
| «Последнее действие администратора» | **Нет API** | — | не показывается | — |

## Сервер практики: Журнал сессий (`?tab=sessions`)

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| «Прошедшие циклы» | `GET /admin/practice-servers/{id}/sessions` | `executionId`, `runtimeSessionId`, `startedAt`, `finishedAt`, `state`, `failure.code` | ← / → | `?page=N&pageSize=20` |
| Колонки «Плановый старт», «Участники» | **Нет API** | — | заменены на «Сессия», «Ошибка» | — |

Журнал загружается только при открытии вкладки.

## Сервер практики: Настройки / создание (`/edit`, `/new`)

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| «Основное»: название, организатор, дисциплина, описание | `Config` | `title`, `organizerId` (только при создании), `disciplineCode` (только при создании), `description` | Ввод | — |
| «Тренировочная сессия» | `Config` | `sessionDurationMinutes` (= `practice.durationMinutes`), `practice.maxParticipants`, `extraDelaySeconds` | Ввод, проверка `practiceIssues` | — |
| «Трасса», «Класс машин», «Погода», «Помощники», «Состояние трассы», «Правила симуляции», «Плагины» | общий `GameFields` → `ContentSelectionFields` | `config.game.*` | Выбор из каталога организатора | `GET /games/assetto_corsa/{cars,tracks,car-sets,catalog/plugin,weather-presets}` |
| «Нужно исправить» | `practiceIssues(config)` | — | Переход к панели | — |
| «Сохранить для следующего цикла» | `Server.configVersion` | `{config, version}` | Сохранение | `PUT /admin/practice-servers/{id}/config` + `Idempotency-Key` |
| «Создать остановленный сервер» | — | `{config}` | Создание | `POST /admin/practice-servers` + `Idempotency-Key` → переход на сервер |
| «Отменить изменения» / «Отменить» | baseline формы | — | Сброс / выход (с подтверждением) | — |
| Конфликт версии | 409 или новая `configVersion` при обновлении | правки остаются в форме | «Загрузить актуальные настройки» | `GET /admin/practice-servers/{id}` |
| «Машины по умолчанию», «Режим погоды DYNAMIC», фиксированный список машин макета | реализованы общими полями каталога | — | — | — |

## Игровые серверы (`/runtime`)

Все данные — один снимок `GET /admin/runtime/ac/daemon` (и `admin:runtime` → `runtime.snapshot`). Слот, процесс и сессия — разные данные: занятый слот не доказывает работу процесса, отсутствие свежего наблюдения не означает остановку, будущая нагрузка — только `reservations`.

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Строка свежести (нет в макете) | `Snapshot` | `stale`, `daemonId`, `receivedAt`, `checkedAt` | — | — |
| «↻ Обновить» | — | — | Перечитать снимок | `GET /admin/runtime/ac/daemon` |
| KPI «Всего / Занято / Свободно» | `slots[]` | `state` (`ALLOCATED`, `AVAILABLE`), `queue.length` | — | — |
| KPI «Ошибки» → **«Нужна проверка»** | правило UI | слот `FAILED/UNAVAILABLE`, или `ALLOCATED` без процесса `running`, или сессия с `connectionLostAt` | — | — |
| Вкладка «Слоты»: поиск, фильтры «Все / Заняты / Свободны / Нужна проверка» | весь снимок (фильтр на клиенте полон) | `serverId`, `serverCode`, `session.id` | Ввод / выбор | — |
| Строка слота: слот, состояние, назначение, игроки, старт, окончание | `slots[]`, `activeSession()` | `state`, `availableAt`, `sessions[].sessionTypes/id/displayStatus/connectedPlayers/startedAt/estimatedEndsAt` | Открыть слот | `/runtime?slot={serverId}` |
| Колонка CPU → **«Процесс»** | `processFor()` → `metrics.servers[]` по `serverCode` | `status`, `pid` | — | — |
| Вкладка «Сессии»: «Текущие / История» | `sessions[]` | `status` (история: `STOPPED/CANCELLED/FAILED`), `serverId`, `connectedPlayers`, `startedAt`, `estimatedEndsAt`/`stoppedAt`, `displayStatus.reason`, `reservationId` | Переход к слоту | `/runtime?slot=…`; `?sessionId=` из события подсвечивает строку |
| Вкладка «Очередь запуска» | `queue[]` | `runtimeSessionId`, `requestedAt`, `plannedStartsAt`, `reservationId` | — | — |
| Вкладка «Будущая нагрузка» | `reservations[]` (окончание позже `checkedAt`) | `startsAt`, `estimatedEndsAt`, `owner.type/id`, `serverCount`, `status`; пик — `plannedPeak()` | Ссылка на событие/сервер практики | маршруты `/events/{id}`, `/practice-servers/{id}` |
| Вкладка «Демон»: KPI и «Наблюдаемая система» | `metrics` | `process.pid/cpuPercent/memoryRssBytes/memoryHeapUsedBytes`, `uptimeSeconds`, `system.platform/arch/cpuCount/loadAverage/cpuPercent/memoryFreeBytes/memoryTotalBytes`, `plugin.status` | — | — |
| `?eventId=` (переход из события) | маршрут | — | «← К событию» в топбаре | `/events/{id}?section=execution&view=servers` |

### Карточка слота (`/runtime?slot={serverId}`)

| Элемент макета | Источник | Поля |
| --- | --- | --- |
| KPI «Состояние / Сервер / Хост / CPU» → «Состояние слота / Сервер / Процесс / Игроки» | `slot`, `processFor`, `activeSession` | `state`, `serverCode`, `status`/`pid`, `connectedPlayers` |
| «Текущая работа» | `activeSession` | `id`, `displayStatus`, `startedAt`, `estimatedEndsAt`, `runtimeRunId`, `reservationId`, `connectionLostAt` |
| «Телеметрия и диагностика» | `Snapshot`, процесс | `stale`, процесс, `runtimeRunId`, `daemonId`, `receivedAt` |
| Другие сессии слота | `sessions[]` с тем же `serverId` | — |

### Журнал игры (`/service-journal?practiceServerId=…`, `/runtime?matchmakingId=…&matchId=…`)

`OwnerGameJournal`: `GET {owner}/game-chat?limit=50[&afterId=nextCursor]`, обновление по `chat/runtime/matchmaking/practice`. Отображение — `lsr-log`, «Ещё сообщения», «↻ Обновить».

## Нет в API

- Поиск по списку серверов практики (параметра `q` нет) — поиск в макете не выводится.
- Количество подключённых пилотов сервера практики (`Server` не содержит `connectedPlayers`); вместо «14 / 24» — «Мест».
- Плановый старт цикла и число участников в журнале циклов.
- «Последнее действие администратора» на сервере практики.
- Счётчики практики по статусам одним запросом: KPI собираются из `total` фильтрованных запросов (или локально, если весь список на одной странице).
- CPU/RAM отдельного игрового сервера, хост процесса, живой журнал процесса (`metrics.servers[]` даёт только `status`, `pid`, `runtimeSessionRefId`, `runtimeRunId`).
- Назначение (событие/матч) сессии runtime: у `Session` есть только `reservationId`; владелец известен только для резервов.
- Команды рестарта слота, снятия резерва, освобождения слота — нет; в карточке слота это сказано явно.
- Ссылка на матчмейкинг из резерва: маршрута матча по `owner.id` очереди нет, показывается текстом.
