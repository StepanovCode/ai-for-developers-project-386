package usecase

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"time"
)

type MeetingRepository interface {
	ListUpcomingMeetings(context.Context, string, time.Time) ([]domain.Booking, error)
}
type Meetings struct {
	repository MeetingRepository
	clock      Clock
}

func NewMeetings(repository MeetingRepository, clock Clock) *Meetings {
	return &Meetings{repository: repository, clock: clock}
}
func (s *Meetings) List(ctx context.Context) ([]domain.Booking, error) {
	items, _, err := s.ListAt(ctx)
	return items, err
}

// ListAt returns the single server instant used to select this snapshot.
func (s *Meetings) ListAt(ctx context.Context) ([]domain.Booking, time.Time, error) {
	now := s.clock()
	items, err := s.repository.ListUpcomingMeetings(ctx, "default", now)
	return items, now, err
}
