package domain

import (
	"testing"
	"time"
)

func instant(s string) time.Time {
	v, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return v
}
func TestCalendarWindowAndMidnight(t *testing.T) {
	for _, tc := range []struct{ now, start, end string }{{"2026-10-07T20:59:59Z", "2026-10-07", "2026-10-20"}, {"2026-10-07T21:00:00Z", "2026-10-08", "2026-10-21"}, {"2026-10-30T05:00:00Z", "2026-10-30", "2026-11-12"}, {"2026-12-25T05:00:00Z", "2026-12-25", "2027-01-07"}} {
		w := BuildSlotWindow(DefaultSchedule(), 30, instant(tc.now), nil)
		if len(w.Days) != 14 || w.Start.Format("2006-01-02") != tc.start || w.End.Format("2006-01-02") != tc.end {
			t.Fatalf("window=%+v", w)
		}

		for _, d := range w.Days {
			if (d.Date.Weekday() == time.Saturday || d.Date.Weekday() == time.Sunday) && len(d.Slots) != 0 {
				t.Fatal("weekend offered")
			}
			if d.Slots == nil {
				t.Fatal("nil day slots")
			}
		}
	}
}
func TestNoticeGridAndDuration(t *testing.T) {
	for _, tc := range []struct {
		now              string
		minutes          int
		first, last, end string
	}{{"2026-10-07T07:00:00Z", 30, "10:30", "17:30", "18:00"}, {"2026-10-07T07:07:00Z", 45, "10:45", "17:15", "18:00"}, {"2026-10-07T05:29:59Z", 1, "09:00", "17:45", "17:46"}, {"2026-10-07T05:30:01Z", 480, "09:15", "10:00", "18:00"}} {
		w := BuildSlotWindow(DefaultSchedule(), tc.minutes, instant(tc.now), nil)
		s := w.Days[0].Slots
		if len(s) == 0 {
			t.Fatal("no slots")
		}
		last := s[len(s)-1]
		if s[0].StartsAt.Format("15:04") != tc.first || last.StartsAt.Format("15:04") != tc.last || last.EndsAt.Format("15:04") != tc.end {
			t.Fatalf("duration%d first%s last%s end%s", tc.minutes, s[0].StartsAt, last.StartsAt, last.EndsAt)
		}
	}
}
func TestWorkingIntervalsGridStartsAtIntervalAndExactEnds(t *testing.T) {
	schedule := Schedule{time.Wednesday: {{StartMinute: 9*60 + 7, EndMinute: 10*60 + 7}, {StartMinute: 12 * 60, EndMinute: 12*60 + 30}}}
	w := BuildSlotWindow(schedule, 30, instant("2026-10-07T05:00:00Z"), nil)
	s := w.Days[0].Slots
	if len(s) != 4 || s[0].StartsAt.Format("15:04") != "09:07" || s[2].EndsAt.Format("15:04") != "10:07" || s[3].StartsAt.Format("15:04") != "12:00" {
		t.Fatalf("slots=%+v", s)
	}
	if len(BuildSlotWindow(schedule, 61, instant("2026-10-07T05:00:00Z"), nil).Days[0].Slots) != 0 {
		t.Fatal("duration crossed interval")
	}
}
func TestBusyHalfOpenOverlapAllShapes(t *testing.T) {
	busy := []TimeRange{{StartsAt: instant("2026-10-07T07:00:00Z"), EndsAt: instant("2026-10-07T08:00:00Z")}}
	for _, tc := range []struct {
		duration int
		start    string
		want     bool
	}{{30, "09:30", false}, {30, "09:45", true}, {30, "10:00", true}, {30, "10:45", true}, {30, "11:00", false}, {120, "09:30", true}} {
		w := BuildSlotWindow(DefaultSchedule(), tc.duration, instant("2026-10-07T05:00:00Z"), busy)
		found := false
		for _, s := range w.Days[0].Slots {
			if s.StartsAt.Format("15:04") == tc.start {
				found = true
				if s.Busy != tc.want {
					t.Fatalf("%s duration%d busy=%v", tc.start, tc.duration, s.Busy)
				}
			}
		}
		if !found {
			t.Fatal("missing expected slot")
		}
	}
}
func TestWindowLastDateAndMidnightEnd(t *testing.T) {
	schedule := Schedule{time.Wednesday: {{StartMinute: 23 * 60, EndMinute: 24 * 60}}}
	w := BuildSlotWindow(schedule, 60, instant("2026-10-08T00:00:00+03:00"), nil)
	last := w.Days[13]
	if len(last.Slots) != 1 || last.Slots[0].EndsAt.Format(time.RFC3339) != "2026-10-22T00:00:00+03:00" {
		t.Fatalf("last=%+v", last)
	}
}

func TestEveryCalendarDateReturnedInOrder(t *testing.T) {
	want := []string{"2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"}
	w := BuildSlotWindow(Schedule{}, 30, instant("2026-10-07T05:00:00Z"), nil)
	for i, date := range want {
		if w.Days[i].Date.Format("2006-01-02") != date || len(w.Days[i].Slots) != 0 {
			t.Fatalf("day %d=%+v", i, w.Days[i])
		}
	}
}
