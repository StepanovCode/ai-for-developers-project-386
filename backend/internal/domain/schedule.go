package domain

import (
	"time"
	_ "time/tzdata" // The IANA zone is available even in minimal containers.
)

const TimeZone = "Europe/Moscow"

var moscow = func() *time.Location {
	location, err := time.LoadLocation(TimeZone)
	if err != nil {
		panic(err)
	}
	return location
}()

// WorkingInterval uses minutes since local midnight; EndMinute may be 1440.
type WorkingInterval struct{ StartMinute, EndMinute int }
type Schedule map[time.Weekday][]WorkingInterval

// TimeRange is a half-open interval shared by bookings and slot availability.
type TimeRange struct{ StartsAt, EndsAt time.Time }
type Slot struct {
	StartsAt, EndsAt time.Time
	Busy             bool
}
type SlotDay struct {
	Date  time.Time
	Slots []Slot
}

// End is the final included calendar date, not an exclusive instant.
type SlotWindow struct {
	Start, End time.Time
	Days       []SlotDay
}

func DefaultSchedule() Schedule {
	s := Schedule{}
	for day := time.Monday; day <= time.Friday; day++ {
		s[day] = []WorkingInterval{{StartMinute: 540, EndMinute: 1080}}
	}
	return s
}

// WindowBounds returns today's midnight and the exclusive end of the 14-date window.
func WindowBounds(now time.Time) (time.Time, time.Time) {
	local := now.In(moscow)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, moscow)
	return start, start.AddDate(0, 0, 14)
}
func Overlaps(a, b TimeRange) bool { return a.StartsAt.Before(b.EndsAt) && b.StartsAt.Before(a.EndsAt) }
func BuildSlotWindow(schedule Schedule, duration int, now time.Time, busy []TimeRange) SlotWindow {
	start, end := WindowBounds(now)
	window := SlotWindow{Start: start, End: end.AddDate(0, 0, -1), Days: make([]SlotDay, 0, 14)}
	threshold := now.Add(30 * time.Minute)
	for n := 0; n < 14; n++ {
		date := start.AddDate(0, 0, n)
		day := SlotDay{Date: date, Slots: make([]Slot, 0)}
		for _, interval := range schedule[date.Weekday()] {
			intervalEnd := date.Add(time.Duration(interval.EndMinute) * time.Minute)
			for minute := interval.StartMinute; minute < interval.EndMinute; minute += 15 {
				begins := date.Add(time.Duration(minute) * time.Minute)
				finishes := begins.Add(time.Duration(duration) * time.Minute)
				if duration < 1 || begins.Before(threshold) || finishes.After(intervalEnd) || finishes.After(end) {
					continue
				}
				slot := Slot{StartsAt: begins, EndsAt: finishes}
				for _, booking := range busy {
					if Overlaps(TimeRange{StartsAt: begins, EndsAt: finishes}, booking) {
						slot.Busy = true
						break
					}
				}
				day.Slots = append(day.Slots, slot)
			}
		}
		window.Days = append(window.Days, day)
	}
	return window
}
