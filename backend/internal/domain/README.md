# Домен

Независимые сущности, типы и чистые доменные правила. Нет зависимостей от API,
usecase, services, repo, config, HTTP, Gin или ORM. EventType и Owner — обычные
типы; ValidateEvent удаляет крайние пробелы и проверяет название, описание
и длительность. ErrNotFound и ValidationError не зависят от HTTP-статусов.

Schedule/WorkingInterval задают внутри дня интервалы в московских минутах.
WindowBounds и BuildSlotWindow вычисляют 14 календарных дат от явно заданного
времени, сетку 15 минут, порог 30 минут и занятость. TimeRange и Overlaps
используют полуоткрытые интервалы, SlotWindow не содержит HTTP DTO или контактов.
