# Meetly

[![hexlet-check](https://github.com/StepanovCode/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/StepanovCode/ai-for-developers-project-386/actions/workflows/hexlet-check.yml)

Сервис записи на звонки: выбор свободного времени, бронирование и управление
встречами. Учебный проект Хекслета на React, TypeScript, Go и PostgreSQL.

**[Открыть сайт →](https://ai-for-developers-project-386-al08.onrender.com/)**

## Локальный запуск

Нужны Git, Make и запущенный Docker с Compose v2. Все зависимости работают
в контейнерах.

```bash
git clone https://github.com/StepanovCode/ai-for-developers-project-386.git
cd ai-for-developers-project-386
make start
```

Откройте [localhost:5173](http://localhost:5173). Команда установит зависимости,
применит миграции и запустит приложение; `.env` создавать необязательно.

- `make down` — остановить приложение, сохранив данные.
- `make check` — запустить линтеры, тесты и сборку.

Подробнее: [Frontend](frontend/README.md) · [Backend](backend/README.md) · [API](api/README.md).
