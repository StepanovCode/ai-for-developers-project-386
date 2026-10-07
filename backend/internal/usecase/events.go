package usecase

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/google/uuid"
)

type EventRepository interface {
	CreateEvent(context.Context, domain.EventType) error
	ListEvents(context.Context) ([]domain.EventType, error)
	GetEvent(context.Context, string) (domain.EventType, error)
}
type Events struct {
	repository EventRepository
	owner      domain.Owner
}

func NewEvents(repository EventRepository, ownerName string) *Events {
	return &Events{repository: repository, owner: domain.Owner{ID: "default", Name: ownerName}}
}
func (e *Events) Owner() domain.Owner { return e.owner }
func (e *Events) Create(ctx context.Context, name, description string, duration int) (domain.EventType, error) {
	event, err := domain.ValidateEvent(name, description, duration)
	if err != nil {
		return domain.EventType{}, err
	}
	event.ID = uuid.NewString()
	if err = e.repository.CreateEvent(ctx, event); err != nil {
		return domain.EventType{}, err
	}
	return event, nil
}
func (e *Events) List(ctx context.Context) ([]domain.EventType, error) {
	return e.repository.ListEvents(ctx)
}
func (e *Events) Get(ctx context.Context, id string) (domain.EventType, error) {
	return e.repository.GetEvent(ctx, id)
}
