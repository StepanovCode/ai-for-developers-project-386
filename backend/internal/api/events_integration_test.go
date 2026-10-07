//go:build integration

package api_test

import (
	"context"
	"encoding/json"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/repo"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
	"github.com/jackc/pgx/v5"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
)

func TestPostgresEventLifecycle(t *testing.T) {
	ctx := context.Background()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	parsed, err := url.Parse(databaseURL)
	if err != nil || parsed.Hostname() != "postgres-test" || parsed.Path != "/booking_test" {
		t.Fatal("integration tests require isolated postgres-test/booking_test database")
	}
	connection, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = connection.Close(ctx) }()
	if _, err = connection.Exec(ctx, `TRUNCATE event_types RESTART IDENTITY`); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := connection.Exec(ctx, `TRUNCATE event_types RESTART IDENTITY`); err != nil {
			t.Error(err)
		}
	}()
	database, err := repo.Open(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if err = database.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	router := api.NewRouterWithApplication(usecase.NewEvents(database, "Дмитрий Степанов"))
	request := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	rec := request("GET", "/api/event-types", "")
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"items":[]`) {
		t.Fatalf("empty catalog: %d %s", rec.Code, rec.Body.String())
	}
	body := `{"name":"  Разговор  ","description":"  Первая\nВторая  ","durationMinutes":45}`
	rec = request("POST", "/api/event-types", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Duration    int    `json:"durationMinutes"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Name != "Разговор" || created.Description != "Первая\nВторая" || created.Duration != 45 || len(created.ID) != 36 || created.ID[14] != '4' {
		t.Fatalf("created=%+v", created)
	}
	rec = request("POST", "/api/event-types", body)
	if rec.Code != 201 {
		t.Fatalf("duplicates: %d", rec.Code)
	}
	// A new pool and application observe the committed data, with no migration on startup.
	reopened, err := repo.Open(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	router = api.NewRouterWithApplication(usecase.NewEvents(reopened, "Дмитрий Степанов"))
	rec = request("GET", "/api/event-types/"+created.ID, "")
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"name":"Разговор"`) {
		t.Fatalf("get: %d %s", rec.Code, rec.Body.String())
	}
	rec = request("GET", "/api/event-types/00000000-0000-4000-8000-000000000000", "")
	if rec.Code != 404 {
		t.Fatalf("missing: %d", rec.Code)
	}
	rec = request("GET", "/api/event-types", "")
	var catalog struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &catalog); err != nil {
		t.Fatal(err)
	}
	if len(catalog.Items) != 2 || catalog.Items[0].ID != created.ID {
		t.Fatalf("order: %s", rec.Body.String())
	}
}
