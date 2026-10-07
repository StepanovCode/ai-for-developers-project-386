package repo

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"time"
)

func (p *Postgres) ListUpcomingMeetings(ctx context.Context, owner string, now time.Time) ([]domain.Booking, error) {
	rows, err := p.pool.Query(ctx, `SELECT id::text,event_type_id::text,owner_id,event_name,duration_minutes,guest_name,guest_email,starts_at,ends_at,created_at FROM bookings WHERE owner_id=$1 AND starts_at>$2 ORDER BY starts_at,id`, owner, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]domain.Booking, 0)
	for rows.Next() {
		var b domain.Booking
		if err = rows.Scan(&b.ID, &b.EventTypeID, &b.OwnerID, &b.EventName, &b.DurationMinutes, &b.GuestName, &b.GuestEmail, &b.StartsAt, &b.EndsAt, &b.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, b)
	}
	return result, rows.Err()
}
