# Эндпоинты бэкенда (173)

_Сгенерировано tools/gen-api.mjs._

## admin

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/audit` | Журнал аудита |
| GET | `/api/admin/audit/export` | Экспорт журнала аудита |
| GET | `/api/admin/audit/verify-chain` | Проверить цепочку аудита |
| GET | `/api/admin/feature-flags` | Список флагов |
| PATCH | `/api/admin/feature-flags/{code}` | Изменить флаг |
| GET | `/api/admin/system-settings` | Список настроек |
| PUT | `/api/admin/system-settings/{key}` | Изменить настройку |

## admin-users

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/approvals` | Заявки на подтверждение |
| POST | `/api/admin/approvals/{approval_id}/approve` | Подтвердить операцию |
| POST | `/api/admin/approvals/{approval_id}/reject` | Отклонить операцию |
| POST | `/api/admin/contacts/{contact_id}/erasure-request` | Запрос на удаление/обезличивание контакта |
| GET | `/api/admin/erasure-requests` | Запросы на удаление/обезличивание |
| GET | `/api/admin/erasure-requests/{request_id}` | Карточка запроса на удаление/обезличивание |
| GET | `/api/admin/erasure-requests/{request_id}/act` | Ссылка на акт об уничтожении ПДн |
| POST | `/api/admin/erasure-requests/{request_id}/recheck` | Пересчитать блокеры |
| POST | `/api/admin/erasure-requests/{request_id}/reject` | Отклонить запрос |
| POST | `/api/admin/erasure-requests/{request_id}/restore` | Восстановить (отменить удаление в период отсрочки) |
| POST | `/api/admin/organizations/{organization_id}/erasure-request` | Запрос на удаление/обезличивание ИП |
| GET | `/api/admin/teams` | Список команд |
| POST | `/api/admin/teams` | Создать команду |
| PATCH | `/api/admin/teams/{team_id}` | Изменить команду |
| GET | `/api/admin/users` | Список пользователей |
| POST | `/api/admin/users` | Создать пользователя |
| GET | `/api/admin/users/{user_id}` | Карточка пользователя |
| PATCH | `/api/admin/users/{user_id}` | Изменить пользователя |
| POST | `/api/admin/users/{user_id}/block` | Заблокировать пользователя |
| POST | `/api/admin/users/{user_id}/erasure-request` | Запрос на удаление или обезличивание |
| POST | `/api/admin/users/{user_id}/invite` | Повторно выдать приглашение |
| POST | `/api/admin/users/{user_id}/offboard` | Мастер передачи дел |
| POST | `/api/admin/users/{user_id}/reset-password` | Сбросить пароль |
| POST | `/api/admin/users/{user_id}/unblock` | Разблокировать пользователя |

## attachments

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/attachments` | Вложения сущности |
| POST | `/api/attachments` | Привязать файл к сущности |
| DELETE | `/api/attachments/{attachment_id}` | Отвязать файл |

## auth

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/auth/backchannel-logout` | Backchannel logout от Keycloak |
| POST | `/api/auth/callback` | Завершить OIDC-поток |
| GET | `/api/auth/invite/{token}` | Проверить приглашение |
| GET | `/api/auth/login` | Начать OIDC-поток |
| POST | `/api/auth/logout` | Выйти из системы |

## comments

| Метод | Путь | Описание |
|---|---|---|
| PATCH | `/api/comments/{comment_id}` | Редактировать комментарий |
| DELETE | `/api/comments/{comment_id}` | Удалить комментарий |

## contacts

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/contacts` | Список контактов |
| POST | `/api/contacts` | Создать контакт |
| GET | `/api/contacts/{contact_id}` | Карточка контакта |
| PATCH | `/api/contacts/{contact_id}` | Обновить контакт |
| POST | `/api/contacts/{contact_id}/reveal` | Раскрыть полные контактные данные |

## custom-field-defs

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/custom-field-defs` | Определения пользовательских полей |
| POST | `/api/custom-field-defs` | Создать пользовательское поле |
| PATCH | `/api/custom-field-defs/{field_id}` | Обновить пользовательское поле |

