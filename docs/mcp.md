# MCP для этого проекта

Настройки находятся в [`.codex/config.toml`](../.codex/config.toml).
Codex загружает настройки доверенного проекта вместе с пользовательскими.
Существующие серверы в пользовательском config.toml изменять не требуется.
Открывайте Codex в корне этого репозитория.

## 1. Подготовить shadcn

Запустите Docker Desktop. После чистого клонирования выполните из корня:

```sh
make build
make frontend-install
codex mcp get shadcn
```

Если образы и зависимости уже установлены, повторять установку не нужно.
Токен для стандартного реестра shadcn не требуется.
Сервер запускает установленный из lockfile shadcn 4.21.0 внутри frontend:

```sh
docker compose run --rm --no-deps -T frontend ./node_modules/.bin/shadcn mcp --cwd /workspace/frontend
```

Эту команду запускает MCP-клиент; вручную она ожидает JSON-RPC на stdin.
Рабочий каталог контейнера — `/workspace/frontend`, исходники и
`components.json` доступны через bind mount, зависимости — через volume.
Флаг `-T` отключает TTY. Запуск не устанавливает пакеты и не использует
`npm run` или Make, которые могли бы добавить служебный вывод в stdout.
Постоянный dev-сервер для MCP не нужен.

## 2. Создать GitHub-токен

Откройте GitHub → аватар → Settings → Developer settings → Personal access
tokens → Fine-grained tokens → Generate new token.
[Прямая ссылка](https://github.com/settings/personal-access-tokens/new).

Выберите:

- Token name: `codex-actions`.
- Expiration: например, 30 дней.
- Resource owner: `StepanovCode`.
- Repository access: Only select repositories → `ai-for-developers-project-386`.
- Repository permissions: Actions → Read-only; Metadata → Read-only
  добавляется автоматически.

Нажмите Generate token и сохраните значение в менеджере паролей.
Токен не нужно отправлять в чат или записывать в файлы репозитория.
Для чтения workflow, запусков и логов достаточно Actions: read.

## 3. Передать токен Codex

Конфигурация GitHub уже ссылается на переменную `GITHUB_MCP_TOKEN`:

```toml
[mcp_servers.github_actions]
url = "https://api.githubcopilot.com/mcp/x/actions/readonly"
bearer_token_env_var = "GITHUB_MCP_TOKEN"
startup_timeout_sec = 30
tool_timeout_sec = 60
```

Это официальный удалённый GitHub MCP Server с toolset `actions` в режиме
чтения. Дополнительный npm-пакет или Docker-образ для него не нужен.
Версию размещённого GitHub сервера контролирует GitHub.
Выбран поддерживаемый в инструкции GitHub для Codex способ авторизации PAT.

На macOS откройте обычный Terminal с zsh. Выполните первую команду отдельно,
вставьте токен в скрытый ввод и нажмите Enter, затем выполните остальные:

```zsh
read -rs 'GITHUB_MCP_TOKEN?GitHub MCP token: '
printf '\n'
export GITHUB_MCP_TOKEN
launchctl setenv GITHUB_MCP_TOKEN "$GITHUB_MCP_TOKEN"
```

Значение не выводится и не попадает в историю команд. `export` передаёт его
Codex CLI, запущенному из этого терминала; `launchctl setenv` задаёт окружение
для вновь запускаемых GUI-приложений пользовательской сессии macOS.
Полностью завершите Codex через Cmd+Q и запустите снова, открыв проект.
Простое открытие новой задачи в уже работающем приложении не обновляет
окружение процесса. После выхода из macOS или перезагрузки повторите ввод.
Корневой `.env` читает Docker Compose, но Codex автоматически его не загружает.

Для CLI можно выполнить `codex` из корня проекта в том же терминале.
В других ОС передайте переменную окружения процессу MCP-клиента средствами ОС.
Для удаления переменной на macOS:

```sh
launchctl unsetenv GITHUB_MCP_TOKEN
unset GITHUB_MCP_TOKEN
```

После удаления также перезапустите клиент; отзыв самого токена выполняется
в настройках GitHub.

## 4. Проверить подключение

В корне проекта `codex mcp get shadcn` и `codex mcp get github_actions`
показывают прочитанную конфигурацию, но сами по себе не проверяют подключение.
В Codex CLI используйте `/mcp`, в приложении — список MCP-серверов в настройках.
После перезапуска попросите ассистента:

> Проверь этап 7 через MCP: получи реестры проекта и список компонентов shadcn;
> через github_actions получи workflow репозитория
> StepanovCode/ai-for-developers-project-386, последний запуск hexlet-check
> и логи одного job. Запиши результаты в план.

При ошибке shadcn проверьте Docker и `make frontend-install`.
При GitHub 401 проверьте переменную в окружении именно процесса Codex,
срок токена и полный перезапуск; при 403 — права и доступ к репозиторию.
Не выводите значение токена для диагностики.

## Проверено 2026-09-25

- Codex CLI прочитал обе проектные настройки, сторонние серверы сохранены.
- shadcn прошёл initialize, tools/list и два tools/call через Docker STDIO:
  7 инструментов, реестр `@shadcn`, 61 UI-компонент. Все четыре строки stdout —
  успешные JSON-RPC-ответы, stderr пуст, TTY отключён.
- В ответе списка shadcn 4.21.0 поле Add command содержит `[object Promise]`:
  это дефект текста ответа CLI; сами имена компонентов возвращаются корректно.
  Подсказки с `npx shadcn@latest` следует адаптировать к закреплённому CLI в Docker.
- GitHub MCP без токена вернул HTTP 401. Публичный REST API видит workflow
  `hexlet-check` и успешный запуск `35932043218`, но это не проверка MCP.
- Ожидаются токен, перезапуск Codex и реальные вызовы обоих серверов из Codex.
  Чтение GitHub workflow, запусков и логов через MCP ещё не проверено.

## Источники

- [MCP в Codex](https://developers.openai.com/codex/mcp/).
- [shadcn MCP](https://ui.shadcn.com/docs/mcp).
- [GitHub MCP для Codex](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-codex.md).
- [Удалённые toolsets GitHub](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md).
- [Создание PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
- [Права чтения workflow](https://docs.github.com/en/rest/actions/workflows).
- [Права чтения логов job](https://docs.github.com/en/rest/actions/workflow-jobs).
