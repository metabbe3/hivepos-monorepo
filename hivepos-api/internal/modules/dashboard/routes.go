package dashboard

import (
	"database/sql"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/dashboard/application"
	"github.com/hivepos/api/internal/modules/dashboard/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// ponytail: in-memory TTL cache for dashboard stats. GetStats runs 17-24 queries per load;
// 5m TTL avoids them on repeat loads. Invalidate via InvalidateStats(tenantID) on order/payment writes.
const statsTTL = 5 * time.Minute

type cachedStats struct {
	data interface{}
	at   time.Time
}

var statsCache sync.Map // "tenantID:from:to:module:branchId" → cachedStats

// statsCacheN bounds growth. InvalidateStats is currently never wired, so without a cap
// every distinct (tenant, date range, module, branch) query leaks a permanent entry.
// Drop new entries past maxStatsEntries — data is regenerable (worst case: a recompute).
const maxStatsEntries = 2048

var statsCacheN atomic.Int64

// InvalidateStats clears ALL cached dashboard data and resets the cap counter.
// NOTE: the tenantID arg is currently ignored (clears every tenant); and this func is
// not yet called on order/payment writes — wiring it on writes would also bound staleness.
func InvalidateStats(tenantID string) {
	_ = tenantID
	statsCache.Range(func(k, _ any) bool {
		statsCache.Delete(k)
		return true
	})
	statsCacheN.Store(0)
}

// Module wires the dashboard domain: repository -> service -> HTTP handlers.
type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgDashboardRepository(db)
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the dashboard sub-router.
// Endpoints (all GET, all read-only):
//
//	GET /stats   - aggregate metrics (MRR, orders, customers, revenue)
//	GET /kanban  - orders grouped by status (live pipeline)
//	GET /heatmap - busy hours aggregation (day-of-week x hour)
func (m *Module) Register(r chi.Router) {
	r.Get("/stats", m.stats)
	r.Get("/kanban", m.kanban)
	r.Get("/heatmap", m.heatmap)
}

func (m *Module) stats(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}

	f := application.StatsFilter{
		BranchID: middleware.GetBranchID(req),
		Module:   req.URL.Query().Get("module"),
		From:     req.URL.Query().Get("from"),
		To:       req.URL.Query().Get("to"),
	}

	// Cache check — avoids 17-24 queries on repeat dashboard loads within 5m.
	cacheKey := fmt.Sprintf("%s:%s:%s:%s:%s", tenantID, f.From, f.To, f.Module, f.BranchID)
	if v, ok := statsCache.Load(cacheKey); ok {
		c := v.(cachedStats)
		if time.Since(c.at) < statsTTL {
			apphttp.Success(w, c.data)
			return
		}
	}

	s, err := m.svc.GetStats(req.Context(), tenantID, f)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Cache the fresh result, but cap total entries so unbounded date-range keys can't
	// leak memory. Refresh of an existing key doesn't grow the count.
	if _, loaded := statsCache.LoadOrStore(cacheKey, cachedStats{data: s, at: time.Now()}); loaded {
		statsCache.Store(cacheKey, cachedStats{data: s, at: time.Now()}) // refresh TTL
	} else if statsCacheN.Add(1) > maxStatsEntries {
		statsCache.Delete(cacheKey)
		statsCacheN.Add(-1) // over cap — serve fresh but don't cache
	}
	apphttp.Success(w, s)
}

func (m *Module) kanban(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}

	list, err := m.svc.GetKanban(req.Context(), tenantID, req.URL.Query().Get("branchId"), req.URL.Query().Get("module"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
}

func (m *Module) heatmap(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}

	list, err := m.svc.GetHeatmap(req.Context(), tenantID, req.URL.Query().Get("branchId"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
}
