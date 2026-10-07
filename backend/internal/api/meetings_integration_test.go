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
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"
)

func TestMeetingsStrictBoundaryAllTypesAndDistantDates(t *testing.T) {
	ctx := context.Background()
	raw := os.Getenv("TEST_DATABASE_URL")
	u, err := url.Parse(raw)
	if err != nil || u.Hostname() != "postgres-test" || u.Path != "/booking_test" {
		t.Fatal("isolated database required")
	}
	db, err := repo.Open(ctx, raw)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = db.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	conn, err := pgx.Connect(ctx, raw)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close(ctx) }()
	clean := func() {
		t.Helper()
		if _, err := conn.Exec(ctx, `TRUNCATE bookings,event_types RESTART IDENTITY`); err != nil {
			t.Fatal(err)
		}
	}
	clean()
	defer clean()
	now := time.Date(2026, 10, 7, 6, 0, 0, 0, time.UTC)
	events := usecase.NewEvents(db, "Owner")
	a, err := events.Create(ctx, "First", "Description", 30)
	if err != nil {
		t.Fatal(err)
	}
	b, err := events.Create(ctx, "Second", "Description", 30)
	if err != nil {
		t.Fatal(err)
	}
	starts := []time.Time{now.AddDate(0, 0, 30), now.Add(-time.Hour), now, now.Add(2 * time.Hour), now.Add(time.Hour)}
	ids := make([]string, len(starts))
	for i, start := range starts {
		event := a
		if i%2 == 0 {
			event = b
		}
		ids[i] = uuid.NewString()
		err = db.CreateBooking(ctx, domain.Booking{ID: ids[i], EventTypeID: event.ID, OwnerID: "default", GuestName: "Guest", GuestEmail: "guest@example.com", EventName: event.Name, DurationMinutes: 30, StartsAt: start, EndsAt: start.Add(30 * time.Minute), CreatedAt: now})
		if err != nil {
			t.Fatal(err)
		}
	}
	router := api.NewRouterWithMeetings(events, nil, nil, usecase.NewMeetings(db, func() time.Time { return now }))
	list := func() generated.MeetingList {
		t.Helper()
		r := httptest.NewRecorder()
		router.ServeHTTP(r, httptest.NewRequest("GET", "/api/meetings", nil))
		if r.Code != 200 {
			t.Fatalf("%d %s", r.Code, r.Body.String())
		}
		var result generated.MeetingList
		if err = json.Unmarshal(r.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	result := list()
	if len(result.Items) != 3 {
		t.Fatalf("items%v", result.Items)
	}
	for i, index := range []int{4, 3, 0} {
		m := result.Items[i]
		if m.Id.String() != ids[index] || m.GuestName != "Guest" || string(m.GuestEmail) != "guest@example.com" || m.DurationMinutes != 30 || m.TimeZone != "Europe/Moscow" || m.Owner.Name != "Owner" {
			t.Fatalf("meeting%v", m)
		}
	}
	if result.Items[0].EventTypeId == result.Items[1].EventTypeId {
		t.Fatal("different types missing")
	}
	now = starts[0]
	result = list()
	if result.Items == nil || len(result.Items) != 0 {
		t.Fatalf("empty%v", result)
	}
	var count int
	if err = conn.QueryRow(ctx, `SELECT count(*) FROM bookings`).Scan(&count); err != nil || count != 5 {
		t.Fatalf("rows%d %v", count, err)
	}
}
