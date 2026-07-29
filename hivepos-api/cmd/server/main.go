package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hivepos/api/internal/config"
	"github.com/hivepos/api/internal/database"
	"github.com/hivepos/api/internal/modules/superadmin"
	"github.com/hivepos/api/internal/router"
	"github.com/hivepos/api/internal/shared/apperror"
	"github.com/hivepos/api/internal/shared/jobs"
	"github.com/hivepos/api/internal/shared/logging"
	"github.com/hivepos/api/internal/shared/selfheal"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// Structured logging (slog) + prod-time error-message redaction.
	logging.Setup(cfg.Environment)
	apperror.SetProduction(cfg.Environment == "production")

	// Connect to PostgreSQL (same DB as the Next.js app — shared during transition)
	db, err := database.New(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()
	log.Println("✓ Connected to PostgreSQL")

	// Schema ownership check (READ-ONLY — never applies DDL at boot). Refuses to serve
	// if the journal is dirty or behind code (forward-only; data untouched), and warns if
	// migration ownership hasn't been adopted yet (no journal). See cmd/migrate.
	if st, err := database.CheckSchema(cfg.DatabaseURL); err != nil {
		log.Fatalf("schema check: %v", err)
	} else if !st.OK {
		log.Fatalf("schema: refusing to boot — %s", st.Action)
	} else if st.Action != "" {
		log.Printf("⚠ schema: %s", st.Action)
	}

	// Seed platform feature flags (boot side-effect; kept out of BuildRouter so the
	// OpenAPI generator can construct the router offline without a live DB).
	superAdminForSeeding := superadmin.NewModule(db, cfg.AIKey, cfg.AIModel, cfg.AIBaseURL)
	superAdminForSeeding.SeedFeatureFlags(context.Background())

	// Build router — all module wiring lives in router.BuildRouter (single source of
	// truth, shared with cmd/genopenapi).
	r := router.BuildRouter(router.Deps{
		DB:                          db,
		JWTSecret:                   cfg.JWTSecret,
		MidtransServerKey:           cfg.MidtransServerKey,
		MidtransEnv:                 cfg.MidtransEnv,
		BillingAllowUnsignedWebhook: cfg.BillingAllowUnsignedWebhook,
		GoogleClientID:              cfg.GoogleClientID,
		GoogleClientSecret:          cfg.GoogleClientSecret,
		GoogleRedirectURI:           cfg.GoogleRedirectURI,
		WebOrigin:                   cfg.WebOrigin,
		AIKey:                       cfg.AIKey,
		AIModel:                     cfg.AIModel,
		AIBaseURL:                   cfg.AIBaseURL,
		WhatsAppGatewayURL:          cfg.WhatsAppGatewayURL,
	})

	// Photo cleanup cron — runs every 24h, deletes OrderPhoto rows older than 7 days.
	// Replaces pos-saas's /api/photo-cleanup daily cron. Best-effort, non-blocking.
	// reaperCancel stops it at shutdown so it can't fire a DELETE after db.Close().
	reaperCtx, reaperCancel := context.WithCancel(context.Background())
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				// Record this run durably (JobRun) — a crash mid-run used to leave no
				// trace. Recording is best-effort; a nil run means the JobRun table
				// isn't there yet and the job proceeds regardless.
				run, _ := jobs.Start(reaperCtx, db, "photo_cleanup")
				deletedPhotos, purgedErrorlog := int64(0), int64(0)
				jobErr := error(nil)
				res, err := db.ExecContext(reaperCtx,
					`DELETE FROM "OrderPhoto" WHERE "createdAt" < NOW() - INTERVAL '7 days'`)
				if err != nil {
					log.Printf("photo cleanup error: %v", err)
					jobErr = err
				} else if n, _ := res.RowsAffected(); n > 0 {
					deletedPhotos = n
					log.Printf("photo cleanup: deleted %d expired photos", n)
				}
				// ErrorLog retention — cap table growth so a client-error flood or 5xx
				// storm can't fill the shared DB disk and wedge every tenant at once.
				if res, err := db.ExecContext(reaperCtx,
					`DELETE FROM "ErrorLog" WHERE "createdAt" < NOW() - INTERVAL '90 days'`); err != nil {
					log.Printf("errorlog retention error: %v", err)
					if jobErr == nil {
						jobErr = err
					}
				} else if n, _ := res.RowsAffected(); n > 0 {
					purgedErrorlog = n
					log.Printf("errorlog retention: purged %d rows older than 90 days", n)
				}
				if run != nil {
					if jobErr != nil {
						run.Fail(reaperCtx, jobErr)
					} else {
						run.Complete(reaperCtx, map[string]any{"deleted_photos": deletedPhotos, "purged_errorlog": purgedErrorlog})
					}
				}
			case <-reaperCtx.Done():
				return
			}
		}
	}()

	// Self-heal alert ticker — scans ErrorLog every cfg.AlertIntervalMinutes for
	// spikes (>= threshold identical errors in the window) and opens a SupportTicket
	// (+ optional ALERT_WEBHOOK_URL). Guardrail: alert + ticket only — never resolves
	// the error, touches money, or edits code. Canceled on shutdown.
	healCtx, healCancel := context.WithCancel(context.Background())
	go selfheal.RunAlertTicker(healCtx, db,
		time.Duration(cfg.AlertIntervalMinutes)*time.Minute,
		selfheal.Config{
			WebhookURL:     cfg.AlertWebhookURL,
			ErrorThreshold: cfg.AlertErrorThreshold,
			WindowMinutes:  cfg.AlertWindowMinutes,
		})

	// HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("✓ hivePOS API listening on :%s (env: %s)", cfg.Port, cfg.Environment)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")
	healCancel()   // stop the self-heal ticker before draining
	reaperCancel() // stop the photo-reaper before closing the DB pool

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}

	db.Close()
	log.Println("Server stopped")
}
