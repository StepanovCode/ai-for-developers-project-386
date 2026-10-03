package api_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
)

func TestHealth(t *testing.T) {
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	api.NewRouter().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if got := response.Header().Get("Content-Type"); got != "application/json; charset=utf-8" {
		t.Errorf("Content-Type = %q, want JSON", got)
	}
	if got := response.Body.String(); got != `{"status":"ok"}` {
		t.Errorf("body = %q, want {\"status\":\"ok\"}", got)
	}
}
