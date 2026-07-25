package reports

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/reports/application"
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
	q := req.URL.Query()
	// Frontend sends from/to (YYYY-MM-DD); accept startDate/endDate too for safety.
	from := q.Get("from")
	if from == "" {
		from = q.Get("startDate")
	}
	to := q.Get("to")
	if to == "" {
		to = q.Get("endDate")
	}
	if len(to) == 10 { // date-only → include the whole end day (createdAt <= end-of-day)
		to = to + " 23:59:59"
	}
	return application.ReportFilter{
		BranchID:  q.Get("branchId"),
		StartDate: from,
		EndDate:   to,
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
	// TS /api/reports/orders scopes by the user's branch context (requireWithBranch),
	// not a query param. Mirror that so totals match.
	f := filterFromRequest(req)
	f.BranchID = middleware.GetBranchID(req)
	rep, err := m.svc.Orders(req.Context(), tenantID, f)
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
	month, _ := strconv.Atoi(req.URL.Query().Get("month"))
	year, _ := strconv.Atoi(req.URL.Query().Get("year"))
	rep, err := m.svc.MonthlyPnL(req.Context(), tenantID, month, year)
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
	// TS wraps attendance with meta {from, to, totalWorkDays}.
	from := req.URL.Query().Get("from")
	to := req.URL.Query().Get("to")
	if from == "" {
		from = time.Now().AddDate(0, -1, 0).UTC().Format(time.RFC3339)
	}
	if to == "" {
		to = time.Now().UTC().Format(time.RFC3339)
	}
	apphttp.Success(w, rep, map[string]any{"from": from, "to": to, "totalWorkDays": 27})
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
	// CSV export of a report (format=csv). PDF needs a generator lib — left as a
	// follow-up; the web client also exports CSV/XLSX client-side. This endpoint
	// flattens the report struct to field,value rows so any type exports generically.
	tenantID, ok := tenantOr403(w, req)
	if !ok {
		return
	}
	typ := req.URL.Query().Get("type")
	if typ == "" {
		typ = "revenue"
	}
	f := filterFromRequest(req)
	ctx := req.Context()
	var (
		rep any
		err error
	)
	switch typ {
	case "orders":
		rep, err = m.svc.Orders(ctx, tenantID, f)
	case "expenses":
		rep, err = m.svc.Expenses(ctx, tenantID, f)
	case "profit":
		rep, err = m.svc.Profit(ctx, tenantID, f)
	case "customers":
		rep, err = m.svc.Customers(ctx, tenantID, f)
	case "services":
		rep, err = m.svc.Services(ctx, tenantID, f)
	case "commission":
		rep, err = m.svc.Commission(ctx, tenantID, f)
	case "outstanding":
		rep, err = m.svc.Outstanding(ctx, tenantID, f)
	case "piutang":
		rep, err = m.svc.Piutang(ctx, tenantID, f)
	case "inventory":
		rep, err = m.svc.Inventory(ctx, tenantID)
	case "financial":
		rep, err = m.svc.FinancialStatement(ctx, tenantID, f)
	default: // revenue + unknown
		rep, err = m.svc.Revenue(ctx, tenantID, f)
	}
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Round-trip the report through JSON to normalize its shape (rep is `any`,
	// varies by report type). Surface marshal errors instead of an empty CSV.
	raw, err := json.Marshal(rep)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "marshaling report: "+err.Error())
		return
	}
	var obj any
	if err := json.Unmarshal(raw, &obj); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "decoding report: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="report-`+typ+`.csv"`)
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"field", "value"})
	flattenCSV(cw, "", obj, 0)
	cw.Flush()
}

// flattenCSV walks a decoded JSON value, emitting one field,value row per leaf.
// ponytail: depth cap (maxCSVDepth) — bounds recursion so a pathological / deeply-nested
// payload can't overflow the goroutine stack.
const maxCSVDepth = 20

func flattenCSV(cw *csv.Writer, prefix string, v any, depth int) {
	if depth > maxCSVDepth {
		return
	}
	switch t := v.(type) {
	case map[string]any:
		for k, val := range t {
			p := k
			if prefix != "" {
				p = prefix + "." + k
			}
			flattenCSV(cw, p, val, depth+1)
		}
	case []any:
		for i, val := range t {
			p := prefix + "[" + strconv.Itoa(i) + "]"
			flattenCSV(cw, p, val, depth+1)
		}
	default:
		_ = cw.Write([]string{prefix, fmt.Sprintf("%v", v)})
	}
}
