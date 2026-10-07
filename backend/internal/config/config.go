package config

import (
	"fmt"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"os"
	"strconv"
)

type Config struct {
	Port        string
	DatabaseURL string
	OwnerName   string
	Schedule    domain.Schedule
}

func Load() (Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	number, err := strconv.Atoi(port)
	if err != nil || number < 1 || number > 65535 {
		return Config{}, fmt.Errorf("PORT must be an integer between 1 and 65535, got %q", port)
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://booking:booking@postgres:5432/booking?sslmode=disable"
	}
	ownerName := os.Getenv("OWNER_NAME")
	if ownerName == "" {
		ownerName = "Дмитрий Степанов"
	}
	schedule, err := ParseSchedule(os.Getenv("WORK_SCHEDULE"))
	if err != nil {
		return Config{}, err
	}
	return Config{Schedule: schedule, Port: strconv.Itoa(number), DatabaseURL: databaseURL, OwnerName: ownerName}, nil
}
