package repo

import (
	"context"
	"errors"
	"fmt"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct{ pool *pgxpool.Pool }

func Open(ctx context.Context, url string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("configure postgres: %w", err)
	}
	if err = pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	return &Postgres{pool: pool}, nil
}
func (p *Postgres) Close() { p.pool.Close() }
func (p *Postgres) CreateEvent(ctx context.Context, e domain.EventType) error {
	_, err := p.pool.Exec(ctx, `INSERT INTO event_types (id,name,description,duration_minutes) VALUES ($1,$2,$3,$4)`, e.ID, e.Name, e.Description, e.DurationMinutes)
	return err
}
func (p *Postgres) ListEvents(ctx context.Context) ([]domain.EventType, error) {
	rows, err := p.pool.Query(ctx, `SELECT id::text,name,description,duration_minutes FROM event_types ORDER BY sequence`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.EventType, 0)
	for rows.Next() {
		var e domain.EventType
		if err = rows.Scan(&e.ID, &e.Name, &e.Description, &e.DurationMinutes); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	return items, rows.Err()
}
func (p *Postgres) GetEvent(ctx context.Context, id string) (domain.EventType, error) {
	var e domain.EventType
	err := p.pool.QueryRow(ctx, `SELECT id::text,name,description,duration_minutes FROM event_types WHERE id=$1`, id).Scan(&e.ID, &e.Name, &e.Description, &e.DurationMinutes)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.EventType{}, domain.ErrNotFound
	}
	return e, err
}
