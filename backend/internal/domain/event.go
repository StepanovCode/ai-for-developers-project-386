package domain

import (
	"errors"
	"strings"
	"unicode/utf8"
)

type EventType struct {
	ID              string
	Name            string
	Description     string
	DurationMinutes int
}
type Owner struct {
	ID   string
	Name string
}

var ErrNotFound = errors.New("event type not found")

type ValidationError struct{ Fields map[string][]string }

func (e *ValidationError) Error() string { return "invalid event type" }
func ValidateEvent(name, description string, duration int) (EventType, error) {
	event := EventType{Name: strings.TrimSpace(name), Description: strings.TrimSpace(description), DurationMinutes: duration}
	fields := map[string][]string{}
	if n := utf8.RuneCountInString(event.Name); n < 1 || n > 100 || strings.ContainsAny(event.Name, "\r\n\u2028\u2029") {
		fields["name"] = []string{"Название: одна строка от 1 до 100 символов"}
	}
	if n := utf8.RuneCountInString(event.Description); n < 1 || n > 2000 {
		fields["description"] = []string{"Описание: от 1 до 2000 символов"}
	}
	if duration < 1 || duration > 480 {
		fields["durationMinutes"] = []string{"Длительность: целое число от 1 до 480 минут"}
	}
	if len(fields) > 0 {
		return EventType{}, &ValidationError{Fields: fields}
	}
	return event, nil
}
