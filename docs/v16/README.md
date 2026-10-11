# Админка v16: дизайн-система и правила

Эталон: `design/LeagueSimRacing_Admin_All_Sections_v16.html`. Экраны событий — во встроенном документе `VIEWER_SOURCE`, конструктор — `CREATOR_SOURCE`, модули (матчмейкинг, серверы, каталог, …) — функции `render*` основного документа (`renderMatchmaking`, `renderPractice`, …).

## Где что лежит

| Путь | Назначение |
| --- | --- |
| `admin/src/ui/v16/v16.css` | Токены и классы макета с префиксом `lsr-`. Значения перенесены из CSS макета. |
| `admin/src/ui/v16/*.tsx` | React-компоненты дизайн-системы (импорт из `ui/v16`). |
| `admin/src/ui/theme.ts` | MUI-тема на токенах v16: оставшиеся MUI-поля (Autocomplete, сложные формы) выглядят как поля макета — подпись над полем, радиус 8, рамка `#d5dce6`. |
| `admin/src/layout/AdminLayout.tsx`, `Topbar.tsx` | Каркас: навигация, топбар. Страница объявляет крошки через `usePageChrome`. |
| `admin/src/shared/ui.tsx` | Старые общие компоненты (`Page`, `Section`, `SearchField`, `FilterButtons`, …) с прежним API, отрисованные классами v16. Для новых экранов использовать `ui/v16` напрямую. |
| `admin/src/pages/events/workspace` | Эталонная реализация: события на v16 (данные, адаптеры, общие компоненты, форматы). |
| `admin/dev/mock-api` | Dev-only mock API для визуальной проверки (`npm run mock-api`). Разделы — `modules/*.mjs`. |

## Компоненты `ui/v16`

- Каркас: `usePageChrome({ crumbs, back, variant })` — крошки (строки), кнопка «Назад», геометрия `module` (по умолчанию) или `event`. `PageHeader({ overline, title, description, actions })`. `Tabs` (подчёркнутые вкладки: `variant="module"` — компактные модульные), `SubTabs` (сегменты внутри раздела, как `mm-tabs`).
- Кнопки: `Button` (`variant`: `default` | `primary` | `soft` | `plain` | `danger` | `danger-solid`, `size="sm"`, `to` для ссылки), `TextLink` («Открыть →»), `ActionButton` — команда, разрешённая сервером (`{code, enabled, reason}`): недоступная показывает причину.
- Панели и данные: `Panel({ title, sub, actions, foot, body })`, `FormGroup`, `MetaGrid`/`Meta`, `KvGrid`, `InfoTiles`, `DateGrid`, `InfoPills`, `Stats` (плашки списка событий), `Kpis` (модульные KPI `adm-kpi`), `RowItem`, `Timeline`, `Details` (технические подробности JSON).
- Статусы: `StatusBadge({ status, tone, variant })`; `variant`: `status` (экраны события), `pill` (список событий), `badge` (модули). Текст — серверная подпись (`label`); цвет — правило UI: `blockTone`, `eventTone` или `recordTone(code, map)`. Неизвестный код — нейтральный цвет. `freshness: 'UNCERTAIN'` — жёлтый.
- Таблицы и фильтры: `Table({ variant })` (`list`, `weeks`, `module`), `clickableRow(onOpen)` (вся строка открывает запись, вложенные кнопки/ссылки работают отдельно), `TableFoot`, `Toolbar`, `SearchInput`, `SelectInput`, `FilterButtons`, `PillButtons`, `LoadMore`.
- Поля и диалоги: `Fields`, `Field`, `TextField`, `TextArea`, `SelectField`, `Checkbox`, `Dialog({ title, description, actions })`.
- Состояния: `AsyncView({ resource, isEmpty, empty })` — раздельно загрузка, ошибка (403 → «Недостаточно прав», не пустой список), пусто, данные; при фоновом обновлении старые данные остаются на экране. `LoadingBlock`, `EmptyState`, `ErrorState`, `Notice({ tone })`.
- Форматирование: `shortDateTime`, `dateTime`, `fullDate`, `clock`, `period`, `longDay`, `weekday`, `count`, `lapTime` — только для отображения, во временной зоне сущности, `null` → «—».

Модульные страницы макета: заголовок страницы → (`Kpis`) → `Tabs variant="module"` → `Panel` со `Toolbar` и `Table variant="module"`; карточка записи — `usePageChrome` с крошками раздела, `PageHeader` записи, `Tabs` деталей, двухколоночная сетка `lsr-cols-module` (основное + боковые панели).

## Правила (из задания)

1. Не менять API-контракты. Данные — из существующих запросов; недостающее — явное состояние «нет данных в API» и запись в `docs/v16/<раздел>.md`.
2. Сохранять права (`actions`, `allowedActions`, permissions), проверки форм, версии (`expectedVersion`, `version`, `If-Match` — как в текущем коде) и `Idempotency-Key` с повтором неподтверждённой команды тем же ключом и телом.
3. Не удалять работающие возможности, даже если их нет в макете — размещать в той же визуальной системе.
4. Не оставлять кнопки и вкладки, которые ничего не делают. Нет API — нет кнопки (или неактивна с причиной).
5. Не подставлять демонстрационные значения вместо данных. Различать загрузку, пустой результат, отсутствие значения («—»), ошибку и отказ в доступе.
6. Не определять состояние по календарному времени, если есть серверный статус.
7. Получение данных, адаптер и отображение разделены; общий визуальный компонент получает подготовленные данные и обработчики.
8. Удалять заменённые стили и компоненты после проверки, что они не используются.

## Проверка

- `npm run build`, `npx vitest run --testTimeout=60000 <папка>` (тесты на машине медленные), `npm run lint` без новых ошибок.
- Визуальная сверка с макетом при 1440×900: скриншоты макета — `python -m http.server` в `design/`, реализация — dev-сервер + `npm run mock-api`.
