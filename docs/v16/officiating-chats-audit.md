# Судейство, Чаты, Журнал действий — v16

Макет: `design/LeagueSimRacing_Admin_All_Sections_v16.html` → `renderOfficiating`, `renderChats`, `renderAudit`, `adminAction` (`save-decision`, `review-submit`, `confirm-hide`/`hide-message`).
Код: `admin/src/pages/officiating/**`, `admin/src/pages/chats/**`, `admin/src/pages/audit/**`. Стили: `<раздел>/<раздел>.v16.css` (префиксы `lsr-off-`, `lsr-chat-`, `lsr-audit-`). Mock: `admin/dev/mock-api/modules/{officiating,chats,audit}.mjs`.

Встраивание сохранено: `OfficiatingPage({initialEventId, visible})`, `ChatsPage({eventId, userId, active})`, `AuditPage({eventId, active})`. Встроенная страница не показывает заголовок модуля, оборачивает себя в `EmbeddedContext` (крошки страницы-хозяина не меняются), фильтрует данные по `eventId`/`userId`. В журнале события панели судейства рисуются «плоскими» (`lsr-off-flat`) внутри панели вкладки.

## Судейство

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Заголовок «Администрирование / Судейство» | — | — | — | — |
| KPI «Новые / В работе / Нужна информация / Решены» | **нет в API** | — | не показываются (список постраничный, считать по странице нельзя) | — |
| Очередь протестов: фильтр статусов | `GET /admin/officiating/protests?limit=30&status=` | `status` | смена фильтра перечитывает список | — |
| Поиск «Протест, событие, участник» | **нет в API** (нет `q`) | — | заменён полями «ID события», «ID организатора» + «Применить» | `eventId`, `organizerId` |
| Таблица: Протест / Событие / Заявитель / Участник / Создан / Статус | `{items, nextAfterId}` | `reason`, `id`, `incidentLocation`, `context.eventId` или матч из `context.source.id`, `submittedById`, `accusedId`, `createdAt` (необязательное поле, иначе «—»), `status` | клик по строке/названию открывает карточку | `GET /admin/officiating/protests/{id}` |
| «Ещё протесты» | `nextAfterId` | — | догрузка | `afterId=` |
| Карточка: заголовок, статус | `{report, history}` | `id`, `incidentLocation`, источник (`race:[result,split,occurrence]` / `res:[result,"matchmaking",match]`) | «← Протесты» — назад к очереди | — |
| «Материалы протеста» | `report` | заявитель, участник, место, источник, описание (`reason`) | — | — |
| «Доказательства» | `replayUploadId`, `videoUrl` | — | «Скачать реплей» (имя из Content-Disposition); видео — только http/https без учётных данных | `GET …/protests/{id}/replay` |
| Комментарии | `report.comments` | автор, время, текст | — | — |
| «История рассмотрения» | `createdAt`, `history[]` | `to`, `at`, `reason` | — | — |
| «Рассмотрение» (статус в макете — селект) | — | «Обоснование рассмотрения / переоткрытия» (обязательно), «Номер рассмотренного дубликата» (для «Дубликат») | кнопки переходов `under_review / needs_info / resolved / rejected / duplicate`; текущий статус неактивен | `POST …/protests/{id}/status` `{status, resolutionReason, duplicateOfProtestId}` + `Idempotency-Key` |
| «Рассмотрение и решение»: правило, пилот, штраф, сплит, гонка, обоснование («Сохранить локально») | `GET {owner}/penalty-rules[?resultId=]` | `rulesVersion`, `rules[].ruleCode/title/description/values` | «Загрузить правила и решения»; список правил и значения штрафа — только из ответа; значение отправляется, если у правила есть `values`; «Сохранить черновик» | `POST {owner}/decisions` `{resultId, ruleCode, rulesVersion, participantId, target, value?, participantIds?/winnerId? (match_outcome), reason, submitted:false, reportId, supersedesDecisionId}` |
| — (нет в макете) Таблица решений | `GET {owner}/decisions?limit=30` | `id`, `effect` (тип, пилот, мс, область), `reason`, `source.id`, `status`, `supersedesDecisionId` | «Ещё решения» | `afterId=` |
| Редактирование черновика | решение `draft` | «Причина изменения» обязательна | «Редактировать черновик» → «Сохранить изменения» | `PATCH {owner}/decisions/{id}` `{expectedVersion, changeReason, reason, …}` |
| Вынесение | `draft/submitted/approved` | — | «Вынести решение» → подтверждение | `POST {owner}/decisions/{id}/issue` `{expectedVersion}` |
| Замена | `applied` | — | «Подготовить замену» → новый черновик с `supersedesDecisionId` | `POST {owner}/decisions` |
| Отмена | кроме `cancelled/superseded` | «Причина отмены» в диалоге (обязательно) | «Отменить решение» | `POST {owner}/decisions/{id}/cancel` `{reason}` |
| Матч матчмейкинга | `GET /admin/matchmaking/matches/{matchId}/context` | `matchmakingId`, `matchId` | `owner = /admin/matchmaking/{id}/matches/{matchId}` | — |
| Неподтверждённая команда | — | — | «Повторить ту же команду» — тот же ключ, путь и тело; 4xx (кроме 408) снимает блокировку | — |
| Обновление | realtime `reports`, `results` | — | перечитывает очередь, открытый протест и решения | — |

