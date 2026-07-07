package reports

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/reports/application"
	"github.com/hivepos/api/internal/modules/reports/domain"
	"github.com/hivepos/api/internal/modules/reports/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the reports domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
}

// NewModule constructs the reports module. db is expected to be *sql.DB.
func NewModule(db interface{}) *Module {
	repo := infrastructure.NewPgReportsRepository(db.(*sql.DB))
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the 15 reports endpoints under the module's mount point.
func (m *Module) Register(r chi.Router) {
	r.Get("/orders", m.orders)
	r.Get("/revenue", m.revenue)
	r.Get("/services", m.services)
	r.Get("/customers", m.customers)
	r.Get("/expenses", m.expenses)
	r.Get("/monthly-pnl", m.monthlyPnL)
	r.Get("/profit", m.profit)
	r.Get("/outstanding", m.outstanding)
	r.Get("/payment-collection", m.paymentCollection)
	r.Get("/commission", m.commission)
	r.Get("/attendance", m.attendance)
	r.Get("/inventory", m.inventory)
	r.Get("/piutang-tracker", m.piutang)
	r.Get("/financial-statement", m.financialStatement)
	r.Get("/export", m.exportReport)
}

// filterFromRequest reads the shared branchId/startDate/endDate query params.
func filterFromRequest(req *http.Request) application.ReportFilter {
	return application.ReportFilter{
		BranchID:  req.URL.Query().Get("branchId"),
		StartDate: req.URL.Query().Get("startDate"),
		EndDate:   req.URL.Query().Get("endDate"),
	}
}

func tenantOr403(w http.ResponseWriter, req *http.Request) (string, bool) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return "", false
	}
	return tenantID, true
}

func (m *Module) orders(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Orders(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) revenue(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Revenue(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) services(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Services(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) customers(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Customers(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) expenses(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Expenses(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) monthlyPnL(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.MonthlyPnL(req.Context(), tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) profit(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Profit(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) outstanding(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Outstanding(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) paymentCollection(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.PaymentCollection(req.Context(), tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) commission(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Commission(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) attendance(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Attendance(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) inventory(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Inventory(req.Context(), tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) piutang(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.Piutang(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) financialStatement(w http.ResponseWriter, req *http.Request) {
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	rep, err := m.svc.FinancialStatement(req.Context(), tenantID, filterFromRequest(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, rep)
}

func (m *Module) exportReport(w http.ResponseWriter, req *http.Request) {
	// ponytail: <ceiling> — export not implemented; returns a stub. Wire to a
	// real CSV/PDF generator when download is needed.
	stub := domain.ExportStub{
		Format: "csv",
		URL:    "",
		Note:   "stub — not implemented",
	}
	apphttp.Success(w, stub)
}
