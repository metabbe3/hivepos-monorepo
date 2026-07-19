package main

import (
	"context"
	"database/sql"
	"encoding/json"
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
	"github.com/hivepos/api/internal/modules/account"
	"github.com/hivepos/api/internal/modules/attendance"
	"github.com/hivepos/api/internal/modules/auth"
	"github.com/hivepos/api/internal/modules/billing"
	"github.com/hivepos/api/internal/modules/branches"
	"github.com/hivepos/api/internal/modules/customers"
	"github.com/hivepos/api/internal/modules/dashboard"
	"github.com/hivepos/api/internal/modules/demo"
	"github.com/hivepos/api/internal/modules/expenses"
	"github.com/hivepos/api/internal/modules/inventory"
	"github.com/hivepos/api/internal/modules/orders"
	"github.com/hivepos/api/internal/modules/pickup"
	"github.com/hivepos/api/internal/modules/public_api"
	"github.com/hivepos/api/internal/modules/reports"
	"github.com/hivepos/api/internal/modules/services"
	"github.com/hivepos/api/internal/modules/superadmin"
	"github.com/hivepos/api/internal/modules/telemetry"
	"github.com/hivepos/api/internal/modules/tickets"
	"github.com/hivepos/api/internal/modules/tenant"
	"github.com/hivepos/api/internal/modules/users"
	"github.com/hivepos/api/internal/modules/whatsapp"
	"github.com/hivepos/api/internal/router"
	"github.com/hivepos/api/internal/shared/apperror"
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

	// Build router — ALL middleware must be registered BEFORE any routes (chi requirement).
	// CORS first (outermost) so preflight OPTIONS is answered before JWT rejects it.
	jwtMgr := appauth.NewJWTManager(cfg.JWTSecret)
	r := router.New(db, middleware.CORS, middleware.RequestTimeout, jwtMgr.Middleware, middleware.RequestIDHeader, middleware.ErrorLogger(db))

	// Register ALL domain modules
	// Core CRUD (require auth + feature flag)
	ordersModule := orders.NewModule(db)
	r.Route("/api/orders", func(r chi.Router) { r.Use(middleware.RequireResource("orders"), middleware.RequireFeatureFlag("orders")); ordersModule.Register(r) })

	customersModule := customers.NewModule(db)
	r.Route("/api/customers", func(r chi.Router) { r.Use(middleware.RequireResource("customers"), middleware.RequireFeatureFlag("customers")); customersModule.Register(r) })

	servicesModule := services.NewModule(db)
	r.Route("/api/services", func(r chi.Router) { r.Use(middleware.RequireResource("services"), middleware.RequireFeatureFlag("services")); servicesModule.Register(r) })
	r.Route("/api/service-groups", func(r chi.Router) { r.Use(middleware.RequireResource("services"), middleware.RequireFeatureFlag("services")); servicesModule.RegisterGroups(r) })

	branchesModule := branches.NewModule(db)
	r.Route("/api/branches", func(r chi.Router) { r.Use(middleware.RequireResource("branches"), middleware.RequireFeatureFlag("branches")); branchesModule.Register(r) })

	inventoryModule := inventory.NewModule(db)
	r.Route("/api/stock-items", func(r chi.Router) { r.Use(middleware.RequireResource("inventory"), middleware.RequireFeatureFlag("inventory")); inventoryModule.Register(r) })

	expensesModule := expenses.NewModule(db)
	r.Route("/api/expenses", func(r chi.Router) { r.Use(middleware.RequireResource("expenses"), middleware.RequireFeatureFlag("expenses")); expensesModule.Register(r) })
	r.Route("/api/expense-categories", func(r chi.Router) {
		r.Use(middleware.RequireResource("expenses"), middleware.RequireFeatureFlag("expenses"))
		expensesModule.RegisterCategories(r)
	})

	usersModule := users.NewModule(db)
	r.Route("/api/users", func(r chi.Router) { r.Use(middleware.RequireResource("users"), middleware.RequireFeatureFlag("roles")); usersModule.RegisterUsers(r) })
	r.Route("/api/roles", func(r chi.Router) { r.Use(middleware.RequireResource("roles"), middleware.RequireFeatureFlag("roles")); usersModule.RegisterRoles(r) })

	attendanceModule := attendance.NewModule(db)
	r.Route("/api/attendance", func(r chi.Router) { r.Use(middleware.RequireResource("attendance"), middleware.RequireFeatureFlag("staffAttendance")); attendanceModule.Register(r) })

	pickupModule := pickup.NewModule(db)
	r.Route("/api/pickup-requests", func(r chi.Router) { r.Use(middleware.RequireResource("pickupRequests"), middleware.RequireFeatureFlag("pickupRequests")); pickupModule.Register(r) })

	dashboardModule := dashboard.NewModule(db)
	r.Route("/api/dashboard", func(r chi.Router) { r.Use(middleware.RequireResource("dashboard"), middleware.RequireFeatureFlag("dashboard")); dashboardModule.Register(r) })

	// Billing
	billingModule := billing.NewModule(db, cfg.MidtransServerKey, cfg.MidtransEnv)
	r.Route("/api/billing", billingModule.Register)

	// Auth (login, register)
	authModule := auth.NewModule(db, jwtMgr, cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURI, cfg.WebOrigin, cfg.JWTSecret)
	r.Route("/api/auth", func(r chi.Router) { r.Use(middleware.RateLimit(20, time.Minute)); authModule.Register(r) })
	r.With(middleware.RateLimit(5, time.Hour)).Post("/api/register", authModule.RegisterHandler)

	// Demo entrypoint (public): returns shared demo creds for the web /demo auto-signin.
	demoModule := demo.NewModule()
	r.With(middleware.RateLimit(10, time.Hour)).Post("/api/demo/start", demoModule.Start)

	// Public API (no auth)
	publicModule := publicapi.NewModule(db)
	r.Route("/api/public", publicModule.Register)

	// PWA nonce — public (the service worker's force-update watcher polls it; no auth needed).
	// INSERT ... ON CONFLICT DO NOTHING seeds a default on first call, then returns the value.
	r.Get("/api/pwa/nonce", func(w http.ResponseWriter, req *http.Request) {
		var nonce string
		err := db.QueryRowContext(req.Context(), `
			INSERT INTO "SystemSetting" (key, value, "updatedAt")
			VALUES ('pwaNonce', gen_random_uuid()::text, NOW())
			ON CONFLICT (key) DO UPDATE SET "updatedAt" = "SystemSetting"."updatedAt"
			RETURNING value
		`).Scan(&nonce)
		if err != nil {
			http.Error(w, `{"success":false,"error":{"message":"nonce read failed"}}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": map[string]string{"nonce": nonce}})
	})

	// Public order tracking — /api/track/{orderNumber} + /api/track/{orderNumber}/photos.
	// Customer-facing (no auth); read-only from the Order + OrderItem + OrderPhoto tables.
	r.Get("/api/track/{orderNumber}", func(w http.ResponseWriter, req *http.Request) {
		orderNumber := chi.URLParam(req, "orderNumber")
		var id, status, payStatus string
		var total float64
		var createdAt time.Time
		var received, inProg, ready, delivered sql.NullTime
		err := db.QueryRowContext(req.Context(), `
			SELECT o.id, o.status, o."paymentStatus"::text, o."totalAmount"::float, o."createdAt",
			       o."receivedAt", o."inProgressAt", o."readyAt", o."deliveredAt"
			FROM "Order" o WHERE o."orderNumber" = $1`, orderNumber,
		).Scan(&id, &status, &payStatus, &total, &createdAt, &received, &inProg, &ready, &delivered)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": map[string]string{"message": "Order not found"}})
			return
		}
		items := []map[string]interface{}{}
		if iRows, ierr := db.QueryContext(req.Context(), `
			SELECT COALESCE(s.name,''), oi.quantity::float, oi.subtotal::float
			FROM "OrderItem" oi LEFT JOIN "Service" s ON s.id = oi."serviceId"
			WHERE oi."orderId" = $1`, id); ierr == nil {
			for iRows.Next() {
				var name string
				var qty, sub float64
				if iRows.Scan(&name, &qty, &sub) == nil {
					items = append(items, map[string]interface{}{"name": name, "quantity": qty, "subtotal": sub})
				}
			}
			iRows.Close()
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": map[string]interface{}{
			"orderNumber": orderNumber, "status": status, "paymentStatus": payStatus,
			"totalAmount": total, "items": items,
			"createdAt":   createdAt.UTC().Format(time.RFC3339),
		}})
	})
	r.Get("/api/track/{orderNumber}/photos", func(w http.ResponseWriter, req *http.Request) {
		orderNumber := chi.URLParam(req, "orderNumber")
		photos := []map[string]interface{}{}
		rows, err := db.QueryContext(req.Context(), `
			SELECT p.id, p.url FROM "OrderPhoto" p
			JOIN "Order" o ON o.id = p."orderId"
			WHERE o."orderNumber" = $1 ORDER BY p."createdAt"`, orderNumber)
		if err == nil {
			for rows.Next() {
				var pid, url string
				if rows.Scan(&pid, &url) == nil {
					photos = append(photos, map[string]interface{}{"id": pid, "url": url})
				}
			}
			rows.Close()
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": photos})
	})

	// Telemetry (authed POST, accepts client events)
	telemetryModule := telemetry.NewModule(db)
	r.With(middleware.RequireAuth).Post("/api/telemetry", telemetryModule.PostTelemetry)

	// Reports (read-only)
	reportsModule := reports.NewModule(db)
	r.Route("/api/reports", func(r chi.Router) { r.Use(middleware.RequireResource("reports")); reportsModule.Register(r) })

	// Super-admin
	superAdminModule := superadmin.NewModule(db, cfg.AIKey, cfg.AIModel, cfg.AIBaseURL)
	r.Route("/api/super-admin", func(r chi.Router) { r.Use(middleware.RequireAuth, middleware.RequireSuperAdmin); superAdminModule.Register(r) })

	// Tenant
	tenantModule := tenant.NewModule(db)
	r.Route("/api/tenant", func(r chi.Router) { r.Use(middleware.RequireAuth, middleware.RequireTenant); tenantModule.Register(r) })

	// WhatsApp gateway proxy (Baileys microservice)
	whatsappModule := whatsapp.NewModule(db, cfg.WhatsAppGatewayURL)
	r.Route("/api/whatsapp", func(r chi.Router) { r.Use(middleware.RequireAuth, middleware.RequireTenant); whatsappModule.Register(r) })

	// Tenant support tickets (RBAC-free for logged-in tenant users; SUPER_ADMIN uses /api/super-admin/tickets)
	ticketsModule := tickets.NewModule(db)
	r.Route("/api/tickets", func(r chi.Router) { r.Use(middleware.RequireAuth, middleware.RequireTenant); ticketsModule.Register(r) })

	// Account: onboarding progress + the current user's own profile.
	accountModule := account.NewModule(db)
	r.With(middleware.RequireAuth, middleware.RequireTenant).Get("/api/onboarding/status", accountModule.OnboardingStatus)
	r.Route("/api/user", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Get("/", accountModule.Me)
		r.Get("/profile", accountModule.GetProfile)
		r.Patch("/profile", accountModule.UpdateProfile)
	})

	// Printer scan/test — device-local hardware; backend can't access the cashier's USB.
	// Return a helpful response so the frontend doesn't crash; the printer-settings page
	// already has manual IP config as the primary path.
	r.Post("/api/printers/scan", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   map[string]string{"message": "Auto-scan requires the local device. Use manual IP configuration."},
		})
	})
	r.Post("/api/printers/test", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   map[string]string{"message": "Printer test requires the local device. Use the printer's built-in self-test."},
		})
	})

	// Photo cleanup cron — runs every 24h, deletes OrderPhoto rows older than 7 days.
	// Replaces pos-saas's /api/photo-cleanup daily cron. Best-effort, non-blocking.
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				res, err := db.ExecContext(context.Background(),
					`DELETE FROM "OrderPhoto" WHERE "createdAt" < NOW() - INTERVAL '7 days'`)
				if err != nil {
					log.Printf("photo cleanup error: %v", err)
				} else if n, _ := res.RowsAffected(); n > 0 {
					log.Printf("photo cleanup: deleted %d expired photos", n)
				}
			case <-context.Background().Done():
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
	healCancel() // stop the self-heal ticker before draining

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}

	db.Close()
	log.Println("Server stopped")
}
