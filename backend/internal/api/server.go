package api

import (
	"context"
	"errors"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
)

// Only health is implemented in ticket 15. No fabricated business results:
// later tickets replace these explicit failures with application use cases.
type server struct{}

var errNotImplemented = errors.New("business operation is not implemented yet")
var _ generated.StrictServerInterface = server{}

func (server) GetHealth(context.Context, generated.GetHealthRequestObject) (generated.GetHealthResponseObject, error) {
	return generated.GetHealth200JSONResponse{Status: generated.HealthStatus("ok")}, nil
}
func (server) ListEventTypes(context.Context, generated.ListEventTypesRequestObject) (generated.ListEventTypesResponseObject, error) {
	return nil, errNotImplemented
}
func (server) CreateEventType(context.Context, generated.CreateEventTypeRequestObject) (generated.CreateEventTypeResponseObject, error) {
	return nil, errNotImplemented
}
func (server) GetEventType(context.Context, generated.GetEventTypeRequestObject) (generated.GetEventTypeResponseObject, error) {
	return nil, errNotImplemented
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
