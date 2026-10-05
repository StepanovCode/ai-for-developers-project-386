package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
)

type boundaryServer struct {
	server
	eventType func(generated.CreateEventTypeRequestObject) (generated.CreateEventTypeResponseObject, error)
	booking   func(generated.CreateBookingRequestObject) (generated.CreateBookingResponseObject, error)
	health    func() (generated.GetHealthResponseObject, error)
}

func (s boundaryServer) CreateEventType(_ context.Context, r generated.CreateEventTypeRequestObject) (generated.CreateEventTypeResponseObject, error) {
	return s.eventType(r)
}
func (s boundaryServer) CreateBooking(_ context.Context, r generated.CreateBookingRequestObject) (generated.CreateBookingResponseObject, error) {
	return s.booking(r)
}
func (s boundaryServer) GetHealth(context.Context, generated.GetHealthRequestObject) (generated.GetHealthResponseObject, error) {
	return s.health()
}

func TestNormalizedRequestReachesStrictHandler(t *testing.T) {
	for _, duration := range []int{1, 480} {
		t.Run(strconv.Itoa(duration), func(t *testing.T) {
			called := false
			s := boundaryServer{eventType: func(r generated.CreateEventTypeRequestObject) (generated.CreateEventTypeResponseObject, error) {
				called = true
				if r.Body.Name != strings.Repeat("Я", 100) || r.Body.Description != "Первая\nВторая" || int(r.Body.DurationMinutes) != duration {
					t.Fatalf("unexpected request: %+v", r.Body)
				}
				return nil, &HTTPError{Status: 400, Code: "TEST_BOUNDARY", Message: "test"}
			}}
			body, _ := json.Marshal(map[string]any{"name": " \t" + strings.Repeat("Я", 100) + "  ", "description": "  Первая\nВторая\n ", "durationMinutes": duration})
			req := httptest.NewRequest(http.MethodPost, "/api/event-types", strings.NewReader(string(body)))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			newRouter(s).ServeHTTP(rec, req)
			if !called || rec.Code != 400 {
				t.Fatalf("handler called=%v status=%d body=%s", called, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestBookingTimeHasExplicitOffset(t *testing.T) {
	for _, stamp := range []string{"2026-10-06T10:00:00+03:00", "2026-10-06T07:00:00Z"} {
		t.Run(stamp, func(t *testing.T) {
			called := false
			s := boundaryServer{booking: func(r generated.CreateBookingRequestObject) (generated.CreateBookingResponseObject, error) {
				called = true
				want := time.Date(2026, 10, 6, 7, 0, 0, 0, time.UTC)
				if !r.Body.StartsAt.Equal(want) || r.Body.GuestName != "Гость" {
					t.Fatalf("unexpected request: %+v", r.Body)
				}
				return nil, &HTTPError{Status: 400, Code: "SLOT_UNAVAILABLE", Message: "Это время уже занято"}
			}}
			body := `{"eventTypeId":"b89ff958-472f-4cb3-af6b-5bc9a5277b88","startsAt":"` + stamp + `","guestName":" Гость ","guestEmail":"guest@example.com"}`
			req := httptest.NewRequest(http.MethodPost, "/api/bookings", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			newRouter(s).ServeHTTP(rec, req)
			if !called || rec.Code != 400 {
				t.Fatalf("handler called=%v status=%d body=%s", called, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestStrictHandlerErrorsAndPanics(t *testing.T) {
	for _, tt := range []struct {
		name       string
		err        error
		panicValue bool
		status     int
		code       string
	}{
		{"missing", &HTTPError{Status: 404, Code: "NOT_FOUND", Message: "Не найдено"}, false, 404, "NOT_FOUND"},
		{"domain", &HTTPError{Status: 400, Code: "SLOT_UNAVAILABLE", Message: "Занято"}, false, 400, "SLOT_UNAVAILABLE"},
		{"unexpected", errors.New("internal database detail"), false, 500, "INTERNAL_ERROR"},
		{"panic", nil, true, 500, "INTERNAL_ERROR"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			s := boundaryServer{health: func() (generated.GetHealthResponseObject, error) {
				if tt.panicValue {
					panic("internal database detail")
				}
				return nil, tt.err
			}}
			rec := httptest.NewRecorder()
			newRouter(s).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/health", nil))
			var body map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if rec.Code != tt.status || body["code"] != tt.code {
				t.Fatalf("status=%d body=%v", rec.Code, body)
			}
			if _, ok := body["fieldErrors"]; ok {
				t.Errorf("unexpected fieldErrors")
			}
			if strings.Contains(rec.Body.String(), "database") {
				t.Errorf("leaked internal detail")
			}
		})
	}
}
