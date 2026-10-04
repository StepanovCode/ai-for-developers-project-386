# Окружение разработки

Frontend запускает Vite, backend собирает и запускает HTTP-сервер Gin.
Запуск одной командой из корня репозитория: `make start`.
Она собирает образы, останавливает сервисы перед переустановкой зависимостей,
устанавливает зависимости из lockfile и Go-модуля в контейнерах и запускает
оба сервиса в фоне. На хосте нужны Make и работающий Docker.
Ниже приведены отдельные команды для ручного управления окружением.

## Требования и запуск

На хосте нужны Git и работающий Docker Engine с Docker Compose v2
(на macOS/Windows — Docker Desktop). Node.js, npm, Go и библиотеки проекта
на хост устанавливать не требуется. Все команды ниже выполнять из корня
репозитория.

```sh
docker --version
docker compose version
docker info
docker compose config --quiet
docker compose build
docker compose run --rm --no-deps -T frontend npm ci
docker compose run --rm --no-deps -T backend go mod download
docker compose up -d
docker compose ps
```

Если `docker info` не может подключиться к daemon, запустите Docker Desktop
или службу Docker Engine. Первая сборка требует доступа к Docker Hub.
Если сборка сообщает `docker-credential-desktop: executable file not found`,
используйте `make start`: Makefile определяет каталог установленного Docker
по ссылке на CLI и добавляет его в `PATH` своих команд, если рядом найден
credential helper. Настройки оболочки и Docker при этом не меняются.
Для прямых вызовов `docker compose` добавьте каталог CLI-инструментов Docker
Desktop в `PATH` терминала или настройте установку CLI через Docker Desktop.

Базовые образы закреплены тегами `node:24.21.0-bookworm-slim` и
`golang:1.27.1-bookworm`. npm 11.19.0 поставляется в образе Node.js;
Dockerfile проверяет его версию. [Соглашение о версиях и CI](toolchain.md).
Переменная
`GOTOOLCHAIN=local` запрещает Go незаметно скачивать другую версию toolchain.

## Команды и вход в окружение

Makefile предоставляет сокращённые команды: `make config`, `make build`,
`make up`, `make ps`, `make versions`, `make stop`, `make down` и
`make clean-volumes`. `make build` собирает образы окружения, а не приложения.
`make frontend-shell` и `make backend-shell` открывают интерактивную оболочку.
`make frontend-run CMD="node --version"` и `make backend-run CMD="go version"`
выполняют команды без TTY, передавая код возврата в Make.

Для отдельной копии можно передать `COMPOSE="docker compose -p <имя>"`
в любую цель Makefile; при запуске и очистке использовать одно и то же имя.

Одноразовые контейнеры не требуют предварительного `up` или существования
приложений. Они используют те же каталоги и volumes, что и постоянные сервисы:

```sh
docker compose run --rm --no-deps frontend node --version
docker compose run --rm --no-deps frontend npm --version
docker compose run --rm --no-deps backend go version
docker compose run --rm --no-deps frontend sh
docker compose run --rm --no-deps backend sh
```

В уже запущенные контейнеры можно войти так:

```sh
docker compose exec frontend sh
docker compose exec backend sh
```

Команды установки (`npm install`, `npm ci`, `go mod download`) также
нужно вызывать через `docker compose run --rm --no-deps <сервис> ...` или
`docker compose exec <сервис> ...`.
Образы используют пользователя root: на Linux создаваемые через bind mount
файлы могут принадлежать root; учитывайте права рабочего каталога.

## Исходники и кеши

| Ресурс | Путь в контейнере | Хранение |
|---|---|---|
| Frontend | `/workspace/frontend` | Bind mount `./frontend` |
| Backend | `/workspace/backend` | Bind mount `./backend` |
| Зависимости npm | `/workspace/frontend/node_modules` | Volume `frontend_node_modules` |
| Кеш npm, включая npx | `/cache/npm` | Volume `npm_cache` |
| Модули Go | `/go/pkg/mod` | Volume `go_modules` |
| Кеш сборки Go | `/cache/go-build` | Volume `go_build_cache` |

Изменения исходников видны на хосте и в контейнерах. Docker может создать
пустую точку монтирования `frontend/node_modules` на хосте, но её содержимое
хранится в volume. Все четыре volume получают префикс Compose-проекта
`ai-for-developers-project-386`. Кеши сохраняются после `run --rm` и `down`.
Исходники и локальные файлы не попадают в build context благодаря `.dockerignore`.

## Порты и запуск приложений

| Назначение | Адрес с хоста | Порт контейнера |
|---|---|---|
| Vite dev | `http://localhost:5173` | 5173 |
| Vite preview | `http://localhost:4173` | 4173 |
| Backend | `http://localhost:8080` | 8080 |

