# API-контракт и генерация

Источник истины — `main.tsp`, по утверждённой
[спецификации](https://github.com/StepanovCode/ai-for-developers-project-386/issues/14).
Реализация первого тикета подключает health; остальные семь операций пока
возвращают 500 / INTERNAL_ERROR после проверки запроса. Они не создают
объекты и не возвращают фиктивные каталоги. PostgreSQL и бизнес-сценарии
добавляются следующими тикетами.

## Воспроизведение

Из корня репозитория при работающем Docker:

```sh
make generate
make check
# Для сквозной проверки SDK с настоящим backend:
make backend-dev frontend-dev
make api-smoke
```

`make generate` последовательно собирает образы `api-node`/`api-go` профиля
`tools`, устанавливает npm-зависимости через `npm ci`, компилирует TypeSpec,
нормализует эквивалентное представление закрытых схем OpenAPI, запускает
Hey API и oapi-codegen. Ошибка любого шага останавливает цепочку. Go tool
зафиксирован отдельными `generator/go.mod` и `go.sum`, npm — `package-lock.json`.
Зависимости и кеши остаются в volumes. Node.js/Go на хосте не нужны.
Повторная генерация с теми же входными файлами должна быть побайтово одинаковой.
При ошибке не коммитить частично обновлённые артефакты: исправить источник и
повторить всю команду.

В Git вместе с исходником сохраняются:

- `api/openapi.json` (OpenAPI 3.0.0);
- `frontend/src/api/generated/` (типы, SDK, fetch client);
- `backend/internal/api/generated/api.gen.go` (models, gin-server,
  strict-server, embedded-spec).

Эти файлы не редактируются вручную. Перед коммитом выполнить `make generate`
и проверить diff всех трёх путей; повторный запуск не должен добавлять изменений.
Generated SDK исключён из ESLint/Prettier: его формат принадлежит генератору;
TypeScript и обе сборки продолжают проверять generated-код. Существующий CI
выполняет новые HTTP/SDK-тесты через `make frontend-check`/`make backend-check`.
Генерации/diff, браузерного E2E и live smoke в CI нет.

## Проверенные версии

| Компонент | Версия |
|---|---|
| Node.js / npm / Go | 24.21.0 / 11.19.0 / 1.27.1 |
| TypeSpec compiler/http/openapi/openapi3 | 1.16.0 |
| Hey API openapi-ts | 0.99.0 |
| TypeScript для генератора | 6.0.2 |
| oapi-codegen | 2.8.0 |
| gin-middleware | 1.1.0 |
| oapi-codegen/runtime | 1.7.0 |
| kin-openapi | 0.142.0 |

TypeScript закреплён отдельно: автоматически выбранный 7.0.2 не предоставляет
compiler API, который требуется Hey API 0.99.0. oapi-codegen 2.8.0 использует
`ValueIsUnescaped`, отсутствующий в runtime 1.4.2; проверена версия 1.7.0.
Overrides js-yaml 4.3.2 и undici 7.30.0 устраняют найденные npm audit проблемы
в новых зависимостях генератора; на момент установки audit сообщает 0.

`seal-object-schemas` в TypeSpec выдаёт `additionalProperties: {not: {}}`.
kin-openapi 0.142.0 считает такую схему пустой и пропускает лишние поля.
`normalize-openapi.mjs` автоматически заменяет только это представление на
семантически эквивалентное `additionalProperties: false` перед обоими
генераторами. HTTP-тест проверяет фактический отказ на неизвестное поле.

## Граница HTTP

JSON-поля camelCase. Идентификаторы типов и бронирований — UUID v4.
Моменты — RFC 3339 с обязательным `Z` или числовым смещением; будущие ответы
используют UTC (`Z`). Календарные даты — `YYYY-MM-DD` в `Europe/Moscow`.
`windowStart` и `windowEnd` включительны, `days` всегда содержит 14 дат,
включая дни с пустым `slots`. Показ ДД-ММ-ГГГГ остаётся задачей frontend.

Каталог содержит `owner` и `items`; детали типа — `owner` и `eventType`.
Подтверждение включает снимок названия/длительности типа, id, eventTypeId,
startsAt/endsAt, timeZone и owner, без контактов гостя. Предстоящие встречи
добавляют guestName/guestEmail; список содержит timeZone и items.

`normalizeBody` удаляет пробелы по краям name/description/guestName **до**
проверки длины. Не меняет внутренний текст, длительность и время. Ограничение
тела — 1 MiB. Сломанный JSON, пустое тело, неизвестное поле, неправильный
Content-Type, UUID и другие нарушения схемы дают 422 / VALIDATION_ERROR.
Ошибки в полях могут содержать fieldErrors; в остальных ответах его нет.
Непредвиденные ошибки и panic дают безопасную 500 / INTERNAL_ERROR;
технические подробности остаются в серверном логе. HTTPError используется
только внутри API, для преобразования ошибок будущих usecase.

Health проходит через generated strict handler; приложение вызывает его через
SDK при открытии, отменяет запрос при размонтировании и при ошибке предлагает
повторить. Успешный вызов не добавляет технической информации на главную.

## Первичные источники

- [TypeSpec OpenAPI emitter](https://typespec.io/docs/emitters/openapi3/reference/emitter/).
- [Закрытые схемы TypeSpec](https://typespec.io/docs/getting-started/typespec-for-openapi-dev/).
- [Hey API](https://heyapi.dev/docs/openapi/typescript/get-started).
- [oapi-codegen](https://github.com/oapi-codegen/oapi-codegen/tree/v2.8.0).
- [Gin middleware](https://github.com/oapi-codegen/gin-middleware/tree/v1.1.0).
