# Backend

Go-приложение с Gin. Точка входа — `cmd/api/main.go`, HTTP-роутер —
`internal/api/router.go`. `GET /api/health` через generated strict handler
возвращает HTTP 200, `Content-Type: application/json` и `{"status":"ok"}`.
`POST /api/event-types`, `GET /api/event-types` и `GET /api/event-types/{id}`
реализованы через usecase и PostgreSQL. Остальные бизнес-маршруты пока
возвращают 500 после проверки входа и будут реализованы следующими тикетами.
[Контракт и генерация](../api/README.md) запускаются через `make generate`.

```sh
make build
make backend-install
make migrate
make backend-dev
make backend-check
```

Все команды выполняются в Docker. Сервер доступен на `localhost:8080`;
при запущенном frontend также через `localhost:5173/api/health`.
После изменения исходников повторите `make backend-dev`. При старте контейнер
собирает `/tmp/api` и запускает его через `exec`, чтобы сигналы доходили
до процесса сервера. `make backend-build` сохраняет сборку в `backend/bin/api`.

## Настройки и завершение

Приложение читает `DATABASE_URL`, `OWNER_NAME` (по умолчанию Дмитрий Степанов)
и `PORT` (по умолчанию 8080, допустимы числа 1–65535).
Compose явно передаёт `PORT=8080` и `GIN_MODE=release`. Корневая переменная
`BACKEND_PORT` меняет только опубликованный порт хоста, сохраняя адрес proxy.
Проверить другой порт внутри одноразового контейнера можно так:

```sh
docker compose run --rm --no-deps -T -e PORT=9090 backend
```

Таймауты HTTP: заголовки — 5 секунд, чтение/запись — 10 секунд,
idle — 60 секунд. SIGINT/SIGTERM запускают graceful shutdown с лимитом
5 секунд; Compose даёт процессу 10 секунд до принудительной остановки.
Ошибка конфигурации, запуска или завершения приводит к ненулевому коду выхода.
События сервера записываются через `slog` в JSON, запросы и panic recovery —
стандартными middleware Gin. Просмотр: `docker compose logs backend`.

## Проверки

`make backend-test` запускает `go test ./...`: дымовой тест использует реальный
роутер и `httptest`, проверяет health, валидацию, нормализацию строк, время
с явным смещением, адаптацию ошибок и panic без раскрытия внутренних деталей.
`make backend-lint` запускает закреплённый golangci-lint; `make backend-format-check`
проверяет gofmt без записи. Исправления: `make backend-format` и
`make backend-lint-fix`. Сборка, тесты и линтер используют модули в режиме
`readonly`; обновление зависимостей выполняется явно, с сохранением `go.mod/go.sum`.

Произвольные команды выполняются из корня через `make backend-run CMD="..."`
или `make backend-shell`.

[Архитектура и правила импортов](../docs/architecture.md) ·
[Версии и зависимости](../docs/toolchain.md)

## PostgreSQL и миграции

`repo.Postgres` использует закреплённый pgx v5.7.6 и удовлетворяет интерфейсу
`usecase.EventRepository`; HTTP-модели сюда не импортируются. `cmd/api`
открывает pool с проверкой соединения, собирает usecase и router; закрывает
pool при завершении. Ошибка БД не заменяется временным хранилищем.

`make migrate` запускает `cmd/migrate` отдельно от API. Миграции встроены
в бинарный файл, выполняются по именам и защищены контрольными суммами.
Добавляйте новый файл с очередным номером; применённые файлы не редактируйте.
`make database-test` выполняет те же миграции на `postgres-test/booking_test`
и Go HTTP-интеграцию без кеша. Тест очищает только эту БД и проверяет пустой
каталог, UUID v4, trim, дубликаты, порядок, 404 и чтение из нового pool.
