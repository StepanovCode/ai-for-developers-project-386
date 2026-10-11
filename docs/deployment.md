# Production-образ и Render

## Сборка и запуск

Корневой `Dockerfile` собирает frontend через npm ci и Vite, backend и
миграции через Go. В итоговом образе находятся готовые файлы, CA-сертификаты
и встроенные данные часовых поясов. Node.js, Go, исходники и локальные
зависимости для запуска не нужны. HTTP обслуживает один Go-процесс от UID 10001.

```sh
make production-build
docker run --rm -e PORT=9090 -p 9090:9090 meetly:local
```

На `http://localhost:9090/` открывается Meetly; на `/api/health` — JSON
`{"status":"ok"}`. Значение PORT задаёт порт внутри контейнера: если меняете
его, меняйте правую часть `-p` соответственно. Без PORT используется 8080.
Приложение слушает на всех интерфейсах; EXPOSE 8080 — только метаданные образа.
Прямое открытие клиентских маршрутов работает без Vite/proxy и CORS-настроек.

Без DATABASE_URL доступны только интерфейс и liveness: операции с данными
возвращают 503 SERVICE_UNAVAILABLE. Это позволяет проверить самостоятельный
запуск образа с PORT; полноценная запись на встречу требует PostgreSQL.
При заданном DATABASE_URL недоступная БД или ошибка миграций прекращает запуск.
Health не заменяет проверку создания типа и бронирования.

Для полной локальной проверки можно запустить отдельную PostgreSQL
в отдельной сети (рабочая БД Compose не используется):

```sh
docker network create meetly-production
docker volume create meetly-production-db
docker run -d --name meetly-production-db --network meetly-production \
  -e POSTGRES_USER=meetly -e POSTGRES_PASSWORD=local-only \
  -e POSTGRES_DB=meetly \
  -v meetly-production-db:/var/lib/postgresql/data postgres:17.6-alpine
docker exec meetly-production-db pg_isready -U meetly -d meetly
# Дождитесь ответа accepting connections, затем запускайте приложение.
docker run -d --name meetly-production-app --network meetly-production \
  --read-only -e PORT=9090 \
  -e 'DATABASE_URL=postgres://meetly:local-only@meetly-production-db:5432/meetly?sslmode=disable' \
  -p 9090:9090 meetly:local
docker logs meetly-production-app
```

Пароль local-only используется только в локальном примере. Для внешнего
деплоя используйте строку подключения хостинга через секреты окружения.
Первый запуск автоматически применяет миграции, следующие проверяют их
контрольные суммы. Затем entrypoint заменяет себя API через exec; SIGTERM
доходит до Go и запускает graceful shutdown. Миграции не изменены и
не наполняют БД демонстрационными сущностями. Dev make migrate остаётся
отдельной командой.

Остановка приложения и БД сохраняет PostgreSQL volume:

```sh
docker stop meetly-production-app meetly-production-db
docker rm meetly-production-app meetly-production-db
docker network rm meetly-production
```

`docker volume rm meetly-production-db` **удаляет данные этого примера**;
выполняйте отдельно, если они больше не нужны. Глобальный Docker prune не нужен.

Для проверки архитектуры Render с ARM-хоста:

```sh
make production-build PRODUCTION_PLATFORM=linux/amd64 PRODUCTION_IMAGE=meetly:render
```

## Настройки Render

Сначала изменения Dockerfile должны быть опубликованы в выбранной ветке
GitHub. Пока ветка только локальная, Render не видит её и не может собрать
этот образ. Push и merge выполняются только после отдельного указания пользователя.

### 1. PostgreSQL

New → Postgres:

| Поле | Значение |
| --- | --- |
| Name | meetly-db (или свободное имя) |
| Database | meetly |
| User | meetly |
| Region | Frankfurt; web service должен быть в том же регионе |
| PostgreSQL Version | 17 |
| Plan | Free для временной учебной проверки, если доступен в аккаунте |

После статуса Available скопируйте **Internal Database URL** в DATABASE_URL
веб-сервиса. Не добавляйте URL с паролем в Git, README или сообщения.
БД должна поддерживать расширение btree_gist — его создаёт существующая
миграция 003. На бесплатном тарифе БД истекает через 30 дней; для постоянной
ссылки потребуется БД с подходящим сроком хранения.

### 2. Web Service

| Поле | Значение |
| --- | --- |
| Source Code | StepanovCode/ai-for-developers-project-386 |
| Name | meetly-stepanov (или свободное имя) |
| Language | Docker |
| Branch | codex/docker-deploy после публикации; main только после merge изменений |
| Region | Тот же регион, что у PostgreSQL |
| Root Directory | Оставить пустым |
| Dockerfile Path | ./Dockerfile |
| Docker Build Context | . (если поле показано) |
| Compute | Free, если доступен в аккаунте |
| Docker Command | Оставить пустым: запуск определён в образе |
| Pre-Deploy Command | Оставить пустым: entrypoint применяет миграции |
| Health Check Path | /api/health |
| Auto-Deploy | Off на время ручной проверки |

Переменные окружения:

| Имя | Значение |
| --- | --- |
| PORT | 10000 |
| DATABASE_URL | Internal Database URL созданной PostgreSQL |
| OWNER_NAME | Имя владельца; по умолчанию Дмитрий Степанов |
| GIN_MODE | release (уже задано образом) |

STATIC_DIR уже задан в образе как /app/public. WORK_SCHEDULE можно оставить
незаданным: используются пн–пт 09:00–18:00, Europe/Moscow.
Build Command и Start Command для Docker не требуются.

### 3. Приёмка деплоя

- В логах: migrations applied и server started, без ошибок БД/схемы.
- Публичная HTTPS-ссылка открывает Meetly, CSS, JS, логотип и шрифт загружаются.
- /api/health возвращает 200 JSON; /api/event-types и /api/meetings
  возвращают реальные ответы PostgreSQL.
- Прямое открытие /admin/meetings и /book работает; отсутствующий API
  возвращает JSON 404, отсутствующий asset — 404.
- Создание типа, выбор свободного слота, бронирование и список встреч
  владельца работают; перезапуск сервиса сохраняет данные.
- После этих проверок публичная ссылка добавляется в README и журнал плана.

Render MCP подключается отдельно от доступа Render к GitHub-репозиторию.
Подключение проверяется чтением workspace/сервисов; создание сервиса в UI
само по себе не означает проверку MCP или успешный deploy.

## Официальные источники

- [Docker на Render](https://render.com/docs/docker)
- [Web Service и PORT](https://render.com/docs/web-services)
- [PostgreSQL](https://render.com/docs/postgresql-creating-connecting)
- [Ограничения Free](https://render.com/docs/free)
- [Render MCP](https://render.com/docs/mcp-server)

Публичный сервис пока не создан; рабочая ссылка будет записана после реального деплоя.
