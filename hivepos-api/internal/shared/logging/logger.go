// Package logging provides a request-scoped slog logger. Middleware attaches
// the chi RequestID so every log line for a request is correlated.
package logging

import (
	"context"
	"log/slog"
	"os"

	"github.com/go-chi/chi/v5/middleware"
)

// Setup configures the process-wide slog default: JSON in production, text
// (debug level) in development.
func Setup(env string) {
	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	var h slog.Handler
	if env == "production" {
		opts.Level = slog.LevelInfo
		h = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		h = slog.NewTextHandler(os.Stdout, opts)
	}
	slog.SetDefault(slog.New(h))
}

type ctxKey struct{}

// WithLogger stores l in ctx (no-op if l is nil).
func WithLogger(ctx context.Context, l *slog.Logger) context.Context {
	if l == nil {
		return ctx
	}
	return context.WithValue(ctx, ctxKey{}, l)
}

// FromCtx returns the logger from ctx, falling back to slog.Default(). When a
// chi RequestID is present it is attached as an attr for correlation.
func FromCtx(ctx context.Context) *slog.Logger {
	l, ok := ctx.Value(ctxKey{}).(*slog.Logger)
	if !ok || l == nil {
		l = slog.Default()
	}
	if reqID := middleware.GetReqID(ctx); reqID != "" {
		return l.With("request_id", reqID)
	}
	return l
}
