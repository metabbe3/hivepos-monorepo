package dashboard

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/dashboard/application"
	"github.com/hivepos/api/internal/modules/dashboard/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

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
		BranchID: req.URL.Query().Get("branchId"),
		Module:   req.URL.Query().Get("module"),
		From:     req.URL.Query().Get("from"),
		To:       req.URL.Query().Get("to"),
	}

	s, err := m.svc.GetStats(req.Context(), tenantID, f)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
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
