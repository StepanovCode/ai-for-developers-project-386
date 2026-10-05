# Календарь звонков

[![hexlet-check](https://github.com/StepanovCode/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/StepanovCode/ai-for-developers-project-386/actions)

Учебный проект сервиса бронирования календаря, разрабатываемый совместно с ИИ.
Готов технический каркас: frontend, backend с health endpoint, тесты,
линтеры и сборка в Docker (этапы 1–6). Бизнес-логика ещё не реализована.

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Стек

- Окружение: Docker Compose, Node.js 24.21.0, npm 11.19.0, Go 1.27.1.
- Frontend: Vite, React, TypeScript, Tailwind CSS, shadcn/ui.
- Backend: Go и Gin, слои API, usecase, services, repo и domain.

## Установка

На хосте нужны Git, Docker с Compose v2 и Make. Node.js, npm, Go и зависимости
проекта запускаются в контейнерах; устанавливать их на хост не требуется.

```bash
git clone https://github.com/StepanovCode/ai-for-developers-project-386.git
cd ai-for-developers-project-386
make start
```

Перед запуском откройте Docker Desktop или запустите Docker Engine.
`make start` собирает образы, останавливает ранее запущенные сервисы,
устанавливает зависимости в контейнерах и запускает приложение в фоне.
Команда подходит для первого и повторного запуска; первый запуск требует
интернета и может занять несколько минут. Создавать `.env` необязательно.
Для остановки выполните `make down`. Быстрый повторный запуск без установки
зависимостей — `make up`. Проверки запускаются отдельно: `make check`.

Frontend доступен на [localhost:5173](http://localhost:5173)
и backend на [localhost:8080/api/health](http://localhost:8080/api/health).
`GET /api/health` возвращает HTTP 200 и `{"status":"ok"}` напрямую и через
[proxy Vite](http://localhost:5173/api/health).
Отдельный запуск: `make frontend-dev` и `make backend-dev`.
После изменения Go-кода повторите `make backend-dev`: он пересобирает
бинарный файл и перезапускает backend. Frontend использует HMR.

Проверка production-сборки:

```sh
make frontend-build
make frontend-preview
```

Preview доступен на [localhost:4173](http://localhost:4173), пока команда
работает; остановка — Ctrl+C. Сначала запустите `make up` или
`make frontend-dev`. Preview предназначен для локальной проверки сборки.

По умолчанию зарезервированы порты 5173, 4173 и 8080 на loopback хоста.
Для изменения скопируйте `.env.example` в `.env` и отредактируйте внешние порты.
Корневой `.env` читает Compose; в приложения он автоматически не передаётся.
Файлы `.env` исключены из Git, безопасный пример сохраняется.

## Команды окружения

```sh
make help
make frontend-shell
make backend-shell
make frontend-run CMD="node --version"
make backend-run CMD="go version"
make down
```

`make down` сохраняет зависимости и кеши. `make clean-volumes` явно удаляет
также volumes этого проекта; после очистки повторите `make install`.

## Проверки и исправления

Все проверки выполняются в одноразовых контейнерах и не требуют `make up`:

```sh
make check          # линтеры, типы, форматирование, тесты, сборка обеих частей
make frontend-check # проверки только frontend
make backend-check  # проверки только backend
make test
make lint
make typecheck
make format-check
make app-build
```

Проверки не исправляют исходники. Для явного исправления используйте
`make format` (Prettier и gofmt) и `make lint-fix` (доступные исправления
линтеров). Тесты завершаются после одного запуска и подходят для CI.
Сборка создаёт `frontend/dist/` и `backend/bin/api`; оба каталога исключены из Git.

## Документация

- [API: TypeSpec, генерация SDK/Go, форматы и команды](api/README.md).
- [Окружение Docker: команды, кеши, порты и очистка](docs/docker.md).
- [Frontend: структура, shadcn/ui и команды](frontend/README.md).
- [Backend: запуск, конфигурация и health endpoint](backend/README.md).
- [Структура и архитектурные границы](docs/architecture.md).
- [Версии инструментов, зависимости и соглашения для CI](docs/toolchain.md).
- [Подключение shadcn MCP и GitHub Actions MCP](docs/mcp.md).
- [Conventional Commits, CI и автоматические релизы](docs/releases.md).
- [План этапов и журнал выполнения](docs/project-plan.md).

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
