package api_test

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
	"net/http/httptest"
	"testing"
	"time"
)

type missingEvents struct{}

func (missingEvents) CreateEvent(context.Context, domain.EventType) error    { return nil }
func (missingEvents) ListEvents(context.Context) ([]domain.EventType, error) { return nil, nil }
func (missingEvents) GetEvent(context.Context, string) (domain.EventType, error) {
	return domain.EventType{}, domain.ErrNotFound
}
func (missingEvents) ReadBusy(context.Context, string, time.Time, time.Time) ([]domain.TimeRange, error) {
	return nil, nil
}
func TestSlotsMissingType(t *testing.T) {
	r := httptest.NewRecorder()
	api.NewRouterWithApplication(usecase.NewEvents(missingEvents{}, "Owner"), usecase.NewSlots(missingEvents{}, domain.DefaultSchedule(), time.Now)).ServeHTTP(r, httptest.NewRequest("GET", "/api/event-types/00000000-0000-4000-8000-000000000000/slots", nil))
	if r.Code != 404 {
		t.Fatalf("missing type: got %d %s, want 404", r.Code, r.Body.String())
	}
}
