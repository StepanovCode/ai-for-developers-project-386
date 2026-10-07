package api_test

import (
	"context"
	"errors"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
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
