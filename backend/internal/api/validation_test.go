package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
)

func TestRequestValidation(t *testing.T) {
	tests := []struct{ name, method, path, body, contentType string }{
		{"broken JSON", "POST", "/api/event-types", `{`, "application/json"},
		{"empty body", "POST", "/api/event-types", ``, "application/json"},
		{"missing fields", "POST", "/api/event-types", `{}`, "application/json"},
		{"fractional duration", "POST", "/api/event-types", `{"name":"Call","description":"Text","durationMinutes":1.5}`, "application/json"},
		{"duration too long", "POST", "/api/event-types", `{"name":"Call","description":"Text","durationMinutes":481}`, "application/json"},
		{"blank name", "POST", "/api/event-types", `{"name":"  ","description":"Text","durationMinutes":30}`, "application/json"},
		{"multiline name", "POST", "/api/event-types", `{"name":"One\nTwo","description":"Text","durationMinutes":30}`, "application/json"},
		{"unknown field", "POST", "/api/event-types", `{"name":"Call","description":"Text","durationMinutes":30,"extra":true}`, "application/json"},
		{"wrong content type", "POST", "/api/event-types", `{}`, "text/plain"},
		{"invalid UUID", "GET", "/api/event-types/not-a-uuid", ``, ""},
		{"invalid email", "POST", "/api/bookings", `{"eventTypeId":"b89ff958-472f-4cb3-af6b-5bc9a5277b88","startsAt":"2026-10-06T10:00:00+03:00","guestName":"Гость","guestEmail":"wrong"}`, "application/json"},
		{"time without offset", "POST", "/api/bookings", `{"eventTypeId":"b89ff958-472f-4cb3-af6b-5bc9a5277b88","startsAt":"2026-10-06T10:00:00","guestName":"Гость","guestEmail":"guest@example.com"}`, "application/json"},
	}
	router := api.NewRouter()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
			if tt.contentType != "" {
				req.Header.Set("Content-Type", tt.contentType)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status = %d, want 422; body=%s", rec.Code, rec.Body.String())
			}
			var body map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body["code"] != "VALIDATION_ERROR" || body["message"] == "" {
				t.Fatalf("unexpected error: %v", body)
			}
		})
	}
}
