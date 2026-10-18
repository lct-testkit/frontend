# Контраст токенов тем rt-ui (WCAG 2.x)

Текущее состояние: токены rt-ui + переопределения `src/lib/styles/a11y-tokens.css` (F7-2). Обязательных пар ниже порога: 0 (до: 65, см. `contrast-report-before.md`).

Порог: текст 4,5:1 (AA), значки, границы и фокус 3:1; справочные пары (декор, неактивное, кандидаты) в таблице есть, проверку не роняют. Команда: `node tools/check-contrast.mjs --overlay src/lib/styles/a11y-tokens.css --md`.

**Текст на фонах**

| Пара | rtk_default_light | rtk_default_dark | rtk_purple_light | rtk_purple_dark |
|---|---|---|---|---|
| fg-default на bg-page | 17,75 AAA | 13,83 AAA | 17,75 AAA | 13,83 AAA |
| fg-default на bg-surface1 | 17,75 AAA | 12,91 AAA | 17,75 AAA | 12,91 AAA |
| fg-default на bg-surface2 | 16,87 AAA | 11,96 AAA | 16,87 AAA | 11,96 AAA |
| fg-default на bg-surface3 | 16,15 AAA | 11,17 AAA | 16,15 AAA | 11,17 AAA |
| fg-default на bg-surface4 | 14,54 AAA | 9,37 AAA | 14,54 AAA | 9,37 AAA |
| fg-default на bg-surface5 | 12,01 AAA | 7,19 AAA | 12,01 AAA | 7,19 AAA |
| fg-soft на bg-page | 7,88 AAA | 8,44 AAA | 7,88 AAA | 8,44 AAA |
| fg-soft на bg-surface1 | 7,88 AAA | 7,88 AAA | 7,88 AAA | 7,88 AAA |
| fg-soft на bg-surface2 | 7,66 AAA | 7,30 AAA | 7,66 AAA | 7,30 AAA |
| fg-soft на bg-surface3 | 7,48 AAA | 6,82 AA | 7,48 AAA | 6,82 AA |
| fg-soft на bg-surface4 | 7,05 AAA | 5,72 AA | 7,05 AAA | 5,72 AA |
| fg-soft на bg-surface5 | 6,30 AA | 4,39 крупн. | 6,30 AA | 4,39 крупн. |
| fg-muted на bg-page | 5,34 AA | 6,53 AA | 5,34 AA | 6,53 AA |
| fg-muted на bg-surface1 | 5,34 AA | 6,10 AA | 5,34 AA | 6,10 AA |
| fg-muted на bg-surface2 | 5,24 AA | 5,65 AA | 5,24 AA | 5,65 AA |
| fg-muted на bg-surface3 | 5,15 AA | 5,28 AA | 5,15 AA | 5,28 AA |
| fg-muted на bg-surface4 | 4,94 AA | 4,42 крупн. | 4,94 AA | 4,42 крупн. |
| fg-muted на bg-surface5 | 4,56 AA | 3,40 крупн. | 4,56 AA | 3,40 крупн. |
| fg-disabled на bg-page (исключение WCAG для неактивных) | 2,22 нет | 3,12 крупн. | 2,22 нет | 3,12 крупн. |
| fg-disabled на bg-surface1 (исключение WCAG для неактивных) | 2,22 нет | 3,04 крупн. | 2,22 нет | 3,04 крупн. |
| fg-disabled на bg-surface2 (исключение WCAG для неактивных) | 2,20 нет | 2,94 нет | 2,20 нет | 2,94 нет |
| fg-disabled на bg-surface3 (исключение WCAG для неактивных) | 2,19 нет | 2,85 нет | 2,19 нет | 2,85 нет |
| fg-disabled на bg-surface4 (исключение WCAG для неактивных) | 2,16 нет | 2,60 нет | 2,16 нет | 2,60 нет |
| fg-disabled на bg-surface5 (исключение WCAG для неактивных) | 2,10 нет | 2,25 нет | 2,10 нет | 2,25 нет |

**Цветной текст и ссылки**

