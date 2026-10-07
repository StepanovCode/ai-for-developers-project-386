package usecase_test

import (
	"context"
	"errors"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
	"testing"
	"time"
)

type meetingRepo struct {
	owner string
	now   time.Time
	err   error
}

func (r *meetingRepo) ListUpcomingMeetings(_ context.Context, owner string, now time.Time) ([]domain.Booking, error) {
	r.owner = owner
	r.now = now
	return []domain.Booking{{GuestName: "Guest"}}, r.err
}
func TestMeetingsPassesSingleServerInstantAndOwner(t *testing.T) {
	now := time.Date(2026, 10, 7, 6, 0, 0, 0, time.UTC)
	calls := 0
	r := &meetingRepo{}
	s := usecase.NewMeetings(r, func() time.Time { calls++; return now })
	got, err := s.List(context.Background())
	if err != nil || len(got) != 1 || r.owner != "default" || !r.now.Equal(now) || calls != 1 {
		t.Fatalf("got %v err %v repo %v calls %d", got, err, r, calls)
	}
	r.err = errors.New("storage failed")
	if _, err = s.List(context.Background()); !errors.Is(err, r.err) {
		t.Fatalf("error %v", err)
	}
}
func TestMeetingSnapshotUsesSameClockForRowsAndResponse(t *testing.T) {
	now := time.Date(2026, 10, 7, 6, 0, 0, 123456789, time.UTC)
	calls := 0
	r := &meetingRepo{}
	s := usecase.NewMeetings(r, func() time.Time { calls++; return now.Add(time.Duration(calls-1) * time.Hour) })
	_, at, err := s.ListAt(context.Background())
	if err != nil || !at.Equal(now) || !r.now.Equal(at) || calls != 1 {
		t.Fatalf("at %v repo %v calls %d err %v", at, r.now, calls, err)
	}
}