Глубокие ссылки: `?eventId=&resultId=` или `?matchmakingId=&matchId=&resultId=` (страница результатов события, матчмейкинг) — правила и решения загружаются сразу.

## Чаты

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| Вкладки «Чаты / Журнал проверок / Объявление» | — | — | в профиле пилота (`userId`) только «Чаты»; в журнале события — сегменты | — |
| «Доступные чаты»: поиск, тип | `GET /admin/chat/threads?limit=50&q=&type=&eventId=&userId=&cursor=` | — | поиск с задержкой 350 мс; «Личные/События» | `{items, nextCursor}` |
| Таблица: Чат / Тип / Сообщений / Состояние | thread | `type`, `eventId`, `id`, `messageCount`, `status` | клик открывает запрос проверки (текст не загружается) | — |
| Колонка «Последняя активность» | **нет в API** | — | заменена колонкой «Событие» | — |
| «Запрос проверки» | — | «Причина доступа к переписке» (обязательно, до 4000 символов; в макете ≥10 символов — текущий код и API требуют только непустую причину) | «Зарегистрировать проверку» / «Отменить» | `POST /admin/chat/threads/{id}/review` `{reason}` + `Idempotency-Key` → `{reviewId}` |
| «Контекст чата» | thread | тип, сообщений, событие, статус | — | — |
| «Сообщения» | `GET …/threads/{id}/messages?reviewId=&limit=50[&beforeId=]` | `kind`, `authorName/authorUserId`, `createdAt`, `originalBody`, `moderation.hidden` | «Предыдущие сообщения» (`hasMore`, `nextBeforeId`); «Завершить просмотр» — закрывает экран (команды завершения проверки в API нет) | — |
| «Скрыть сообщение · причина» | — | «Причина скрытия» обязательна | «Скрыть» | `POST …/messages/{messageId}/hide` `{reviewId, reason}` |
| «История проверок» | `GET /admin/chat/reviews?limit=50&q=&eventId=&userId=&cursor=` | `reviewId`, `threadId`, `actorId`, `reason`, `createdAt` | поиск, «Показать ещё» | — |
| «Объявление пользователям» | — | аудитория (пользователи по ID / принятые участники события; в журнале события — фиксированное событие), путь на сайте, заголовок (180), текст (4000) | «Отправить объявление» → подтверждение; «Очистить» | `POST /admin/notifications/announcements` `{audience, title, body, actionUrl}` |
| Результат объявления | `{recipientCount}` | — | «Выбрано получателей: N. Это не подтверждение доставки» | — |
| Аудитория «Все пользователи» | **нет в API** | — | не предлагается | — |

Команды чатов хранят `Idempotency-Key`, пока сервер не ответил окончательно: повтор того же пути и тела после потерянного ответа уходит с тем же ключом.

## Журнал действий

| Элемент макета | Источник | Поля | Действие | Команда API |
| --- | --- | --- | --- | --- |
| KPI «Записей / Пользовательские / Системные / Период» | **нет в API** | — | не показываются | — |
| Поиск | `GET /admin/audit?limit=50&q=&eventId=&cursor=` | — | поиск по всему журналу с задержкой, курсор сбрасывается; `?q=` из адреса | `{items, nextCursor}` |
| Фильтр «Все модули / События / …» | **нет в API** (нет кода модуля в записи) | — | не показывается | — |
| Таблица: Время / Инициатор / Действие / Целевой объект / Область | `AuditItem` | `at` (с секундами), `actor` (Система / Пользователь N → профиль), `action` (код) + `reason`, `target.type · target.id`, связи `eventId`/`organizerId` | клик открывает карточку | — |
| Человекочитаемое название действия | **нет в API** | — | показывается серверный код `action` | — |
| «Событие аудита» | запись | время, инициатор, действие, объект, причина, `changes` (таблица «до/после» для `{поле:{before,after}}`, иначе JSON) | «← Журнал действий» | — |
| «Трассировка» | запись | `id`, `commandId`, объект, `eventId`, `organizerId`, `subjectId`, полный JSON | — | — |
| «Показать ещё» | `nextCursor` | — | догрузка | `cursor=` |

## Нет в API

- Агрегаты для KPI судейства и журнала (счётчики по статусам, период).
- Текстовый поиск по протестам; фильтр журнала по модулю; человекочитаемые названия действий журнала.
- `createdAt` протеста отсутствует в типе клиента страницы судейства, но используется в профиле пилота; поле показано как необязательное.
- Время последней активности чата; аудитория «все пользователи» для объявлений; команда завершения проверки чата.
- Правила судейства не описывают набор полей формы: поля пары (`participantIds`, `winnerId`) по-прежнему привязаны к коду `match_outcome`; единицы `values` (мс) приняты по текущему коду.
