# CRM ИТ Школы Ростелекома — веб-клиент

SvelteKit 2 (SPA) · Svelte 5 · TypeScript strict · **Tailwind CSS v4** · дизайн-система Ростелекома [`rt-ui`](../rt-ui) · pnpm.
Клиент к бэкенду [`backend`](../backend) (FastAPI, Keycloak). Типы API генерируются из OpenAPI (173 операции); с экранами связаны все ручки, кроме машинных — OIDC-поток, health-пробы, вебхуки интеграций (165 из 173, `docs/STATUS.md`).

Запуск бэкенда, стенд с образом `web`, порты, демо-данные и устранение неполадок описаны в [корневом README](../README.md). Здесь — то, что нужно при работе с самим клиентом.

## Быстрый старт

```bash
# бэкенд (один раз, из ../backend): cp .env.example .env && docker compose up -d --build
pnpm install
pnpm dev            # http://localhost:5273 ; /api /auth /public /health проксируются на http://localhost:8080
```

Для `pnpm install` нужен пакет `vendor/lct-testkit-rt-ui-0.1.0.tgz` (выдаёт заказчик), для шрифта — `static/fonts/*.woff` (без них запасная гарнитура). Node.js — версия, подходящая по `engines` зависимостей (20.19+, 22.13+ или 24+; в образе `node:22-alpine`), pnpm 11.13.1.

