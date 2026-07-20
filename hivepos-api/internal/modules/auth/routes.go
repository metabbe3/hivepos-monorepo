package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	oauth2svc "google.golang.org/api/oauth2/v2"

	appauth "github.com/hivepos/api/internal/auth"
	"github.com/hivepos/api/internal/modules/auth/application"
	"github.com/hivepos/api/internal/modules/auth/domain"
	"github.com/hivepos/api/internal/modules/auth/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the auth HTTP domain: repository → service → HTTP handlers.
// Unlike other modules, it also holds a *appauth.JWTManager because login and
// registration must mint JWTs.
type Module struct {
	svc      *application.Service
	jwt      *appauth.JWTManager
	google   *oauth2.Config // nil when GOOGLE_CLIENT_ID not configured
	feOrigin string         // frontend origin for post-OAuth redirect (e.g. http://localhost:3008)
	secret   string         // JWT secret — used to HMAC-sign the OAuth state + link cookies
}

// NewModule takes the DB, JWTManager, and Google OAuth config. db is interface{}
// to match the sibling-module convention (cast to *sql.DB internally).
func NewModule(db interface{}, jwt *appauth.JWTManager, googleClientID, googleSecret, googleRedirectURI, feOrigin, secret string) *Module {
	repo := infrastructure.NewPgAuthRepository(db.(*sql.DB))
	m := &Module{
		svc:      application.NewService(repo),
		jwt:      jwt,
		feOrigin: feOrigin,
		secret:   secret,
	}
	if googleClientID != "" && googleSecret != "" {
		m.google = &oauth2.Config{
			ClientID:     googleClientID,
			ClientSecret: googleSecret,
			RedirectURL:  googleRedirectURI,
			Endpoint:     google.Endpoint,
			Scopes:       []string{"openid", "email", "profile"},
		}
	}
	return m
}

