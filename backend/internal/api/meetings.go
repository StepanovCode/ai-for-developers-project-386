package api

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (s server) ListMeetings(ctx context.Context, _ generated.ListMeetingsRequestObject) (generated.ListMeetingsResponseObject, error) {
	if s.meetings == nil {
		return nil, errNotImplemented
	}
	bookings, err := s.meetings.List(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]generated.Meeting, 0, len(bookings))
	for _, b := range bookings {
		items = append(items, generated.Meeting{Id: uuid.MustParse(b.ID), EventTypeId: uuid.MustParse(b.EventTypeID), EventTypeName: b.EventName, DurationMinutes: int32(b.DurationMinutes), GuestName: b.GuestName, GuestEmail: openapi_types.Email(b.GuestEmail), StartsAt: b.StartsAt.UTC(), EndsAt: b.EndsAt.UTC(), Owner: s.owner(), TimeZone: generated.MeetingTimeZoneEuropeMoscow})
	}
	return generated.ListMeetings200JSONResponse{Items: items, TimeZone: generated.MeetingListTimeZoneEuropeMoscow}, nil
}
