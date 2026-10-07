# Домен

Независимые сущности, типы и чистые доменные правила. Нет зависимостей от API,
usecase, services, repo, config, HTTP, Gin или ORM. EventType и Owner — обычные
типы; ValidateEvent удаляет крайние пробелы и проверяет название, описание
и длительность. ErrNotFound и ValidationError не зависят от HTTP-статусов.
