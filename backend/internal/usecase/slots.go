package usecase

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"time"
)

type Clock func() time.Time

// SlotRepository belongs to its consumer; reads all event types for the owner.
type SlotRepository interface {
	GetEvent(context.Context, string) (domain.EventType, error)
	ReadBusy(context.Context, string, time.Time, time.Time) ([]domain.TimeRange, error)
}
type Slots struct {
	repository SlotRepository
	schedule   domain.Schedule
	clock      Clock
}

func NewSlots(repository SlotRepository, schedule domain.Schedule, clock Clock) *Slots {
	return &Slots{repository: repository, schedule: schedule, clock: clock}
}
func (s *Slots) Get(ctx context.Context, id string) (domain.SlotWindow, error) {
	event, err := s.repository.GetEvent(ctx, id)
	if err != nil {
		return domain.SlotWindow{}, err
	}
	now := s.clock()
	start, end := domain.WindowBounds(now)
	busy, err := s.repository.ReadBusy(ctx, "default", start, end)
	if err != nil {
		return domain.SlotWindow{}, err
	}
	return domain.BuildSlotWindow(s.schedule, event.DurationMinutes, now, busy), nil
}
