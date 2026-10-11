# События и викли: соответствие макета v16 и API

Источники: [ADMIN_API_MAP.md](../../ADMIN_API_MAP.md), [api-reference/workspace-schedule](../../api-reference/workspace-schedule/README.md), клиентские типы в `admin/src/pages/events/current`.
Макет: `design/LeagueSimRacing_Admin_All_Sections_v16.html` (список — основной документ, экраны события — встроенный `VIEWER_SOURCE`).

Обозначения: «—» в колонке команды означает только чтение. **Нет API** — элемент макета не может быть заполнен существующим контрактом и в интерфейсе заменён честным состоянием.

## Список событий (`/events`)

| Элемент макета | Источник | Поля | Действие | Команда |
| --- | --- | --- | --- | --- |
| Заголовок, «Создать событие» | права `events.write.*` из `AdminAccess` | `grants[].permissions` | Переход к редактору | — (маршрут `/events/new`) |
| Плашки «Всего / Идут / Запланированы / Черновики» | загруженные страницы `GET /admin/events?view=list` и `GET /admin/event-drafts` | `items[].status`, `nextAfterId` | — | — |
| Поиск | серверный фильтр | `q` | Ввод (с задержкой) | `GET /admin/events?q=…`, `GET /admin/event-drafts?q=…` |
| «Все типы событий» | серверный фильтр | `scenarioCode` | Выбор | `GET /admin/events?scenarioCode=…` |
| Фильтры статуса | серверный фильтр | `status` = `RUNNING` / `PUBLISHED` / `COMPLETED` / `CANCELLED`; «Черновики» = `publication=unpublished` + черновики редактора | Выбор | `GET /admin/events?status=…` |
| Строка: название, ID, описание | `EventSummary` | `title`, `id`, `description` (HTML → текст) | Открыть | маршрут `/events/{id}` |
| Тип | `EventSummary` | `scenarioTitle` (сервер), иначе подпись кода `scenarioCode` | — | — |
| Игра и организатор | `EventSummary` + `GET /admin/access/organizers` (если есть право) | `gameCode`, `organizerId` → `name` | — | — |
| Период / старт | `EventSummary.displaySchedule` | `startsAt`, `endsAt` в `timezone` события | — | — |
| Статус | `EventSummary.displayStatus` | `label` (текст), `code`/`freshness` (цвет) | — | — |
| Черновик: удалить | `Draft` | `id`, `revision` | Подтверждение | `DELETE /admin/event-drafts/{id}` `{expectedVersion: revision}` + `Idempotency-Key` |
| «Показать ещё» | курсоры | `nextAfterId` | Клик | `afterId=…` |

Ограничения: общего количества событий API не возвращает, поэтому плашки считают загруженные записи и при наличии следующей страницы показывают «N+».

## Событие викли: общая оболочка (`/events/{id}`)

| Элемент | Источник | Поля |
| --- | --- | --- |
| Хлебные крошки, «Назад» | маршрут + `WorkspaceSummary.event` | `title`, `scenarioTitle` |
| Заголовок и описание | `GET /admin/events/{id}/workspace` | `event.title`, `event.description` (HTML), `event.presentation.subtitle` |
| Статус события | `event.displayStatus` | `label`, `code`, `reason`, `freshness` |
| «Редактировать» / «Опубликовать» / «Копировать» / «Отменить» | `actions[]` | `code`, `enabled`, `reason.message` |
| Вкладки | тип сценария (`scenarioCode`) + наличие регистрации (`activity.hasRegistration`) | — |

Команды оболочки: `POST /publish {}`, `POST /cancel {expectedVersion, reason}` (может вернуть 202), `PATCH /admin/events/{id} {expectedVersion, patch}` для описания старых событий, `PUT /admin/event-authoring/events/{id} {expectedVersion, document}` для формы v2. Все — с `Idempotency-Key`; ключ и тело неподтверждённой команды сохраняются для повтора.

## Общая информация викли

| Элемент макета | Источник | Поля / правило |
| --- | --- | --- |
| ID, организатор, тип, период, сценарий | `WorkspaceSummary` | `eventId`, `metadata.organizer.name`, `event.scenarioTitle`, `event.displaySchedule`, `event.scenarioCode` |
| «N недель · M гонок / неделя · K запусков» | `WorkspaceSummary.program` | группы по `program[].group.key`; максимум гонок в группе; `counts.stages` |
| Текущая неделя | `program` + `currentStage` | группа блока `currentStage.key`, иначе первая группа с незавершёнными гонками; период = первая и последняя гонка группы |
| Текущая гонка: статус, план/факт | `program[]` | `displayStatus`, `startsAt`, `startedAt` |
| Требуют внимания | `program[]` | `displayStatus.code = FAILED` или `freshness = UNCERTAIN`; текст — `displayStatus.reason.message` |
| Ближайшие запуски | `program[]` | `displayStatus.code ∈ {SCHEDULED, WAITING}`, сортировка по `startsAt` |
| Метаданные | `metadata` | `author`, `createdAt`, `publishedAt`, `version`, `observedAt` |