## deals

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/deals` | Список сделок |
| POST | `/api/deals` | Создать сделку |
| GET | `/api/deals/{deal_id}` | Карточка сделки |
| PATCH | `/api/deals/{deal_id}` | Обновить сделку |
| GET | `/api/deals/{deal_id}/available-transitions` | Доступные переходы |
| GET | `/api/deals/{deal_id}/comments` | Комментарии сделки |
| POST | `/api/deals/{deal_id}/comments` | Добавить комментарий |
| GET | `/api/deals/{deal_id}/history` | История статусов и событий |
| GET | `/api/deals/{deal_id}/participants` | Участники сделки |
| POST | `/api/deals/{deal_id}/participants` | Добавить участника |
| DELETE | `/api/deals/{deal_id}/participants/{participant_id}` | Удалить участника |
| POST | `/api/deals/{deal_id}/reassign` | Назначить ответственного |
| POST | `/api/deals/{deal_id}/transition` | Перейти по статусу |
| POST | `/api/deals/bulk/reassign` | Массовая передача сделок |

## directions

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/directions` | Иерархия ИТ-направлений |
| POST | `/api/directions` | Создать направление |
| PATCH | `/api/directions/{direction_id}` | Обновить направление |

## files

| Метод | Путь | Описание |
|---|---|---|
| DELETE | `/api/files/{file_id}` | Удалить файл |
| POST | `/api/files/{file_id}/commit` | Подтвердить загрузку |
| GET | `/api/files/{file_id}/download-url` | Получить ссылку на скачивание |
| POST | `/api/files/upload-intent` | Запросить загрузку файла |

## health

| Метод | Путь | Описание |
|---|---|---|
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | Readiness |

## holidays

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/holidays` | Производственный календарь |
| POST | `/api/holidays` | Добавить дату в календарь |
| PATCH | `/api/holidays/{holiday_id}` | Изменить дату календаря |

## imports

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/import-presets` | Список пресетов маппинга |
| GET | `/api/imports` | Список заданий импорта |
| POST | `/api/imports` | Создать задание импорта |
| GET | `/api/imports/{job_id}` | Карточка задания импорта |
| POST | `/api/imports/{job_id}/apply` | Применить импорт |
| POST | `/api/imports/{job_id}/dry-run` | Проверка без записи |
| PUT | `/api/imports/{job_id}/mapping` | Сохранить маппинг колонок |
| GET | `/api/imports/{job_id}/profile` | Профиль файла: первые строки и подсказка маппинга |
| POST | `/api/imports/{job_id}/rollback` | Откатить импорт |

## integrations-admin

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/integrations/external-refs` | List External Refs |
| GET | `/api/admin/integrations/inbound-messages` | List Inbound Messages |
| GET | `/api/admin/integrations/outbox-events` | List Outbox Events |
| GET | `/api/admin/integrations/sources` | List Sources |
| PATCH | `/api/admin/integrations/sources/{code}` | Update Source |

## integrations-public

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/v1/integrations/bitrix/webhook` | Приём изменений из Bitrix24 |
| POST | `/api/v1/integrations/cms/leads` | Приём лида с сайта (CMS) |
| POST | `/api/v1/integrations/lms/progress` | Приём прогресса от LMS (push) |

## loss-reasons

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/loss-reasons` | Справочник причин отказа |
| POST | `/api/loss-reasons` | Создать причину отказа |
| PATCH | `/api/loss-reasons/{loss_reason_id}` | Обновить причину отказа |

## me

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/me` | Профиль текущего пользователя |
| POST | `/api/me/consent` | Принять политику обработки ПДн |
| POST | `/api/me/password` | Сменить пароль |
| GET | `/api/me/policy` | Действующая политика обработки ПДн |
| GET | `/api/me/recent` | Последние открытые объекты |
| GET | `/api/me/sessions` | Активные сессии |
| DELETE | `/api/me/sessions/{sid}` | Завершить сессию |

## notifications

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/notification-templates` | Список шаблонов уведомлений |
| POST | `/api/admin/notification-templates` | Создать шаблон уведомления |
| PATCH | `/api/admin/notification-templates/{template_id}` | Обновить шаблон уведомления |
| GET | `/api/me/notification-prefs` | Мои настройки уведомлений |
| PUT | `/api/me/notification-prefs` | Обновить настройки уведомлений |
| GET | `/api/notifications` | Мои уведомления |
| POST | `/api/notifications/read` | Отметить уведомления прочитанными |

## org-lookup

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/org-lookup/inn/{inn}` | Детали организации по ИНН |
| GET | `/api/org-lookup/suggest` | Автоподстановка по названию или ИНН |
| POST | `/api/org-lookup/validate` | Проверить контрольную сумму реквизита |

