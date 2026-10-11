# Workspace schedule: контракт и серверная группировка недель

Этот пакет отвечает на вопрос: **какую реальную форму имеет `workspace/schedule` и как гонки объединяются в недели?**

Здесь только относящиеся к этому вопросу серверные исходники из `shared-frontend-backend-source-20261010-224621.zip`, уже использованного при подготовке карты API. Это справочный срез, не отдельный запускаемый backend: его внутренние зависимости и инфраструктура намеренно не включены. Исходники в `source/` скопированы без изменений. Админка их не импортирует.

## Где смотреть

- [event-workspace.service.ts](source/src/modules/events/event-workspace.service.ts) — метод `snapshot()` формирует блоки, ветка `section === 'schedule'` формирует ответ; соседняя ветка `conditions` формирует игровые условия.
- [workspace-week.ts](source/src/modules/events/workspace-week.ts) — точная логика номера недели викли.
- [event-status.ts](source/src/modules/events/event-status.ts) — `blockGroup()` для чемпионата/турнира, вычисление отображаемых статусов и прогресса.
- [authoring-time.ts](source/src/modules/events/scenarios/authoring-time.ts) — преобразование времени в часовой пояс события.
- [event-management.controller.ts](source/src/api/events/event-management.controller.ts) — маршрут, авторизация, query-параметры и их проверка.
- [event-workspace.contract.ts](source/src/modules/events/event-workspace.contract.ts) — секции workspace и параметры страницы.
- [block-inspection.service.ts](source/src/modules/blocks/block-inspection.service.ts) — источник исполнений, участников и прогресса.
- [runtime-status.contract.ts](source/src/modules/runtime/runtime-status.contract.ts), [event-related-status.ts](source/src/modules/events/event-related-status.ts) — статусы сессий и регистрации.
- [schedule.example.json](schedule.example.json) — искусственный пример формы ответа с двумя неделями. Это не выгрузка реального события.

## HTTP-контракт

```http
GET /admin/events/{eventId}/workspace/schedule?limit=25
Authorization: Bearer <admin-access-token>
```

| Параметр | Значение |
| --- | --- |
| `eventId` | ID события; требуются права чтения этого события |
| `limit` | По умолчанию 25, максимум 100 |
| `afterId` | ID последнего блока предыдущей страницы, берётся из `nextAfterId` |
| `stageKey` | Необязательный ключ **одного блока**, а не ключ недели. Неизвестный ключ даёт `event_block_not_found` (404) |

Ответ:

```ts
{
  items: ScheduleBlock[];
  nextAfterId: string | null;
  registrations: Array<{
    key: string;
    config: ResolvedRegistrationConfig;
    displayStatus: DisplayStatus;
  }>;
  dependencies: BlockInputPlan[] | null;
}
```

Имена `ScheduleBlock` в этом документе — поясняющие названия проекции. `ResolvedRegistrationConfig` и `BlockInputPlan` принадлежат внутренним контрактам backend; полный серверный SDK здесь не объявляется. Их значения фактически возвращаются из `registration.definition.config` и `plan.components.blockInputs`.

Список сортируется **по числовому ID блока по возрастанию**, не по времени старта. Для полного расписания нужно читать страницы до `nextAfterId === null`. Один ответ может содержать только часть недели; одна неделя может пересекать границу страниц.

Сервер не принимает `weekKey` как фильтр этого запроса. Для отдельной недели следует выбрать её блоки по `group.key` из собранного расписания. `stageKey=week-1` не является способом запросить неделю, если `week-1` не является настоящим ключом блока.

## Точная проекция блока

| Поле | Откуда берётся / смысл |
| --- | --- |
| `id` | ID блока; строка, используется в пагинации |
| `key` | `definition.key`; ключ для `stageKey` |
| `title`, `type` | Название и тип из определения блока |
| `status` | `execution.status`, либо `PENDING`, если исполнения ещё нет |
| `executionId` | ID исполнения либо null |
| `plannedStartsAt` | `definition.schedule.startsAt` |
| `estimatedEndsAt` | `definition.schedule.estimatedEndsAt` |
| `startedAt`, `finishedAt` | Фактические даты исполнения либо null |
| `actualParticipantIds` | Участники из исполнения, по умолчанию `[]` |
| `displayStatus` | Серверная проекция статуса с учётом исполнения и runtime |
| `group` | Группа недели/этапа/раунда либо null |
| `progress` | Рекурсивный прогресс: сплиты, внутренние заезды и другие узлы |
| `resultIds` | ID результатов этого блока из графа события |
| `sessions` | Записи runtime-сессий этого исполнения, дополненные `displayStatus` |

`status` и `displayStatus.code` могут различаться. Например, ещё не исполнявшийся блок имеет `status=PENDING`, а его отображаемый статус — `SCHEDULED`. Не выводить факт проведения из плановых дат.

```ts
type Group = { key: string; title: string; kind: string } | null;
type DisplayStatus = {
  code: string;
  label: string;
  reason: { code: string; message: string } | null;
  effectiveAt: string | null;
  observedAt: string;
  freshness: 'CURRENT' | 'UNCERTAIN';
};
```