// Register mounts the auth sub-router: /login, /session-version, /me, /google.
// Mount this under /api/auth in main.go. loginLimiter is applied ONLY to /login
// (the credential-submission / brute-force target); /me, /session-version, and the
// Google routes are high-frequency or already CSRF/Google-guarded, so throttling
// them (as a blanket group limit did) locks out normal browsing — the web hits
// /me on every page load and polls /session-version.
func (m *Module) Register(r chi.Router, loginLimiter func(http.Handler) http.Handler) {
	r.With(loginLimiter).Post("/login", m.login)
	r.Post("/logout", m.logout)
	r.Post("/session-version", m.bumpSessionVersion)
	r.Get("/session-version", m.getSessionVersion)
	r.Get("/me", m.me)
	r.Get("/google", m.googleStart)
	r.Get("/callback/google", m.googleCallback)
	r.Post("/google/link", m.googleLinkStart)
	r.Delete("/google/unlink", m.googleUnlink)
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

	// Scope gates the auth table: "super-admin" → SuperAdmin (platform staff),
	// else → User (tenant). Mirrors legacy pos-saas authorize() scope gate.
	var (
		uc  *domain.UserContext
		err error
	)
	if input.Scope == "super-admin" {
		uc, err = m.svc.LoginSuperAdmin(req.Context(), input)
	} else {
		uc, err = m.svc.Login(req.Context(), input)
	}
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

// POST /logout — clear all session cookies. hivepos-web's signOut() calls this so the
// httpOnly next-auth.session-token cookie (legacy pos-saas, honored by extractToken's
// fallback) is dropped alongside the localStorage JWT. Without this, a tenant logout
// leaves the super-admin session alive via the surviving cookie.
func (m *Module) logout(w http.ResponseWriter, _ *http.Request) {
	clearCookie(w, "next-auth.session-token")
	// __Secure- prefixed cookies require the Secure attribute on EVERY Set-Cookie
	// (deletion included) or the browser rejects it — so the plain clearCookie helper
	// (no Secure) would silently fail to drop this one on https://hivepos.id.
	http.SetCookie(w, &http.Cookie{
		Name: "__Secure-next-auth.session-token", Value: "", MaxAge: -1,
		Path: "/", Secure: true, SameSite: http.SameSiteLaxMode,
	})
	apphttp.Success(w, map[string]any{"ok": true})
}

// POST /  (mounted at /api/register)  {tenantName, tenantSlug, ownerName, email, password, module, branchName, phone?}
func (m *Module) register(w http.ResponseWriter, req *http.Request) {
	var input domain.RegisterInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	// Password is required only for the email flow. The Google flow sends a
	// googleId and no password (the FE hides the field), so the account must
	// authenticate via Google OAuth only — see the unusable-hash handling below.
	needsPassword := input.GoogleID == ""
	if input.TenantName == "" || input.TenantSlug == "" || input.OwnerName == "" ||
		input.Email == "" || input.Module == "" || input.BranchName == "" ||
		(needsPassword && input.Password == "") {
		apphttp.ValidationError(w, "tenantName, tenantSlug, ownerName, email, module, branchName are required (password required unless googleId is present)")
		return
	}

	// Google-only accounts have no user-supplied password. Hash a random
	// never-revealed secret instead so the NOT NULL passwordHash column is
	// satisfied AND credential login always fails (the plaintext is discarded).
	// The account authenticates only via Google (FindUserByGoogleID).
	plain := input.Password
	if !needsPassword {
		plain = randHex(32)
	}
	hash, err := appauth.HashPassword(plain)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	tenantID, userID, branchID, err := m.svc.Register(req.Context(), input, hash)
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

// GET /session-version — returns the caller's current sessionVersion (no bump).
// useSessionSync polls this to detect admin-triggered permission reloads.
func (m *Module) getSessionVersion(w http.ResponseWriter, req *http.Request) {
	claims := appauth.GetClaims(req)
	if claims == nil {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	v, err := m.svc.GetSessionVersion(req.Context(), claims.UserID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"sessionVersion": v})
}

// GET /me — returns the current user + claims. Accepts Bearer (new web stores
// the JWT in localStorage) OR the NextAuth session cookie (legacy TS web). The
// JWT middleware already validates both into the request context, so prefer that;
// the explicit cookie parse remains as a defensive fallback.
func (m *Module) me(w http.ResponseWriter, req *http.Request) {
	claims := appauth.GetClaims(req)
	if claims == nil {
		// Fallback: NextAuth session cookie (legacy TS app).
		if cookie, cerr := req.Cookie("next-auth.session-token"); cerr == nil && cookie.Value != "" {
			claims, _ = m.jwt.Validate(cookie.Value)
		}
		if claims == nil {
			if cookie, cerr := req.Cookie("__Secure-next-auth.session-token"); cerr == nil && cookie.Value != "" {
				claims, _ = m.jwt.Validate(cookie.Value)
			}
		}
	}
	if claims == nil {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}

	uc, err := m.svc.LoadContextForRole(req.Context(), claims.UserID, claims.Role)
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
			"tenantId":     claims.TenantID,
			"branchId":     claims.BranchID,
			"branchName":   uc.BranchName,
			"tenantName":   uc.TenantName,
			"role":         claims.Role,
			"permissions":  claims.Permissions,
			"featureFlags": uc.FeatureFlags,
		},
	})
}

// GET /google — kick off Google OAuth: redirect to Google's consent screen.
// GET /google — kick off Google OAuth. A random state is HMAC-signed into a
// short-lived cookie + sent to Google; the callback verifies both (CSRF).
func (m *Module) googleStart(w http.ResponseWriter, req *http.Request) {
	if m.google == nil {
		apphttp.Error(w, http.StatusServiceUnavailable, "Google OAuth not configured")
		return
	}
	// Always use the platform domain for the Google redirect_uri (Google Console registers
	// a fixed set of authorized redirect URIs — can't add every tenant subdomain).
	host := req.Host
	if h := req.Header.Get("X-Forwarded-Host"); h != "" {
		host = h
	}
	var dynamicRedirect string
	if strings.HasPrefix(host, "localhost") || strings.HasPrefix(host, "127.0.0.1") {
		dynamicRedirect = fmt.Sprintf("http://%s/api/auth/callback/google", host)
	} else {
		dynamicRedirect = "https://hivepos.id/api/auth/callback/google"
	}

	// Stash the origin host so the callback can redirect back to the tenant subdomain.
	// Use Domain=.hivepos.id so the cookie is shared across subdomains (the callback
	// lands on hivepos.id but the user started on honey-bee-laundry.hivepos.id).
	cookieDomain := ""
	if h := host; !strings.HasPrefix(h, "localhost") && !strings.HasPrefix(h, "127.0.0.1") {
		parts := strings.Split(h, ".")
		if len(parts) >= 2 {
			cookieDomain = "." + strings.Join(parts[len(parts)-2:], ".")
		}
	}
	http.SetCookie(w, &http.Cookie{
		Name: "oauth_origin", Value: host, MaxAge: 600,
		Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, Domain: cookieDomain,
	})

	cfg := *m.google
	cfg.RedirectURL = dynamicRedirect

	state := randHex(16)
	http.SetCookie(w, &http.Cookie{
		Name: "google_oauth_state", Value: m.sign(state), MaxAge: 600,
		Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, Domain: cookieDomain,
	})
	http.Redirect(w, req, cfg.AuthCodeURL(state), http.StatusFound)
}

