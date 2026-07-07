package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all application configuration.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	Environment string // development | production
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirect     string
	MidtransServerKey  string
	MidtransClientKey  string
	MidtransEnv        string // sandbox | production
	RedisURL           string
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgresql://posadmin:poslocal@localhost:5437/pos_saas?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		Environment: getEnv("APP_ENV", "development"),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirect:     getEnv("GOOGLE_REDIRECT_URI", "http://localhost:8080/api/auth/google/callback"),
		MidtransServerKey:  getEnv("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey:  getEnv("MIDTRANS_CLIENT_KEY", ""),
		MidtransEnv:        getEnv("MIDTRANS_ENV", "sandbox"),
		RedisURL:           getEnv("REDIS_URL", ""),
	}

	if cfg.Environment == "production" && cfg.JWTSecret == "dev-secret-change-in-production" {
		return nil, fmt.Errorf("JWT_SECRET must be set in production")
	}

	return cfg, nil
}

func (c *Config) IsProduction() bool { return c.Environment == "production" }

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
