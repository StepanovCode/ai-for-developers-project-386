package usecase_test

import (
	"context"
	"errors"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
	"testing"
	"time"
)

type bookingRepo struct {
	saved []domain.Booking
	err   error
}

func (r *bookingRepo) GetEvent(context.Context, string) (domain.EventType, error) {
	return domain.EventType{ID: "00000000-0000-4000-8000-000000000001", Name: "Meeting", DurationMinutes: 30}, nil
}
func (r *bookingRepo) CreateBooking(_ context.Context, b domain.Booking) error {
	if r.err != nil {
		return r.err
	}
	r.saved = append(r.saved, b)
	return nil
}
func (r *bookingRepo) GetBooking(context.Context, string) (domain.Booking, error) {
	return domain.Booking{}, domain.ErrNotFound
}
func TestBookingTimeRules(t *testing.T) {
	now := time.Date(2026, 10, 7, 6, 0, 0, 0, time.UTC)
	r := &bookingRepo{}
	s := usecase.NewBookings(r, domain.DefaultSchedule(), func() time.Time { return now })
	for _, offset := range []time.Duration{29 * time.Minute, 30 * time.Minute, 31 * time.Minute, 45*time.Minute + time.Nanosecond, 24 * 14 * time.Hour, 24 * 3 * time.Hour} {
		_, err := s.Create(context.Background(), "id", now.Add(offset), " Guest ", "guest@example.com")
		valid := offset == 30*time.Minute
		if (err == nil) != valid {
			t.Fatalf("offset%v err%v", offset, err)
		}
	}
	if len(r.saved) != 1 || r.saved[0].GuestName != "Guest" || r.saved[0].OwnerID != "default" || r.saved[0].EndsAt.Sub(r.saved[0].StartsAt) != 30*time.Minute {
		t.Fatalf("saved%+v", r.saved)
	}
	now = now.Add(time.Minute)
	_, err := s.Create(context.Background(), "id", r.saved[0].StartsAt, "Guest", "guest@example.com")
	if !errors.Is(err, domain.ErrSlotUnavailable) {
		t.Fatalf("time recheck %v", err)
	}
}
func TestBookingValidationAndStorageFailure(t *testing.T) {
	now := time.Date(2026, 10, 7, 6, 0, 0, 0, time.UTC)
	r := &bookingRepo{err: errors.New("db secret")}
	s := usecase.NewBookings(r, domain.DefaultSchedule(), func() time.Time { return now })
	for _, v := range []struct{ name, email string }{{" ", "a@b.com"}, {"A\nB", "a@b.com"}, {"A", "invalid"}, {"A", "Name <a@b.com>"}} {
		_, err := s.Create(context.Background(), "id", now.Add(time.Hour), v.name, v.email)
		var validation *domain.ValidationError
		if !errors.As(err, &validation) {
			t.Fatalf("validation%v", err)
		}
	}
	if _, err := s.Create(context.Background(), "id", now.Add(time.Hour), "A", "a@b.com"); err == nil || len(r.saved) != 0 {
		t.Fatal("storage failure returned success")
	}
}
