package api_test

import (
	"encoding/json"
	"mime"
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
	if got, _, _ := mime.ParseMediaType(response.Header().Get("Content-Type")); got != "application/json" {
		t.Errorf("Content-Type = %q, want JSON", got)
	}
	var body map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body) != 1 || body["status"] != "ok" {
		t.Errorf("body = %v, want status=ok", body)
	}
}
