# Эндпоинты бэкенда (287)

_Сгенерировано tools/gen-api.mjs._

## access-requests

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/access-requests` | Мои запросы или входящие на решение |
| POST | `/api/access-requests` | Запросить доступ к чужому вузу |
| POST | `/api/access-requests/{request_id}/cancel` | Отменить свой ожидающий запрос |
| POST | `/api/access-requests/{request_id}/decision` | Одобрить или отклонить запрос доступа |
| POST | `/api/access-requests/{request_id}/revoke` | Снять ранее выданный доступ |

## admin

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/audit` | Журнал аудита |
| GET | `/api/admin/audit/export` | Экспорт журнала аудита |
| GET | `/api/admin/audit/verify-chain` | Проверить цепочку аудита |
| GET | `/api/admin/feature-flags` | Список флагов |
| POST | `/api/admin/feature-flags` | Создать флаг |
| PATCH | `/api/admin/feature-flags/{code}` | Изменить флаг |
| GET | `/api/admin/incidents` | Список инцидентов |
| POST | `/api/admin/incidents` | Завести инцидент вручную |
| GET | `/api/admin/incidents/{incident_id}` | Карточка инцидента |
| PATCH | `/api/admin/incidents/{incident_id}` | Править карточку инцидента |
| POST | `/api/admin/incidents/{incident_id}/close` | Закрыть инцидент |
| POST | `/api/admin/incidents/{incident_id}/confirm` | Подтвердить кандидата |
| POST | `/api/admin/incidents/{incident_id}/rkn-notice/{stage}` | Сформировать текст уведомления РКН |
| POST | `/api/admin/incidents/{incident_id}/rkn-notice/{stage}/sent` | Отметить отправку уведомления РКН |
| POST | `/api/admin/incidents/{incident_id}/subjects-notice` | Сформировать уведомление субъектам |
| POST | `/api/admin/retention/run` | Запустить очистку по сроку хранения вручную |
| GET | `/api/admin/retention/runs` | Журнал запусков очистки по сроку хранения |
| GET | `/api/admin/security-events` | Журнал безопасности |
| GET | `/api/admin/security-events/export` | Экспорт журнала безопасности |
| GET | `/api/admin/security-events/summary` | Сводка журнала безопасности |
| GET | `/api/admin/security/posture` | Посадочная панель безопасности |
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
| GET | `/api/admin/teams/{team_id}` | Карточка команды |
| PATCH | `/api/admin/teams/{team_id}` | Изменить команду |
| DELETE | `/api/admin/teams/{team_id}` | Удалить команду |
| GET | `/api/admin/users` | Список пользователей |
| POST | `/api/admin/users` | Создать пользователя |
| GET | `/api/admin/users/{user_id}` | Карточка пользователя |
| PATCH | `/api/admin/users/{user_id}` | Изменить пользователя |
| GET | `/api/admin/users/{user_id}/access-rules` | Ограничения видимости пользователя |
| PUT | `/api/admin/users/{user_id}/access-rules` | Задать ограничения видимости пользователя |
| GET | `/api/admin/users/{user_id}/access-rules/preview` | Предпросмотр последствий ограничения |
| POST | `/api/admin/users/{user_id}/block` | Заблокировать пользователя |
| POST | `/api/admin/users/{user_id}/erasure-request` | Запрос на удаление или обезличивание |
| POST | `/api/admin/users/{user_id}/invite` | Повторно выдать приглашение |
| POST | `/api/admin/users/{user_id}/offboard` | Мастер передачи дел |
| GET | `/api/admin/users/{user_id}/offboard/items` | Все сделки/вузы уходящего (постранично) |
| POST | `/api/admin/users/{user_id}/reset-password` | Сбросить пароль |
| POST | `/api/admin/users/{user_id}/unblock` | Разблокировать пользователя |
| POST | `/api/users/{user_id}/handover` | Передать портфель без увольнения |

## attachments

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/attachments` | Вложения сущности |
| POST | `/api/attachments` | Привязать файл к сущности |
| DELETE | `/api/attachments/{attachment_id}` | Отвязать файл |

## audit

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/audit/deals/{deal_id}/comments` | Комментарии сделки для аудитора |

