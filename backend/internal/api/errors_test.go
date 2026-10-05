package api

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestErrorResponses(t *testing.T) {
	for _, tt := range []struct {
		name   string
		err    error
		status int
		code   string
		fields bool
	}{
		{"validation", &HTTPError{Status: 422, Code: "VALIDATION_ERROR", Message: "Некорректные данные", FieldErrors: map[string][]string{"name": {"Укажите название"}}}, 422, "VALIDATION_ERROR", true},
		{"domain", &HTTPError{Status: 400, Code: "SLOT_UNAVAILABLE", Message: "Это время уже занято", FieldErrors: map[string][]string{"name": {"must not leak"}}}, 400, "SLOT_UNAVAILABLE", false},
		{"missing", &HTTPError{Status: 404, Code: "NOT_FOUND", Message: "Объект не найден"}, 404, "NOT_FOUND", false},
		{"unexpected", errors.New("postgres password=secret connection failed"), 500, "INTERNAL_ERROR", false},
		{"unsafe server message", &HTTPError{Status: 500, Code: "DB_ERROR", Message: "password=secret"}, 500, "INTERNAL_ERROR", false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(rec)
			writeError(ctx, tt.err)
			if rec.Code != tt.status {
				t.Fatalf("status=%d want=%d", rec.Code, tt.status)
			}
			var body map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body["code"] != tt.code {
				t.Errorf("code=%v", body["code"])
			}
			_, fields := body["fieldErrors"]
			if fields != tt.fields {
				t.Errorf("fieldErrors present=%v", fields)
			}
			if tt.status == 500 && body["message"] != "Внутренняя ошибка сервера" {
				t.Errorf("internal error leaked: %v", body)
			}
		})
	}
}
