package main

import (
	"context"
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
	"github.com/hivepos/api/internal/modules/attendance"
	"github.com/hivepos/api/internal/modules/auth"
	"github.com/hivepos/api/internal/modules/billing"
	"github.com/hivepos/api/internal/modules/branches"
	"github.com/hivepos/api/internal/modules/customers"
	"github.com/hivepos/api/internal/modules/dashboard"
	"github.com/hivepos/api/internal/modules/expenses"
	"github.com/hivepos/api/internal/modules/inventory"
	"github.com/hivepos/api/internal/modules/orders"
	"github.com/hivepos/api/internal/modules/pickup"
	"github.com/hivepos/api/internal/modules/public_api"
	"github.com/hivepos/api/internal/modules/reports"
	"github.com/hivepos/api/internal/modules/services"
	"github.com/hivepos/api/internal/modules/superadmin"
	"github.com/hivepos/api/internal/modules/tenant"
	"github.com/hivepos/api/internal/modules/users"
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

	// Build router — ALL middleware must be registered BEFORE any routes (chi requirement).
	jwtMgr := appauth.NewJWTManager(cfg.JWTSecret)
	r := router.NewWithMiddleware(jwtMgr.Middleware)

	// Register ALL domain modules
	// Core CRUD (require auth)
	ordersModule := orders.NewModule(db)
	r.Route("/api/orders", func(r chi.Router) { r.Use(middleware.RequireAuth); ordersModule.Register(r) })

	customersModule := customers.NewModule(db)
	r.Route("/api/customers", func(r chi.Router) { r.Use(middleware.RequireAuth); customersModule.Register(r) })

	servicesModule := services.NewModule(db)
	r.Route("/api/services", func(r chi.Router) { r.Use(middleware.RequireAuth); servicesModule.Register(r) })
	r.Route("/api/service-groups", func(r chi.Router) { r.Use(middleware.RequireAuth); servicesModule.RegisterGroups(r) })

	branchesModule := branches.NewModule(db)
	r.Route("/api/branches", func(r chi.Router) { r.Use(middleware.RequireAuth); branchesModule.Register(r) })

	inventoryModule := inventory.NewModule(db)
	r.Route("/api/stock-items", func(r chi.Router) { r.Use(middleware.RequireAuth); inventoryModule.Register(r) })

	expensesModule := expenses.NewModule(db)
	r.Route("/api/expenses", func(r chi.Router) { r.Use(middleware.RequireAuth); expensesModule.Register(r) })
	r.Route("/api/expense-categories", func(r chi.Router) { r.Use(middleware.RequireAuth); expensesModule.RegisterCategories(r) })

	usersModule := users.NewModule(db)
	r.Route("/api/users", func(r chi.Router) { r.Use(middleware.RequireAuth); usersModule.RegisterUsers(r) })
	r.Route("/api/roles", func(r chi.Router) { r.Use(middleware.RequireAuth); usersModule.RegisterRoles(r) })

	attendanceModule := attendance.NewModule(db)
	r.Route("/api/attendance", func(r chi.Router) { r.Use(middleware.RequireAuth); attendanceModule.Register(r) })

	pickupModule := pickup.NewModule(db)
	r.Route("/api/pickup-requests", func(r chi.Router) { r.Use(middleware.RequireAuth); pickupModule.Register(r) })

	dashboardModule := dashboard.NewModule(db)
	r.Route("/api/dashboard", func(r chi.Router) { r.Use(middleware.RequireAuth); dashboardModule.Register(r) })

	// Billing
	billingModule := billing.NewModule(db)
	r.Route("/api/billing", billingModule.Register)

	// Auth (login, register)
	authModule := auth.NewModule(db, jwtMgr)
	r.Route("/api/auth", authModule.Register)
	r.Post("/api/register", authModule.RegisterHandler)

	// Public API (no auth)
	publicModule := publicapi.NewModule(db)
	r.Route("/api/public", publicModule.Register)

	// Reports (read-only)
	reportsModule := reports.NewModule(db)
	r.Route("/api/reports", reportsModule.Register)

	// Super-admin
	superAdminModule := superadmin.NewModule(db)
	r.Route("/api/super-admin", func(r chi.Router) { r.Use(middleware.RequireAuth); superAdminModule.Register(r) })

	// Tenant
	tenantModule := tenant.NewModule(db)
	r.Route("/api/tenant", func(r chi.Router) { r.Use(middleware.RequireAuth, middleware.RequireTenant); tenantModule.Register(r) })

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