Экран входа в demo-режиме — «Выберите роль». Учётки (только для демо; пароли — в `static/config.json` и в [корневом README](../README.md#демо-учётки-только-для-демо)): `kam.ivanov` (КАМ), `head.petrov` (руководитель), `admin.crm` и `admin.volkov` (администраторы, второй нужен для «четырёх глаз»), `auditor.smirnov` (аудитор).

## Два режима

Режим задаёт `static/config.json` → `mode`; в контейнере — переменная `APP_MODE` (конфиг пишется при старте).

| | demo | prod |
|---|---|---|
| Экран входа | «Выберите роль»: карточки учётных записей, вход в один клик | одна кнопка «Войти» → Keycloak |
| Как аутентифицируется | Keycloak password grant, токены в `localStorage` (`rtk.demo.tokens`), `Authorization: Bearer`, тихое обновление | OIDC + PKCE на бэкенде, серверная сессия (httpOnly-cookie `crm_sid`), CSRF (`crm_csrf` + `X-CSRF-Token`) |
| Демо-пароли и client secret в бандле | да (`/config.json`) | нет |

Если `/config.json` не удалось прочитать, клиент выбирает prod; учётки в prod-режиме игнорируются, даже если они есть в файле (`src/lib/config.ts`). Как проходит prod-вход шаг за шагом — корневой README, раздел 5.6.

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | Vite на `0.0.0.0:5273` (`--strictPort`), HMR, прокси на бэкенд |
| `pnpm build` | `vite build` и `tools/postbuild.mjs` (выносит inline-скрипт в `/boot.js` под строгую CSP); результат в `build/` |
| `pnpm preview` | раздаёт `build/` на `:4273` с теми же прокси; так проверяется production-сборка: `APP_URL=http://localhost:4273 node tools/qa-all.mjs` |
| `pnpm check`, `pnpm check:watch` | `svelte-kit sync` и `svelte-check` |
| `pnpm lint` | ESLint (правила и осознанные исключения — `eslint.config.js`); 0 ошибок |
| `pnpm test` | Vitest (`src/**/*.test.ts`): чистая логика — валидаторы ИНН, DSL воронок, условия переходов, SLA, OTP, аудит, импорт, отчёты |
| `pnpm gen:api` | пересоздаёт `src/lib/api/schema.d.ts`, `docs/openapi.json` и `docs/api-endpoints.md` из живого бэкенда (`--url <адрес или файл>`) |

`pnpm install` сам выполняет `svelte-kit sync` (скрипт `prepare`).

## Конфигурация

`static/config.json` читается клиентом при старте (`cache: no-store`): `mode`, `appName`, `keycloak` (`path`, `realm`, `clientId`, `clientSecret` — только в demo), `demoAccounts` (логин, пароль, роль, имя, должность).

| Переменная | Где действует | По умолчанию | Назначение |
|---|---|---|---|
| `BACKEND_URL` | `pnpm dev`, `pnpm preview` (окружение или `.env` в этой папке) | `http://localhost:8080` | куда проксируются `/api`, `/public`, `/health`, `/auth` |
| `APP_MODE`, `APP_NAME`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` | образ `web` | `demo`, `CRM ИТ Школы`, `crm`, `crm-bff` | пишут `/config.json` при старте; `APP_NAME` учитывается только в prod и в compose не передаётся |
| `APP_URL` | инструменты `tools/` | `http://localhost:5273` | адрес клиента для проверок (`http://localhost:8080` — через Caddy) |
| `PW_CHANNEL` | инструменты `tools/` | `chrome` | канал браузера Playwright (`msedge` — Edge) |
| `REF_URL`, `REGISTRY_REIMPORT` | `ref-shot.mjs`, `seed-demo.mjs` | `http://127.0.0.1:5180`, — | витрина rt-ui; заново загрузить реестр ЕГРЮЛ |

Прокси Vite подменяет Host (`changeOrigin`): издатель токенов Keycloak выводится из Host, а API сверяет его со своим публичным адресом (`http://localhost:8080/auth`).

## Образ `web`

```bash
docker build -t rtk-crm-web .    # нужны vendor/lct-testkit-rt-ui-*.tgz и static/fonts/*.woff (выдаёт заказчик, в git их нет)
cd ../backend && docker compose --profile web up -d --build     # весь стек с клиентом: http://localhost:8080
```

Два этапа: `node:22-alpine` с pnpm 11.13.1 собирает `build/`, затем статический Caddy (`caddy:2.8-alpine`) отдаёт его на `:3000` за основным Caddy (`../backend/deploy/Caddyfile`: `/api`, `/public`, `/health` → FastAPI, `/auth` → Keycloak, остальное → `web`). `deploy/docker-entrypoint.sh` пишет `/srv/config.json` из `APP_MODE`; `deploy/Caddyfile.web` ставит `Cache-Control: no-cache` на `config.json`, `boot.js`, `index.html`, годовой `immutable` — на `_app/immutable/*` и `fonts/*`, а неизвестные пути отдаёт как `index.html` (роутер SPA). В контекст сборки не попадают `docs` и `tools/scenarios` (`.dockerignore`). Переключение demo и prod, переменные стека и запуск с `--profile web` — корневой README, раздел 5.

## Один origin с API (dev-клиент за Caddy)

Нужен для OIDC-входа prod-режима при разработке: вход рассчитан на один origin с API и Keycloak (`BASE_URL` и redirect URI клиента `crm-bff` — `http://localhost:8080`) и проверялся только там. В `../backend/.env` задайте `WEB_UPSTREAM=host.docker.internal:5273` и `CSP_SCRIPT_SRC="'self' 'unsafe-inline' 'unsafe-eval'"`, при запущенном `pnpm dev` выполните в `../backend` `docker compose up -d --no-deps caddy` и откройте http://localhost:8080. Пока строки в `.env`, Caddy не отдаёт образ `web`: чтобы вернуться, удалите их и повторите команду.

## Устройство

```text
src/app.css                 Tailwind + токены rt-ui в теме Tailwind (bg-surface, text-muted, rounded-md, t-body-m …); переходы колец и рамок
src/lib/api/                типизированный клиент (openapi-fetch), ошибки RFC 7807, пагинация, загрузка файлов, справочник имён; schema.d.ts генерируется
src/lib/auth/               сессия, права (session.can('deal:update')), demo-токены
src/lib/config.ts, nav.ts   runtime-конфиг; меню и заголовки по правам
src/lib/ui/                 блоки интерфейса: AppShell, TopBar, SideNav, Page, PageHeader, TabsBar, FilterBar, DataTable (+TableCell), RowList, Card,
                            KeyValue, StatusSteps, FormDrawer, FormModal, Notice, ConfirmModal, WizardSteps, WizardCard, Skeleton, EmptyState, ErrorState …;
                            ui/fields — поля форм (TextField, Pick, RemotePick, DateField, FileField …)
src/lib/features/<область>/ логика и компоненты по областям: crm, config, identity, signing, home
src/lib/content/help/       тексты справки /help
src/routes/                 login · (app) — экраны за входом · sign, verify, invite — публичные без входа · dev/blocks — каталог блоков (только dev)
static/                     config.json, favicon.svg, logo.svg, robots.txt, fonts/ (не в git)
deploy/                     Caddyfile.web, docker-entrypoint.sh (образ web)
tools/                      инструменты проверки, сеялка демо-данных, сценарии Playwright
docs/                       документация клиента
```

## Экраны и права

Пункты меню показываются по правам из `/api/me → scopes` (`src/lib/nav.ts`); бэкенд остаётся арбитром. Аудитор (`audit:read` без `deal:read`) после входа попадает на журнал аудита, остальные — на первый доступный пункт.

| Раздел | Маршруты (`src/routes/(app)`) | Право для показа в меню |
|---|---|---|
| Главная, сделки, задачи | `/`, `/deals`, `/deals/[id]`, `/tasks` | `deal:read` (главная — или `report:read`) |
| Организации, контакты | `/organizations[/id]`, `/contacts[/id]` | `organization:read`, `contact:read` |
| Подписание | `/signing`, `/signing/[id]`, `/signing/requests/[id]` | `signature:sign` или `signature:create` |
| Отчёты, импорт | `/reports` (+ `history`, `dashboards[/id]`), `/imports` (+ `new`, `[id]`) | `report:read`, `import:run` |
| Воронки, справочники | `/workflows[/id]`, `/catalog/*` (products, directions, loss-reasons, holidays, custom-fields, regions) | `workflow:write`, `catalog:write` |
| Настройка | `/admin/integrations`, `/admin/registry`, `/admin/edm`, `/admin/notification-templates` | `integration:admin`, `registry:import`, `edm:admin` или `edm:read`, `notification_template:manage` |
| Администрирование | `/admin/users[/id]`, `/admin/teams`, `/admin/approvals`, `/admin/erasure[/id]`, `/admin/audit`, `/admin/settings` | `user:read`, `user:write`, `erasure:manage`, `audit:read`, `settings:write` |
| Для всех вошедших | `/profile`, `/notifications` (+ `settings`), `/help` | без ограничений |
| Публичные, без входа | `/login`, `/sign/[token]`, `/verify/[[id]]`, `/invite/[token]` | — |

## Правила разработки

* Стили — только Tailwind-утилитами, без блоков `<style>`. Токены дизайн-системы вшиты в тему и переключаются вместе с темой оформления (четыре темы: `rtk_default_light`, `rtk_default_dark`, `rtk_purple_light`, `rtk_purple_dark`). Слой rt-ui лежит ниже `utilities`, поэтому утилита всегда побеждает стиль компонента.
* Где в rt-ui есть компонент, используется он (`docs/DS-MIGRATION.md`). Своё — раскладка, карточки-секции, аватар, скелетон, плитка KPI, ввод OTP: их в rt-ui нет.
* Блоки живут в `src/lib/ui`, экраны собираются из них; правила раскладки (оси страницы, первая строка 36 px, таблицы, фильтры) — `docs/REBUILD-PLAN.md`, §9. Принятые заказчиком блоки не меняются без его слова.
* Радиусы — `rounded-sm|md|lg|full`; `rounded-s|m|l` — это стороны (тест `class-names.test.ts` их запрещает). Двойное подчёркивание в произвольных селекторах Tailwind превращается в пробел.
* Права: интерфейс скрывает недоступное по `scopes` из `/api/me`, но авторитет — бэкенд. Пакетный менеджер — pnpm.
* Ctrl+K обрабатывается по `e.code === 'KeyK'` — работает в любой раскладке.

## Каталог блоков `/dev/blocks`

Инструмент разработчика: каждый блок в своих состояниях (норма, пусто, ошибка, длинный текст), светлая и тёмная темы, ширины 1440, 1024, 768, 390 и 360. Откройте http://localhost:5273/dev/blocks при запущенном `pnpm dev` (вход не нужен). Демо — `src/routes/dev/blocks/demos/B*.demo.svelte` (B01–B10, B12–B14; каталог находит их через `import.meta.glob`), моковые данные — `mock.ts`, рамка одного блока — `/dev/blocks/frame?demo=<id>&theme=<тема>`.

В production-сборку каталог не попадает: демо подключаются через `import.meta.glob` только при `import.meta.env.DEV`, их кода нет в бандле (проверено поиском по `build/`), а маршрут `/dev/*` отвечает 404 (`src/routes/dev/+layout.ts`). Папку можно оставить в репозитории; если каталог не нужен, её удаляют целиком — на остальной клиент это не влияет.

## Проверки и инструменты

```bash
pnpm check                                  # svelte-check: 0 ошибок, 0 предупреждений (2574 файла, прогон 21.09.2026)
pnpm test                                   # 32 файла, 232 теста, все пройдены (прогон 21.09.2026)
pnpm lint                                   # ESLint: 0 ошибок
node tools/qa-all.mjs                       # все маршруты x роли x размеры, печатает только проблемы
node tools/shot.mjs --as kam --url /deals --sizes desktop,phone [--guides]   # скриншоты + аудит вёрстки + линии выравнивания
node tools/tops.mjs --as admin              # первая строка каждой страницы на одной линии; аналогично axes.mjs (оси), taps.mjs (тап-цели)
node tools/seed-demo.mjs                    # демо-данные, идемпотентно
```

Инструменты работают против живого клиента (`APP_URL`, по умолчанию `:5273`) и бэкенда в demo-режиме, используют системный Chrome. Таблицы всех инструментов (`shot`, `qa-all`, `tops`, `axes`, `taps`, `guides`, `sheet`, `forms-shots`, `probe`, `ref-shot`, `seed-demo`, `gen-api`, `coverage`) и сценарии `tools/scenarios/` (40 файлов) с предпосылками и побочными эффектами — в [корневом README](../README.md#9-проверка-качества), раздел 9. Скриншоты пишутся в `.shots/` (в git не попадает).

## Документация (`docs/`)

| Файл | Что внутри |
|---|---|
| `STATUS.md` | состояние клиента, как посмотреть, покрытие ручек, как проверять, известные ограничения |
| `REBUILD-PLAN.md` | замечания заказчика, блоки B1–B15 и критерии приёмки, правила раскладки (§9), что принято |
| `USERFLOWS.md` | пользовательские потоки по ролям: задача, экраны, блоки, обязательные состояния |
| `backend-issues.md` | проблемы и несоответствия бэкенда, обходы (в том числе про сиды отчётов, уведомлений и интеграций) |
| `LEAD-DECISIONS.md` | общие решения и правки бэкенда, сделанные для клиента |
| `DS-MIGRATION.md` | что на что менять при переводе самописных элементов на rt-ui |
| `openapi.json`, `api-endpoints.md` | генерируются `pnpm gen:api` |
| `AGENT-BRIEF.md`, `plan-*.md`, `handoff-C.md`, `lead-requests.md` | история первой сборки, справочно |

## Шрифт и лицензия

Rostelecom Basis и пакет `@lct-testkit/rt-ui` — материалы Ростелекома: `static/fonts` и `vendor/` не коммитятся; без шрифта интерфейс использует запасную гарнитуру.
