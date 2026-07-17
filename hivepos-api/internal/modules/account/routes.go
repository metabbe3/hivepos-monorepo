package account

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/hivepos/api/internal/middleware"
	apphttp "github.com/hivepos/api/internal/shared/http"
	"golang.org/x/crypto/bcrypt"
)

// Module holds the current-user / tenant-account endpoints that don't fit a
// single CRUD domain: onboarding progress + the user's own profile.
type Module struct {
	db *sql.DB
}

func NewModule(db *sql.DB) *Module { return &Module{db: db} }

// GET /api/onboarding/status — setup progress for the caller's tenant.
func (m *Module) OnboardingStatus(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	var serviceCount, customerCount, orderCount int
	var addr, phone sql.NullString
	_ = m.db.QueryRowContext(req.Context(),
		`SELECT count(*) FROM "Service" s JOIN "Branch" b ON b.id=s."branchId" WHERE b."tenantId"=$1`, tenantID).Scan(&serviceCount)
	_ = m.db.QueryRowContext(req.Context(),
		`SELECT count(*) FROM "Customer" c JOIN "Branch" b ON b.id=c."branchId" WHERE b."tenantId"=$1`, tenantID).Scan(&customerCount)
	_ = m.db.QueryRowContext(req.Context(),
		`SELECT count(*) FROM "Order" o JOIN "Branch" b ON b.id=o."branchId" WHERE b."tenantId"=$1`, tenantID).Scan(&orderCount)
	_ = m.db.QueryRowContext(req.Context(),
		`SELECT address, phone FROM "Branch" WHERE "tenantId"=$1 AND "isActive"=true LIMIT 1`, tenantID).Scan(&addr, &phone)

	servicesExist := serviceCount > 0
	outletConfigured := addr.Valid && addr.String != "" || phone.Valid && phone.String != ""
	customersExist := customerCount > 0
	firstOrderPlaced := orderCount > 0

	steps := []bool{servicesExist, outletConfigured, customersExist, firstOrderPlaced}
	done := 0
	for _, s := range steps {
		if s {
			done++
		}
	}
	apphttp.Success(w, map[string]any{
		"servicesExist":    servicesExist,
		"outletConfigured": outletConfigured,
		"customersExist":   customersExist,
		"firstOrderPlaced": firstOrderPlaced,
		"done":             done,
		"total":            len(steps),
		"percent":          int(float64(done) / float64(len(steps)) * 100),
	})
}

// GET /api/user — lightweight current-user context (id, branchId, role) used by
// the receipt + printer-settings pages to resolve the active branch.
func (m *Module) Me(w http.ResponseWriter, req *http.Request) {
	userID := middleware.GetUserID(req)
	if userID == "" {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	var name, email, phone sql.NullString
	var role, branchID, tenantID sql.NullString
	err := m.db.QueryRowContext(req.Context(),
		`SELECT name, email, phone, role::text, "branchId", "tenantId" FROM "User" WHERE id=$1`, userID).
		Scan(&name, &email, &phone, &role, &branchID, &tenantID)
	if err == sql.ErrNoRows {
		apphttp.NotFoundError(w, "User not found")
		return
	}
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]any{
		"id":       userID,
		"name":     ns(name),
		"email":    ns(email),
		"phone":    ns(phone),
		"role":     role.String,
		"branchId": ns(branchID),
		"tenantId": ns(tenantID),
	})
}

// GET /api/user/profile — the current user's editable profile.
func (m *Module) GetProfile(w http.ResponseWriter, req *http.Request) {
	userID := middleware.GetUserID(req)
	if userID == "" {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	var p struct {
		ID        string         `json:"id"`
		Name      sql.NullString `json:"-"`
		Email     sql.NullString `json:"-"`
		Phone     sql.NullString `json:"-"`
		Role      string         `json:"role"`
		CreatedAt time.Time      `json:"createdAt"`
		GoogleID  sql.NullString `json:"-"`
		Avatar    sql.NullString `json:"-"`
	}
	err := m.db.QueryRowContext(req.Context(),
		`SELECT id, name, email, phone, role::text, "createdAt", "googleId", avatar FROM "User" WHERE id=$1`, userID).
		Scan(&p.ID, &p.Name, &p.Email, &p.Phone, &p.Role, &p.CreatedAt, &p.GoogleID, &p.Avatar)
	if err == sql.ErrNoRows {
		apphttp.NotFoundError(w, "User not found")
		return
	}
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]any{
		"id":        p.ID,
		"name":      ns(p.Name),
		"email":     ns(p.Email),
		"phone":     ns(p.Phone),
		"role":      p.Role,
		"createdAt": p.CreatedAt.UTC().Format(time.RFC3339),
		"googleId":  ns(p.GoogleID),
		"avatar":    ns(p.Avatar),
	})
}

// PATCH /api/user/profile — update name/phone and/or change password.
func (m *Module) UpdateProfile(w http.ResponseWriter, req *http.Request) {
	userID := middleware.GetUserID(req)
	if userID == "" {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	var body struct {
		Name            *string `json:"name"`
		Phone           *string `json:"phone"`
		CurrentPassword *string `json:"currentPassword"`
		NewPassword     *string `json:"newPassword"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}

	updates := map[string]any{}
	if body.Name != nil {
		updates["name"] = *body.Name
	}
	if body.Phone != nil {
		if *body.Phone == "" {
			updates["phone"] = nil
		} else {
			updates["phone"] = *body.Phone
		}
	}
	if body.NewPassword != nil && *body.NewPassword != "" {
		if body.CurrentPassword == nil || *body.CurrentPassword == "" {
			apphttp.ValidationError(w, "currentPassword is required to change password")
			return
		}
		var hash sql.NullString
		_ = m.db.QueryRowContext(req.Context(), `SELECT "passwordHash" FROM "User" WHERE id=$1`, userID).Scan(&hash)
		if !hash.Valid || bcrypt.CompareHashAndPassword([]byte(hash.String), []byte(*body.CurrentPassword)) != nil {
			apphttp.ValidationError(w, "Kata sandi lama salah.")
			return
		}
		h, err := bcrypt.GenerateFromPassword([]byte(*body.NewPassword), 12)
		if err != nil {
			apphttp.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		updates["passwordHash"] = string(h)
	}
	if len(updates) == 0 {
		apphttp.ValidationError(w, "Tidak ada perubahan.")
		return
	}

	// ponytail: dynamic UPDATE builder — small column set, no ORM warranted.
	cols := []string{`"updatedAt"=$1`}
	args := []any{time.Now().UTC()}
	i := 2
	for k, v := range updates {
		cols = append(cols, `"`+k+`"=$`+strconv.Itoa(i))
		args = append(args, v)
		i++
	}
	args = append(args, userID)
	query := `UPDATE "User" SET ` + strings.Join(cols, ", ") + ` WHERE id=$` + strconv.Itoa(i)
	if _, err := m.db.ExecContext(req.Context(), query, args...); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	m.GetProfile(w, req) // echo back the updated profile
}

func ns(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}
