package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// PostgresConfig for connection pooling.
type PostgresConfig struct {
	MaxConns          int32
	MinConns          int32
	MaxConnLifetime   time.Duration
	MaxConnIdleTime   time.Duration
	ConnectTimeout    time.Duration
}

// DefaultConfig returns production-safe pool settings.
func DefaultConfig() PostgresConfig {
	return PostgresConfig{
		MaxConns:        25,
		MinConns:        5,
		MaxConnLifetime: 1 * time.Hour,
		MaxConnIdleTime: 30 * time.Minute,
		ConnectTimeout:  10 * time.Second,
	}
}

// New creates a *sql.DB connection pool (pgx driver).
func New(databaseURL string, cfg PostgresConfig) (*sql.DB, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("opening db: %w", err)
	}

	db.SetMaxOpenConns(int(cfg.MaxConns))
	db.SetMaxIdleConns(int(cfg.MinConns))
	db.SetConnMaxLifetime(cfg.MaxConnLifetime)
	db.SetConnMaxIdleTime(cfg.MaxConnIdleTime)

	ctx, cancel := context.WithTimeout(context.Background(), cfg.ConnectTimeout)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("pinging db: %w", err)
	}

	return db, nil
}