## auth

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/auth/backchannel-logout` | Backchannel logout от Keycloak |
| POST | `/api/auth/callback` | Завершить OIDC-поток |
| GET | `/api/auth/invite/{token}` | Проверить приглашение |
| POST | `/api/auth/invite/{token}/password` | Задать пароль по ссылке |
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
| GET | `/api/contacts/{contact_id}/channels` | Каналы связи контакта (маскированные) |
| GET | `/api/contacts/{contact_id}/learner-profile` | Профиль учащегося (маскированный) |
| PUT | `/api/contacts/{contact_id}/learner-profile` | Обновить профиль учащегося |
| POST | `/api/contacts/{contact_id}/learner-profile/reveal` | Раскрыть полный профиль учащегося |
| GET | `/api/contacts/{contact_id}/products` | Продукты, за которые отвечает контакт |
| POST | `/api/contacts/{contact_id}/reveal` | Раскрыть полные контактные данные |

## custom-field-defs

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/custom-field-defs` | Определения пользовательских полей |
| POST | `/api/custom-field-defs` | Создать пользовательское поле |
| PATCH | `/api/custom-field-defs/{field_id}` | Обновить пользовательское поле |
| DELETE | `/api/custom-field-defs/{field_id}` | Удалить пользовательское поле |

## deals

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/deals` | Список сделок |
| POST | `/api/deals` | Создать сделку |
| GET | `/api/deals/{deal_id}` | Карточка сделки |
| PATCH | `/api/deals/{deal_id}` | Обновить сделку |
| DELETE | `/api/deals/{deal_id}` | Удалить сделку |
| GET | `/api/deals/{deal_id}/available-transitions` | Доступные переходы |
| GET | `/api/deals/{deal_id}/comments` | Комментарии сделки |
| POST | `/api/deals/{deal_id}/comments` | Добавить комментарий |
| GET | `/api/deals/{deal_id}/history` | История статусов и событий |
| GET | `/api/deals/{deal_id}/history/{history_id}/attachments` | Файлы, приложенные к записи истории |
| GET | `/api/deals/{deal_id}/participants` | Участники сделки |
| POST | `/api/deals/{deal_id}/participants` | Добавить участника |
| DELETE | `/api/deals/{deal_id}/participants/{participant_id}` | Удалить участника |
| PUT | `/api/deals/{deal_id}/products` | Заменить продукты сделки |
| POST | `/api/deals/{deal_id}/reassign` | Назначить ответственного |
| POST | `/api/deals/{deal_id}/restore` | Восстановить сделку |
| GET | `/api/deals/{deal_id}/stages` | Контроль исполнения этапов |
| POST | `/api/deals/{deal_id}/transition` | Перейти по статусу |
| POST | `/api/deals/bulk/reassign` | Массовая передача сделок |

## directions

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/directions` | Иерархия ИТ-направлений |
| POST | `/api/directions` | Создать направление |
| PATCH | `/api/directions/{direction_id}` | Обновить направление |
| DELETE | `/api/directions/{direction_id}` | Удалить направление |

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
| GET | `/health/live` | Проверка живости процесса |
| GET | `/health/ready` | Проверка готовности принимать трафик |

## holidays

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/holidays` | Производственный календарь |
| POST | `/api/holidays` | Добавить дату в календарь |
| PATCH | `/api/holidays/{holiday_id}` | Изменить дату календаря |
| DELETE | `/api/holidays/{holiday_id}` | Удалить дату календаря |

## imports

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/import-presets` | Список пресетов маппинга |
| DELETE | `/api/import-presets/{preset_id}` | Удалить пресет маппинга |
| GET | `/api/imports` | Список заданий импорта |
| POST | `/api/imports` | Создать задание импорта |
| GET | `/api/imports/{job_id}` | Карточка задания импорта |
| POST | `/api/imports/{job_id}/apply` | Применить импорт |
| POST | `/api/imports/{job_id}/dry-run` | Проверка без записи |
| PUT | `/api/imports/{job_id}/mapping` | Сохранить маппинг колонок |
| GET | `/api/imports/{job_id}/profile` | Профиль файла: первые строки и подсказка маппинга |
| POST | `/api/imports/{job_id}/rollback` | Откатить импорт |
| GET | `/api/imports/{job_id}/rows` | Результаты по строкам |
| GET | `/api/imports/{job_id}/summary` | Сводка проверки: коды проблем и что будет создано/обновлено |
| GET | `/api/imports/entity-types` | Типы импорта и их поля |
| GET | `/api/imports/templates/{entity_type}` | Шаблон файла для скачивания |

