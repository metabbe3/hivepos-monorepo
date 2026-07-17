package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims mirrors the TypeScript NextAuth JWT shape.
type Claims struct {
	jwt.RegisteredClaims
	UserID               string         `json:"sub"`
	Role                 string         `json:"role"`
	TenantID             string         `json:"tenantId"`
	BranchID             string         `json:"branchId"`
	BranchName           string         `json:"branchName"`
	TenantName           string         `json:"tenantName"`
	TenantSlug           string         `json:"tenantSlug"`
	ActiveModules        []string       `json:"activeModules"`
	ActiveModule         string         `json:"activeModule"`
	Permissions          []string       `json:"permissions"`
	RoleID               string         `json:"roleId"`
	RoleName             string         `json:"roleName"`
	SessionVersion       int            `json:"sessionVersion"`
	FeatureFlags         map[string]bool `json:"featureFlags"`
	OnboardingCompletedAt *string       `json:"onboardingCompletedAt"`
	IsDemo               bool           `json:"isDemo"`
}

type contextKey string

const ClaimsKey contextKey = "claims"

// JWTManager handles token generation/validation.
type JWTManager struct {
	secret []byte
}

func NewJWTManager(secret string) *JWTManager {
	return &JWTManager{secret: []byte(secret)}
}

// Generate creates a signed JWT for the given claims.
func (m *JWTManager) Generate(claims *Claims, duration time.Duration) (string, error) {
	claims.RegisteredClaims = jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// Validate parses + validates a JWT string. It accepts both:
//   - plain HS256 signed JWTs (Go-issued), and
//   - Auth.js v5 JWE-encrypted tokens (issued by the TS/NextAuth app), so tokens
//     minted by the TS app authenticate against this Go backend.
func (m *JWTManager) Validate(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return m.secret, nil
	})
	if err == nil {
		return claims, nil
	}
	// Fall back: Auth.js v5 JWE token (TS/NextAuth-issued).
	if nc, jerr := DecodeNextAuth(tokenStr, string(m.secret)); jerr == nil {
		return nc, nil
	}
	return nil, err
}

// Middleware validates the JWT from the Authorization header (Bearer token)
// or the next-auth cookie, and injects Claims into the request context.
func (m *JWTManager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenStr := extractToken(r)
		if tokenStr == "" {
			next.ServeHTTP(w, r) // Anonymous — handler decides if auth is needed
			return
		}
		claims, err := m.Validate(tokenStr)
		if err != nil {
			next.ServeHTTP(w, r) // Invalid token — treat as anonymous
			return
		}
		ctx := context.WithValue(r.Context(), ClaimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetClaims extracts claims from the request context. Returns nil if not authenticated.
func GetClaims(r *http.Request) *Claims {
	if c, ok := r.Context().Value(ClaimsKey).(*Claims); ok {
		return c
	}
	return nil
}

func extractToken(r *http.Request) string {
	// Bearer token from Authorization header
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	// NextAuth session cookie
	if cookie, err := r.Cookie("next-auth.session-token"); err == nil {
		return cookie.Value
	}
	if cookie, err := r.Cookie("__Secure-next-auth.session-token"); err == nil {
		return cookie.Value
	}
	return ""
}
