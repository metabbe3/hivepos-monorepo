package expenses

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/expenses/application"
	"github.com/hivepos/api/internal/modules/expenses/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
	"github.com/hivepos/api/internal/shared/pagination"
)

// Module wires the expenses domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgExpenseRepository(db)
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the /api/expenses sub-router.
func (m *Module) Register(r chi.Router) {
	r.Get("/", m.list)
	r.Post("/", m.create)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getByID)
		r.Patch("/", m.update)
		r.Delete("/", m.delete)
	})
}

// RegisterCategories mounts the /api/expense-categories sub-router.
func (m *Module) RegisterCategories(r chi.Router) {
	r.Get("/", m.listCategories)
	r.Post("/", m.createCategory)
	r.Route("/{id}", func(r chi.Router) {
		r.Patch("/", m.updateCategory)
		r.Delete("/", m.deleteCategory)
	})
}

// --- Expenses ---

func (m *Module) list(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	filter := application.ListFilter{
		BranchID:   req.URL.Query().Get("branchId"),
		CategoryID: req.URL.Query().Get("categoryId"),
		From:       req.URL.Query().Get("from"),
		To:         req.URL.Query().Get("to"),
		Search:     req.URL.Query().Get("search"),
	}
	// /api/expenses is intentionally unpaginated (matches the original TS contract).
	filter.All = true
	list, _, err := m.svc.ListExpenses(req.Context(), tenantID, filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// TS /api/expenses returns the list unpaginated (no meta).
	apphttp.Success(w, list)
}

func (m *Module) create(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	branchID := middleware.GetBranchID(req)
	if tenantID == "" || branchID == "" {
		apphttp.ForbiddenError(w, "Missing tenant/branch context")
		return
	}
	var input application.CreateExpenseInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Amount <= 0 {
		apphttp.ValidationError(w, "amount must be positive")
		return
	}
	e, err := m.svc.CreateExpense(req.Context(), input, tenantID, branchID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, e)
}

func (m *Module) getByID(w http.ResponseWriter, req *http.Request) {
	e, err := m.svc.GetExpense(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Expense not found")
		return
	}
	apphttp.Success(w, e)
}

func (m *Module) update(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	e, err := m.svc.GetExpense(req.Context(), id, middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Expense not found")
		return
	}
	// Decode into a DTO whose Date is a string. The FE <input type="date">
	// sends date-only "YYYY-MM-DD"; decoding into the domain entity (Date is
	// time.Time) rejects that and fails every edit (BUGS-E2E-FINDINGS #1).
	var input application.UpdateExpenseInput
	if !decodeJSON(w, req, &input) {
		return
	}
	e.Amount = input.Amount
	e.Description = input.Description
	e.CategoryID = input.CategoryID
	if input.Date != nil && *input.Date != "" {
		t, perr := application.ParseDate(*input.Date)
		if perr != nil {
			apphttp.ValidationError(w, "invalid expense date: expected YYYY-MM-DD or RFC3339")
			return
		}
		e.Date = t
	}
	e.ID = id
	if err := m.svc.UpdateExpense(req.Context(), e); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, e)
}

func (m *Module) delete(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeleteExpense(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

// --- Expense Categories ---

func (m *Module) listCategories(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	filter := application.CategoryListFilter{
		BranchID: req.URL.Query().Get("branchId"),
		Search:   req.URL.Query().Get("search"),
	}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		filter.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		filter.Limit = l
	}
	filter.Page, filter.Limit, _ = pagination.Normalize(filter.Page, filter.Limit)
	list, _, err := m.svc.ListCategories(req.Context(), tenantID, filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// TS /api/expense-categories returns the list unpaginated (no meta).
	apphttp.Success(w, list)
}

func (m *Module) createCategory(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	branchID := middleware.GetBranchID(req)
	if tenantID == "" || branchID == "" {
		apphttp.ForbiddenError(w, "Missing tenant/branch context")
		return
	}
	var input application.CreateCategoryInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Name == "" {
		apphttp.ValidationError(w, "name is required")
		return
	}
	c, err := m.svc.CreateCategory(req.Context(), input, tenantID, branchID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, c)
}

func (m *Module) updateCategory(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	c, err := m.svc.GetCategory(req.Context(), id, middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Expense category not found")
		return
	}
	if !decodeJSON(w, req, c) {
		return
	}
	c.ID = id
	if err := m.svc.UpdateCategory(req.Context(), c); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, c)
}

func (m *Module) deleteCategory(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeleteCategory(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

func decodeJSON(w http.ResponseWriter, req *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(req.Body).Decode(dst); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return false
	}
	return true
}
