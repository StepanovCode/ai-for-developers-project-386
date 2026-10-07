package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ParseSchedule accepts a JSON object keyed by mon/tue/wed/thu/fri/sat/sun.
// An empty environment value selects defaults; {} deliberately closes all days.
func ParseSchedule(raw string) (domain.Schedule, error) {
	if raw == "" {
		return domain.DefaultSchedule(), nil
	}
	var input map[string][]struct {
		Start string `json:"start"`
		End   string `json:"end"`
	}
	decoder := json.NewDecoder(bytes.NewBufferString(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		return nil, fmt.Errorf("WORK_SCHEDULE: %w", err)
	}
	if input == nil {
		return nil, fmt.Errorf("WORK_SCHEDULE must be an object")
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return nil, fmt.Errorf("WORK_SCHEDULE must contain one JSON object")
	}
	days := map[string]time.Weekday{"mon": time.Monday, "tue": time.Tuesday, "wed": time.Wednesday, "thu": time.Thursday, "fri": time.Friday, "sat": time.Saturday, "sun": time.Sunday}
	schedule := domain.Schedule{}
	for name, intervals := range input {
		day, ok := days[name]
		if !ok {
			return nil, fmt.Errorf("WORK_SCHEDULE: unknown day %q", name)
		}
		for _, interval := range intervals {
			start, err := parseMinute(interval.Start, false)
			if err != nil {
				return nil, err
			}
			end, err := parseMinute(interval.End, true)
			if err != nil {
				return nil, err
			}
			if start >= end {
				return nil, fmt.Errorf("WORK_SCHEDULE: intervals must finish after their start within one day")
			}
			schedule[day] = append(schedule[day], domain.WorkingInterval{StartMinute: start, EndMinute: end})
		}
		sort.Slice(schedule[day], func(i, j int) bool { return schedule[day][i].StartMinute < schedule[day][j].StartMinute })
		for i := 1; i < len(schedule[day]); i++ {
			if schedule[day][i].StartMinute < schedule[day][i-1].EndMinute {
				return nil, fmt.Errorf("WORK_SCHEDULE: overlapping intervals on %s", name)
			}
		}
	}
	return schedule, nil
}
func parseMinute(value string, allowEnd bool) (int, error) {
	if allowEnd && value == "24:00" {
		return 1440, nil
	}
	if len(value) != 5 || value[2] != ':' {
		return 0, fmt.Errorf("WORK_SCHEDULE: time must use HH:MM")
	}
	parts := strings.Split(value, ":")
	hour, e1 := strconv.Atoi(parts[0])
	minute, e2 := strconv.Atoi(parts[1])
	if e1 != nil || e2 != nil || hour < 0 || hour > 23 || minute < 0 || minute > 59 || fmt.Sprintf("%02d:%02d", hour, minute) != value {
		return 0, fmt.Errorf("WORK_SCHEDULE: invalid time %q", value)
	}
	return hour*60 + minute, nil
}
