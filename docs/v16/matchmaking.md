# Матчмейкинг (v16)

Код: `admin/src/pages/matchmaking/`. Эталон: функции `renderMatchmaking`, `mmContent`, `mmIssues` макета.

| Файл | Назначение |
| --- | --- |
| `matchmaking-model.ts` | Типы ответов API, `initialConfig`, `configForSave`, расчёт вероятностей, подписи и тона статусов матча |
| `useMatchmaking.ts` | Загрузка очереди, live/журнала/аналитики, realtime-обновление, команды с `version` и `Idempotency-Key` |
| `MatchmakingPage.tsx` | Маршруты `/matchmaking` (вкладки) и `/matchmaking/matches/:id` (карточка матча) |
| `MatchRecords.tsx` | Таблицы «Участники в очереди» и матчей |
| `MatchPage.tsx`, `MatchDetails.tsx` | Карточка матча, раунды и заезды |
| `MatchmakingAnalytics.tsx` | Вкладка «Аналитика» |
| `MatchmakingSettings.tsx`, `PoolFields.tsx`, `CarPoolSelect.tsx`, `pool-catalog.ts`, `pool-validation.ts` | Конфигуратор |
| `matchmaking.v16.css` | Классы `lsr-mm-*` (аналоги `mm-*` макета) |

Вкладка и страница журнала хранятся в адресе: `?tab=matches&page=2`.

## Элементы макета и источники данных

| Элемент макета | Запрос | Поля ответа | Действие | Команда API |
| --- | --- | --- | --- | --- |
| KPI «Состояние» | `GET /admin/matchmaking` (затем `GET …/{id}/config` при каждом обновлении) | `items[]` с `config.gameCode='assetto_corsa'`, `enabled` | — | — |
| Кнопка «Включить / Выключить поиск» (в шапке страницы) | — | `id`, `version`, `enabled` | Переключение очереди | `POST /admin/matchmaking/{id}/enable` или `/disable`, тело `{version}`, `Idempotency-Key` |
| KPI «В очереди», таблица «Участники в очереди» | `GET /admin/matchmaking/{id}/live` | `queue[]`: `id`, `participantId`, `queuedAt`, `waitingSeconds` | Поиск по ID пилота/заявки (на клиенте), ссылка на пилота `/users?userId=` | — |
| KPI «Ожидание» | `GET …/live` | максимум `queue[].waitingSeconds` (дольше всех в текущей очереди) | — | — |
| KPI «Активных матчей», панель «Активные матчи» | `GET …/live` | `matches[]` | Строка открывает карточку матча | — |
| Панель «Журнал матчей» | `GET /admin/matchmaking/{id}/races?page&pageSize=20` | `items[]`, `total` | Страницы «Назад/Вперёд», строка открывает карточку | — |
| Колонки «Матч / Участники / Трасса / Начало / Окончание / Состояние» | `live.matches[]`, `races.items[]` | `id`, `players[].name`, `result.winnerId`, `result.roundsWon`, `condition.trackTitle/weatherTitle/pool.durationMinutes`, `startedAt ?? createdAt`, `finishedAt`, `status`, `runtimeStatus` | — | — |
| Карточка матча: KPI «Состояние / Старт / Финиш / Результат» | матч из `live` или страницы журнала | `status`, `startedAt`, `finishedAt`, `roundsWon`, `resultId` | — | — |
| «Ход матча»: пилоты, машины, готовность | то же | `players[]`: `name`, `ready`, `selection.carId/skinId`; названия машин — `GET /games/assetto_corsa/cars` | Ссылка на пилота | — |
| «Ход матча»: шаги | то же | `createdAt`, `readyDeadlineAt`, `runtimeSessionId`, `runtimeStatus`, `finishedAt` | — | — |
| «Раунды и заезды» | то же | `result.rounds[].heats[]`: `leaderId`, `chaserId`, `winnerId`, `status`, `attemptNumber`, `adjustedGapMs` | — | — |
| «Результат и диагностика» | то же | `failure`, `runtimeFailure`, `resultId`, `serverId`, `runtimeStatus`, длительность `finishedAt − startedAt` | «Решения по заезду» → `/officiating?matchmakingId&matchId&resultId`, «Журнал игры» → `/runtime?matchmakingId&matchId`, «Сессия №» → `/runtime?sessionId`, «Аудит» → `/audit?q=` | — |
| Аналитика: KPI | `GET /admin/matchmaking/{id}/analytics` | `matches`, `uniquePilots`, `finished`, `failed` | — | — |
| Аналитика: «Исходы матчей» | то же | `finished`, `failed`, `cancelled`, остаток = «В процессе» | — | — |
| Аналитика: «Выбор машин и победы», «Трассы», «Погода» | то же | `cars[]`, `tracks[]`, `weather[]` (`share`, `winRate` — проценты сервера; `winRate=null` → «—») | — | — |
| Настройки: плашки «Трассы / Общие машины / Погодные варианты / Проверка» | `config.pools` | включённые `tracks`, `carIds`, включённые `weather`; число замечаний `poolErrors` | — | — |
| «Общие правила»: допуск и дуэли | `config` | `pools.readyTimeoutSeconds`, `pools.minimumPilotLicense`, `pools.tiePolicy`, `duel.winsTo`, `duel.maximumOmtRounds` (только при OMT) | Редактирование формы | сохранение конфигурации |
| «Общие правила»: рейтинг | `config.rating` | `mode`, `pilotMultiplier`, `safetyMultiplier` | Редактирование формы | сохранение конфигурации |
| «Пул машин» | `config.pools`, `GET /games/assetto_corsa/cars`, `/car-sets` | `carIds`, `carSetCode`, `offerCount`, подпулы `tracks[].carIds` | Добавить/убрать машину, «Выбрать все», «Очистить», набор машин, число машин на выбор; строка подпула открывает трассу | сохранение конфигурации |
| «Погода» | `config.pools.weather`, `GET /games/assetto_corsa/weather-presets` | `key`, `title`, `enabled`, `weight`, `codes`, `weather` (WeatherConfig) | Добавить/удалить вариант, параметры WeatherConfig | сохранение конфигурации |
| «Трассы» | `config.pools.tracks`, `GET /games/assetto_corsa/tracks` | `code`, `layoutCode`, `weight`, `durationMinutes`, `enabled`, `carIds`, `weatherKeys` | Добавить/удалить трассу, подпул машин и допустимая погода (чипы с вероятностью) | сохранение конфигурации |
| «Игра и помощники» | `config.game` | `assists`, `environment`, `simulation` (без «Шин вне трассы»: всегда `-1`), `catalogChoices.pluginCodes` | Общий компонент `GameFields` (onlyRules) | сохранение конфигурации |
| «Проверка настройки» | `poolErrors(config.pools)` | — | Блокирует сохранение | — |
| «Сохранить конфигурацию» (в макете «Проверить и сохранить конфигурацию») | — | — | Сохранение | `PUT /admin/matchmaking/{id}/config` `{config, version}` или `POST /admin/matchmaking` `{config}` для новой очереди; `Idempotency-Key` |
| «Переход к пулам» (нет в макете, сохранено из старой админки) | `GET …/config` | `config.conditions`, `poolConversion.issues`, `poolConversion.config` | «Принять предложенное преобразование», «Настроить пулы вручную» | — (затем сохранение) |

