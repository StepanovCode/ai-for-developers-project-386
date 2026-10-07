# Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Реализовать утверждённый путь владельца и гостя по тикетам 16–20.

**Architecture:** Generated HTTP boundary остаётся в api; usecase координирует repo через интерфейсы потребителя, domain содержит временные правила. PostgreSQL обеспечивает сохранность и запрет пересечений. React использует generated SDK; страницы разделены по сценариям.

**Tech Stack:** Go/Gin, PostgreSQL/pgx, React/TypeScript/Vite, Docker Compose, Vitest/RTL, Go testing/httptest.

**Spec:** ../specs/2026-10-07-booking-approved.md (утверждённая GitHub issue 14). Полные критерии отдельных тикетов сохранены контроллером в task briefs.

## Global Constraints

- Все инструменты, зависимости, тесты и сборки запускаются в Docker.
- PostgreSQL доступен только через repo. Gin и generated HTTP-типы остаются в api; usecase/services не импортируют конкретный repo.
- Все вызовы frontend API проходят через generated SDK; generated-файлы вручную не редактируются.
- Один владелец default, имя Дмитрий Степанов конфигурируется; без регистрации/авторизации.
- Europe/Moscow; даты ДД-ММ-ГГГГ; UTC RFC3339 в ответах.
- Окно: сегодня и следующие 13 московских дат; сетка 15 минут; минимум 30 минут включительно; пересечения всех типов запрещены, стыки допустимы.
- Не менять workflow Хекслета, version.txt и changelog; не push, не merge, не закрывать Issues.
- Отдельный Conventional Commit после каждого тикета, make commitlint и make commits-check обязательны.
- Автоматические тесты входят в CI; без генерации/diff и браузерного E2E в CI. Ручная браузерная приёмка обязательна и записывается честно.

## Review Focus

