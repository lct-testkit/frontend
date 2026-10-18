# Статус фронтенда

Обновлено: 2026-10-18. Экраны собраны по ТЗ (`new_spec.md`, `dop.md`); число ручек бэкенда с экранами считает генератор (строка с цифрами в `README.md`), остальные — машинные или ещё без экрана (таблицы ниже). Интерфейс пересобран по блокам (`REBUILD-PLAN.md`): **B1–B15 приняты заказчиком** (шапка, меню, фильтры, таблицы, карточки, формы, сообщения, состояния, мастера, публичные страницы, проход по телефону 390 и 360 px).

## Контраст

Расчёт по токенам четырёх тем: `node tools/check-contrast.mjs` (`--md`, `--json`, `--check`). Отчёты: `docs/contrast-report.md` (сейчас), `docs/contrast-report-before.md` (до правок токенов). С переопределениями `src/lib/styles/a11y-tokens.css` обязательных пар ниже порога 0 (было 65); защищает `tools/check-contrast.test.mjs` в `vitest`.

## Проверка кнопок и аудит

`tools/buttons.mjs` открывает каждый экран под каждой ролью и нажимает каждую кнопку, ссылку, вкладку и пункт меню (изменяющие запросы подменяются заглушкой, данные не трогаются); статический аудит кода и живой обход дали список поправок, все сделаны. Осознанно оставлены решения заказчика: read-only справочники и воронки для KAM/HEAD без пункта меню (S2-3); правило «недоступно вашей роли» реализовано не везде (S2-5); диалог перехода теряет черновик при переходе по подсказке-ссылке (S2-12); лицензии «вуз ↔ вендор ↔ ПО» теперь есть отдельным экраном `/licenses` (таблица на десять полей ТЗ, фильтры, создание, правка, удаление, ссылка `/licenses/<id>`, вкладка в карточке вуза, импорт с шаблоном и подсказкой формата, выгрузка отчётом «Реестр лицензий») (см. корневой `README.md` → «Соответствие требованиям кейса»).

## Как посмотреть

| Что | Адрес |
|---|---|
| Dev-клиент (HMR), demo-режим | http://localhost:5273 (`pnpm dev`) |
| **Тот же клиент за Caddy (единый origin, как в проде)** | http://localhost:8080 — способ описан в корневом `README.md`, раздел «Один origin с API» |
| Production-сборка локально | `pnpm build && pnpm preview` → http://localhost:4273 |
| Swagger бэкенда | http://localhost:8080/api/docs |
| Keycloak | http://localhost:8080/auth/admin |

Демо-учётки (экран входа показывает их карточками): КАМ `kam.ivanov`, руководитель `head.petrov`, администраторы `admin.crm` и `admin.volkov` (второй нужен для «четырёх глаз»), аудитор `auditor.smirnov`. Пароли — `static/config.json`, `backend/README.md`.

* **demo** (`static/config.json → "mode": "demo"`): на экране входа выбор роли в один клик (пароль-грант Keycloak, токены в `localStorage`, тихое обновление).
* **prod** (`"mode": "prod"`): только «Войти» → Keycloak → серверная сессия (httpOnly `crm_sid` + CSRF). Демо-учёток и client secret в prod-конфиге нет. Проверено `node tools/scenarios/lead-prod-login.mjs` (с `APP_URL=http://localhost:8080`).

## Что готово