| Пара | rtk_default_light | rtk_default_dark | rtk_purple_light | rtk_purple_dark |
|---|---|---|---|---|
| accent-default на bg-surface1 | 5,03 AA | 8,36 AAA | 6,50 AA | 5,73 AA |
| accent-default на bg-surface3 | 4,57 AA | 7,23 AAA | 5,92 AA | 4,96 AA |
| error-default на bg-surface1 | 6,80 AA | 7,39 AAA | 6,80 AA | 7,39 AAA |
| error-default на bg-surface3 | 6,18 AA | 6,39 AA | 6,18 AA | 6,39 AA |
| success-default на bg-surface1 | 5,63 AA | 9,04 AAA | 5,63 AA | 9,04 AAA |
| success-default на bg-surface3 | 5,13 AA | 7,82 AAA | 5,13 AA | 7,82 AAA |
| warning-default на bg-surface1 | 1,97 нет | 11,17 AAA | 1,97 нет | 11,17 AAA |
| warning-default на bg-surface3 | 1,80 нет | 9,66 AAA | 1,80 нет | 9,66 AAA |
| info-default на bg-surface1 | 4,64 AA | 7,61 AAA | 4,64 AA | 7,61 AAA |
| info-default на bg-surface3 | 4,22 крупн. | 6,58 AA | 4,22 крупн. | 6,58 AA |
| neutral-default на bg-surface1 | 6,59 AA | 7,88 AAA | 6,59 AA | 7,88 AAA |
| neutral-default на bg-surface3 | 6,00 AA | 6,82 AA | 6,00 AA | 6,82 AA |
| accent-hover (ссылка при наведении) на surface1 | 6,05 AA | 11,53 AAA | 8,22 AAA | 9,73 AAA |
| text-warning приложения (--app-warning-text) на surface1 | 5,05 AA | 11,17 AAA | 5,05 AA | 11,17 AAA |
| text-warning приложения (--app-warning-text) на surface3 | 4,59 AA | 9,66 AAA | 4,59 AA | 9,66 AAA |
| accent-700 на surface1 (кандидат) | 6,05 AA | 2,60 нет | 10,40 AAA | 1,51 нет |
| error-700 на surface1 (кандидат) | 6,80 AA | 2,32 нет | 6,80 AA | 2,32 нет |
| success-700 на surface1 (кандидат) | 5,63 AA | 2,80 нет | 5,63 AA | 2,80 нет |
| warning-800 на surface1 (кандидат) | 5,05 AA | 3,12 крупн. | 5,05 AA | 3,12 крупн. |

**Кнопки**

| Пара | rtk_default_light | rtk_default_dark | rtk_purple_light | rtk_purple_dark |
|---|---|---|---|---|
| primary accent: подпись на accent-default | 5,03 AA | 6,99 AA | 6,50 AA | 6,15 AA |
| primary accent, наведение | 6,05 AA | 9,64 AAA | 8,22 AAA | 10,44 AAA |
| primary neutral | 6,59 AA | 8,44 AAA | 6,59 AA | 8,44 AAA |
| danger primary | 6,80 AA | 6,62 AA | 6,80 AA | 6,62 AA |
| primary accent, disabled (исключение WCAG) | 1,57 нет | 1,82 нет | 1,57 нет | 1,82 нет |
| secondary accent | 5,35 AA | 6,18 AA | 5,41 AA | 4,87 AA |
| secondary neutral | 5,72 AA | 6,14 AA | 5,72 AA | 6,14 AA |
| outline и ghost neutral (подпись) | 6,59 AA | 7,88 AAA | 6,59 AA | 7,88 AAA |
| ghost и outline accent (подпись) | 5,03 AA | 8,36 AAA | 6,50 AA | 5,73 AA |

**Чипы статусов (Badge secondary)**

| Пара | rtk_default_light | rtk_default_dark | rtk_purple_light | rtk_purple_dark |
|---|---|---|---|---|
| info: подпись на container-default | 6,89 AA | 5,71 AA | 6,89 AA | 5,71 AA |
| success: подпись на container-default | 5,05 AA | 6,33 AA | 5,05 AA | 6,33 AA |
| warning: подпись на container-default | 4,71 AA | 7,16 AAA | 4,71 AA | 7,16 AAA |
| error: подпись на container-default | 5,87 AA | 5,79 AA | 5,87 AA | 5,79 AA |
| neutral: подпись на container-default | 5,72 AA | 6,14 AA | 5,72 AA | 6,14 AA |
| accent: подпись на container-default | 5,35 AA | 6,18 AA | 5,41 AA | 4,87 AA |
| status-01: подпись на container-default | 8,65 AAA | 4,87 AA | 5,35 AA | 6,18 AA |
| status-02: подпись на container-default | 7,99 AAA | 5,53 AA | 7,99 AAA | 5,53 AA |
| status-03: подпись на container-default | 5,66 AA | 6,09 AA | 5,66 AA | 6,09 AA |
| status-04: подпись на container-default | 5,61 AA | 6,21 AA | 5,61 AA | 6,21 AA |
| status-05: подпись на container-default | 6,69 AA | 5,58 AA | 6,69 AA | 5,58 AA |
| status-06: подпись на container-default | 7,03 AAA | 5,53 AA | 7,03 AAA | 5,53 AA |
| neutral на строке таблицы под курсором (surface3) | 5,23 AA | 5,37 AA | 5,23 AA | 5,37 AA |

