package api_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
)

func TestWebServesFrontendAndKeepsAPIBoundary(t *testing.T) {
	dir := t.TempDir()
	for name, contents := range map[string]string{
		"index.html":    "<!doctype html><title>Meetly</title>",
		"assets/app.js": "console.log('Meetly')",
		"favicon.svg":   "<svg></svg>",
		".env":          "SECRET=do-not-serve",
	} {
		path := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(contents), 0600); err != nil {
			t.Fatal(err)
		}
	}
	handler, err := api.NewWebHandler(api.NewRouter(), dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		method, path      string
		status            int
		body, contentType string
	}{
		{"GET", "/", 200, "<title>Meetly</title>", "text/html"},
		{"GET", "/book/123?date=2026-10-11", 200, "<title>Meetly</title>", "text/html"},
		{"GET", "/admin/meetings", 200, "<title>Meetly</title>", "text/html"},
		{"HEAD", "/admin", 200, "", "text/html"},
		{"GET", "/assets/app.js", 200, "console.log('Meetly')", "javascript"},
		{"GET", "/favicon.svg", 200, "<svg>", "image/svg+xml"},
		{"GET", "/api/health", 200, `"status":"ok"`, "application/json"},
		{"GET", "/api/missing", 404, `"code":"NOT_FOUND"`, "application/json"},
		{"GET", "/api", 404, `"code":"NOT_FOUND"`, "application/json"},
		{"GET", "/assets/missing.js", 404, "", ""},
		{"GET", "/assets", 404, "", ""},
		{"GET", "/assets/", 404, "", ""},
		{"GET", "/.env", 404, "", ""},
		{"GET", "/assets/%2e%2e/.env", 404, "", ""},
		{"GET", "/missing.css", 404, "", ""},
		{"GET", "/missing.css/", 404, "", ""},
		{"GET", "/missing.js/child", 404, "", ""},
		{"POST", "/admin", 405, "", ""},
	} {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(tt.method, tt.path, nil))
			if response.Code != tt.status {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			if tt.method == "HEAD" && response.Body.Len() != 0 {
				t.Fatal("HEAD returned a body")
			}
			if !strings.Contains(response.Body.String(), tt.body) {
				t.Fatalf("body=%s, want %q", response.Body.String(), tt.body)
			}
			if !strings.Contains(response.Header().Get("Content-Type"), tt.contentType) {
				t.Fatalf("content type=%s", response.Header().Get("Content-Type"))
			}
			if tt.status >= 400 && strings.Contains(response.Body.String(), "<title>Meetly</title>") {
				t.Fatal("error returned SPA HTML")
			}
		})
	}
}

func TestWebRequiresBuiltIndex(t *testing.T) {
	if _, err := api.NewWebHandler(api.NewRouter(), t.TempDir()); err == nil {
		t.Fatal("missing index accepted")
	}
}

func TestWebWithoutStaticDirectoryKeepsAPIOnly(t *testing.T) {
	handler, err := api.NewWebHandler(api.NewRouter(), "")
	if err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest("GET", "/", nil))
	if response.Code != http.StatusNotFound {
		t.Fatalf("status=%d", response.Code)
	}
}

func TestRouterWithoutDatabaseKeepsHealthAndRejectsDataOperations(t *testing.T) {
	handler := api.NewRouterWithoutDatabase()
	for _, tt := range []struct {
		path   string
		status int
		code   string
	}{
		{"/api/health", 200, `"status":"ok"`},
		{"/api/event-types", 503, `"code":"SERVICE_UNAVAILABLE"`},
		{"/api/meetings", 503, `"code":"SERVICE_UNAVAILABLE"`},
		{"/api/missing", 404, `"code":"NOT_FOUND"`},
	} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", tt.path, nil))
		if response.Code != tt.status || !strings.Contains(response.Body.String(), tt.code) {
			t.Fatalf("%s: status=%d body=%s", tt.path, response.Code, response.Body.String())
		}
	}
}