* **Каркас**: SvelteKit 2 SPA, Svelte 5, TS strict, Tailwind v4 поверх дизайн-системы rt-ui (токены вшиты в тему), 4 темы, шрифт Rostelecom Basis, типизированный клиент по OpenAPI (249 операций), RFC 7807, `Idempotency-Key`, `If-Match`, CSRF, курсорная пагинация, загрузка файлов напрямую в хранилище.
* **Шелл**: меню по правам роли, глобальный поиск (Ctrl+K), уведомления-колокольчик, смена темы, согласие на ПДн (152-ФЗ), справка `/help`, главная с KPI.
* **CRM**: сделки (таблица, доска, карточка, переходы с чек-листом условий, комментарии, файлы, задачи, история, подписание), организации (ИНН-автоподстановка, дубли, расхождения с ЕГРЮЛ), контакты, задачи, уведомления и их настройки.
* **Конфигурация**: воронки (редактор графа), справочники, импорт (мастер из пяти шагов), отчёты и дашборды, реестр ЕГРЮЛ, интеграции, шаблоны уведомлений.
* **Доступы и подпись**: пользователи, команды, согласования («четыре глаза»), аудит с проверкой цепочки, увольнение (передача дел), удаление ПДн (запрос → блокеры → отсрочка → акт), соглашения ЭДО, настройки и флаги, профиль/сессии/пароль, публичные `/sign`, `/verify`, `/invite`.
* **Дизайн-система**: везде, где в rt-ui есть компонент, используется он (`Button`, `Input`, `Select`, `Chip`, `Badge`, `InlineNotification`, `Modal`, `Drawer`, `TableGrid`, `Tabs`, `Wizard`, `Switch`, `Counter`…). Общие обёртки — `src/lib/ui` (`DataTable`, `Notice`, `StatusChip`, `Card`, `FormDrawer`, поля форм…). Своё (Tailwind) — только раскладка, карточки-секции (в rt-ui нет `Card`) и кликабельные блоки целиком. Приложение переопределяет около 25 токенов светлых тем ради контраста AA (`src/lib/styles/a11y-tokens.css`, rt-ui не меняется; в Rostelecom light основной оранжевый чуть темнее: #c93e0e вместо #ff4f12); расчёт — `docs/contrast-report.md`.
* **Адаптив**: таблица ↔ карточки на телефоне, панели на весь экран, обход `qa-all` гоняет размеры из `ALL_SIZES` (`tools/lib.mjs`: 1440×900, 1024×768, 768×1024, 390×844, 360×640 и широкий телефон); 1280×600 (`laptop`) умеет проверять `shot.mjs --sizes laptop`, но в обход не входит; светлая/тёмная тема.

## Покрытие ручек

Число — в строке цифр `README.md` (блок STATS, считает `node tools/fill-stats.mjs`). `node tools/coverage.mjs` читает только файлы, без запросов; на 18.10.2026 он печатает «249 операций, вызывается 223 (90%), не вызывается 26». Без экрана сознательно (8):

| Ручки | Почему |
|---|---|
| `GET /api/auth/login`, `POST /api/auth/callback`, `POST /api/auth/backchannel-logout` | Поток OIDC: браузер уходит на `/api/auth/login`, вернуться обратно ведёт Keycloak, backchannel вызывает сам Keycloak |
| `GET /health/live`, `GET /health/ready` | Пробы Docker/Caddy |
| `POST /api/v1/integrations/{cms/leads,lms/progress,bitrix/webhook}` | Вебхуки внешних систем, подписаны секретом, которого в браузере быть не должно; на карточке источника есть «паспорт» с примером `curl` |

Без экрана пока, UI не строился (18; группы — как в выводе `coverage.mjs`):

| Группа | Ручки | Что нужно |
|---|---|---|
| Сделки | `DELETE /api/deals/{id}`, `POST /api/deals/{id}/restore` | «Удалить» и «Восстановить» сделку (удаление мягкое) |
| Организации | `DELETE /api/organizations/{id}` | «Удалить» организацию |
| Пользователи | `GET`/`PUT /api/admin/users/{id}/access-rules`, `GET …/access-rules/preview`, `POST /api/users/{id}/handover` | Ограничения видимости и передача портфеля без увольнения |
| Безопасность | `POST /api/admin/retention/run`, `GET /api/admin/retention/runs` | Очистка по срокам хранения |
| Аудит и реестр | `GET /api/admin/audit/deals/{id}/comments`, `GET /api/admin/registry/versions/{id}` | Комментарии сделки для аудитора, карточка версии реестра |
| Контакты, импорт, воронки, справочники | `GET /api/contacts/{id}/channels`, `DELETE /api/import-presets/{id}`, `POST /api/workflows/{id}/archive`, `GET /api/meta/error-codes` | Каналы контакта, удаление пресета импорта, архив воронки целиком, справочник кодов ошибок |
| Публичная подпись | `GET /public/signed/{token}` (+ `/protocol`), `POST /public/verify/by-file` | Скачивание по отдельной ссылке, сверка файла по хэшу |

Предпросмотр PDF подписи идёт через `file_url` (поле ответа страницы подписи, F3-7; `pickPdfSource` в `pdf-source.ts`): `SignAdapter.loadPdf` (`src/lib/features/signing/api.ts`) вызывает `GET /public/sign/{token}/file` и `GET /api/signature-requests/{id}/file` через типизированный клиент `api` (`parseAs: 'arrayBuffer'`), поэтому обе ручки считаются покрытыми `tools/coverage.mjs`; байты PDF кэширует `SignSession` (лимит ссылки 10 запросов в минуту общий). Запасной путь для бэкенда без `file_url` — прямой `fetch` по `preview_url`; такой запрос скрипт `coverage.mjs` не видит (слепая зона). Подмена origin presigned-ссылки (`previewUrlForFetch`) удалена. «Переиздать ссылку» в карточке запроса подписи и «Удалить» у команды, пользовательского поля, праздника и продукта, «Восстановить» организацию — готовы (F3-7 и ранее).

## Как проверять

* `pnpm check` (0 ошибок), `pnpm lint` (0 ошибок), `pnpm test` (все зелёные; число тестов — в README), `pnpm build` (+`tools/postbuild.mjs` для строгого CSP; каталог блоков `/dev/blocks` больше не существует — удалён перед сдачей, см. README).
* `node tools/fill-stats.mjs` — переписать блок цифр в шапке `README.md` по коду; `--check` (шаг CI) падает, если README отстал; `--print` печатает числа. Ручные цифры про экраны, ручки, компоненты и тесты в документах не ставим.
* `node tools/qa-all.mjs` — все маршруты × роли × размеры, печатает только проблемы (в том числе обрезанные колонки таблиц); `APP_URL=http://localhost:4273 node tools/qa-all.mjs` — то же по production-сборке (`pnpm preview`).
* `node tools/taps.mjs --as kam --urls /deals,/tasks` — нажимаемые элементы меньше 44×44 px на телефоне (на курсоре-пальце у мелких элементов есть невидимая зона до 44 px, `app.css`).
* `node tools/buttons.mjs --as kam,head,admin,auditor` — обход каждой кнопки/ссылки/вкладки/пункта меню каждого экрана каждой ролью (и того, что внутри открывшихся окон, на три уровня); изменяющие запросы отвечает заглушка, реальные данные не трогаются. `node tools/buttons-report.mjs .shots/buttons` — читаемый разбор результата по корзинам (мёртвые кнопки, не закрывается по Escape, нет доступного имени и т.д.); один файл — один прогон, `--full` для полного списка.
* `node tools/shot.mjs --as <роль> --url <путь> --sizes all --theme rtk_default_dark` — скриншоты + аудит вёрстки.
* Сценарии на живом бэкенде: `tools/scenarios/{a,b,c,d,lead}-*.mjs` (сделки, воронки, импорт, подпись, ЭДО, полный цикл удаления ПДн с двумя админами).
* Без живого стенда (мок-стенд, ответы бэкенда подменяются в браузере по `docs/openapi.json`; клиент по `APP_URL`, лучше production: `pnpm build && pnpm preview`, `PW_CHANNEL=chromium` для своего Chromium Playwright): `node tools/mock/selfcheck.mjs` (каждый экран в режимах ok / empty / error, ответов вне мока нет), `node tools/mock/ui-checks.mjs` (пусто, ошибка с «Повторить», клавиатура, имена), `node tools/xss-check.mjs` (XSS-векторы в комментарии), `node tools/perf.mjs [--check|--update]` (список на 1000 сделок при замедлении CPU в 4 раза, база — `tools/perf-baseline.json`). Всё это идёт в CI отдельным job `mock-stand`.
* `node tools/run-scenarios.mjs --tier smoke|full` — сценарии `tools/scenarios` одним прогоном с таблицей «сценарий — секунды — результат» (список и уровни — `tools/scenarios/e2e.list.json`); нужен живой бэкенд на одноразовом стенде.
* `node tools/fill-stats.mjs [--check]` — числа в шапке README; `node tools/unused-exports.mjs --max N` — экспорты без вызывающего кода; `node tools/coverage-summary.mjs` — сводка покрытия по модулям после `vitest run --coverage`; `node tools/check-bundle-size.mjs` — бюджет бандла, в том числе «оболочки» (что грузится при открытии любой страницы).
* Доступность и удобство (спринт F7): `node tools/check-contrast.mjs --overlay src/lib/styles/a11y-tokens.css --check` (контраст токенов, он же тест в `pnpm test`), `node tools/a11y.mjs --themes all` (DOM: контраст по вычисленным цветам, имена, подписи, id), `node tools/cls.mjs` (сдвиги вёрстки, цель ≤ 0,1), `node tools/dupreq.mjs --urls …` (повторные запросы), `node tools/scenarios/e-states.mjs` (загрузка, пусто, ошибка на 21 списке), `e-keyboard.mjs`, `e-live.mjs`, `e-board-move.mjs`, `f-org-guard.mjs`, `e-fly.mjs`. Чек-лист телефона — `docs/MOBILE-CHECKLIST.md`.
* Проверено и в порядке (F7-M): `lang="ru"`, `<title>` у каждого экрана, `theme-color` следует теме, у `<img>` есть `alt`, у `target="_blank"` есть `rel` (у внутренней ссылки в `OrgCreateDrawer` — `noopener`), у `<button>` задан `type`.
* Демо-данные: `node tools/seed-demo.mjs`, `node tools/scenarios/lead-seed-erasure.mjs`.

## Известные ограничения

* **Безопасность клиента (F8-13).** Разметка комментариев, политики и справки чистится DOMPurify (запрещены `script`, `iframe`, `form`, `input`, атрибут `style`, картинки только с локальным путём, ссылки с `rel="noopener noreferrer nofollow"`); `node tools/xss-check.mjs` проверяет это на собранном клиенте. Остаточные риски: `style-src 'unsafe-inline'` в CSP прокси (inline-стили компонентов дизайн-системы; строгий CSP их сломает, поэтому только записан); токены Keycloak в `localStorage` — только в режиме demo (`src/lib/auth/tokens.ts`), в prod сессия серверная, httpOnly. `/config.json` в режиме prod пишет `deploy/docker-entrypoint.sh` без `clientSecret` и `demoAccounts`; демо-стенд `lct.velikoss.ru` работает в режиме demo и отдаёт их по замыслу демо (проверено 18.10.2026), prod-стенда для проверки нет.
* **Подгрузка списка (F8-12).** На 1000 сделок при замедлении CPU в 4 раза догрузка строк идёт минутами, самая длинная задача — секунды (список не виртуальный, каждая порция перерисовывает всё); подгрузка прокруткой срабатывает один раз, дальше работает кнопка «Показать ещё» (подвал таблицы липкий и всегда в поле зрения). Числа — в `tools/perf-baseline.json`.

* Проблемы бэкенда и обходы — `docs/backend-issues.md` (что исправлено и что ещё открыто, по пунктам); общий список открытых задач проекта — `OPEN-ISSUES.md` в корне монорепозитория.
* Редактор воронки на телефоне без перетаскивания (по плану).
* В демо остались тестовые записи прогонов сценариев — `DELETE`-ручки уже есть, но накопленные записи руками ещё не почищены.
