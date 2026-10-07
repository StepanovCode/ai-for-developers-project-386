//go:build integration

package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/repo"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
	"github.com/jackc/pgx/v5"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestPostgresBookingLifecycleAndConflicts(t *testing.T) {
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
	now := time.Date(2026, 10, 7, 5, 0, 0, 0, time.UTC)
	clock := func() time.Time { return now }
	makeRouter := func(database *repo.Postgres) http.Handler {
		return api.NewRouterWithMeetings(usecase.NewEvents(database, "Owner"), usecase.NewSlots(database, domain.DefaultSchedule(), clock), usecase.NewBookings(database, domain.DefaultSchedule(), clock), usecase.NewMeetings(database, clock))
	}
	router := makeRouter(db)
	request := func(r http.Handler, method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}
	createEvent := func(duration int) string {
		t.Helper()
		r := request(router, "POST", "/api/event-types", fmt.Sprintf(`{"name":"Snapshot","description":"Description","durationMinutes":%d}`, duration))
		if r.Code != 201 {
			t.Fatalf("event%d %s", r.Code, r.Body.String())
		}
		var event generated.EventType
		if err = json.Unmarshal(r.Body.Bytes(), &event); err != nil {
			t.Fatal(err)
		}
		return event.Id.String()
	}
	id := createEvent(60)
	other := createEvent(30)
	body := func(event, start string) string {
		return fmt.Sprintf(`{"eventTypeId":%q,"startsAt":%q,"guestName":" PRIVATE GUEST ","guestEmail":"private@example.com"}`, event, start)
	}
	r := request(router, "GET", "/api/event-types/"+id+"/slots", "")
	if r.Code != 200 {
		t.Fatalf("slots%d", r.Code)
	}
	r = request(router, "POST", "/api/bookings", body(id, "2026-10-07T07:00:00Z"))
	if r.Code != 201 {
		t.Fatalf("book%d %s", r.Code, r.Body.String())
	}
	var confirmation generated.BookingConfirmation
	if err = json.Unmarshal(r.Body.Bytes(), &confirmation); err != nil {
		t.Fatal(err)
	}
	meetings := request(router, "GET", "/api/meetings", "")
	var listed generated.MeetingList
	if meetings.Code != 200 {
		t.Fatalf("meetings %d %s", meetings.Code, meetings.Body.String())
	}
	if err = json.Unmarshal(meetings.Body.Bytes(), &listed); err != nil || len(listed.Items) != 1 || listed.Items[0].Id != confirmation.Id || listed.Items[0].GuestName != "PRIVATE GUEST" || string(listed.Items[0].GuestEmail) != "private@example.com" {
		t.Fatalf("owner lifecycle %v %v", listed, err)
	}
	post := r.Body.String()
	if strings.Contains(post, "PRIVATE") || strings.Contains(post, "private@example.com") {
		t.Fatal("privacy")
	}
	reopened, err := repo.Open(ctx, raw)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	r = request(makeRouter(reopened), "GET", "/api/bookings/"+confirmation.Id.String(), "")
	if r.Code != 200 || r.Body.String() != post {
		t.Fatalf("persisted confirmation%d %s", r.Code, r.Body.String())
	}
	var guest string
	var count int
	if err = conn.QueryRow(ctx, `SELECT guest_name FROM bookings WHERE id=$1`, confirmation.Id.String()).Scan(&guest); err != nil || guest != "PRIVATE GUEST" {
		t.Fatalf("guest%s err%v", guest, err)
	}
	for _, v := range []struct{ event, start string }{{other, "2026-10-07T07:15:00Z"}, {other, "2026-10-07T06:45:00Z"}, {other, "2026-10-07T07:45:00Z"}, {id, "2026-10-07T07:00:00Z"}} {
		r = request(router, "POST", "/api/bookings", body(v.event, v.start))
		if r.Code != 400 || !strings.Contains(r.Body.String(), "SLOT_UNAVAILABLE") {
			t.Fatalf("overlap%d %s", r.Code, r.Body.String())
		}
	}
	enclosing := createEvent(120)
	r = request(router, "POST", "/api/bookings", body(enclosing, "2026-10-07T06:30:00Z"))
	if r.Code != 400 {
		t.Fatalf("enclosing%d", r.Code)
	}
	for _, start := range []string{"2026-10-07T06:30:00Z", "2026-10-07T08:00:00Z"} {
		r = request(router, "POST", "/api/bookings", body(other, start))
		if r.Code != 201 {
			t.Fatalf("abutting%d %s", r.Code, r.Body.String())
		}
	}
	for _, start := range []string{"2026-10-07T08:01:00Z", "2026-10-07T08:15:00.000000001Z", "2026-10-07T04:30:00Z", "2026-10-21T06:00:00Z", "2026-10-10T06:00:00Z", "2026-10-07T14:45:00Z"} {
		r = request(router, "POST", "/api/bookings", body(id, start))
		if r.Code != 400 {
			t.Fatalf("invalid%s code%d", start, r.Code)
		}
	}
	// Independent applications/pools share only PostgreSQL, which arbitrates writes.
	var wg sync.WaitGroup
	results := make(chan *httptest.ResponseRecorder, 2)
	for _, handler := range []http.Handler{router, makeRouter(reopened)} {
		wg.Add(1)
		go func(h http.Handler) {
			defer wg.Done()
			results <- request(h, "POST", "/api/bookings", body(other, "2026-10-08T06:00:00Z"))
		}(handler)
	}
	wg.Wait()
	close(results)
	codes := map[int]int{}
	for result := range results {
		if result.Code == 400 && !strings.Contains(result.Body.String(), "SLOT_UNAVAILABLE") {
			t.Fatalf("loser response%s", result.Body.String())
		}
		codes[result.Code]++
	}
	if codes[201] != 1 || codes[400] != 1 {
		t.Fatalf("concurrent%v", codes)
	}
	if err = conn.QueryRow(ctx, `SELECT count(*) FROM bookings WHERE starts_at='2026-10-08T06:00:00Z'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("rows%d err%v", count, err)
	}
	now = time.Date(2026, 10, 8, 6, 0, 0, 0, time.UTC)
	r = request(router, "POST", "/api/bookings", body(other, "2026-10-08T06:15:00Z"))
	if r.Code != 400 {
		t.Fatalf("overlap%d", r.Code)
	}
	r = request(router, "POST", "/api/bookings", body(other, "2026-10-08T06:30:00Z"))
	if r.Code != 201 {
		t.Fatalf("notice equality%d", r.Code)
	}
	now = time.Date(2026, 10, 8, 6, 45, 0, 1, time.UTC)
	r = request(router, "POST", "/api/bookings", body(other, "2026-10-08T07:15:00Z"))
	if r.Code != 400 {
		t.Fatalf("notice recheck%d", r.Code)
	}
	for _, v := range []struct {
		method, path, body string
		status             int
	}{{"GET", "/api/bookings/00000000-0000-4000-8000-000000000000", "", 404}, {"POST", "/api/bookings", body("00000000-0000-4000-8000-000000000000", "2026-10-08T07:00:00Z"), 404}, {"POST", "/api/bookings", "{", 422}, {"POST", "/api/bookings", strings.Replace(body(other, "2026-10-08T07:00:00Z"), "private@example.com", "invalid", 1), 422}} {
		r = request(router, v.method, v.path, v.body)
		if r.Code != v.status {
			t.Fatalf("boundary%d %s", r.Code, r.Body.String())
		}
	}
	reopened.Close()
	r = request(makeRouter(reopened), "POST", "/api/bookings", body(other, "2026-10-08T07:00:00Z"))
	if r.Code != 500 || strings.Contains(r.Body.String(), "pool") {
		t.Fatalf("db outage%d %s", r.Code, r.Body.String())
	}
}
