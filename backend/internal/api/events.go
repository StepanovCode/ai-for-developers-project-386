package api

import (
	"context"
	"errors"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/google/uuid"
)

func toEvent(e domain.EventType) generated.EventType {
	return generated.EventType{Id: uuid.MustParse(e.ID), Name: e.Name, Description: e.Description, DurationMinutes: int32(e.DurationMinutes)}
}
func (s server) owner() generated.Owner {
	owner := s.events.Owner()
	return generated.Owner{Id: generated.OwnerId(owner.ID), Name: owner.Name}
}
func (s server) ListEventTypes(ctx context.Context, _ generated.ListEventTypesRequestObject) (generated.ListEventTypesResponseObject, error) {
	if s.events == nil {
		return nil, errNotImplemented
	}
	events, err := s.events.List(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]generated.EventType, 0, len(events))
	for _, e := range events {
		items = append(items, toEvent(e))
	}
	return generated.ListEventTypes200JSONResponse{Owner: s.owner(), Items: items}, nil
}
func (s server) CreateEventType(ctx context.Context, r generated.CreateEventTypeRequestObject) (generated.CreateEventTypeResponseObject, error) {
	if s.events == nil {
		return nil, errNotImplemented
	}
	e, err := s.events.Create(ctx, r.Body.Name, r.Body.Description, int(r.Body.DurationMinutes))
	if err != nil {
		var validation *domain.ValidationError
		if errors.As(err, &validation) {
			public := validationError()
			public.FieldErrors = validation.Fields
			return nil, public
		}
		return nil, err
	}
	return generated.CreateEventType201JSONResponse(toEvent(e)), nil
}
func (s server) GetEventType(ctx context.Context, r generated.GetEventTypeRequestObject) (generated.GetEventTypeResponseObject, error) {
	if s.events == nil {
		return nil, errNotImplemented
	}
	e, err := s.events.Get(ctx, r.Id.String())
	if errors.Is(err, domain.ErrNotFound) {
		return nil, &HTTPError{Status: 404, Code: "NOT_FOUND", Message: "Тип события не найден"}
	}
	if err != nil {
		return nil, err
	}
	return generated.GetEventType200JSONResponse{Owner: s.owner(), EventType: toEvent(e)}, nil
}
