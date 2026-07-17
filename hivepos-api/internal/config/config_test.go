package config_test

import (
	"testing"

	"github.com/hivepos/api/internal/config"
)

func TestLoadDefaults(t *testing.T) {
	for _, k := range []string{"PORT", "DATABASE_URL", "JWT_SECRET", "APP_ENV"} {
		t.Setenv(k, "")
	}
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want 8080", cfg.Port)
	}
	if cfg.Environment != "development" {
		t.Errorf("Environment = %q, want development", cfg.Environment)
	}
	if cfg.JWTSecret != "dev-secret-change-in-production" {
		t.Errorf("JWTSecret default wrong: %q", cfg.JWTSecret)
	}
}

func TestLoadEnvOverride(t *testing.T) {
	t.Setenv("PORT", "9090")
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "real-prod-secret")
	t.Setenv("DATABASE_URL", "postgresql://u:p@db:5432/x")
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Port != "9090" || cfg.Environment != "production" || cfg.JWTSecret != "real-prod-secret" {
		t.Errorf("overrides not applied: %+v", cfg)
	}
	if cfg.DatabaseURL != "postgresql://u:p@db:5432/x" {
		t.Errorf("DatabaseURL = %q", cfg.DatabaseURL)
	}
}

func TestLoadProductionRejectsDefaultSecret(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "") // falls back to the insecure default
	if _, err := config.Load(); err == nil {
		t.Fatal("production with default JWT secret must error")
	}
}

func TestLoadProductionAcceptsRealSecret(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "a-real-secret")
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Environment != "production" {
		t.Fatalf("Environment = %q", cfg.Environment)
	}
}
