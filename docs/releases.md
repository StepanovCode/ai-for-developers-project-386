# Коммиты, CI и автоматические релизы

## Формат коммитов

Правило распространяется на разработчика и агента и закреплено в
[AGENTS.md](../AGENTS.md). Используется
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```text
type(scope): краткое описание

Необязательное объяснение причины и результата изменения.

Необязательные футеры.
```

`scope` необязателен; например, `frontend`, `backend`, `deps`. Типы проекта:
`feat`, `fix`, `docs`, `chore`, `ci`, `build`, `test`, `refactor`, `perf`,
`style`, `revert`. Type — в нижнем регистре; заголовок — до 100 символов.
Это соглашения проекта поверх спецификации. Описание можно писать по-русски
или по-английски. Выбирайте тип по изменению, а не по желаемому номеру версии.

Примеры:

```text
feat(backend): add health endpoint
fix(backend): handle shutdown errors
docs: describe Docker setup
ci: check frontend and backend in containers
```

Несовместимость обозначается `!` перед `:` или футером `BREAKING CHANGE:`.
Оба маркера одновременно не обязательны; `BREAKING-CHANGE:` тоже допустим.
При несовместимости объясните, что изменилось и как перейти на новый интерфейс:

```text
feat(backend)!: replace API_PORT with PORT

BREAKING CHANGE: set PORT instead of API_PORT in the server environment.
```

Заголовок PR проверяется по тем же правилам. При squash merge перенесите его
в заголовок итогового коммита и сохраните важные сведения о несовместимости
в body. Название PR без префикса не подходит даже при корректных коммитах.

## Проверки

Все инструменты работают в Docker; установка Node.js/npm на хост не нужна:

```sh
make tooling-build
make tooling-install
printf '%s\n' 'feat: add application scaffold' | make commitlint
make commits-check
make workflows-check
```

`tools/package-lock.json` фиксирует commitlint и зависимости. Профиль Compose
`tools` отделён от запуска приложения. `make commits-check` проверяет все
коммиты после SHA в `.commitlint-baseline` вплоть до текущего HEAD; исходные
коммиты Хекслета исключены. Нужна полная Git-история (`fetch-depth: 0` в CI).
Стандартные merge-коммиты игнорируются commitlint; в проекте используется squash.
Проверка сообщения не создаёт коммит, а локальные Git hooks не устанавливаются.

`.github/workflows/ci.yml` запускается на push и PR, в том числе при изменении
заголовка PR. Независимые jobs:

- `frontend`: установка из lockfile, ESLint, TypeScript, Prettier, тест и сборка;
- `backend`: установка/проверка модулей, golangci-lint, gofmt, тест и сборка;
- `commits`: commitlint для истории и заголовка PR, actionlint для новых workflows.

CI использует те же Dockerfile и Make-команды, что локальная разработка.
Workflow Хекслета сохранён отдельно. В branch protection рекомендуется сделать
обязательными jobs `frontend`, `backend`, `commits`; сам YAML не включает
branch protection в настройках GitHub.

## Версия и release-PR

Отдельный `.github/workflows/release-please.yml` запускается после push в `main`
и вручную через Actions → release-please → Run workflow (ветка `main`).
Используется официальный `googleapis/release-please-action`, закреплённый на SHA.
Manifest-конфигурация использует `simple`: одна версия приложения в `version.txt`,
общий `CHANGELOG.md`, тег вида `v0.1.0` без имени компонента.

Начальные `version.txt` и `.release-please-manifest.json` содержат `0.0.0`.
Первый релиз ожидается `0.1.0`. `bootstrap-sha` указывает на последний коммит
исходного проекта **до** коммита каркаса, чтобы `feat: add application scaffold`
попал в первый changelog. `initial-version` задаёт только первую версию,
постоянный `release-as` не используется.

Для стабильных версий `fix` повышает patch, `feat` — minor, несовместимость —
major. До 1.0 включён режим `bump-minor-pre-major`: несовместимость повышает
minor; `feat` также повышает minor, `fix` — patch. `docs`, `chore`, `ci` и другие
обычные служебные изменения сами по себе не требуют нового релиза; `perf`
обрабатывается release-please как patch. Несовместимость учитывается у любого типа.

Версия приватного frontend npm-пакета остаётся технической `0.0.0` и не
синхронизируется с версией приложения: публикации npm-пакета в этом проекте нет.

После изменения main release-please читает историю, создаёт или обновляет
release-PR с версией и changelog. После **отдельно одобренного** merge этого
release-PR следующий запуск создаст тег и GitHub Release. Создание release-PR
не публикует релиз. Автоматического merge, публикации пакетов и деплоя нет.

## Настройка GitHub

Чтобы CI запускался автоматически на созданном ботом release-PR, нужен
отдельный PAT: события от обычного `GITHUB_TOKEN` не запускают последующие
workflows. Токен для MCP с Actions: read для этого не подходит.

1. В GitHub Settings → Developer settings → Personal access tokens →
   Fine-grained tokens создайте токен только для этого репозитория с ограниченным
   сроком действия. Repository permissions: Contents, Pull requests и Issues —
   Read and write. Issues нужен для меток release-please.
2. В репозитории Settings → Secrets and variables → Actions → New repository
   secret сохраните токен под именем `RELEASE_PLEASE_TOKEN`.
3. Проверьте, что GitHub Actions разрешён. Если используется политика разрешённых
   Actions, разрешите `actions/checkout`, `googleapis/release-please-action`
   и существующий action Хекслета. При ограничениях организации администратор
   должен разрешить создание PR автоматизацией.
4. Проведите PR с каркасом через CI и squash merge с заголовком
   `feat: add application scaffold` либо другим подходящим `feat:`.
5. Откройте Actions → release-please: ожидается успешный запуск и открытый
   release-PR с `version.txt`, manifest и changelog. На release-PR должны
   автоматически пройти три задания CI. Если токен добавлен после неудачного
   запуска, повторите запуск workflow на `main`.

Workflow явно завершится ошибкой с инструкцией, если secret отсутствует.
Он не подменяет PAT встроенным токеном, чтобы не создавать PR без ожидаемого CI.
Не помещайте токены в репозиторий, документацию или чат.

Основание: [release-please-action](https://github.com/googleapis/release-please-action),
[manifest-конфигурация](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md),
[commitlint в CI](https://commitlint.js.org/guides/ci-setup.html).
