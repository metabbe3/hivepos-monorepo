package router

// BuildRouter — the single source of truth for the route table. Extracted from
// cmd/server/main.go so the OpenAPI generator (cmd/genopenapi) can construct the
// IDENTICAL router with stub deps (no live DB/Midtrans) and enumerate routes,
// instead of duplicating the wiring (which would drift).
//
// Construction does NO DB I/O: every module's NewModule only stores the *sql.DB,
// and the inline handlers are closures that query at request time. The one boot
// side-effect that DID touch the DB here — super-admin SeedFeatureFlags — moved
// back to cmd/server, so a generator can build this without a live database.

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	appauth "github.com/hivepos/api/internal/auth"
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
	publicapi "github.com/hivepos/api/internal/modules/public_api"
	"github.com/hivepos/api/internal/modules/reports"
	"github.com/hivepos/api/internal/modules/services"
	"github.com/hivepos/api/internal/modules/superadmin"
	"github.com/hivepos/api/internal/modules/telemetry"
	"github.com/hivepos/api/internal/modules/tickets"
	"github.com/hivepos/api/internal/modules/tenant"
	"github.com/hivepos/api/internal/modules/users"
	"github.com/hivepos/api/internal/modules/whatsapp"
)

// Deps holds everything BuildRouter needs. A struct (not args) so the generator
// can pass stub values for fields it doesn't have.
type Deps struct {
	DB                          *sql.DB
	JWTSecret                   string
	MidtransServerKey           string
	MidtransEnv                 string
	BillingAllowUnsignedWebhook bool
	GoogleClientID              string
	GoogleClientSecret          string
	GoogleRedirectURI           string
	WebOrigin                   string
	AIKey                       string
	AIModel                     string
	AIBaseURL                   string
	WhatsAppGatewayURL          string
}

