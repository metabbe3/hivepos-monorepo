// Command migrate is the operator-facing schema migration tool for hivepos-api.
//
// Schema ownership moved from pos-saas's `prisma db push` (no journal) to golang-migrate
// (forward-only, journal = schema_migrations_go). The server NEVER applies DDL — this
// command is the only path. Everything here is data-preserving:
//
//	baseline — adopt ownership of the ALREADY-PRESENT live schema without executing the
//	           dump (Force to the embedded head). Run ONCE on an existing DB. No data touched.
//	up       — apply pending forward migrations. No-op at head. Never runs Down.
//	version  — print applied journal version vs compiled-in expected head.
//	force v  — set the journal version without executing (repair a dirty journal).
//	create n — scaffold a new empty forward migration pair 00000N_<n>.{up,down}.sql
//
// Usage:
//
//	go run ./cmd/migrate baseline
//	go run ./cmd/migrate up
//	go run ./cmd/migrate version
//	go run ./cmd/migrate force 3
//	go run ./cmd/migrate create add_user_avatar
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/hivepos/api/internal/config"
	"github.com/hivepos/api/internal/database"
)

func usage() {
	fmt.Fprintln(os.Stderr, `migrate — hivepos-api schema migration tool (forward-only, no data loss)

commands:
  baseline           adopt ownership of the present live schema (Force to head; run once)
  up                 apply pending forward migrations (no-op at head)
  version            show applied vs expected migration version
  force <v>          set journal version without executing (repair dirty)
  create <name>      scaffold a new migration pair`)
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		os.Exit(1)
	}
	dbURL := cfg.DatabaseURL

	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	cmd := os.Args[1]

	switch cmd {
	case "baseline":
		head, err := database.ExpectedHead()
		must(err)
		must(database.Force(dbURL, int(head)))
		fmt.Printf("baseline applied: schema_migrations_go forced to v%d (ownership adopted, no data touched)\n", head)

	case "up":
		must(database.RunUp(dbURL))
		applied, dirty, err := database.AppliedVersion(dbURL)
		must(err)
		fmt.Printf("migrations up to date: v%d (dirty=%v)\n", applied, dirty)

	case "version":
		expected, err := database.ExpectedHead()
		must(err)
		applied, dirty, err := database.AppliedVersion(dbURL)
		if err != nil {
			if database.IsJournalMissing(err) {
				fmt.Printf("expected v%d | journal not found (run `baseline`)\n", expected)
			} else {
				fmt.Fprintf(os.Stderr, "expected v%d | error: %v\n", expected, err)
				os.Exit(1)
			}
			return
		}
		state := "up to date"
		switch {
		case dirty:
			state = "DIRTY — run `force <applied>` after verifying partial state"
		case applied < expected:
			state = fmt.Sprintf("BEHIND — run `up` (applied v%d < expected v%d)", applied, expected)
		case applied > expected:
			state = "AHEAD — DB has migrations this binary lacks"
		}
		fmt.Printf("applied v%d | expected v%d | %s\n", applied, expected, state)

	case "force":
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "force requires a version argument")
			os.Exit(2)
		}
		var v int
		_, err := fmt.Sscanf(os.Args[2], "%d", &v)
		must(err)
		must(database.Force(dbURL, v))
		fmt.Printf("journal forced to v%d\n", v)

	case "create":
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "create requires a name argument")
			os.Exit(2)
		}
		name := strings.ToLower(strings.TrimSpace(os.Args[2]))
		name = strings.ReplaceAll(name, " ", "_")
		dir := mustDir()
		// next version = max existing + 1
		head, err := database.ExpectedHead()
		must(err)
		next := int(head) + 1
		prefix := fmt.Sprintf("%06d_%s", next, name)
		must(os.WriteFile(filepath.Join(dir, prefix+".up.sql"), []byte("-- "+name+" up\n\n"), 0o644))
		must(os.WriteFile(filepath.Join(dir, prefix+".down.sql"), []byte("-- "+name+" down (forward-only project; populate only if a reversible fix is truly needed)\n\n"), 0o644))
		fmt.Printf("created %s/*.sql\n", prefix)

	default:
		usage()
		os.Exit(2)
	}
}

func must(err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "migrate: %v\n", err)
		os.Exit(1)
	}
}

// mustDir resolves the migrations dir on disk (for `create`). Run from the hivepos-api
// repo root (same place you run `go run ./cmd/migrate ...`) so the relative path resolves.
func mustDir() string {
	return filepath.Join("internal", "database", "migrations")
}
