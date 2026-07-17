package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all application configuration.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	Environment string // development | production

	// Midtrans (Snap checkout + webhook signature).
	MidtransServerKey string
	MidtransClientKey string
	MidtransEnv       string // sandbox | production

	// WhatsApp gateway (Baileys microservice).
	WhatsAppGatewayURL string

	// Google OAuth (server-side redirect flow).
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
	// Frontend origin (post-Google-OAuth redirect target).
	WebOrigin string

	// AI assistant (super-admin) — OpenAI-compatible. Empty key → assistant stays disabled.
	AIKey    string
	AIModel  string
	AIBaseURL string
}

// Load reads configuration from .env (if present) then environment variables.
func Load() (*Config, error) {
	// Best-effort .env load — ignored if the file is missing (prod reads real env).
	_ = godotenv.Load()

	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgresql://posadmin:poslocal@localhost:5437/pos_saas?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		Environment: getEnv("APP_ENV", "development"),

		MidtransServerKey:   getEnv("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey:   getEnv("MIDTRANS_CLIENT_KEY", ""),
		MidtransEnv:         getEnv("MIDTRANS_ENV", "sandbox"),
		WhatsAppGatewayURL:  getEnv("WHATSAPP_GATEWAY_URL", "http://localhost:3001"),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getEnv("GOOGLE_REDIRECT_URI", "http://localhost:8099/api/auth/google/callback"),
		WebOrigin:          getEnv("FE_ORIGIN", "http://localhost:3008"),

		AIKey:     getEnv("AI_API_KEY", ""),
		AIModel:   getEnv("AI_MODEL", "gpt-4o-mini"),
		AIBaseURL: getEnv("AI_BASE_URL", "https://api.openai.com/v1"),
	}

	if cfg.Environment == "production" && cfg.JWTSecret == "dev-secret-change-in-production" {
		return nil, fmt.Errorf("JWT_SECRET must be set in production")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