Поведение, перенесённое без изменений: числовая `version` в теле; неподтверждённая команда (сеть/5xx) повторяется кнопкой «Повторить неподтверждённую команду» с тем же ключом и телом; 4xx сбрасывает команду, 409 включает «Настройки очереди изменены» с загрузкой актуальной версии, правки формы при этом остаются; при отсутствии очереди организатор League Sim Racing подбирается из `GET /admin/access/organizers`; запись доступна только с `matchmaking.manage.all` (иначе поля и команды неактивны, показано «Только просмотр»); realtime-домены `matchmaking`, `runtime`, `results`, `rating` перечитывают live, журнал, аналитику и версию конфигурации; `beforeunload` при несохранённых правках.

## Нет в API

- Чтение одного матча (`GET /admin/matchmaking/{id}/matches/{matchId}`). Карточка берёт матч из `live.matches` или из страницы журнала (`?page=`), с которой он открыт. Если матч сместился на другую страницу, показывается «Матч не найден» со ссылкой на журнал.
- Имя и рейтинг пилота в заявке очереди: есть только `participantId` (колонка «Рейтинг» макета не выводится, пилот показан как «Пилот №…»).
- Состояние заявки очереди (колонка «Состояние» макета): все заявки в `live.queue` ожидают, отдельного статуса нет.
- Среднее время ожидания (KPI «Ожидание» макета): показывается максимальное ожидание текущей очереди из `waitingSeconds`.
- Статистика «за сегодня» (KPI «Матчей сегодня» макета): аналитика отдаёт данные только за всё время.
- «Код сета машин» как свободное поле: в конфигурации — выбор набора из каталога `car-sets`.
- Редактирование названия очереди и организатора (в макете поля «Название очереди», «Организатор»): старая админка намеренно их не показывает; организатор выбирается автоматически.
- Статус готовности подбора `live.readiness` получен, но, как и в старой админке, не выводится.

## Проверка

- `npx vitest run --testTimeout=60000 src/pages/matchmaking` — версии и ключи команд, повтор неподтверждённой команды, 409, 403, права, проверка пулов, realtime-обновление, карточка матча.
- Mock: `admin/dev/mock-api/modules/matchmaking.mjs`; `MOCK_MATCHMAKING=empty|legacy|forbidden` включает состояния «не настроен», «прежняя модель», «нет прав».
