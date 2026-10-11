package config_test

import (
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/config"
	"testing"
)

func TestLoadProductionSettings(t *testing.T) {
	t.Setenv("WORK_SCHEDULE", "")
	t.Setenv("PORT", "10000")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("STATIC_DIR", "/app/public")
	cfg, err := config.Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != "10000" || cfg.DatabaseURL != "" || cfg.StaticDir != "/app/public" {
		t.Fatalf("config=%+v", cfg)
	}
}