## Недели серии

`program` уже содержит каждую гонку с серверной группой (`{key: 'week-N', title: 'Неделя N', kind: 'WEEK'}`), статусом и плановыми/фактическими датами, поэтому список недель строится без постраничного чтения всего расписания.

| Колонка | Правило |
| --- | --- |
| Неделя | `group.title`; подпись «Неделя i из n» по порядку групп; блоки с `group = null` показываются отдельной группой «Без недели» |
| Период | даты первой и последней гонки группы в часовом поясе события (это диапазон гонок, а не календарный период недели) |
| Трасса | уникальные `program[].track` группы; если трасс несколько — список |
| Гонки | завершённые (`displayStatus.code = COMPLETED`) / всего |
| Состояние | явная агрегация: есть идущая гонка → «Идёт»; все гонки в конечном статусе → «Завершена» (или «Завершена с ошибками» при `FAILED`); иначе «По плану». Сервер отдельного статуса недели не отдаёт |

## Неделя

| Элемент | Источник |
| --- | --- |
| Итоги (всего / завершено / идут / ошибки) | гонки группы из `program` |
| Параметры недели | `GET …/workspace/conditions?stageKey={ключ выбранной гонки}` — условия загружаются по ключу одной гонки и подписываются её именем; трассы всех гонок группы сравниваются по `program[].track`, чтобы не выдавать условия первой гонки за условия всей недели |
| Плановые параметры недели (трасса, погода, отличия) | `GET …/workspace/edit` → `settings.weekly.weeks[N-1]`, где N из `group.key` (`week-N`); показываются как настройки события, отдельно от сохранённых условий гонки |
| Таблица гонок по дням | гонки группы, день — локальная дата `startsAt` в часовом поясе события; колонки план старта / факт старта / факт окончания / состояние |
| Фильтры | клиентские, по уже загруженным гонкам группы: поиск по ID/времени, статус, день |
| Сплиты | **нет в `program`**: количество сплитов показывается на странице гонки (`schedule?stageKey`) |

## Гонка

| Элемент | Источник |
| --- | --- |
| Заголовок, статус, план старта | `GET …/workspace/schedule?stageKey={key}` → `items[0]` |
| Плановый / фактический старт / окончание / ожидаемое окончание | `plannedStartsAt`, `startedAt`, `finishedAt`, `estimatedEndsAt` (отсутствующий факт — «—») |
| Ход проведения | `progress[]` (сплиты: `title`, `status`, `displayStatus`, `participants`) |
| Сессии и сплиты | `sessions[]` (`id`, `serverId`, `displayStatus`, `connectedPlayers`) + узлы `progress` |
| Условия: трасса, конфигурация, машины, погода, программа сессий, помощники, симуляция | `GET …/workspace/conditions?stageKey={key}` → `stages[0]` (`track`, `layoutTitle`, `cars`, `weatherPresets`, `game.environment`, `settings`, `origins`) |
| Перенести | `actions[reschedule]` | `POST /reschedule {expectedVersion, changes:[{target:{type:'block', blockKey}, startsAt}]}` |
| Участники · фактический состав | `progress[].participants` по сплитам |
| Участники · заявки | `GET …/workspace/participants`; заявки относятся к окнам регистрации события. Связь окна с конкретной гонкой в ответе не передаётся, поэтому на странице гонки показывается пояснение и переход к заявкам события |
| Результаты | `resultIds[]` → `GET …/revisions?resultId=` → `GET …/result?resultId=&revisionId=` → `payload` (`RACE_CLASSIFICATION`: позиции внутри сплита) |
| История | факты блока и сессий: `plannedStartsAt`, `sessions[].requestedAt/startedAt/stoppedAt`, `startedAt`, `finishedAt`; без вычисления событий по календарю |

## Не хватает в API (зафиксировано)

1. Общее количество событий по статусам для плашек списка.
2. Сводный статус и календарный период недели (сейчас агрегируются в клиенте по явному правилу).
3. Количество сплитов в `program` для таблицы недели.
4. Связь окна регистрации с гонкой викли в проекции `participants`.
5. Фильтр `runtime-history` и `presence` по блоку (история гонки строится из полей блока и его сессий).