**Плашки (Notice)**

| Пара | rtk_default_light | rtk_default_dark | rtk_purple_light | rtk_purple_dark |
|---|---|---|---|---|
| info: подзаголовок fg-soft | 7,31 AAA | 5,91 AA | 7,31 AAA | 5,91 AA |
| info: значок info-default (3:1) | 4,06 ок | 5,71 ок | 4,06 ок | 5,71 ок |
| warning: подзаголовок fg-soft | 7,60 AAA | 5,05 AA | 7,60 AAA | 5,05 AA |
| warning: значок warning-default (3:1) | 1,84 нет | 7,16 ок | 1,84 нет | 7,16 ок |
| error: подзаголовок fg-soft | 7,28 AAA | 6,17 AA | 7,28 AAA | 6,17 AA |
| error: значок error-default (3:1) | 5,87 ок | 5,79 ок | 5,87 ок | 5,79 ок |
| success: подзаголовок fg-soft | 7,42 AAA | 5,52 AA | 7,42 AAA | 5,52 AA |
| success: значок success-default (3:1) | 5,05 ок | 6,33 ок | 5,05 ок | 6,33 ок |

**Границы и фокус (WCAG 1.4.11, 3:1)**

| Пара | rtk_default_light | rtk_default_dark | rtk_purple_light | rtk_purple_dark |
|---|---|---|---|---|
| граница поля в покое | 3,03 ок | 3,04 ок | 3,03 ок | 3,04 ок |
| граница поля при наведении | 4,10 ок | 4,17 ок | 4,10 ок | 4,17 ок |
| граница поля в фокусе | 5,03 ок | 6,94 ок | 5,07 ок | 4,14 ок |
| граница флажка и радиокнопки в покое | 3,03 ок | 3,04 ок | 3,03 ок | 3,04 ок |
| трек выключенного переключателя | 3,03 ок | 3,04 ок | 3,03 ок | 3,04 ок |
| трек включённого переключателя | 5,03 ок | 8,36 ок | 6,50 ок | 5,73 ок |
| кольцо фокуса (accent-default, app.css:197) на surface1 | 5,03 ок | 8,36 ок | 6,50 ок | 5,73 ок |
| кольцо фокуса на surface3 | 4,57 ок | 7,23 ок | 5,92 ок | 4,96 ок |
| значки fg-muted на surface1 | 5,34 ок | 6,10 ок | 5,34 ок | 6,10 ок |
| разделитель border-soft (декор) | 1,45 нет | 1,72 нет | 1,45 нет | 1,72 нет |
| разделитель border-default на surface3 (декор) | 2,15 нет | 2,85 нет | 2,15 нет | 2,85 нет |

**Графики (метки 3:1, rt-ui charts.css)**

| Пара | rtk_default_light | rtk_default_dark | rtk_purple_light | rtk_purple_dark |
|---|---|---|---|---|
| --rt-chart-1 на surface1 | 4,05 ок | 5,46 ок | 7,46 ок | 3,11 ок |
| --rt-chart-2 на surface1 | 6,00 ок | 3,82 ок | 3,39 ок | 6,46 ок |
| --rt-chart-3 на surface1 | 3,44 ок | 4,58 ок | 3,44 ок | 4,58 ок |
| --rt-chart-4 на surface1 | 5,54 ок | 4,11 ок | 5,54 ок | 4,11 ок |
| --rt-chart-5 на surface1 | 3,73 ок | 5,91 ок | 3,73 ок | 5,91 ок |
| --rt-chart-6 на surface1 | 5,34 ок | 4,24 ок | 5,34 ок | 4,24 ок |
| --rt-chart-7 на surface1 | 3,41 ок | 6,44 ок | 3,41 ок | 6,44 ок |
| --rt-chart-8 на surface1 | 4,30 ок | 5,19 ок | 4,30 ок | 5,19 ок |
| --rt-chart-9 на surface1 | 5,70 ок | 3,97 ок | 5,70 ок | 3,97 ок |
| --rt-chart-10 на surface1 | 4,70 ок | 4,78 ок | 4,70 ок | 4,78 ок |
| chart-other (neutral-400) | 4,06 ок | 3,88 ок | 4,06 ок | 3,88 ок |
| подписи осей (fg-soft) | 7,88 AAA | 7,88 AAA | 7,88 AAA | 7,88 AAA |
| линии сетки (декор) | 1,24 нет | 1,36 нет | 1,24 нет | 1,36 нет |
