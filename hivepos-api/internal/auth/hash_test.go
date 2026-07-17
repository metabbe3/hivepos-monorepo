package auth_test

import (
	"strings"
	"testing"

	"github.com/hivepos/api/internal/auth"
)

func TestHashPasswordRoundTrip(t *testing.T) {
	hash, err := auth.HashPassword("hunter2")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if hash == "" || hash == "hunter2" {
		t.Fatal("hash empty or equals plaintext")
	}
	if !strings.HasPrefix(hash, "$2") {
		t.Fatalf("not a bcrypt hash: %q", hash)
	}
	if err := auth.ComparePassword(hash, "hunter2"); err != nil {
		t.Fatalf("ComparePassword correct pw: %v", err)
	}
}

func TestComparePasswordMismatch(t *testing.T) {
	hash, _ := auth.HashPassword("right")
	if err := auth.ComparePassword(hash, "wrong"); err == nil {
		t.Fatal("mismatched password must error")
	}
}

func TestComparePasswordEmptyInputs(t *testing.T) {
	hash, _ := auth.HashPassword("x")
	// empty plaintext against real hash → mismatch
	if err := auth.ComparePassword(hash, ""); err == nil {
		t.Fatal("empty plaintext must not match")
	}
	// empty/garbage hash → error, never panic
	if err := auth.ComparePassword("", "x"); err == nil {
		t.Fatal("empty hash must error")
	}
	if err := auth.ComparePassword("not-a-bcrypt-hash", "x"); err == nil {
		t.Fatal("garbage hash must error")
	}
}

func TestHashPasswordEmpty(t *testing.T) {
	// bcrypt happily hashes the empty string; it must just not equal "" and be verifiable
	hash, err := auth.HashPassword("")
	if err != nil {
		t.Fatalf("HashPassword empty: %v", err)
	}
	if err := auth.ComparePassword(hash, ""); err != nil {
		t.Fatalf("empty round-trip must verify: %v", err)
	}
}

func TestHashPasswordLongInput(t *testing.T) {
	// bcrypt truncates at 72 bytes; hashing must not error on long input
	long := strings.Repeat("a", 5000)
	if _, err := auth.HashPassword(long); err != nil {
		t.Fatalf("long input: %v", err)
	}
}
