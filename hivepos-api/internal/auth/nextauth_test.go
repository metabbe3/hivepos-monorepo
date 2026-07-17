package auth

import (
	"encoding/hex"
	"strings"
	"testing"
	"time"
)

// TestCEK_MatchesAuthJS pins that Go's HKDF derivation is byte-identical to
// @auth/core's (@panva/hkdf). CEK for the dev secret was generated with Node.
func TestCEK_MatchesAuthJS(t *testing.T) {
	cek, err := cekRaw("pos-sa...2026", "authjs.session-token")
	if err != nil {
		t.Fatal(err)
	}
	const want = "7e6305d5ef99821152062f09e1db155ffb4e5083be45f67a8428c3d4f724bd99d8b18351dc1f27a1de513ff40d509b5d613bf0de45f57cf8e763c480aabb184a"
	if got := hex.EncodeToString(cek); got != want {
		t.Fatalf("CEK mismatch with @auth/core:\n got %s\nwant %s", got, want)
	}
}

func TestNextAuth_RoundTrip(t *testing.T) {
	in := &Claims{UserID: "u1", Role: "STAFF", TenantID: "t9", BranchID: "b2", Permissions: []string{"orders:read"}}
	tok, err := EncodeNextAuth(in, "the-secret", 3600)
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	// JWE compact = 5 dot-separated parts; NOT a JWT (no "eyJhbGci" JWS header alone).
	if strings.Count(tok, ".") != 4 {
		t.Fatalf("token not 5-part JWE: %q", tok)
	}
	out, err := DecodeNextAuth(tok, "the-secret")
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if out.UserID != "u1" || out.TenantID != "t9" || out.Role != "STAFF" || len(out.Permissions) != 1 {
		t.Fatalf("claims lost in round-trip: %+v", out)
	}
}

func TestNextAuth_WrongSecret(t *testing.T) {
	tok, _ := EncodeNextAuth(&Claims{UserID: "u1"}, "secret-a", 3600)
	if _, err := DecodeNextAuth(tok, "secret-b"); err == nil {
		t.Fatal("decode with wrong secret must fail (tag mismatch)")
	}
}

func TestNextAuth_Malformed(t *testing.T) {
	if _, err := DecodeNextAuth("not.valid", "s"); err == nil {
		t.Fatal("malformed token must error")
	}
	if _, err := DecodeNextAuth("a.b.c.d.e", "s"); err == nil {
		t.Fatal("garbage 5-part token must error")
	}
}

func TestValidate_AcceptsBothTokenShapes(t *testing.T) {
	m := NewJWTManager("dual-secret")
	// HS256 (Go Generate)
	hsTok, _ := m.Generate(&Claims{UserID: "hs-user"}, time.Hour)
	if c, err := m.Validate(hsTok); err != nil || c.UserID != "hs-user" {
		t.Fatalf("HS256 validate failed: %v / %+v", err, c)
	}
	// JWE (NextAuth)
	jweTok, _ := EncodeNextAuth(&Claims{UserID: "jwe-user"}, "dual-secret", 3600)
	if c, err := m.Validate(jweTok); err != nil || c.UserID != "jwe-user" {
		t.Fatalf("JWE validate failed: %v / %+v", err, c)
	}
	// garbage still rejected
	if _, err := m.Validate("garbage"); err == nil {
		t.Fatal("garbage token must be rejected")
	}
}