## organizations

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/organizations` | Список организаций |
| POST | `/api/organizations` | Создать организацию |
| GET | `/api/organizations/{organization_id}` | Карточка организации |
| PATCH | `/api/organizations/{organization_id}` | Обновить организацию |
| POST | `/api/organizations/{organization_id}/apply-drift` | Принять изменения реквизитов |
| POST | `/api/organizations/{organization_id}/reveal` | Раскрыть полные реквизиты организации |
| GET | `/api/organizations/check-duplicate` | Проверить дубль по ИНН/ОГРН |

## products

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/products` | Справочник продуктов |
| POST | `/api/products` | Создать продукт |
| PATCH | `/api/products/{product_id}` | Обновить продукт |

## regions

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/regions` | Справочник регионов |

## registry

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/admin/registry/import` | Загрузить новую выгрузку ЕГРЮЛ |
| GET | `/api/admin/registry/versions` | Список версий реестра |

## reporting

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/dashboards` | Мои дашборды |
| POST | `/api/dashboards` | Создать дашборд |
| GET | `/api/dashboards/{dashboard_id}` | Дашборд |
| PATCH | `/api/dashboards/{dashboard_id}` | Обновить дашборд |
| DELETE | `/api/dashboards/{dashboard_id}` | Удалить дашборд |
| GET | `/api/dashboards/{dashboard_id}/widgets` | Виджеты дашборда |
| POST | `/api/dashboards/{dashboard_id}/widgets` | Добавить виджет |
| PATCH | `/api/dashboards/{dashboard_id}/widgets/{widget_id}` | Обновить виджет |
| DELETE | `/api/dashboards/{dashboard_id}/widgets/{widget_id}` | Удалить виджет |
| GET | `/api/report-templates` | Доступные виды отчётов |
| GET | `/api/reports` | Мои отчёты |
| POST | `/api/reports` | Запустить отчёт |
| GET | `/api/reports/{report_id}` | Статус отчёта |
| GET | `/api/reports/{report_id}/download` | Ссылка на файл отчёта |

## signing

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/edm-agreements` | Список соглашений об ЭДО |
| POST | `/api/admin/edm-agreements` | Оформить соглашение об ЭДО |
| POST | `/api/admin/edm-agreements/{agreement_id}/revoke` | Отозвать соглашение |
| GET | `/api/me/signature-requests` | Мои задачи на подпись |
| GET | `/api/signature-documents` | Документы на подпись по сущности |
| POST | `/api/signature-documents` | Создать документ на подпись |
| GET | `/api/signature-documents/{document_id}` | Карточка документа на подпись |
| GET | `/api/signature-documents/{document_id}/protocol` | Ссылка на протокол подписания |
| POST | `/api/signature-documents/{document_id}/send` | Запустить сбор подписей |
| POST | `/api/signature-documents/{document_id}/void` | Аннулировать документ |
| POST | `/api/signature-requests/{request_id}/challenge` | Запросить одноразовый код |
| POST | `/api/signature-requests/{request_id}/reject` | Отклонить документ |
| POST | `/api/signature-requests/{request_id}/sign` | Подписать кодом подтверждения |
| POST | `/api/signature-requests/{request_id}/view` | Отметить ознакомление (внутренний подписант) |
| GET | `/api/signature-templates` | Активные шаблоны документов |
| POST | `/api/signatures/verify` | Проверить документ по хэшу |

## signing-public

| Метод | Путь | Описание |
|---|---|---|
| GET | `/public/sign/{token}` | Страница подписания (внешний подписант) |
| POST | `/public/sign/{token}/challenge` | Запросить одноразовый код (внешний подписант) |
| POST | `/public/sign/{token}/reject` | Отклонить документ (внешний подписант) |
| POST | `/public/sign/{token}/sign` | Подписать кодом подтверждения (внешний подписант) |
| GET | `/public/verify/{signature_id}` | Проверить подпись публично |

## tasks

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/tasks` | Список задач |
| POST | `/api/tasks` | Создать задачу |
| PATCH | `/api/tasks/{task_id}` | Обновить задачу |
| POST | `/api/tasks/{task_id}/complete` | Завершить задачу |

## users

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/users/directory` | Справочник сотрудников |

## workflows

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/workflows` | Список воронок |
| POST | `/api/workflows` | Создать черновик воронки |
| GET | `/api/workflows/{workflow_id}` | Граф воронки |
| PUT | `/api/workflows/{workflow_id}/graph` | Сохранить черновик графа |
| POST | `/api/workflows/{workflow_id}/publish` | Опубликовать воронку |
| POST | `/api/workflows/{workflow_id}/statuses/{status_id}/archive` | Архивировать статус с переносом сделок |
| GET | `/api/workflows/{workflow_id}/statuses/{status_id}/impact` | Предпросмотр архивирования статуса |
| POST | `/api/workflows/{workflow_id}/validate` | Провалидировать граф |
