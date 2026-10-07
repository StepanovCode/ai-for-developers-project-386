package repo

import (
	"context"
	"errors"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (p *Postgres) CreateBooking(ctx context.Context, b domain.Booking) error {
	_, err := p.pool.Exec(ctx, `INSERT INTO bookings(id,event_type_id,owner_id,guest_name,guest_email,event_name,duration_minutes,starts_at,ends_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, b.ID, b.EventTypeID, b.OwnerID, b.GuestName, b.GuestEmail, b.EventName, b.DurationMinutes, b.StartsAt, b.EndsAt, b.CreatedAt)
	var pgerr *pgconn.PgError
	if errors.As(err, &pgerr) && pgerr.Code == "23P01" {
		return domain.ErrSlotUnavailable
	}
	return err
}
func (p *Postgres) GetBooking(ctx context.Context, id string) (domain.Booking, error) {
	var b domain.Booking
	err := p.pool.QueryRow(ctx, `SELECT id::text,event_type_id::text,owner_id,event_name,duration_minutes,starts_at,ends_at,created_at FROM bookings WHERE id=$1`, id).Scan(&b.ID, &b.EventTypeID, &b.OwnerID, &b.EventName, &b.DurationMinutes, &b.StartsAt, &b.EndsAt, &b.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Booking{}, domain.ErrNotFound
	}
	return b, err
}
