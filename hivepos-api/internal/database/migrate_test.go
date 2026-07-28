package database

import (
	"io/fs"
	"strings"
	"testing"
)

// ExpectedHead parses the leading version of every embedded migration. If a future
// migration is mis-named (no numeric prefix), this fails loudly — guarding the boot
// check's "expected" value from silently drifting.
func TestExpectedHead(t *testing.T) {
	head, err := ExpectedHead()
	if err != nil {
		t.Fatalf("ExpectedHead: %v", err)
	}
	if head == 0 {
		t.Fatal("ExpectedHead = 0; no migrations embedded")
	}

	// Every embedded migration must have a matching up/down pair and a numeric prefix,
	// or the boot check + golang-migrate will disagree about what "head" means.
	entries, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		t.Fatalf("read migrations dir: %v", err)
	}
	up, down := map[string]bool{}, map[string]bool{}
	for _, e := range entries {
		n := e.Name()
		if !strings.HasSuffix(n, ".sql") {
			t.Fatalf("unexpected non-sql file in migrations: %s", n)
		}
		base := strings.TrimSuffix(n, ".sql")
		parts := strings.SplitN(base, "_", 2)
		if parts[0] == "" || !allDigits(parts[0]) {
			t.Fatalf("migration %q missing numeric version prefix", n)
		}
		switch {
		case strings.HasSuffix(base, ".up"):
			up[strings.TrimSuffix(base, ".up")] = true
		case strings.HasSuffix(base, ".down"):
			down[strings.TrimSuffix(base, ".down")] = true
		default:
			t.Fatalf("migration %q is neither .up nor .down", n)
		}
	}
	for k := range up {
		if !down[k] {
			t.Fatalf("migration %s has .up.sql but no .down.sql", k)
		}
	}
}

func allDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
