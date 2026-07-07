package auth

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	appauth "github.com/hivepos/api/internal/auth"
	apphttp "github.com/hivepos/api/internal/shared/http"
	"github.com/hivepos/api/internal/modules/auth/application"
	"github.com/hivepos/api/internal/modules/auth/domain"
	"github.com/hivepos/api/internal/modules/auth/infrastructure"
)

// Module wires the auth HTTP domain: repository → service → HTTP handlers.
// Unlike other modules, it also holds a *appauth.JWTManager because login and
// registration must mint JWTs.
type Module struct {
	svc *application.Service
	jwt *appauth.JWTManager
}

// NewModule takes BOTH the DB and the JWTManager. db is interface{} to match
// the sibling-module convention (cast to *sql.DB internally).
func NewModule(db interface{}, jwt *appauth.JWTManager) *Module {
	repo := infrastructure.NewPgAuthRepository(db.(*sql.DB))
	return &Module{
		svc: application.NewService(repo),
		jwt: jwt,
	}
}

// Register mounts the auth sub-router: /login, /session-version, /me, /google.
// Mount this under /api/auth in main.go.
func (m *Module) Register(r chi.Router) {
	r.Post("/login", m.login)
	r.Post("/session-version", m.bumpSessionVersion)
	r.Get("/me", m.me)
	r.Post("/google", m.google)
}

// RegisterSignup mounts the public registration endpoint at "/" — mount the
// module a second time under /api/register in main.go and call this.
// (Kept separate from Register so /api/auth only exposes auth routes.)
func (m *Module) RegisterSignup(r chi.Router) {
	r.Post("/", m.register)
}

// RegisterHandler is a standalone handler so /api/register can be wired with a
// single r.Post("/api/register", authModule.RegisterHandler) if you prefer not
// to mount a second sub-router.
func (m *Module) RegisterHandler(w http.ResponseWriter, req *http.Request) {
	m.register(w, req)
}

// POST /login  {email, password}
func (m *Module) login(w http.ResponseWriter, req *http.Request) {
	var input domain.LoginInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.Email == "" || input.Password == "" {
		apphttp.ValidationError(w, "email and password are required")
		return
	}

	uc, err := m.svc.Login(req.Context(), input)
	if err != nil {
		if errors.Is(err, application.ErrInvalidCredentials) {
			// Compare against a dummy hash to keep response time roughly constant
			// whether or not the user existed (mitigates user-enumeration timing).
			_ = bcrypt.CompareHashAndPassword(
				[]byte("$2a$10$CwTycUXWue0Thq9StjUM0uJ8.0B7q5qK0xLRJQQRw1hGjZqVq3ZyG"),
				[]byte(input.Password),
			)
			apphttp.UnauthorizedError(w, "Invalid credentials")
			return
		}
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Real password check now that the user exists.
	if err := bcrypt.CompareHashAndPassword([]byte(uc.PasswordHash), []byte(input.Password)); err != nil {
		apphttp.UnauthorizedError(w, "Invalid credentials")
		return
	}

	token, err := m.mintToken(uc)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "Failed to issue token")
		return
	}

	apphttp.Success(w, domain.LoginResponse{
		Token: token,
		User:  toUserInfo(uc.User),
	})
}

// POST /  (mounted at /api/register)  {tenantName, tenantSlug, ownerName, email, password, module, branchName, phone?}
func (m *Module) register(w http.ResponseWriter, req *http.Request) {
	var input domain.RegisterInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.TenantName == "" || input.TenantSlug == "" || input.OwnerName == "" ||
		input.Email == "" || input.Password == "" || input.Module == "" || input.BranchName == "" {
		apphttp.ValidationError(w, "tenantName, tenantSlug, ownerName, email, password, module, branchName are required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	tenantID, userID, branchID, err := m.svc.Register(req.Context(), input, string(hash))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Load context and mint a JWT for immediate login.
	uc, err := m.svc.LoadContext(req.Context(), userID)
	if err != nil {
		// Provisioning succeeded — return IDs even if context load failed.
		apphttp.Created(w, map[string]interface{}{
			"tenantId": tenantID,
			"userId":   userID,
			"branchId": branchID,
		})
		return
	}

	token, err := m.mintToken(uc)
	if err != nil {
		apphttp.Created(w, map[string]interface{}{
			"tenantId": tenantID,
			"userId":   userID,
			"branchId": branchID,
		})
		return
	}

	apphttp.Created(w, domain.LoginResponse{
		Token: token,
		User:  toUserInfo(uc.User),
	})
}

// POST /session-version  {} (uses claims userId for safety, not body)
func (m *Module) bumpSessionVersion(w http.ResponseWriter, req *http.Request) {
	claims := appauth.GetClaims(req)
	if claims == nil {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}

	newVersion, err := m.svc.BumpSessionVersion(req.Context(), claims.UserID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	apphttp.Success(w, map[string]interface{}{
		"ok":             true,
		"sessionVersion": newVersion,
	})
}

// GET /me
func (m *Module) me(w http.ResponseWriter, req *http.Request) {
	claims := appauth.GetClaims(req)
	if claims == nil {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}

	uc, err := m.svc.LoadContext(req.Context(), claims.UserID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if uc == nil {
		apphttp.UnauthorizedError(w, "User not found")
		return
	}

	apphttp.Success(w, map[string]interface{}{
		"user": toUserInfo(uc.User),
		"claims": map[string]interface{}{
			"tenantId":    claims.TenantID,
			"branchId":    claims.BranchID,
			"role":        claims.Role,
			"permissions": claims.Permissions,
		},
	})
}

// POST /google  {idToken | code}
func (m *Module) google(w http.ResponseWriter, req *http.Request) {
	var body struct {
		IDToken string `json:"idToken"`
		Code    string `json:"code"`
	}
	// Body is optional for the stub — ignore decode errors.
	_ = json.NewDecoder(req.Body).Decode(&body)

	// ponytail: <ceiling> — verify the Google ID token with the oauth2 / googleidtoken
	// lib, upsert the user, then mint a real JWT. For now return a deterministic mock.
	apphttp.Success(w, map[string]interface{}{
		"token": "mock-google-jwt",
		"user": map[string]interface{}{
			"email": "stub@google.com",
		},
	})
}

// mintToken builds the appauth.Claims from a loaded UserContext and signs a 24h JWT.
func (m *Module) mintToken(uc *domain.UserContext) (string, error) {
	claims := &appauth.Claims{
		UserID:         uc.ID,
		Role:           uc.Role,
		TenantID:       uc.TenantID,
		BranchID:       uc.BranchID,
		BranchName:     uc.BranchName,
		TenantName:     uc.TenantName,
		TenantSlug:     uc.TenantSlug,
		ActiveModule:   "", // resolved by the frontend / onboarding
		ActiveModules:  []string{},
		Permissions:    uc.Permissions,
		RoleName:       uc.Role,
		SessionVersion: uc.SessionVersion,
		FeatureFlags:   uc.FeatureFlags,
		IsDemo:         false,
	}
	return m.jwt.Generate(claims, 24*time.Hour)
}

// toUserInfo projects a domain.User (or UserContext embedding one) into the
// public UserInfo shape (no secrets).
func toUserInfo(u domain.User) domain.UserInfo {
	return domain.UserInfo{
		ID:       u.ID,
		Email:    u.Email,
		Name:     u.Name,
		Role:     u.Role,
		TenantID: u.TenantID,
		BranchID: u.BranchID,
	}
}