`progress` содержит `key`, `title`, `status`, `runtimeSessionId`, `participants`, `children`, `displayStatus`. Массив `sessions` содержит серверные runtime-записи; не следует ограничивать их форму полями `id/status` только потому, что старый клиент использует именно их.

## Викли: как появляется неделя

В `snapshot()` для `scenarioCode === 'weekly'` вызывается:

```ts
workspaceWeek(plan?.settings, definition.schedule.startsAt, event.timezone, event.startsAt)
```

1. Начало календаря: `settings.weekly.firstDate`, иначе `settings.firstDate`, иначе локальная дата `event.startsAt`.
2. Дата гонки получается из её планового старта в **часовом поясе события**.
3. Вычисляется число полных семидневных интервалов между этими календарными датами.
4. Возвращается `{key: 'week-N', title: 'Неделя N', kind: 'WEEK'}`, где `N = floor(days / 7) + 1`.

Это последовательные интервалы по 7 дней от первой даты серии, **не ISO-недели с понедельника**. Для отображения не нужно повторять этот расчёт в браузере: группировать по уже полученному `group.key` и показывать `group.title`.

Следствия действующего алгоритма:

- Перенос гонки через границу интервала меняет её группу по новой плановой дате.
- День около полуночи UTC может относиться к следующей локальной дате. Нельзя группировать через `plannedStartsAt.slice(0, 10)`.
- Пустая неделя, в которой нет блоков, не появляется в `items` отдельной строкой.
- `group` не содержит периода, погоды, трассы или суммарного статуса недели.
- Алгоритм не ограничивает номер снизу: если гонка окажется раньше первой даты, возможен неположительный номер. Это описание фактической функции, не рекомендация создавать такие данные.

## Чемпионат и турнир

Для остальных сценариев используется `blockGroup()`:

- Чемпионат: ключи блока `stage-N-practice` / `stage-N-race` объединяются в `group.key=stage-N`, `kind=STAGE`. Заголовок получается из названия без суффикса «: гонка» / «: практика».
- Турнир: при наличии настроек раунда возвращается группа с ключом `${bracket}-${round}` и `kind=ROUND`.
- Если правило не подходит, возвращается `null`.

Не считать `group.kind` общим статусом: `WEEK`, `STAGE`, `ROUND` — вид группы.

## Где трасса, машины и погода недели

`schedule.items` не содержит полной информации об условиях. Для выбранного блока:

```http
GET /admin/events/{eventId}/workspace/conditions?stageKey={block.key}
```

Ответ содержит `stages[]`. Элемент с соответствующим `key` включает:

- `track`, `layoutTitle`, `cars`, `carClass`;
- `weatherPresets`, `plugins`, `content` с закреплёнными `itemId/versionId`;
- `game`: track, cars, environment, assists, simulation, finishRules, catalogChoices;
- `settings`, `admission`, `origins` (`COMMON`, `STAGE`, `OVERRIDE`).

В запросе без `stageKey` текущая реализация отдаёт условия всех блоков плана: это потенциально тяжёлый ответ. Для выбранной гонки достаточно запроса с её ключом.

Для общей плашки недели сначала определить, одинаковы ли условия дочерних гонок. Если есть переопределения, нельзя выдавать условия первой гонки за условия всей недели. Даты первой/последней гонки — диапазон гонок, не автоматически полный календарный период недели. Суммарный статус недели отсутствует отдельным полем API: правила его агрегации должны быть явными.

## Что изменить в клиенте

1. Прочитать страницы `schedule`, объединить блоки по `id` без дублей.
2. Сгруппировать блоки по `group.key`; для `group=null` сохранить отдельное отображение, не смешивать все такие блоки в одну неделю.
3. Внутри группы сортировать для отображения по `plannedStartsAt`, при равенстве использовать устойчивый порядок. Курсор продолжать брать из ответа сервера, не из последней визуально отсортированной строки.
4. Показывать серверное `group.title`; раскрытие группы показывает её гонки. Для полной иерархии не ограничиваться первой страницей.
5. Условия подгружать по ключу выбранного блока. Не выдавать загрузку или отсутствующее значение за ноль/ясную погоду.
6. Использовать `displayStatus` для подписи/семантики, а плановые и фактические даты показывать раздельно.

В опубликованной админке широкий тип блока в `admin/src/pages/events/current/event-api.ts` уже содержит `group`, однако `WorkspaceConduct` не использует его для построения иерархии недель. Узкий `WorkspaceSummary.program` также не описывает все поля, которые сервер может вернуть. Проверять нужно серверную проекцию и реально используемый запрос, а не только короткий клиентский тип.

## Ограничения примера

`schedule.example.json` — искусственный пример минимального расписания будущих гонок. Значения ID, названия и даты придуманы; реальные пользовательские данные отсутствуют. Пустые `registrations`, `sessions`, `progress` не показывают все возможные варианты вложенных объектов. Точная логика формирования находится в приложенных исходниках. Авторизованный ответ работающего сервера в этот пакет не включён.