Dev-сервер запускается через `make up` или `make frontend-dev`; preview
нужно запускать отдельно. Backend отдаёт `GET /api/health`. Публикация ограничена
loopback-интерфейсом хоста. Если порт занят, задайте другой внешний порт:

```sh
FRONTEND_PORT=15173 FRONTEND_PREVIEW_PORT=14173 BACKEND_PORT=18080 docker compose up -d
```

Для постоянной локальной настройки скопируйте `.env.example` в `.env`
и измените значения. Это переменные интерполяции Compose, они не меняют
порты внутри контейнеров и не передаются автоматически в окружение приложений.
Compose явно задаёт backend переменные `PORT=8080`, `GIN_MODE=release`
и `GOFLAGS=-mod=readonly`; отдельные `.env` приложениям не требуются.

Vite слушает `0.0.0.0:5173`, preview — `0.0.0.0:4173`; оба используют
`strictPort`. Адреса заданы в `frontend/vite.config.ts`. Установка и сборка
frontend не выполняются автоматически при старте:

```sh
make frontend-install
make frontend-dev
make frontend-build
make frontend-preview
```

`make frontend-preview` работает в текущем терминале до Ctrl+C. Для запуска
только preview без dev-сервера можно после сборки использовать
`docker compose run --rm --no-deps --service-ports frontend npm run preview`,
предварительно остановив постоянный frontend-контейнер во избежание конфликта портов.

Backend слушает порт 8080 на всех интерфейсах. Proxy Vite настроен обращаться
к `http://backend:8080` по сети Compose. `localhost` внутри frontend-контейнера
обозначает сам frontend-контейнер. `GET /api/health` доступен напрямую
и через frontend proxy, с одинаковым статусом 200 и телом `{"status":"ok"}`.
При старте backend собирает бинарный файл в `/tmp/api` и запускает через `exec`.
После изменения Go-кода выполните `make backend-dev`; автоматического reload нет.
SIGINT/SIGTERM завершают сервер с ожиданием активных запросов до 5 секунд,
а `stop_grace_period` Compose равен 10 секундам.
Команда `docker compose run` по умолчанию
не публикует порты; для одноразового сервера потребуется `--service-ports`
и отсутствие другого контейнера, уже занимающего эти порты.

## Проверки

После `make build` и `make install` команда `make check` запускает ESLint,
TypeScript, Prettier, Vitest, golangci-lint, gofmt, Go-тесты и обе сборки.
`make frontend-check` и `make backend-check` предназначены также для независимых
заданий будущего CI. Для проверки не нужны запущенные HTTP-серверы.
Автоисправления выполняются только отдельными `make format` и `make lint-fix`.
golangci-lint копируется из официального образа с закреплённой версией
в backend-образ; установка инструментов на хост не нужна.

## Подготовка к shadcn CLI/MCP

Frontend-окружение предоставляет Node.js, npm/npx, сетевой доступ, постоянный
npm-кеш и рабочий каталог `/workspace/frontend`. На этапе 7 shadcn CLI/MCP
нужно запускать здесь же: тогда он увидит `components.json` и будет изменять
исходники через bind mount. Для генерации frontend использован shadcn 4.21.0;
конфигурация и проверка MCP-клиента остаются задачей этапа 7.

Для STDIO использовать `docker compose exec -T frontend <команда MCP>` в
уже запущенном окружении: `-T` отключает TTY, stdin остаётся доступным.
Сборку и запуск окружения выполнять отдельно, до запуска MCP. Не добавлять
приветствия или диагностический вывод в stdout процесса MCP.

## Остановка и удаление ресурсов проекта

Остановить контейнеры, сохранив их и кеши:

```sh
docker compose stop
```

Удалить контейнеры и сеть этого проекта, сохранив volumes для следующего запуска:

```sh
docker compose down
```

Явно удалить также зависимости и кеши **этого проекта**:

```sh
docker compose down --volumes
```

Последняя команда удаляет четыре именованных volume; следующая установка
зависимостей и сборка будут выполняться с пустыми кешами. Исходники в bind
mounts сохраняются. Локально собранные образы можно дополнительно удалить
командой `docker compose down --volumes --rmi local`. Глобальные `prune`
для очистки проекта не нужны.

Если запускаете отдельную копию репозитория, задайте собственное имя через
`docker compose -p <имя> ...` и используйте его во всех командах, включая
очистку. Это отделяет контейнеры, сеть и volumes копии; порты тоже должны
отличаться при одновременном запуске.

## Официальные источники

- [Параметры сервисов Compose](https://docs.docker.com/reference/compose-file/services/)
- [Именованные volumes](https://docs.docker.com/reference/compose-file/volumes/)
- [Особенности compose run и публикации портов](https://docs.docker.com/reference/cli/docker/compose/run/)
- [Официальный образ Node.js](https://hub.docker.com/_/node)
- [Официальный образ Go](https://hub.docker.com/_/golang)
- [Требования Vite к Node.js](https://vite.dev/guide/)
