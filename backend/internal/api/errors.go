package api

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/gin-gonic/gin"
)

// HTTPError is an API-boundary error. Application errors must be mapped to it
// by handlers; application layers must not import this package or HTTP DTOs.
type HTTPError struct {
	Status      int
	Code        string
	Message     string
	FieldErrors map[string][]string
}

func (e *HTTPError) Error() string { return e.Message }

func validationError() *HTTPError {
	return &HTTPError{Status: http.StatusUnprocessableEntity, Code: "VALIDATION_ERROR", Message: "Некорректные данные запроса"}
}

func writeError(c *gin.Context, err error) {
	var public *HTTPError
	if errors.As(err, &public) {
		switch public.Status {
		case http.StatusUnprocessableEntity:
			body := generated.ValidationErrorBody{Code: generated.ValidationErrorBodyCode("VALIDATION_ERROR"), Message: public.Message}
			if len(public.FieldErrors) > 0 {
				body.FieldErrors = &public.FieldErrors
			}
			c.AbortWithStatusJSON(public.Status, body)
			return
		case http.StatusBadRequest, http.StatusNotFound:
			c.AbortWithStatusJSON(public.Status, generated.ErrorBody{Code: public.Code, Message: public.Message})
			return
		}
	}
	slog.Error("API request failed", "error", err)
	c.AbortWithStatusJSON(http.StatusInternalServerError, generated.ErrorBody{Code: "INTERNAL_ERROR", Message: "Внутренняя ошибка сервера"})
}
