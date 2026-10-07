package api_test

import (
	"context"
	"errors"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type failedMeetings struct{}

func (failedMeetings) ListUpcomingMeetings(context.Context, string, time.Time) ([]domain.Booking, error) {
	return nil, errors.New("private database failure")
}
func TestMeetingsStorageFailureIsNotEmptySuccess(t *testing.T) {
	r := httptest.NewRecorder()
	api.NewRouterWithMeetings(nil, nil, nil, usecase.NewMeetings(failedMeetings{}, time.Now)).ServeHTTP(r, httptest.NewRequest("GET", "/api/meetings", nil))
	if r.Code != 500 || strings.Contains(r.Body.String(), "private database") {
		t.Fatalf("%d %s", r.Code, r.Body.String())
	}
}

type emptyMeetings struct{ at time.Time }

func (r *emptyMeetings) ListUpcomingMeetings(_ context.Context, _ string, at time.Time) ([]domain.Booking, error) {
	r.at = at
	return []domain.Booking{}, nil
}
func TestMeetingResponseClockMatchesQueryInstant(t *testing.T) {
	now := time.Date(2026, 10, 7, 6, 0, 0, 123456789, time.UTC)
	calls := 0
	repository := &emptyMeetings{}
	clock := func() time.Time { calls++; return now.Add(time.Duration(calls-1) * time.Hour) }
	r := httptest.NewRecorder()
	api.NewRouterWithMeetings(nil, nil, nil, usecase.NewMeetings(repository, clock)).ServeHTTP(r, httptest.NewRequest("GET", "/api/meetings", nil))
	if r.Code != 200 || calls != 1 || !repository.at.Equal(now) || r.Header().Get("Date") != now.Format(http.TimeFormat) || r.Header().Get("X-Server-Time") != now.Format(time.RFC3339Nano) || r.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("response %d %v calls %d query %v", r.Code, r.Header(), calls, repository.at)
	}
}
