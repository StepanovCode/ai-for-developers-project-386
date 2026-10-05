# Версии инструментов и зависимости

Версии проверены в контейнерах 2026-09-25:

| Инструмент | Версия | Источник настройки |
|---|---|---|
| Node.js | 24.21.0 | `FROM node:24.21.0-bookworm-slim` в `docker/frontend.Dockerfile` |
| npm | 11.19.0 | Поставляется с образом Node.js; точная версия проверяется при сборке Dockerfile |
| Go | 1.27.1 | `FROM golang:1.27.1-bookworm` в `docker/backend.Dockerfile` |
| Vite / React / TypeScript | 8.3.0 / 19.2.8 / 6.0.2 | `frontend/package.json` и lockfile |
| Tailwind CSS / Vite plugin | 4.3.3 / 4.3.3 | `frontend/package.json` и lockfile |
| create-vite / shadcn CLI | 9.2.1 / 4.21.0 | Версии генераторов этапа 3; shadcn также закреплён в `frontend/package.json` |
| Gin | 1.12.0 | `backend/go.mod` и `go.sum` |
| golangci-lint | 2.14.0 | Официальный образ `golangci/golangci-lint:v2.14.0`, бинарный файл копируется в backend Dockerfile |
| Vitest / jsdom | 5.0.1 / 30.1.1 | `frontend/package.json` и lockfile |
| React Testing Library / DOM Testing Library / jest-dom | 16.3.3 / 10.4.2 / 7.0.1 | `frontend/package.json` и lockfile |
| ESLint / @eslint/js / typescript-eslint | 10.11.0 / 10.0.1 / 8.70.1 | `frontend/package.json` и lockfile |
| React Hooks / React Refresh ESLint plugins | 7.1.1 / 0.5.7 | `frontend/package.json` и lockfile |
| globals / Prettier | 17.12.0 / 3.9.9 | `frontend/package.json` и lockfile |

Цепочка API проверена отдельно 2026-10-05: TypeSpec 1.16.0, Hey API 0.99.0,
TypeScript 6.0.2, oapi-codegen 2.8.0, gin-middleware 1.1.0 и runtime 1.7.0.
Версии, lockfiles, найденные особенности совместимости и воспроизведение
описаны в [API-контракте](../api/README.md).

Dockerfile — источник версий окружения. Не добавляем дублирующие `.nvmrc`,
`.node-version` или установку языковых инструментов на хосте. Точные теги
закрепляют версии инструментов; digest образа сейчас не фиксируется, поэтому
системные пакеты внутри того же тега могут обновляться.

На хосте нужны Git, Docker с Compose v2 и Make для сокращённых команд.
Make только вызывает Docker; альтернативные команды приведены в
[инструкции окружения](docker.md). Проверка версий: `make versions`.

## Совместимость

- Node.js 24.21.0 удовлетворяет опубликованному минимуму
  [Vite: Node.js 20.19+ или 22.12+](https://vite.dev/guide/).
- Go 1.27.1 удовлетворяет опубликованному минимуму
  [Gin: Go 1.25+](https://gin-gonic.com/en/docs/quickstart/).
- npm 11.19.0 запускается с выбранным Node.js и поставляется в том же образе.
  `.npmrc` включает `engine-strict=true`, чтобы несовместимые зависимости
  обнаруживались при установке.

Установка `npm ci` и production-сборка Vite/React/shadcn с TypeScript проверены
в контейнере на этапе 3. Gin, тесты и линтеры проверяются на этапах 4–6.
Alias TypeScript использует `paths` с относительными путями без устаревшего
`baseUrl`; он согласован с alias Vite и распознаётся shadcn CLI.

## Закрепление остальных инструментов

1. При добавлении инструмента проверить требования официальной документации,
   выбрать точную выпущенную версию и выполнить установку в контейнере.
   Не использовать плавающий `latest` в сохранённых командах и конфигурации.
2. Frontend: точные версии прямых зависимостей в `package.json`, без `^` и `~`.
   `.npmrc` задаёт `save-exact=true` и `package-lock=true`; после генератора
   проверить диапазоны вручную. `package-lock.json` сохранять в Git и обновлять
   вместе с `package.json`. Для повторной установки использовать `npm ci`.
   Согласованные Node.js/npm указаны в `engines`, npm — в `packageManager`;
   реальные версии по-прежнему задаются Dockerfile.
3. Backend: сохранять `go.mod` и `go.sum` в Git после появления настоящего
   модуля; добавлять зависимости через `go get <module>@<version>`, не через
   массовый `go get -u`. Директиву `go` согласовать с выбранным toolchain.
   `GOTOOLCHAIN=local` в Compose запрещает автоматическое скачивание другого Go.
   Повторная установка — `go mod download`, проверки/сборка в CI — без
   неявного изменения зависимостей (`-mod=readonly`).
4. CLI генераторов (create-vite, shadcn) запускать с явной версией в контейнере;
   выбранную версию сохранить в документации соответствующего этапа.
   Линтеры и тестовые раннеры закреплять при добавлении на этапах 5–6.
5. При обновлении версии менять Dockerfile, документацию и связанные метаданные
   приложений вместе, пересобирать образы, проверять версии, установку и
   доступные проверки проекта. Не исправлять несовместимость инструментом хоста.

## Использование в CI

На этапе 8 CI должен собирать те же Dockerfile через `compose.yaml` и вызывать
те же цели Makefile, что используются локально. Не заводить параллельные
версии через `setup-node`/`setup-go`. Одноразовые команды выполняются через
`docker compose run --rm --no-deps -T`: без TTY и с кодом возврата команды.

Собственный CI находится в `.github/workflows/ci.yml`;
существующий `hexlet-check.yml` не изменяется.
Последовательность после клонирования: `make build`, `make install`, `make check`.
Будущие независимые задания могут использовать `make frontend-install frontend-check`
и `make backend-install backend-check`. Общая проверка не исправляет исходники;
`make format` и `make lint-fix` применяют исправления явно.

Commitlint 21.2.3 и config-conventional 21.2.3 закреплены отдельно в
`tools/package.json` и lockfile; Docker tooling использует те же Node.js/npm.
Actionlint 1.7.12 запускается отдельным Docker-образом через `make workflows-check`.
Подготовка commitlint: `make tooling-build`, затем `make tooling-install`.
Формат сообщений и процесс релиза описаны в [releases.md](releases.md).

Официальные инструкции инструментов:
[Vitest](https://vitest.dev/guide/),
[React Testing Library](https://testing-library.com/docs/react-testing-library/setup/),
[typescript-eslint](https://typescript-eslint.io/getting-started/),
[Prettier](https://prettier.io/docs/install),
[golangci-lint в Docker](https://golangci-lint.run/docs/welcome/install/local/).
