package config

import (
	"testing"
	"time"
)

func TestParseSchedule(t *testing.T) {
	s, err := ParseSchedule(`{"wed":[{"start":"12:00","end":"13:00"},{"start":"09:07","end":"10:07"}],"sun":[{"start":"23:00","end":"24:00"}]}`)
	if err != nil {
		t.Fatal(err)
	}
	if len(s) != 2 || s[time.Wednesday][0].StartMinute != 547 || s[time.Sunday][0].EndMinute != 1440 {
		t.Fatalf("schedule=%v", s)
	}
	s, err = ParseSchedule("")
	if err != nil || len(s) != 5 {
		t.Fatalf("defaults=%v %v", s, err)
	}
	s, err = ParseSchedule(`{}`)
	if err != nil || len(s) != 0 {
		t.Fatalf("empty=%v %v", s, err)
	}
}
func TestInvalidScheduleRejected(t *testing.T) {
	for _, raw := range []string{`oops`, `null`, `[]`, `{"monday":[]}`, `{"mon":[{"start":"18:00","end":"09:00"}]}`, `{"mon":[{"start":"09:00","end":"09:00"}]}`, `{"mon":[{"start":"24:00","end":"24:00"}]}`, `{"mon":[{"start":"9:00","end":"18:00"}]}`, `{"mon":[{"start":"09:00","end":"18:00","extra":true}]}`, `{"mon":[{"start":"09:00","end":"12:00"},{"start":"11:00","end":"13:00"}]}`, `{} {}`} {
		if _, err := ParseSchedule(raw); err == nil {
			t.Errorf("accepted %s", raw)
		}
	}
}
func TestLoadScheduleFromEnvironment(t *testing.T) {
	t.Setenv("WORK_SCHEDULE", `{"sat":[{"start":"10:00","end":"11:00"}]}`)
	cfg, err := Load()
	if err != nil || len(cfg.Schedule[time.Saturday]) != 1 {
		t.Fatalf("cfg=%v err=%v", cfg, err)
	}
	t.Setenv("WORK_SCHEDULE", "bad")
	if _, err = Load(); err == nil {
		t.Fatal("invalid schedule accepted")
	}
}
