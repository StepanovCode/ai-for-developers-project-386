//go:build integration

package api_test

import (
	"context"
	"encoding/json"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/repo"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
	"github.com/jackc/pgx/v5"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"
)

func TestPostgresSlotsReadAllTypesAndWindowEdges(t *testing.T) {
	ctx := context.Background()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	parsed, err := url.Parse(databaseURL)
	if err != nil || parsed.Hostname() != "postgres-test" || parsed.Path != "/booking_test" {
		t.Fatal("isolated postgres-test/booking_test required")
	}
	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close(ctx) }()
	if _, err = conn.Exec(ctx, `TRUNCATE bookings,event_types RESTART IDENTITY`); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := conn.Exec(ctx, `TRUNCATE bookings,event_types RESTART IDENTITY`); err != nil {
			t.Error(err)
		}
	}()
	_, err = conn.Exec(ctx, `INSERT INTO event_types(id,name,description,duration_minutes) VALUES ('00000000-0000-4000-8000-000000000001','Selected','Description',30),('00000000-0000-4000-8000-000000000002','Other','Description',60)`)
	if err != nil {
		t.Fatal(err)
	}
	// All fixtures are inserted only after the explicit isolated-host/database guard.
	for _, fixture := range []struct{ id, start string }{{"00000000-0000-4000-8000-000000000003", "2026-10-07T10:00:00+03:00"}, {"00000000-0000-4000-8000-000000000004", "2026-10-06T23:30:00+03:00"}, {"00000000-0000-4000-8000-000000000005", "2026-10-06T22:00:00+03:00"}, {"00000000-0000-4000-8000-000000000006", "2026-10-21T00:00:00+03:00"}} {
		start, parseErr := time.Parse(time.RFC3339, fixture.start)
		if parseErr != nil {
			t.Fatal(parseErr)
		}
		_, err = conn.Exec(ctx, `INSERT INTO bookings(id,event_type_id,owner_id,guest_name,guest_email,event_name,duration_minutes,starts_at,ends_at) VALUES ($1,'00000000-0000-4000-8000-000000000002','default','PRIVATE GUEST','private@example.com','Other',60,$2,$3)`, fixture.id, start, start.Add(time.Hour))
		if err != nil {
			t.Fatal(err)
		}
	}
	database, err := repo.Open(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	now := time.Date(2026, 10, 7, 5, 0, 0, 0, time.UTC)
	start, end := domain.WindowBounds(now)
	intervals, err := database.ReadBusy(ctx, "default", start, end)
	if err != nil || len(intervals) != 2 {
		t.Fatalf("read boundaries len%d err%v", len(intervals), err)
	}
	router := api.NewRouterWithApplication(usecase.NewEvents(database, "Owner"), usecase.NewSlots(database, domain.DefaultSchedule(), func() time.Time { return now }))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest("GET", "/api/event-types/00000000-0000-4000-8000-000000000001/slots", nil))
	if recorder.Code != 200 {
		t.Fatalf("slots %d %s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "PRIVATE") || strings.Contains(recorder.Body.String(), "private@example.com") {
		t.Fatal("guest contacts leaked")
	}
	var window generated.SlotWindow
	if err = json.Unmarshal(recorder.Body.Bytes(), &window); err != nil {
		t.Fatal(err)
	}
	if len(window.Days) != 14 || window.WindowStart.Format("2006-01-02") != "2026-10-07" || window.WindowEnd.Format("2006-01-02") != "2026-10-20" || window.TimeZone != "Europe/Moscow" {
		t.Fatalf("window=%+v", window)
	}
	wants := map[string]generated.SlotStatus{"06:30": generated.Available, "06:45": generated.Busy, "07:00": generated.Busy, "07:45": generated.Busy, "08:00": generated.Available}
	for _, slot := range window.Days[0].Slots {
		if slot.StartsAt.Location() != time.UTC {
			t.Fatal("wire timestamps not UTC")
		}
		if want, ok := wants[slot.StartsAt.Format("15:04")]; ok {
			if slot.Status != want {
				t.Fatalf("slot=%+v want%s", slot, want)
			}
			delete(wants, slot.StartsAt.Format("15:04"))
		}
	}
	if len(wants) != 0 {
		t.Fatalf("missing slots %v", wants)
	}
	if len(window.Days[3].Slots) != 0 || window.Days[3].Slots == nil {
		t.Fatal("weekend must have []")
	}
}
