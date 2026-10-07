package api

import (
	"context"
	"errors"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/google/uuid"
)

func (s server) confirmation(b domain.Booking) generated.BookingConfirmation {
	return generated.BookingConfirmation{Id: uuid.MustParse(b.ID), EventTypeId: uuid.MustParse(b.EventTypeID), EventTypeName: b.EventName, DurationMinutes: int32(b.DurationMinutes), StartsAt: b.StartsAt.UTC(), EndsAt: b.EndsAt.UTC(), TimeZone: generated.BookingConfirmationTimeZoneEuropeMoscow, Owner: s.owner()}
}
func (s server) CreateBooking(ctx context.Context, r generated.CreateBookingRequestObject) (generated.CreateBookingResponseObject, error) {
	if s.bookings == nil {
		return nil, errNotImplemented
	}
	b, err := s.bookings.Create(ctx, r.Body.EventTypeId.String(), r.Body.StartsAt, r.Body.GuestName, string(r.Body.GuestEmail))
	if errors.Is(err, domain.ErrNotFound) {
		return nil, &HTTPError{Status: 404, Code: "NOT_FOUND", Message: "Тип события не найден"}
	}
	if errors.Is(err, domain.ErrSlotUnavailable) {
		return nil, &HTTPError{Status: 400, Code: "SLOT_UNAVAILABLE", Message: "Это время уже занято. Выберите другой слот"}
	}
	var validation *domain.ValidationError
	if errors.As(err, &validation) {
		public := validationError()
		public.FieldErrors = validation.Fields
		return nil, public
	}
	if err != nil {
		return nil, err
	}
	return generated.CreateBooking201JSONResponse(s.confirmation(b)), nil
}
func (s server) GetBooking(ctx context.Context, r generated.GetBookingRequestObject) (generated.GetBookingResponseObject, error) {
	if s.bookings == nil {
		return nil, errNotImplemented
	}
	b, err := s.bookings.Get(ctx, r.Id.String())
	if errors.Is(err, domain.ErrNotFound) {
		return nil, &HTTPError{Status: 404, Code: "NOT_FOUND", Message: "Бронирование не найдено"}
	}
	if err != nil {
		return nil, err
	}
	return generated.GetBooking200JSONResponse(s.confirmation(b)), nil
}