## integrations-admin

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/integrations/api-keys` | Список API-ключей |
| POST | `/api/admin/integrations/api-keys` | Создать API-ключ |
| DELETE | `/api/admin/integrations/api-keys/{api_key_id}` | Отозвать API-ключ |
| GET | `/api/admin/integrations/external-refs` | Связи с внешними системами |
| GET | `/api/admin/integrations/inbound-messages` | Входящие сообщения |
| GET | `/api/admin/integrations/outbox-events` | Исходящие события |
| POST | `/api/admin/integrations/outbox-events/{event_id}/retry` | Повторить доставку события |
| GET | `/api/admin/integrations/sources` | Список источников интеграций |
| PATCH | `/api/admin/integrations/sources/{code}` | Изменить источник интеграции |
| POST | `/api/admin/integrations/sources/{code}/check` | Проверить соединение с источником |
| GET | `/api/admin/integrations/sources/{code}/mapping` | Текущий маппинг полей и каталог целей |
| PUT | `/api/admin/integrations/sources/{code}/mapping` | Сохранить маппинг полей |
| DELETE | `/api/admin/integrations/sources/{code}/mapping` | Вернуть прежнее поведение (без маппинга) |
| POST | `/api/admin/integrations/sources/{code}/mapping/preview` | Предпросмотр маппинга без записи в БД |
| POST | `/api/admin/integrations/sources/{code}/pull` | Забрать сейчас |
| GET | `/api/admin/integrations/sources/{code}/routing` | Текущая маршрутизация (воронка/тип сделки на источник) |
| PUT | `/api/admin/integrations/sources/{code}/routing` | Сохранить маршрутизацию |
| DELETE | `/api/admin/integrations/sources/{code}/routing` | Вернуть прежнее поведение (без маршрутизации) |
| GET | `/api/admin/integrations/sources/{code}/status` | Статус синхронизации источника |
| GET | `/api/admin/integrations/webhooks` | Список webhook-подписок |
| POST | `/api/admin/integrations/webhooks` | Создать webhook-подписку |
| PATCH | `/api/admin/integrations/webhooks/{subscription_id}` | Изменить webhook-подписку |
| DELETE | `/api/admin/integrations/webhooks/{subscription_id}` | Удалить webhook-подписку |
| GET | `/api/admin/integrations/webhooks/{subscription_id}/deliveries` | Доставки подписки |
| POST | `/api/admin/integrations/webhooks/{subscription_id}/rotate-secret` | Сменить секрет подписки |
| POST | `/api/admin/integrations/webhooks/{subscription_id}/test` | Тестовая отправка (PING) |
| POST | `/api/admin/integrations/webhooks/deliveries/{delivery_id}/retry` | Повторить доставку webhook |

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
| DELETE | `/api/loss-reasons/{loss_reason_id}` | Удалить причину отказа |

## me

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/me` | Профиль текущего пользователя |
| PATCH | `/api/me` | Изменить свой профиль |
| POST | `/api/me/consent` | Принять политику обработки ПДн |
| POST | `/api/me/password` | Сменить пароль |
| GET | `/api/me/policy` | Действующая политика обработки ПДн |
| GET | `/api/me/recent` | Последние открытые объекты |
| GET | `/api/me/sessions` | Активные сессии |
| DELETE | `/api/me/sessions/{sid}` | Завершить сессию |
| POST | `/api/me/sessions/terminate-others` | Завершить все остальные сессии |

## meta

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/meta/error-codes` | Справочник кодов ошибок |

## notifications

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/notification-templates` | Список шаблонов уведомлений |
| POST | `/api/admin/notification-templates` | Создать шаблон уведомления |
| PATCH | `/api/admin/notification-templates/{template_id}` | Обновить шаблон уведомления |
| DELETE | `/api/admin/notification-templates/{template_id}` | Удалить шаблон уведомления |
| POST | `/api/admin/notification-templates/preview` | Предпросмотр шаблона уведомления |
| GET | `/api/me/notification-prefs` | Мои настройки уведомлений |
| PUT | `/api/me/notification-prefs` | Обновить настройки уведомлений |
| GET | `/api/notifications` | Мои уведомления |
| GET | `/api/notifications/event-codes` | Коды событий для настроек уведомлений |
| POST | `/api/notifications/read` | Отметить уведомления прочитанными |
| GET | `/api/notifications/unread-count` | Число непрочитанных уведомлений |

## org-lookup

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/org-lookup/inn/{inn}` | Детали организации по ИНН |
| GET | `/api/org-lookup/suggest` | Автоподстановка по названию или ИНН |
| POST | `/api/org-lookup/validate` | Проверить контрольную сумму реквизита |

## organization-licenses

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/organization-licenses` | Список лицензий/договоров вуз-вендор-ПО |
| POST | `/api/organization-licenses` | Создать лицензию/договор |
| GET | `/api/organization-licenses/{license_id}` | Карточка лицензии/договора |
| PATCH | `/api/organization-licenses/{license_id}` | Изменить лицензию/договор |
| DELETE | `/api/organization-licenses/{license_id}` | Удалить лицензию/договор |

