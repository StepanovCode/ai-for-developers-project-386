# Frontend

Техническая стартовая страница Vite + React + TypeScript с Tailwind CSS 4 и
компонентом Card из shadcn/ui. Бизнес-логики и запросов к backend пока нет.

## Запуск

Все команды выполнять из корня репозитория. Node.js/npm работают в Docker:

```sh
make build
make frontend-install
make frontend-dev
```

Dev-сервер: [localhost:5173](http://localhost:5173). Исходники доступны через
bind mount, изменения подхватываются Vite. После обновления lockfile повторите
`make frontend-install`; если dev-сервер уже запущен, перезапустите его через
`docker compose restart frontend`.

```sh
make frontend-build
make frontend-preview
```

Сборка с проверкой типов создаёт `frontend/dist/`. Preview доступен на
[localhost:4173](http://localhost:4173) до Ctrl+C; требует запущенного frontend
и уже собранного `dist/`. Это локальный просмотр сборки, не production-сервер.
Остановка сервисов — `make down`.

## Структура и настройки

- `src/App.tsx` — минимальная техническая страница.
- `src/components/ui/card.tsx` — исходный компонент shadcn/ui.
- `src/lib/utils.ts` — утилита классов, созданная shadcn CLI.
- `src/index.css` — Tailwind CSS и тема shadcn; шрифт поставляется локальным npm-пакетом.
- `components.json` — конфигурация shadcn: Radix, стиль nova, neutral, CSS variables.
- Alias `@/` указывает на `src/`, настроен в Vite и TypeScript.
- Dev/preview слушают `0.0.0.0`, порты 5173/4173 с `strictPort`.
- Proxy `/api` сохраняет путь и направляет запросы на `http://backend:8080`
  в сети Compose. При запущенном backend `/api/health` возвращает `{"status":"ok"}`.
- `.npmrc` включает точные версии, lockfile и строгую проверку engines.

## Проверки

```sh
make frontend-check
make frontend-test
make frontend-lint
make frontend-typecheck
make frontend-format-check
```

Vitest использует jsdom, React Testing Library и jest-dom. Тест `src/App.test.tsx`
проверяет видимый заголовок страницы; `npm test` выполняет `vitest run` без watch.
Для разработки: `make frontend-run CMD="npm run test:watch"`.
ESLint проверяет TypeScript, правила React Hooks и Fast Refresh;
`tsc -b` отдельно проверяет типы. Prettier проверяет файлы frontend, исключая
зависимости, сборку, покрытие и автоматически созданный lockfile.
Явные исправления: `make frontend-format` и `make frontend-lint-fix`.

## Генераторы

Исходный шаблон `react-ts` создан через `npm create vite@9.2.1` во временном
каталоге контейнера, затем перенесён с сохранением `.npmrc`. Демонстрационные
ассеты и счётчик удалены. Линтер шаблона заменён на ESLint на этапе 6.

После установки Tailwind и настройки alias использованы команды в контейнере:

```sh
make frontend-run CMD="npx --yes shadcn@4.21.0 init --preset nova --base radix --no-monorepo --no-rtl --no-reinstall --yes"
make frontend-run CMD="npx --yes shadcn@4.21.0 add card --yes"
```

Повторный `init` для обычного запуска не нужен. Дополнительные компоненты
добавлять через закреплённый CLI по мере необходимости. MCP настраивается
отдельно на этапе 7.

[Официальная инструкция Vite](https://vite.dev/guide/) ·
[shadcn/ui для Vite](https://ui.shadcn.com/docs/installation/vite) ·
[Архитектура](../docs/architecture.md) · [Версии](../docs/toolchain.md)
