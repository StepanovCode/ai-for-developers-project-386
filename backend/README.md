# Backend

Go-приложение с Gin. Точка входа — `cmd/api/main.go`, HTTP-роутер —
`internal/api/router.go`. `GET /api/health` через generated strict handler
возвращает HTTP 200, `Content-Type: application/json` и `{"status":"ok"}`.
Остальные семь маршрутов описаны контрактом и зарегистрированы, но пока
возвращают 500 после проверки входа: бизнес-сценарии ещё не реализованы.
[Контракт и генерация](../api/README.md) запускаются через `make generate`.

```sh
make build
make backend-install
make backend-dev
make backend-check
```

Все команды выполняются в Docker. Сервер доступен на `localhost:8080`;
при запущенном frontend также через `localhost:5173/api/health`.
После изменения исходников повторите `make backend-dev`. При старте контейнер
собирает `/tmp/api` и запускает его через `exec`, чтобы сигналы доходили
до процесса сервера. `make backend-build` сохраняет сборку в `backend/bin/api`.

## Настройки и завершение

Приложение читает `PORT` (по умолчанию 8080, допустимы числа 1–65535).
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
