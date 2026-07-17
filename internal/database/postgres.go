package database

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// New creates a *sql.DB connection pool (pgx driver).
func New(databaseURL string) (*sql.DB, error) {
	// ponytail: append a 15s statement_timeout + 10s connect_timeout to the DSN so a runaway
	// query can't pin a pooled conn until the HTTP WriteTimeout. Guard against duplicate params.
	dsn := ensureDSNParam(databaseURL, "connect_timeout", "10")
	dsn = ensureDSNParam(dsn, "statement_timeout", "15000")

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("opening db: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10) // ponytail: was 5 — 10 keeps more conns warm, less churn under burst
	db.SetConnMaxLifetime(1 * time.Hour)
	db.SetConnMaxIdleTime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("pinging db: %w", err)
	}

	return db, nil
}

// ensureDSNParam appends key=value to the DSN (libpq-style) if not already present.
func ensureDSNParam(dsn, key, value string) string {
	if strings.Contains(dsn, key+"=") {
		return dsn
	}
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	return dsn + sep + key + "=" + value
}
