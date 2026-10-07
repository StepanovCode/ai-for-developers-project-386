package api_test

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
)

func TestEventValidationHasFieldErrors(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/event-types", strings.NewReader(`{"name":" ","description":" ","durationMinutes":0}`))
	req.Header.Set("Content-Type", "application/json")
	api.NewRouter().ServeHTTP(rec, req)
	var body struct {
		FieldErrors map[string][]string `json:"fieldErrors"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if rec.Code != 422 || len(body.FieldErrors) != 3 {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}
