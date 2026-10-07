package api

import (
	"context"
	"errors"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
)

// Event operations are implemented in events.go; later tickets replace the
// remaining explicit failures with real application use cases.
type server struct {
	events   *usecase.Events
	slots    *usecase.Slots
	bookings *usecase.Bookings
}

var errNotImplemented = errors.New("business operation is not implemented yet")
var _ generated.StrictServerInterface = server{}

func (server) GetHealth(context.Context, generated.GetHealthRequestObject) (generated.GetHealthResponseObject, error) {
	return generated.GetHealth200JSONResponse{Status: generated.HealthStatus("ok")}, nil
}
func (server) ListMeetings(context.Context, generated.ListMeetingsRequestObject) (generated.ListMeetingsResponseObject, error) {
	return nil, errNotImplemented
}
