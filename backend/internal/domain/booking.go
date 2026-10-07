package domain

import (
	"errors"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"
)

var ErrSlotUnavailable = errors.New("slot unavailable")

type Booking struct {
	ID, EventTypeID, OwnerID, GuestName, GuestEmail, EventName string
	DurationMinutes                                            int
	StartsAt, EndsAt, CreatedAt                                time.Time
}

func ValidateGuest(name, email string) (string, string, error) {
	name = strings.TrimSpace(name)
	email = strings.TrimSpace(email)
	fields := map[string][]string{}
	if n := utf8.RuneCountInString(name); n < 1 || n > 100 || strings.ContainsAny(name, "\r\n\u2028\u2029") {
		fields["guestName"] = []string{"Имя: одна строка от 1 до 100 символов"}
	}
	address, err := mail.ParseAddress(email)
	if err != nil || address.Address != email || len(email) > 254 || strings.ContainsAny(email, "\r\n") {
		fields["guestEmail"] = []string{"Укажите корректный email до 254 символов"}
	}
	if len(fields) > 0 {
		return "", "", &ValidationError{Fields: fields}
	}
	return name, email, nil
}
