package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newMgr() *JWTManager { return NewJWTManager("test-secret") }

func TestJWTRoundTrip(t *testing.T) {
	m := newMgr()
	in := &Claims{UserID: "u1", Role: "ADMIN", TenantID: "t1", BranchID: "b1", Permissions: []string{"orders:read"}}
	tok, err := m.Generate(in, time.Hour)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	out, err := m.Validate(tok)
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if out.UserID != "u1" || out.TenantID != "t1" || out.Role != "ADMIN" || len(out.Permissions) != 1 {
		t.Fatalf("claims lost in round-trip: %+v", out)
	}
}

func TestJWTExpired(t *testing.T) {
	m := newMgr()
	tok, _ := m.Generate(&Claims{UserID: "u1"}, -time.Hour)
	if _, err := m.Validate(tok); err == nil {
		t.Fatal("expired token must fail validation")
	}
}

func TestJWTMalformed(t *testing.T) {
	m := newMgr()
	if _, err := m.Validate("not.a.real.token"); err == nil {
		t.Fatal("malformed token must fail")
	}
	if _, err := m.Validate(""); err == nil {
		t.Fatal("empty token must fail")
	}
}

func TestJWTWrongSecret(t *testing.T) {
	signer := NewJWTManager("secret-a")
	verifier := NewJWTManager("secret-b")
	tok, _ := signer.Generate(&Claims{UserID: "u1"}, time.Hour)
	if _, err := verifier.Validate(tok); err == nil {
		t.Fatal("token signed with a different secret must fail")
	}
}

func TestExtractToken(t *testing.T) {
	cases := []struct {
		name  string
		build func() *http.Request
		want  string
	}{
		{"bearer", func() *http.Request {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.Header.Set("Authorization", "Bearer abc.def.ghi")
			return r
		}, "abc.def.ghi"},
		{"nextauth cookie", func() *http.Request {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.AddCookie(&http.Cookie{Name: "next-auth.session-token", Value: "cookie-val"})
			return r
		}, "cookie-val"},
		{"secure cookie", func() *http.Request {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.AddCookie(&http.Cookie{Name: "__Secure-next-auth.session-token", Value: "secure-val"})
			return r
		}, "secure-val"},
		{"none", func() *http.Request {
			return httptest.NewRequest(http.MethodGet, "/", nil)
		}, ""},
		{"non-bearer auth header ignored", func() *http.Request {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.Header.Set("Authorization", "Basic abc")
			return r
		}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := extractToken(c.build()); got != c.want {
				t.Fatalf("extractToken = %q, want %q", got, c.want)
			}
		})
	}
}

func TestMiddleware(t *testing.T) {
	m := newMgr()
	tok, _ := m.Generate(&Claims{UserID: "u1"}, time.Hour)

	handler := m.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := GetClaims(r)
		if c == nil {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("anon"))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(c.UserID))
	}))

	// valid token → claims propagated
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	handler.ServeHTTP(rec, req)
	if rec.Body.String() != "u1" {
		t.Fatalf("valid token: body = %q, want u1", rec.Body.String())
	}

	// invalid token → treated as anonymous (still 200, not rejected)
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.Header.Set("Authorization", "Bearer garbage")
	handler.ServeHTTP(rec2, req2)
	if rec2.Body.String() != "anon" {
		t.Fatalf("invalid token: body = %q, want anon", rec2.Body.String())
	}

	// no token → anonymous
	rec3 := httptest.NewRecorder()
	handler.ServeHTTP(rec3, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec3.Body.String() != "anon" {
		t.Fatalf("no token: body = %q, want anon", rec3.Body.String())
	}
}
