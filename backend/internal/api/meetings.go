package api

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"net/http"
	"time"
)

func (s server) ListMeetings(ctx context.Context, _ generated.ListMeetingsRequestObject) (generated.ListMeetingsResponseObject, error) {
	if s.meetings == nil {
		return nil, errNotImplemented
	}
	bookings, now, err := s.meetings.ListAt(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]generated.Meeting, 0, len(bookings))
	for _, b := range bookings {
		items = append(items, generated.Meeting{Id: uuid.MustParse(b.ID), EventTypeId: uuid.MustParse(b.EventTypeID), EventTypeName: b.EventName, DurationMinutes: int32(b.DurationMinutes), GuestName: b.GuestName, GuestEmail: openapi_types.Email(b.GuestEmail), StartsAt: b.StartsAt.UTC(), EndsAt: b.EndsAt.UTC(), Owner: s.owner(), TimeZone: generated.MeetingTimeZoneEuropeMoscow})
	}
	return meetingSnapshotResponse{body: generated.ListMeetings200JSONResponse{Items: items, TimeZone: generated.MeetingListTimeZoneEuropeMoscow}, now: now}, nil
}

type meetingSnapshotResponse struct {
	body generated.ListMeetings200JSONResponse
	now  time.Time
}

func (r meetingSnapshotResponse) VisitListMeetingsResponse(w http.ResponseWriter) error {
	w.Header().Set("Date", r.now.UTC().Format(http.TimeFormat))
	// Date has whole-second precision; preserve the exact selection instant too.
	w.Header().Set("X-Server-Time", r.now.UTC().Format(time.RFC3339Nano))
	w.Header().Set("Cache-Control", "no-store")
	return r.body.VisitListMeetingsResponse(w)
}