// POST /google/link — Bearer-gated. Start linking Google to the LOGGED-IN user:
// stash a signed cookie carrying their userID, then return the consent URL.
func (m *Module) googleLinkStart(w http.ResponseWriter, req *http.Request) {
	if m.google == nil {
		apphttp.Error(w, http.StatusServiceUnavailable, "Google OAuth not configured")
		return
	}
	claims := appauth.GetClaims(req)
	if claims == nil {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	state := randHex(16)
	// Cookie value = userID|state, HMAC-signed. The callback links (not logs in).
	http.SetCookie(w, &http.Cookie{
		Name: "google_link", Value: m.sign(claims.UserID + "|" + state), MaxAge: 600,
		Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	apphttp.Success(w, map[string]any{"url": m.google.AuthCodeURL(state)})
}

// DELETE /google/unlink — Bearer-gated. Remove the Google link from the logged-in user.
func (m *Module) googleUnlink(w http.ResponseWriter, req *http.Request) {
	claims := appauth.GetClaims(req)
	if claims == nil {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	if err := m.svc.ClearGoogleID(req.Context(), claims.UserID); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]any{"ok": true})
}

// GET /google/callback — Google redirects here with ?code&state. Verify the state
// cookie (CSRF). If a google_link cookie is present + valid, link the googleId to
// that user; otherwise resolve/link-by-email + mint a login JWT.
func (m *Module) googleCallback(w http.ResponseWriter, req *http.Request) {
	if m.google == nil {
		apphttp.Error(w, http.StatusServiceUnavailable, "Google OAuth not configured")
		return
	}
	// CSRF: query state must match the signed state cookie.
	if !m.verifyCookie(req, "google_oauth_state", req.URL.Query().Get("state")) {
		apphttp.Error(w, http.StatusBadRequest, "invalid state")
		return
	}
	clearCookie(w, "google_oauth_state")

	code := req.URL.Query().Get("code")
	if code == "" {
		apphttp.ValidationError(w, "missing code")
		return
	}

	// Reconstruct the same redirect_uri used in googleStart — Google validates it matches
	// between the auth request and the token exchange.
	originHost := req.Host
	if originCookie, cerr := req.Cookie("oauth_origin"); cerr == nil && originCookie.Value != "" {
		originHost = originCookie.Value
	}
	var exchangeRedirect string
	if strings.HasPrefix(originHost, "localhost") || strings.HasPrefix(originHost, "127.0.0.1") {
		exchangeRedirect = fmt.Sprintf("http://%s/api/auth/callback/google", originHost)
	} else {
		exchangeRedirect = "https://hivepos.id/api/auth/callback/google"
	}
	exchangeCfg := *m.google
	exchangeCfg.RedirectURL = exchangeRedirect

	tok, err := exchangeCfg.Exchange(req.Context(), code)
	if err != nil {
		apphttp.Error(w, http.StatusBadGateway, "google token exchange failed: "+err.Error())
		return
	}
	svc, err := oauth2svc.New(m.google.Client(req.Context(), tok))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "google userinfo client: "+err.Error())
		return
	}
	info, err := svc.Userinfo.Get().Do()
	if err != nil {
		apphttp.Error(w, http.StatusBadGateway, "google userinfo failed: "+err.Error())
		return
	}

	// Reuse originHost (already extracted above for the Exchange redirect_uri).
	clearCookie(w, "oauth_origin")
	var originScheme string
	if strings.HasPrefix(originHost, "localhost") || strings.HasPrefix(originHost, "127.0.0.1") {
		originScheme = "http"
	} else {
		originScheme = "https"
	}
	originBase := fmt.Sprintf("%s://%s", originScheme, originHost)

	// Profile-link mode: a valid google_link cookie carries the user to link.
	if linkVal, ok := m.cookiePayload(req, "google_link"); ok {
		clearCookie(w, "google_link")
		userID := linkVal
		if i := indexOf(linkVal, '|'); i >= 0 {
			userID = linkVal[:i]
		}
		if err := m.svc.SetGoogle(req.Context(), userID, info.Id, info.Picture); err != nil {
			apphttp.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		http.Redirect(w, req, originBase+"/profile?linked=google", http.StatusFound)
		return
	}

	uc, err := m.svc.GoogleLogin(req.Context(), info.Email, info.Id, info.Picture)
	if err != nil {
		if errors.Is(err, application.ErrGoogleUserNotFound) {
			u := originBase + "/register?googleEmail=" + info.Email + "&googleName=" + info.Name + "&googleId=" + info.Id
			http.Redirect(w, req, u, http.StatusFound)
			return
		}
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	jwt, err := m.mintToken(uc)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "failed to issue token")
		return
	}
	http.Redirect(w, req, originBase+"/login?googleToken="+jwt, http.StatusFound)
}

