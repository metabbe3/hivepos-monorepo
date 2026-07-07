package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	appauth "github.com/hivepos/api/internal/auth"
	"github.com/hivepos/api/internal/config"
	"github.com/hivepos/api/internal/database"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/auth"
	"github.com/hivepos/api/internal/modules/billing"
	"github.com/hivepos/api/internal/modules/public_api"
	"github.com/hivepos/api/internal/modules/reports"
	"github.com/hivepos/api/internal/modules/superadmin"
	"github.com/hivepos/api/internal/modules/tenant"
	"github.com/hivepos/api/internal/router"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// Connect to PostgreSQL (same DB as the Next.js app — shared during transition)
	db, err := database.New(cfg.DatabaseURL, database.DefaultConfig())
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()
	log.Println("✓ Connected to PostgreSQL")

	// Build router
	r := router.New()

	// JWT middleware — validates Bearer/cookie tokens and injects appauth.Claims
	// into the request context. Safe to apply globally: anonymous requests pass
	// through and individual handlers decide whether to require auth.
	jwtMgr := appauth.NewJWTManager(cfg.JWTSecret)
	r.Use(jwtMgr.Middleware)

	// Register domain modules
	billingModule := billing.NewModule(db)
	r.Route("/api/billing", billingModule.Register)

	authModule := auth.NewModule(db, jwtMgr)
	r.Route("/api/auth", authModule.Register)
	r.Post("/api/register", authModule.RegisterHandler)

	// Public API — anonymous, tenant resolved by slug. No auth required.
	// ponytail: medium — public endpoints resolved by slug; add API-key rate limiting when abuse occurs.
	publicModule := publicapi.NewModule(db)
	r.Route("/api/public", publicModule.Register)

	// Reports — read-only SQL aggregation endpoints.
	reportsModule := reports.NewModule(db)
	r.Route("/api/reports", reportsModule.Register)

	// Super-admin — platform-level management (cross-tenant). Gated by SUPER_ADMIN role.
	superAdminModule := superadmin.NewModule(db)
	r.Route("/api/super-admin", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		// ponytail: medium — narrow to SUPER_ADMIN role once auth claims populate Role for platform users.
		superAdminModule.Register(r)
	})

	// Tenant — tenant-scoped self-management (onboarding, website, referral, whatsapp templates).
	tenantModule := tenant.NewModule(db)
	r.Route("/api/tenant", func(r chi.Router) {
		r.Use(middleware.RequireAuth, middleware.RequireTenant)
		tenantModule.Register(r)
	})

	// HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// gRPC server (thin top layer — same service implementations)
	// TODO: when internal service-to-service calls are needed:
	//   grpcSrv := grpc.NewServer()
	//   pb.RegisterOrderServiceServer(grpcSrv, ordersGrpcAdapter)
	//   go func() { lis, _ := net.Listen("tcp", ":9090"); grpcSrv.Serve(lis) }()
	// For now: HTTP-only. gRPC added when the first inter-service call is needed.

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

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}

	db.Close()
	log.Println("Server stopped")
}

// Helper to avoid unused import warning during scaffold phase
var _ = fmt.Sprintf