## organizations

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/organizations` | Список организаций |
| POST | `/api/organizations` | Создать организацию |
| GET | `/api/organizations/{organization_id}` | Карточка организации |
| PATCH | `/api/organizations/{organization_id}` | Обновить организацию |
| DELETE | `/api/organizations/{organization_id}` | Удалить организацию |
| POST | `/api/organizations/{organization_id}/apply-drift` | Принять изменения реквизитов |
| GET | `/api/organizations/{organization_id}/branches` | Филиалы и институты вуза |
| POST | `/api/organizations/{organization_id}/branches` | Завести филиал/институт |
| PATCH | `/api/organizations/{organization_id}/branches/{branch_id}` | Изменить филиал/институт |
| DELETE | `/api/organizations/{organization_id}/branches/{branch_id}` | Удалить филиал/институт |
| POST | `/api/organizations/{organization_id}/dismiss-drift` | Отклонить расхождения реквизитов («Оставить как есть») |
| PUT | `/api/organizations/{organization_id}/owner` | Назначить или сменить ответственного за вуз |
| DELETE | `/api/organizations/{organization_id}/owner` | Снять ответственного за вуз |
| POST | `/api/organizations/{organization_id}/restore` | Восстановить удалённую организацию |
| POST | `/api/organizations/{organization_id}/reveal` | Раскрыть полные реквизиты организации |
| POST | `/api/organizations/bulk/owner` | Массовая смена ответственного за вуз |
| GET | `/api/organizations/check-duplicate` | Проверить дубль по ИНН/ОГРН |

## products

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/products` | Справочник продуктов |
| POST | `/api/products` | Создать продукт |
| PATCH | `/api/products/{product_id}` | Обновить продукт |
| DELETE | `/api/products/{product_id}` | Удалить продукт |
| GET | `/api/products/{product_id}/contacts` | Ответственные за продукт |
| PUT | `/api/products/{product_id}/contacts/{contact_id}` | Назначить ответственного за продукт |
| DELETE | `/api/products/{product_id}/contacts/{contact_id}` | Снять ответственного с продукта |

## regions

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/regions` | Справочник регионов |

## registry

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/admin/registry/import` | Загрузить новую выгрузку ЕГРЮЛ |
| GET | `/api/admin/registry/versions` | Список версий реестра |
| GET | `/api/admin/registry/versions/{version_id}` | Карточка версии реестра |
| DELETE | `/api/admin/registry/versions/{version_id}` | Удалить версию реестра |

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
| GET | `/api/reports/{report_id}/data` | Данные отчёта в JSON |
| GET | `/api/reports/{report_id}/download` | Ссылка на файл отчёта |
| POST | `/api/reports/preview` | Сколько строк будет в отчёте |

## search

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/search` | Общий поиск |

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
| GET | `/api/signature-documents/batch` | Пачка документов по списку id |
| POST | `/api/signature-requests/{request_id}/challenge` | Запросить одноразовый код |
| GET | `/api/signature-requests/{request_id}/file` | PDF документа для просмотра (внутренний подписант) |
| POST | `/api/signature-requests/{request_id}/reissue-link` | Переиздать ссылку внешнему подписанту |
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
| GET | `/public/sign/{token}/file` | PDF документа для просмотра (внешний подписант) |
| POST | `/public/sign/{token}/reject` | Отклонить документ (внешний подписант) |
| POST | `/public/sign/{token}/sign` | Подписать кодом подтверждения (внешний подписант) |
| GET | `/public/signed/{token}` | Скачать подписанный файл по ссылке |
| GET | `/public/signed/{token}/protocol` | Скачать протокол подписания по ссылке |
| GET | `/public/verify/{signature_id}` | Проверить подпись публично |
| POST | `/public/verify/by-file` | Сверить файл по хэшу публично |

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
| PATCH | `/api/workflows/{workflow_id}` | Изменить имя и воронку по умолчанию |
| DELETE | `/api/workflows/{workflow_id}` | Удалить черновик воронки |
| POST | `/api/workflows/{workflow_id}/archive` | Архивировать воронку целиком |
| PUT | `/api/workflows/{workflow_id}/graph` | Сохранить черновик графа |
| GET | `/api/workflows/{workflow_id}/mapping-jobs/{job_id}` | Задача переноса сделок |
| POST | `/api/workflows/{workflow_id}/publish` | Опубликовать воронку |
| PATCH | `/api/workflows/{workflow_id}/statuses/{status_id}` | Переименовать статус |
| POST | `/api/workflows/{workflow_id}/statuses/{status_id}/archive` | Архивировать статус с переносом сделок |
| GET | `/api/workflows/{workflow_id}/statuses/{status_id}/impact` | Предпросмотр архивирования статуса |
| POST | `/api/workflows/{workflow_id}/validate` | Провалидировать граф |
