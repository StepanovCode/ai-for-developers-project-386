package api

import (
	"context"
	"errors"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
)

// Event operations are implemented in events.go; later tickets replace the
// remaining explicit failures with real application use cases.
type server struct{ events *usecase.Events }

var errNotImplemented = errors.New("business operation is not implemented yet")
var _ generated.StrictServerInterface = server{}

func (server) GetHealth(context.Context, generated.GetHealthRequestObject) (generated.GetHealthResponseObject, error) {
	return generated.GetHealth200JSONResponse{Status: generated.HealthStatus("ok")}, nil
}
func (server) GetSlots(context.Context, generated.GetSlotsRequestObject) (generated.GetSlotsResponseObject, error) {
	return nil, errNotImplemented
}
func (server) CreateBooking(context.Context, generated.CreateBookingRequestObject) (generated.CreateBookingResponseObject, error) {
	return nil, errNotImplemented
}
func (server) GetBooking(context.Context, generated.GetBookingRequestObject) (generated.GetBookingResponseObject, error) {
	return nil, errNotImplemented
}
func (server) ListMeetings(context.Context, generated.ListMeetingsRequestObject) (generated.ListMeetingsResponseObject, error) {
	return nil, errNotImplemented
}
