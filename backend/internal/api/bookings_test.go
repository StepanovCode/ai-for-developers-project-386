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

func TestBookingMissing(t *testing.T) {
	r := httptest.NewRecorder()
	api.NewRouterWithBookings(usecase.NewEvents(missingBooking{}, "Owner"), nil, usecase.NewBookings(missingBooking{}, domain.DefaultSchedule(), time.Now)).ServeHTTP(r, httptest.NewRequest("GET", "/api/bookings/00000000-0000-4000-8000-000000000000", nil))
	if r.Code != 404 {
		t.Fatalf("want404 got%d %s", r.Code, r.Body.String())
	}
}

type missingBooking struct{ missingEvents }

func (missingBooking) CreateBooking(context.Context, domain.Booking) error { return nil }
func (missingBooking) GetBooking(context.Context, string) (domain.Booking, error) {
	return domain.Booking{}, domain.ErrNotFound
}
