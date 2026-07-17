package middleware

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	appauth "github.com/hivepos/api/internal/auth"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/hivepos/api/internal/rbac"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// RequestTimeout bounds each request's context (propagates to DB queries via r.Context()).
// Heavy aggregation routes get a longer budget; everything else 15s. Run early in the chain
// (after CORS) so auth + handlers + queries are all bounded.
func RequestTimeout(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		timeout := 15 * time.Second
		p := r.URL.Path
		if strings.HasPrefix(p, "/api/dashboard") ||
			strings.HasPrefix(p, "/api/reports") ||
			strings.HasPrefix(p, "/api/super-admin") {
			timeout = 60 * time.Second
		}
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Context keys for request-scoped data.
type ctxKey string

const (
	TenantIDKey ctxKey = "tenantId"
	BranchIDKey ctxKey = "branchId"
	UserIDKey   ctxKey = "userId"
)

// CORS allows the Next.js frontend to call this API.
//
// In prod the frontend sits behind the same Caddy origin (/api → api), so CORS
// is a no-op there. This mainly serves local dev where web (:3008) and api
// (:8080) are different origins. Echo the request Origin (not "*") — credentialed
// requests (cookies / Authorization) require an exact origin, never a wildcard.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Id, X-Tenant-Slug")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == http.MethodOptions {
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
				log.Printf("PANIC recovered: %v\n%s", rec, debug.Stack())
				apphttp.Error(w, http.StatusInternalServerError, "Internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// RequireResource enforces the RBAC resource:action for the request, deriving the
// action from the HTTP method. SUPER_ADMIN bypasses; a "*" permission grants all.
// Replaces RequireAuth on tenant route groups so Go matches TS authorization.
func RequireResource(resource string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := appauth.GetClaims(r)
			if claims == nil {
				apphttp.UnauthorizedError(w, "Authentication required")
				return
			}
			if claims.Role == "SUPER_ADMIN" || claims.Role == "OWNER" {
				next.ServeHTTP(w, r)
				return
			}
			perm := resource + ":" + string(rbac.ActionForMethod(r.Method))
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

// RequireFeatureFlag gates a route on a feature-flag key. Mirrors RequireResource
// but checks claims.FeatureFlags instead of permissions. Super-admin bypasses.
// Permissive default: if the flag is missing from the map (cache miss / not seeded),
// access is ALLOWED — only an explicit false blocks. This prevents accidental lockout.
func RequireFeatureFlag(flagKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := appauth.GetClaims(r)
			if claims == nil {
				next.ServeHTTP(w, r) // let RequireAuth/RequireResource handle unauthenticated
				return
			}
			if claims.Role == "SUPER_ADMIN" {
				next.ServeHTTP(w, r)
				return
			}
			if enabled, ok := claims.FeatureFlags[flagKey]; ok && !enabled {
				apphttp.ForbiddenError(w, "This feature is not enabled for your account")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAuth rejects requests without valid claims.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := appauth.GetClaims(r)
		if claims == nil {
			apphttp.UnauthorizedError(w, "Authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireSuperAdmin gates platform-staff routes (/api/super-admin/*). Must run
// AFTER RequireAuth. Allows SUPER_ADMIN + SUPPORT (mirrors legacy
// assertSuperAdminOrThrow). Tenant tokens get 403.
func RequireSuperAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := appauth.GetClaims(r)
		if claims == nil {
			apphttp.UnauthorizedError(w, "Authentication required")
			return
		}
		if claims.Role != "SUPER_ADMIN" && claims.Role != "SUPPORT" {
			apphttp.ForbiddenError(w, "Super admin access required")
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
			claims := appauth.GetClaims(r)
			if claims == nil {
				apphttp.UnauthorizedError(w, "Authentication required")
				return
			}
			if claims.Role == "SUPER_ADMIN" || claims.Role == "OWNER" {
				next.ServeHTTP(w, r)
				return
			}
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
		claims := appauth.GetClaims(r)
		if claims == nil || claims.TenantID == "" {
			apphttp.ForbiddenError(w, "Session missing tenant context")
			return
		}
		ctx := context.WithValue(r.Context(), TenantIDKey, claims.TenantID)
		ctx = context.WithValue(ctx, BranchIDKey, claims.BranchID)
		ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetTenantID extracts tenantId from the request context (JWT claims or middleware).
func GetTenantID(r *http.Request) string {
	if v, ok := r.Context().Value(TenantIDKey).(string); ok {
		return v
	}
	if c := appauth.GetClaims(r); c != nil {
		return c.TenantID
	}
	return ""
}

// GetBranchID extracts branchId from the request context.
func GetBranchID(r *http.Request) string {
	if v, ok := r.Context().Value(BranchIDKey).(string); ok {
		return v
	}
	if c := appauth.GetClaims(r); c != nil {
		return c.BranchID
	}
	return ""
}

// GetUserID extracts userId from the request context.
func GetUserID(r *http.Request) string {
	if v, ok := r.Context().Value(UserIDKey).(string); ok {
		return v
	}
	if c := appauth.GetClaims(r); c != nil {
		return c.UserID
	}
	return ""
}

// RequestIDHeader exposes chi's request ID in the X-Request-Id response header so the
// FE can capture it for error tracking / support correlation.
func RequestIDHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if rid := chimw.GetReqID(r.Context()); rid != "" {
			w.Header().Set("X-Request-Id", rid)
		}
		next.ServeHTTP(w, r)
	})
}

// ── ErrorLogger: persists 4xx/5xx errors to the ErrorLog table for support ──

// ErrorLogger returns middleware that captures the HTTP status + error headers
// and writes a row to ErrorLog on 4xx/5xx. Best-effort — never blocks the response.
func ErrorLogger(db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			sc := &statusCapture{ResponseWriter: w, status: 0}
			next.ServeHTTP(sc, r)
			if sc.status >= 400 && db != nil {
				logErrorToDB(db, r, sc)
			}
		})
	}
}

// statusCapture wraps http.ResponseWriter to record the final status code.
type statusCapture struct {
	http.ResponseWriter
	status int
}

func (sc *statusCapture) WriteHeader(code int) {
	sc.status = code
	sc.ResponseWriter.WriteHeader(code)
}

func (sc *statusCapture) Write(b []byte) (int, error) {
	if sc.status == 0 {
		sc.status = 200
	}
	return sc.ResponseWriter.Write(b)
}

// logErrorToDB inserts an ErrorLog row with full request context (best-effort).
func logErrorToDB(db *sql.DB, r *http.Request, sc *statusCapture) {
	code := sc.Header().Get("X-Error-Code")
	msg := sc.Header().Get("X-Error-Message")
	if len(msg) > 500 {
		msg = msg[:500]
	}
	var tenantID, userID interface{}
	if tid := GetTenantID(r); tid != "" {
		tenantID = tid
	}
	if uid := GetUserID(r); uid != "" {
		userID = uid
	}
	_, err := db.ExecContext(r.Context(), `
		INSERT INTO "ErrorLog" ("requestId", method, url, "httpStatus", code, message,
			"tenantId", "userId", "ipAddress", "userAgent", resolved, "createdAt")
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7, $8, $9, $10, false, NOW())`,
		chimw.GetReqID(r.Context()), r.Method, r.URL.Path, sc.status, code, msg,
		tenantID, userID, r.RemoteAddr, r.UserAgent(),
	)
	if err != nil {
		log.Printf("ErrorLogger: failed to write ErrorLog row: %v", err)
	}
}
