package usecase

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/google/uuid"
	"time"
)

type BookingRepository interface {
	GetEvent(context.Context, string) (domain.EventType, error)
	CreateBooking(context.Context, domain.Booking) error
	GetBooking(context.Context, string) (domain.Booking, error)
}
type Bookings struct {
	repository BookingRepository
	schedule   domain.Schedule
	clock      Clock
}

func NewBookings(r BookingRepository, s domain.Schedule, c Clock) *Bookings {
	return &Bookings{r, s, c}
}
func (s *Bookings) Create(ctx context.Context, id string, start time.Time, name, email string) (domain.Booking, error) {
	name, email, err := domain.ValidateGuest(name, email)
	if err != nil {
		return domain.Booking{}, err
	}
	event, err := s.repository.GetEvent(ctx, id)
	if err != nil {
		return domain.Booking{}, err
	}
	now := s.clock()
	valid := false
	for _, day := range domain.BuildSlotWindow(s.schedule, event.DurationMinutes, now, nil).Days {
		for _, slot := range day.Slots {
			if slot.StartsAt.Equal(start) {
				valid = true
				break
			}
		}
	}
	if !valid {
		return domain.Booking{}, domain.ErrSlotUnavailable
	}
	b := domain.Booking{ID: uuid.NewString(), EventTypeID: event.ID, OwnerID: "default", GuestName: name, GuestEmail: email, EventName: event.Name, DurationMinutes: event.DurationMinutes, StartsAt: start.UTC(), EndsAt: start.Add(time.Duration(event.DurationMinutes) * time.Minute).UTC(), CreatedAt: now.UTC()}
	if err = s.repository.CreateBooking(ctx, b); err != nil {
		return domain.Booking{}, err
	}
	return b, nil
}
func (s *Bookings) Get(ctx context.Context, id string) (domain.Booking, error) {
	return s.repository.GetBooking(ctx, id)
}
