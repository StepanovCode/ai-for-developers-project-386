# HTTP API

Gin и HTTP DTO, маршруты в `router.go`, проверка формата входных
данных и преобразование ошибок в HTTP-статусы. Обработчики — в `handlers/`,
HTTP middleware — в `middleware/`.

API вызывает usecase. За границу API передаются `context.Context` и обычные
типизированные данные; `gin.Context` остаётся здесь. Технический
`GET /api/health` реализован непосредственно в API; `NewRouter` возвращает
`http.Handler`, поэтому Gin не импортируется точкой входа и другими слоями.
