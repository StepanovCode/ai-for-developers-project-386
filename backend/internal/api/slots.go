package api

import (
	"context"
	"errors"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (s server) GetSlots(ctx context.Context, r generated.GetSlotsRequestObject) (generated.GetSlotsResponseObject, error) {
	if s.slots == nil {
		return nil, errNotImplemented
	}
	window, err := s.slots.Get(ctx, r.Id.String())
	if errors.Is(err, domain.ErrNotFound) {
		return nil, &HTTPError{Status: 404, Code: "NOT_FOUND", Message: "Тип события не найден"}
	}
	if err != nil {
		return nil, err
	}
	days := make([]generated.SlotDay, 0, len(window.Days))
	for _, day := range window.Days {
		slots := make([]generated.Slot, 0, len(day.Slots))
		for _, slot := range day.Slots {
			status := generated.Available
			if slot.Busy {
				status = generated.Busy
			}
			slots = append(slots, generated.Slot{StartsAt: slot.StartsAt.UTC(), EndsAt: slot.EndsAt.UTC(), Status: status})
		}
		days = append(days, generated.SlotDay{Date: openapi_types.Date{Time: day.Date}, Slots: slots})
	}
	return generated.GetSlots200JSONResponse{Days: days, TimeZone: generated.SlotWindowTimeZoneEuropeMoscow, WindowStart: openapi_types.Date{Time: window.Start}, WindowEnd: openapi_types.Date{Time: window.End}}, nil
}
