package repo

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"time"
)

func (p *Postgres) ReadBusy(ctx context.Context, owner string, start, end time.Time) ([]domain.TimeRange, error) {
	rows, err := p.pool.Query(ctx, `SELECT starts_at,ends_at FROM bookings WHERE owner_id=$1 AND starts_at < $3 AND ends_at > $2 ORDER BY starts_at`, owner, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	intervals := make([]domain.TimeRange, 0)
	for rows.Next() {
		var interval domain.TimeRange
		if err = rows.Scan(&interval.StartsAt, &interval.EndsAt); err != nil {
			return nil, err
		}
		intervals = append(intervals, interval)
	}
	return intervals, rows.Err()
}
