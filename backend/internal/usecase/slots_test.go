package usecase

import (
	"context"
	"errors"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"testing"
	"time"
)

type slotsRepo struct {
	event      domain.EventType
	err        error
	readErr    error
	owner      string
	start, end time.Time
}

func (r *slotsRepo) GetEvent(context.Context, string) (domain.EventType, error) {
	return r.event, r.err
}
func (r *slotsRepo) ReadBusy(_ context.Context, owner string, start, end time.Time) ([]domain.TimeRange, error) {
	r.owner = owner
	r.start = start
	r.end = end
	return []domain.TimeRange{{StartsAt: time.Date(2026, 10, 7, 7, 0, 0, 0, time.UTC), EndsAt: time.Date(2026, 10, 7, 8, 0, 0, 0, time.UTC)}}, r.readErr
}
func TestSlotsReadOwnerWholeWindowAndUseServerClockOnce(t *testing.T) {
	r := &slotsRepo{event: domain.EventType{DurationMinutes: 30}}
	calls := 0
	s := NewSlots(r, domain.DefaultSchedule(), func() time.Time { calls++; return time.Date(2026, 10, 7, 7, 0, 0, 0, time.UTC) })
	w, err := s.Get(context.Background(), "type")
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 || r.owner != "default" || r.start.Format(time.RFC3339) != "2026-10-07T00:00:00+03:00" || r.end.Format(time.RFC3339) != "2026-10-21T00:00:00+03:00" {
		t.Fatalf("calls%d repo=%+v", calls, r)
	}
	if len(w.Days) != 14 || !w.Days[0].Slots[0].Busy || w.Days[0].Slots[2].Busy {
		t.Fatalf("availability=%+v", w.Days[0])
	}
}
func TestSlotsPropagateMissingTypeAndReadErrors(t *testing.T) {
	failure := errors.New("read failed")
	for _, r := range []*slotsRepo{{err: domain.ErrNotFound}, {readErr: failure}} {
		s := NewSlots(r, domain.DefaultSchedule(), time.Now)
		_, err := s.Get(context.Background(), "type")
		if !errors.Is(err, domain.ErrNotFound) && !errors.Is(err, failure) {
			t.Fatalf("err=%v", err)
		}
	}
}