- Прямая ссылка и reload каждого шага: тип/дата восстанавливаются без контактов в URL (#17–19).
- Ошибка БД не становится пустым каталогом или ложным 201 (#16,18,20).
- Два разных типа с пересечением и два конкурентных запроса сохраняют только одну запись (#18).
- Граница московской полуночи и минимального срока проверяется с управляемым временем (#17–18).
- Потеря ответа не вызывает автоматический повтор POST и не теряет введённые контакты (#19).

### Task 1: Ticket 16 — Создание типа события и публичный каталог

**Requirements:** GitHub issue #16 плюс Spec и Global Constraints.
**Files:** domain/event.go; usecase/events.go; repo/postgres.go и migrations/001; api/events.go; config и cmd/api; compose.yaml, Makefile, CI; frontend pages каталога, типа, admin/form, общие routing/API утилиты и UI стили; README.
**Interfaces:** repo удовлетворяет EventRepository из usecase; api.NewRouterWithApplication внедряет usecase, NewRouter сохраняется для boundary-тестов; frontend API использует поля generated models без дублирования контракта. Интерфейсы реально созданные в этом тикете фиксируются в отчёте для следующего.
- [ ] Написать и запустить падающие HTTP/БД и UI тесты для create/list/get, trim, 422/404, пустого списка и сохранности.
- [ ] Реализовать PostgreSQL, последовательный migration runner, отдельную тестовую БД и Docker-команды; pgx закрепить совместимой версией.
- [ ] Реализовать типы, SDK каталог, форму и прямые маршруты; обновить главную текстами спецификации.
- [ ] Проверить make check, DB integration и ручную доступность/сохранность; обновить журнал project-plan.
- [ ] Провести self-review, make commitlint, создать feat(events): add event types and public catalog, make commits-check.

### Task 2: Ticket 17 — Календарь и выбор доступного слота

**Requirements:** GitHub issue #17 плюс Spec и Global Constraints.
**Files:** domain/schedule.go; config/schedule.go; usecase/slots.go; repo booking read и migration; api/slots.go; frontend calendar/date/slot pages; тесты и документация.
**Interfaces:** Использует EventRepository предыдущего тикета; Clock func() time.Time передаётся usecase для детерминированных проверок. Repository читает интервалы всех типов владельца. Slots возвращает generated SlotWindow только через api mapping.
- [ ] Написать падающие тесты 14 дат, полуночи, 30 минут, сетки, длительности, рабочих интервалов, занятости разных типов и стыков; UI выбор/прямые ссылки/состояния.
- [ ] Реализовать конфигурируемое расписание, вычисление и API слотов без гостевых контактов.
- [ ] Реализовать календарь, выбор даты и явный выбор слота, клавиатуру и мобильную компоновку.
- [ ] Проверить make check, DB integration, ручную доступность; обновить project-plan.
- [ ] Провести self-review, commitlint, создать feat(slots): add calendar and slot availability, commits-check.

### Task 3: Ticket 18 — Бронирование и подтверждение

**Requirements:** GitHub issue #18 плюс Spec и Global Constraints.
**Files:** domain/booking.go; usecase/bookings.go; repo booking insert/read и migration ограничения; api/bookings.go; frontend booking form/confirmation; интеграционные HTTP/БД и UI тесты.
**Interfaces:** Использует Clock/расписание и правила слотов Task 2. Репозиторий транзакционно сохраняет снимок типа и интервалы; exclusion constraint для owner + tstzrange '[)' превращается в domain конфликт. Подтверждение не содержит контактов.
- [ ] Написать падающие тесты полного create→slots→book→confirmation, пересечений разных типов/стыков/двух конкурентных HTTP запросов/повторной проверки времени и UI успеха.
- [ ] Реализовать серверную проверку всех правил, сохранение и 201, подтверждение и 404, безопасную 500 при недоступной БД.
- [ ] Реализовать отдельную форму с повторной проверкой перед переходом, подтверждение по прямой ссылке/reload.
- [ ] Проверить make check, DB integration и ручную сохранность/reload/доступность; обновить project-plan.
- [ ] Провести self-review, commitlint, создать feat(bookings): add booking and confirmation with conflict protection, commits-check.

### Task 4: Ticket 19 — Обработка устаревшего слота и сетевых ошибок

**Requirements:** GitHub issue #19 плюс Spec и Global Constraints.
**Files:** frontend booking flow/form/API error helpers и UI тесты.
**Interfaces:** Использует API/страницы Task 3; 400 SLOT_UNAVAILABLE сбрасывает слот, сохраняет контактный draft только в памяти, обновляет slots. Сетевой POST не повторяется автоматически.
- [ ] Написать падающие UI тесты сохранения контактов, сброса слота, обновления вариантов, возврата, неизвестного результата и ручного повтора.
- [ ] Реализовать требуемые сообщения, сохранение ввода при back/переходах, фокус и различимые loading/error/empty.
- [ ] Проверить make check и ручной сценарий/прямые ссылки/доступность; обновить project-plan.
- [ ] Провести self-review, commitlint, создать feat(bookings): recover selection after slot and network errors, commits-check.

### Task 5: Ticket 20 — Предстоящие встречи владельца

**Requirements:** GitHub issue #20 плюс Spec и Global Constraints.
**Files:** usecase/meetings.go; repo meetings read; api/meetings.go; frontend admin meetings page и тесты.
**Interfaces:** Использует общий booking repo, Clock и owner; GET /api/meetings возвращает все типы startsAt > now, сортировка ближайшие сверху, без 14-дневного ограничения.
- [x] Написать Go/UI RED и БД characterization-тесты времени, сортировки, разных типов, встреч вне 14 дней, обновления и исчезновения при начале.
- [x] Реализовать API/экран, обновление при открытии/возврате во вкладку/по кнопке; таймер убирает начавшееся, не удаляя запись.
- [x] Проверить make check, DB integration, полный HTTP путь владельца/гостя; обновить project-plan.
- [ ] Завершить ручную приёмку контроллером; native browser zoom 200% и GitHub CI остаются непроверенными.
- [x] Провести self-review и commitlint; подготовить feat(meetings): list upcoming meetings for owner.
- [x] Проверить commits-check после коммита: 0 problems/warnings; результат в task-5-report.
- [x] Исправить Important review20: server-time snapshot + monotonic expiry, skew/precision/missing-header tests.
- [ ] Scoped независимое re-review исправления server clock (контроллер).

После каждой задачи контроллер делает независимое ревью спецификации и качества; замечания исправляются до перехода к следующей. В конце — общее ревью ветки и итоговый make check. GitHub CI нового кода без push непроверен.