// BuildRouter wires every module into a chi.Router and returns it.
func BuildRouter(d Deps) chi.Router {
	// ALL middleware must be registered BEFORE any routes (chi requirement).
	// CORS first (outermost) so preflight OPTIONS is answered before JWT rejects it.
	jwtMgr := appauth.NewJWTManager(d.JWTSecret)
	r := New(d.DB, middleware.CORS, middleware.RequestTimeout, jwtMgr.Middleware, middleware.RequestIDHeader, middleware.ErrorLogger(d.DB), middleware.Metrics)

	// Register ALL domain modules
	// Core CRUD (require auth + feature flag)
	ordersModule := orders.NewModule(d.DB)
	r.Route("/api/orders", func(r chi.Router) { r.Use(middleware.RequireResource("orders"), middleware.RequireFeatureFlag("orders")); ordersModule.Register(r) })

	customersModule := customers.NewModule(d.DB)
	r.Route("/api/customers", func(r chi.Router) { r.Use(middleware.RequireResource("customers"), middleware.RequireFeatureFlag("customers")); customersModule.Register(r) })

	servicesModule := services.NewModule(d.DB)
	r.Route("/api/services", func(r chi.Router) { r.Use(middleware.RequireResource("services"), middleware.RequireFeatureFlag("services")); servicesModule.Register(r) })
	r.Route("/api/service-groups", func(r chi.Router) { r.Use(middleware.RequireResource("services"), middleware.RequireFeatureFlag("services")); servicesModule.RegisterGroups(r) })

	branchesModule := branches.NewModule(d.DB)
	r.Route("/api/branches", func(r chi.Router) { r.Use(middleware.RequireResource("branches"), middleware.RequireFeatureFlag("branches")); branchesModule.Register(r) })

	inventoryModule := inventory.NewModule(d.DB)
	r.Route("/api/stock-items", func(r chi.Router) { r.Use(middleware.RequireResource("inventory"), middleware.RequireFeatureFlag("inventory")); inventoryModule.Register(r) })

	expensesModule := expenses.NewModule(d.DB)
	r.Route("/api/expenses", func(r chi.Router) { r.Use(middleware.RequireResource("expenses"), middleware.RequireFeatureFlag("expenses")); expensesModule.Register(r) })
	r.Route("/api/expense-categories", func(r chi.Router) {
		r.Use(middleware.RequireResource("expenses"), middleware.RequireFeatureFlag("expenses"))
		expensesModule.RegisterCategories(r)
	})

	usersModule := users.NewModule(d.DB)
	r.Route("/api/users", func(r chi.Router) { r.Use(middleware.RequireResource("users"), middleware.RequireFeatureFlag("roles")); usersModule.RegisterUsers(r) })
	r.Route("/api/roles", func(r chi.Router) { r.Use(middleware.RequireResource("roles"), middleware.RequireFeatureFlag("roles")); usersModule.RegisterRoles(r) })

	attendanceModule := attendance.NewModule(d.DB)
	r.Route("/api/attendance", func(r chi.Router) { r.Use(middleware.RequireResource("attendance"), middleware.RequireFeatureFlag("staffAttendance")); attendanceModule.Register(r) })

	pickupModule := pickup.NewModule(d.DB)
	r.Route("/api/pickup-requests", func(r chi.Router) { r.Use(middleware.RequireResource("pickupRequests"), middleware.RequireFeatureFlag("pickupRequests")); pickupModule.Register(r) })

	dashboardModule := dashboard.NewModule(d.DB)
	r.Route("/api/dashboard", func(r chi.Router) { r.Use(middleware.RequireResource("dashboard"), middleware.RequireFeatureFlag("dashboard")); dashboardModule.Register(r) })

	// Billing
	billingModule := billing.NewModule(d.DB, d.MidtransServerKey, d.MidtransEnv, d.BillingAllowUnsignedWebhook)
	r.Route("/api/billing", billingModule.Register)

	// Auth (login, register)
	authModule := auth.NewModule(d.DB, jwtMgr, d.GoogleClientID, d.GoogleClientSecret, d.GoogleRedirectURI, d.WebOrigin, d.JWTSecret)
	r.Route("/api/auth", func(r chi.Router) { authModule.Register(r, middleware.RateLimit(20, time.Minute)) })
	r.With(middleware.RateLimit(5, time.Hour)).Post("/api/register", authModule.RegisterHandler)

	// Demo entrypoint (public): returns shared demo creds for the web /demo auto-signin.
	demoModule := demo.NewModule()
	r.With(middleware.RateLimit(10, time.Hour)).Post("/api/demo/start", demoModule.Start)

	// Public API (no auth)
	publicModule := publicapi.NewModule(d.DB)
	r.Route("/api/public", publicModule.Register)

	// PWA nonce — public (the service worker's force-update watcher polls it; no auth needed).
	r.Get("/api/pwa/nonce", func(w http.ResponseWriter, req *http.Request) {
		var nonce string
		err := d.DB.QueryRowContext(req.Context(), `
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

	registerTrackRoutes(r, d.DB)

	// Telemetry (authed POST, accepts client events)
	telemetryModule := telemetry.NewModule(d.DB)
	r.With(middleware.RequireAuth).Post("/api/telemetry", telemetryModule.PostTelemetry)

	// Reports (read-only)
	reportsModule := reports.NewModule(d.DB)
	r.Route("/api/reports", func(r chi.Router) { r.Use(middleware.RequireResource("reports")); reportsModule.Register(r) })

	// Super-admin (feature-flag seeding is a boot side-effect — done in cmd/server, not here)
	superAdminModule := superadmin.NewModule(d.DB, d.AIKey, d.AIModel, d.AIBaseURL)
	r.Route("/api/super-admin", func(r chi.Router) { r.Use(middleware.RequireAuth, middleware.RequireSuperAdmin); superAdminModule.Register(r) })

	// Tenant
	tenantModule := tenant.NewModule(d.DB)
	r.Route("/api/tenant", func(r chi.Router) { r.Use(middleware.RequireAuth, middleware.RequireTenant); tenantModule.Register(r) })

	// WhatsApp gateway proxy (Baileys microservice)
	whatsappModule := whatsapp.NewModule(d.DB, d.WhatsAppGatewayURL)
	r.Route("/api/whatsapp", func(r chi.Router) { r.Use(middleware.RequireAuth, middleware.RequireTenant); whatsappModule.Register(r) })

	// Tenant support tickets (RBAC-free for logged-in tenant users; SUPER_ADMIN uses /api/super-admin/tickets)
	ticketsModule := tickets.NewModule(d.DB)
	r.Route("/api/tickets", func(r chi.Router) { r.Use(middleware.RequireAuth, middleware.RequireTenant); ticketsModule.Register(r) })

	// Account: onboarding progress + the current user's own profile.
	accountModule := account.NewModule(d.DB)
	r.With(middleware.RequireAuth, middleware.RequireTenant).Get("/api/onboarding/status", accountModule.OnboardingStatus)
	r.Route("/api/user", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Get("/", accountModule.Me)
		r.Get("/profile", accountModule.GetProfile)
		r.Patch("/profile", accountModule.UpdateProfile)
	})

	// Printer scan/test — device-local hardware; backend can't access the cashier's USB.
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

	return r
}

// registerTrackRoutes mounts the public order-tracking endpoints. Split out only
// to keep BuildRouter readable; behavior is unchanged from the prior inline handlers.
func registerTrackRoutes(r chi.Router, db *sql.DB) {
	// Public order tracking — /api/track/{orderNumber} + photos. Customer-facing
	// (no auth); read-only. Mirrors the legacy pos-saas tracking payload.
	r.Get("/api/track/{orderNumber}", func(w http.ResponseWriter, req *http.Request) {
		orderNumber := chi.URLParam(req, "orderNumber")
		var (
			id                                                       string
			status, payStatus, notes                                 sql.NullString
			custName                                                 sql.NullString
			custPhone, brName, brPhone, brWA, brAddr, brFoot         sql.NullString
			lat, lon                                                 sql.NullFloat64
			total, discount, paid                                    float64
			createdAt                                                time.Time
			received, inProg, ready, delivered                       sql.NullTime
			settingsRaw                                              []byte
		)
		err := db.QueryRowContext(req.Context(), `
			SELECT o.id, o.status, o."paymentStatus"::text,
			       o."totalAmount"::float, o."discountAmount"::float, o."paidAmount"::float,
			       o.notes, o."createdAt",
			       o."receivedAt", o."inProgressAt", o."readyAt", o."deliveredAt",
			       c.name, c.phone,
			       b.name, b.phone, b."whatsappLink", b.address, b.latitude, b.longitude, b."invoiceFooter",
			       t.settings
			FROM "Order" o
			JOIN "Customer" c ON c.id = o."customerId"
			JOIN "Branch"   b ON b.id = o."branchId"
			JOIN "Tenant"   t ON t.id = b."tenantId"
			WHERE o."orderNumber" = $1`, orderNumber,
		).Scan(&id, &status, &payStatus, &total, &discount, &paid, &notes, &createdAt,
			&received, &inProg, &ready, &delivered,
			&custName, &custPhone, &brName, &brPhone, &brWA, &brAddr, &lat, &lon, &brFoot,
			&settingsRaw)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": map[string]string{"message": "Order not found"}})
			return
		}

		nullableStr := func(v sql.NullString) interface{} {
			if v.Valid {
				return v.String
			}
			return nil
		}
		nullableTime := func(v sql.NullTime) interface{} {
			if v.Valid {
				return v.Time.UTC().Format(time.RFC3339)
			}
			return nil
		}
		nullableFloat := func(v sql.NullFloat64) interface{} {
			if v.Valid {
				return v.Float64
			}
			return nil
		}

		type breakdownItem struct {
			Name string `json:"name"`
			Qty  int    `json:"qty"`
		}
		items := []map[string]interface{}{}
		if iRows, ierr := db.QueryContext(req.Context(), `
			SELECT s.name, s."pricingType"::text, oi.quantity::float, oi."weightKg"::float,
			       oi."pricePerUnit"::float, oi.subtotal::float, oi."garmentBreakdown"
			FROM "OrderItem" oi LEFT JOIN "Service" s ON s.id = oi."serviceId"
			WHERE oi."orderId" = $1`, id); ierr == nil {
			for iRows.Next() {
				var svcName, pricing sql.NullString
				var qty, ppu, sub float64
				var weight sql.NullFloat64
				var gb []byte
				if iRows.Scan(&svcName, &pricing, &qty, &weight, &ppu, &sub, &gb) == nil {
					var breakdown interface{}
					if len(gb) > 0 && string(gb) != "null" {
						var bs []breakdownItem
						if json.Unmarshal(gb, &bs) == nil && len(bs) > 0 {
							breakdown = bs
						}
					}
					items = append(items, map[string]interface{}{
						"service":          svcName.String,
						"pricingType":      pricing.String,
						"quantity":         qty,
						"weightKg":         nullableFloat(weight),
						"pricePerUnit":     ppu,
						"subtotal":         sub,
						"garmentBreakdown": breakdown,
					})
				}
			}
			iRows.Close()
		}

		payments := []map[string]interface{}{}
		if pRows, perr := db.QueryContext(req.Context(), `
			SELECT amount::float, "paymentMethod"::text, "paidAt"
			FROM "Payment" WHERE "orderId" = $1 ORDER BY "paidAt" DESC`, id); perr == nil {
			for pRows.Next() {
				var amt float64
				var method string
				var paidAt time.Time
				if pRows.Scan(&amt, &method, &paidAt) == nil {
					payments = append(payments, map[string]interface{}{
						"amount": amt, "method": method, "paidAt": paidAt.UTC().Format(time.RFC3339),
					})
				}
			}
			pRows.Close()
		}

		var qrisImageUrl interface{}
		var whatsappTemplates interface{}
		if len(settingsRaw) > 0 && string(settingsRaw) != "null" {
			var s struct {
				Website struct {
					Qris *string `json:"qrisImageUrl"`
				} `json:"website"`
				Templates json.RawMessage `json:"whatsappTemplates"`
			}
			if json.Unmarshal(settingsRaw, &s) == nil {
				if s.Website.Qris != nil && *s.Website.Qris != "" {
					qrisImageUrl = *s.Website.Qris
				}
				if len(s.Templates) > 0 && string(s.Templates) != "null" {
					whatsappTemplates = json.RawMessage(s.Templates)
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": map[string]interface{}{
			"orderNumber":        orderNumber,
			"status":             status.String,
			"statusLabel":        status.String,
			"paymentStatus":      payStatus.String,
			"paymentStatusLabel": payStatus.String,
			"customerName":       custName.String,
			"customerPhone":      nullableStr(custPhone),
			"totalAmount":        total,
			"discountAmount":     discount,
			"paidAmount":         paid,
			"notes":              nullableStr(notes),
			"createdAt":          createdAt.UTC().Format(time.RFC3339),
			"receivedAt":         nullableTime(received),
			"inProgressAt":       nullableTime(inProg),
			"readyAt":            nullableTime(ready),
			"deliveredAt":        nullableTime(delivered),
			"items":              items,
			"payments":           payments,
			"branch": map[string]interface{}{
				"name":          brName.String,
				"phone":         nullableStr(brPhone),
				"whatsappLink":  nullableStr(brWA),
				"address":       nullableStr(brAddr),
				"latitude":      nullableFloat(lat),
				"longitude":     nullableFloat(lon),
				"invoiceFooter": nullableStr(brFoot),
			},
			"qrisImageUrl":      qrisImageUrl,
			"whatsappTemplates": whatsappTemplates,
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
}
