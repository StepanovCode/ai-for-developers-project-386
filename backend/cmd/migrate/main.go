package main

import (
	"context"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/config"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/repo"
	"log"
	"time"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	database, err := repo.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer database.Close()
	if err = database.Migrate(ctx); err != nil {
		log.Fatal(err)
	}
	log.Print("migrations applied")
}
