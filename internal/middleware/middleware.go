package middleware

import (
	"context"
	"net/http"
	"strings"

	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Context keys for request-scoped data.
type ctxKey string

const (
	TenantIDKey ctxKey = "tenantId"
	BranchIDKey ctxKey = "branchId"
	UserIDKey   ctxKey = "userId"
	IsAllOutletsKey ctxKey = "isAllOutlets"
)

// CORS allows the Next.js frontend to call this API.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Id, X-Tenant-Slug")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Recover catches panics and returns 500 instead of crashing.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				apphttp.Error(w, http.StatusInternalServerError, "Internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// RequireAuth rejects requests without valid claims.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Claims are injected by the auth middleware (set in context by JWTManager.Middleware).
		// If no claims → 401.
		if r.Context().Value(authClaimsKey) == nil {
			apphttp.UnauthorizedError(w, "Authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequirePermission checks if the authenticated user has a specific permission.
func RequirePermission(resource, action string) func(http.Handler) http.Handler {
	perm := resource + ":" + action
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := getAuthClaims(r)
			if claims == nil {
				apphttp.UnauthorizedError(w, "Authentication required")
				return
			}
			// Super-admin bypass.
			if claims.Role == "SUPER_ADMIN" {
				next.ServeHTTP(w, r)
				return
			}
			// Wildcard permission (Owner role).
			for _, p := range claims.Permissions {
				if p == "*" || p == perm {
					next.ServeHTTP(w, r)
					return
				}
			}
			apphttp.ForbiddenError(w, "Missing permission: "+perm)
		})
	}
}

// RequireTenant ensures the request has a tenantId (from JWT or subdomain).
func RequireTenant(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := getAuthClaims(r)
		if claims == nil || claims.TenantID == "" {
			apphttp.ForbiddenError(w, "Session missing tenant context")
			return
		}
		// Inject tenantId into context for downstream handlers.
		ctx := context.WithValue(r.Context(), TenantIDKey, claims.TenantID)
		ctx = context.WithValue(ctx, BranchIDKey, claims.BranchID)
		ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
		ctx = context.WithValue(ctx, IsAllOutletsKey, claims.BranchID == "ALL")
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// JSONContentType sets Content-Type for API responses.
func JSONContentType(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/health") {
			w.Header().Set("Content-Type", "application/json")
		}
		next.ServeHTTP(w, r)
	})
}

// --- internal helpers ---

// We import the auth Claims type to read it from context.
// This avoids a circular import by using an interface{} key.
const authClaimsKey ctxKey = "authClaims"

func getAuthClaims(r *http.Request) *authClaims {
	if v := r.Context().Value(authClaimsKey); v != nil {
		if c, ok := v.(*authClaims); ok {
			return c
		}
	}
	return nil
}

// authClaims is a local alias to avoid circular dependency with the auth package.
// The JWTManager.Middleware sets the actual auth.Claims into context using
// its own key. We bridge them via the SetClaims function below.
type authClaims struct {
	UserID       string
	Role         string
	TenantID     string
	BranchID     string
	Permissions  []string
	FeatureFlags map[string]bool
}

// SetClaimsBridge allows the auth package to inject claims into the middleware's context key.
// Called from the router setup after JWT validation.
func SetClaimsBridge(r *http.Request, userID, role, tenantID, branchID string, perms []string) *http.Request {
	c := &authClaims{
		UserID:      userID,
		Role:        role,
		TenantID:    tenantID,
		BranchID:    branchID,
		Permissions: perms,
	}
	ctx := context.WithValue(r.Context(), authClaimsKey, c)
	return r.WithContext(ctx)
}