// GET /google/e2e-test?email=X — Dev-only: simulates the post-Exchange path of the Google
// OAuth callback (skips Exchange/UserInfo, calls GoogleLogin + mintToken directly).
// Proves: GoogleLogin(real DB) → mintToken → redirect → frontend session establishment.
func (m *Module) googleE2ETest(w http.ResponseWriter, req *http.Request) {
	email := req.URL.Query().Get("email")
	if email == "" {
		email = "admin@laundry.com"
	}
	uc, err := m.svc.GoogleLogin(req.Context(), email, "e2e_test_google_id", "")
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "GoogleLogin: "+err.Error())
		return
	}
	jwt, err := m.mintToken(uc)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "mintToken: "+err.Error())
		return
	}
	// Same redirect the real callback produces.
	originHost := req.Host
	if originCookie, cerr := req.Cookie("oauth_origin"); cerr == nil && originCookie.Value != "" {
		originHost = originCookie.Value
	}
	scheme := "https"
	if strings.HasPrefix(originHost, "localhost") || strings.HasPrefix(originHost, "127.0.0.1") {
		scheme = "http"
	}
	http.Redirect(w, req, fmt.Sprintf("%s://%s/login?googleToken=%s", scheme, originHost, jwt), http.StatusFound)
}

// sign returns payload + "." + hmac(payload) (hex).
func (m *Module) sign(payload string) string {
	mac := hmac.New(sha256.New, []byte(m.secret))
	mac.Write([]byte(payload))
	return payload + "." + hex.EncodeToString(mac.Sum(nil))
}

// verifyCookie checks the cookie value is a valid payload.hmac for `want`.
func (m *Module) verifyCookie(req *http.Request, name, want string) bool {
	v, ok := m.cookiePayload(req, name)
	return ok && hmac.Equal([]byte(v), []byte(want))
}

// cookiePayload returns the payload part of a signed cookie (if the HMAC matches).
func (m *Module) cookiePayload(req *http.Request, name string) (string, bool) {
	c, err := req.Cookie(name)
	if err != nil || c.Value == "" {
		return "", false
	}
	i := indexOf(c.Value, '|') // payload itself won't contain '|' except the link cookie
	dot := len(c.Value)
	for k := 0; k < len(c.Value); k++ {
		if c.Value[k] == '.' {
			dot = k
			break
		}
	}
	payload, macHex := c.Value[:dot], c.Value[dot+1:]
	mac := hmac.New(sha256.New, []byte(m.secret))
	mac.Write([]byte(payload))
	if !hmac.Equal([]byte(macHex), []byte(hex.EncodeToString(mac.Sum(nil)))) {
		return "", false
	}
	_ = i
	return payload, true
}

func clearCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: "", MaxAge: -1, Path: "/"})
}

func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func indexOf(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
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
	return m.jwt.Generate(claims, 60*24*time.Hour) // 60 days
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
