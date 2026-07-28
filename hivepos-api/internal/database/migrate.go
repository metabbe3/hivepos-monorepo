package database

// Schema migration ownership for hivepos-api.
//
// pos-saas (legacy) applied the pos_saas schema via `prisma db push` — there is NO
// Prisma migration journal and NO `_prisma_migrations` table. The live DB was the only
// record of the schema. hivepos-api read/wrote those tables via raw SQL with zero
// migration ownership, so a column change could never be coordinated.
//
// This package adopts ownership with golang-migrate, forward-only:
//
//   - migrations/000001_baseline.up.sql  — a `pg_dump --schema-only` snapshot of the live
//     schema (the trust root). It is marked already-applied via `Force` (see cmd/migrate
//     baseline), NEVER replayed against the live DB. On a fresh/CI DB, `up` runs it to
//     recreate the schema.
//   - journal table = schema_migrations_go (distinct name; never collides with Prisma).
//   - Boot: CheckSchema is READ-ONLY. It queries the journal and warns/refuses — it NEVER
//     applies DDL automatically. Refusing to boot stops serving but leaves all data intact.
//
// Data-loss guard: there is no Down() path exposed to the server. Rollback is forward-fix.
// The baseline .down.sql is intentionally empty (version 0 is the floor).

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5" // registers the "pgx5" scheme
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// MigrationsTable is the golang-migrate journal. Suffixed _go so it can never collide
// with a (currently absent) Prisma `_prisma_migrations` table.
const MigrationsTable = "schema_migrations_go"

// pgxScheme is the URL scheme golang-migrate's pgx/v5 driver registers.
const pgxScheme = "pgx5"

func dsnForMigrate(databaseURL string) string {
	// golang-migrate takes x-migrations-table as a query param on the DB URL, and its
	// pgx5 driver wants its OWN scheme — strip a leading postgres(ql):// so we don't
	// produce `pgx5://postgresql://...` (the driver misparses the nested scheme and
	// tries to resolve host "postgresql").
	dsn := databaseURL
	dsn = strings.TrimPrefix(dsn, "postgresql://")
	dsn = strings.TrimPrefix(dsn, "postgres://")
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	return pgxScheme + "://" + dsn + sep + "x-migrations-table=" + MigrationsTable
}

func newMigrate(databaseURL string) (*migrate.Migrate, error) {
	src, err := iofs.New(migrationFS, "migrations")
	if err != nil {
		return nil, fmt.Errorf("migration source: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dsnForMigrate(databaseURL))
	if err != nil {
		return nil, fmt.Errorf("migrate init: %w", err)
	}
	return m, nil
}

// RunUp applies all pending forward migrations. No-op when already at head.
// NEVER runs Down. Operator-invoked only (cmd/migrate), not at boot.
func RunUp(databaseURL string) error {
	m, err := newMigrate(databaseURL)
	if err != nil {
		return err
	}
	defer m.Close()
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}

// Force sets the journal version without executing migrations. Used once to adopt
// ownership of the already-present live schema (baseline) without touching data.
func Force(databaseURL string, version int) error {
	m, err := newMigrate(databaseURL)
	if err != nil {
		return err
	}
	defer m.Close()
	return m.Force(version)
}

// AppliedVersion returns (version, dirty). version==0 + ErrNilVersion means no journal yet.
func AppliedVersion(databaseURL string) (version uint, dirty bool, err error) {
	m, err := newMigrate(databaseURL)
	if err != nil {
		return 0, false, err
	}
	defer m.Close()
	v, d, e := m.Version()
	return v, d, e
}

// IsJournalMissing reports whether err is the "no migration applied yet" sentinel
// (vs a real connect/parse error). Lets callers tell "run baseline" from "DB broken".
func IsJournalMissing(err error) bool {
	return errors.Is(err, migrate.ErrNilVersion)
}

// ExpectedHead is the highest migration version embedded in the binary.
func ExpectedHead() (uint, error) {
	entries, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		return 0, fmt.Errorf("read embedded migrations: %w", err)
	}
	var versions []int
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		parts := strings.SplitN(name, "_", 2)
		n, perr := strconv.Atoi(parts[0])
		if perr != nil {
			return 0, fmt.Errorf("unparseable migration filename %q: %w", name, perr)
		}
		versions = append(versions, n)
	}
	sort.Ints(versions)
	if len(versions) == 0 {
		return 0, fmt.Errorf("no embedded migrations")
	}
	return uint(versions[len(versions)-1]), nil
}

// SchemaStatus is the read-only boot check result.
type SchemaStatus struct {
	OK            bool   // safe to serve
	JournalExists bool   // schema_migrations_go present
	Applied       uint   // applied journal version (0 if no journal)
	Expected      uint   // compiled-in expected head
	Dirty         bool   // a migration partially applied (needs Force)
	Action        string // operator action to take when !OK
}

// CheckSchema is READ-ONLY. It queries the journal and decides whether serving is safe.
// It NEVER applies DDL. Refusing (OK=false) halts serving but preserves all data.
//
// Bootstrapping: the live DB has the schema but no journal until an operator runs
// `cmd/migrate baseline`. Until then we WARN (OK=true, Action set) rather than fatal —
// adopting migration ownership must not take down the running system.
func CheckSchema(databaseURL string) (SchemaStatus, error) {
	expected, err := ExpectedHead()
	if err != nil {
		return SchemaStatus{}, err
	}
	st := SchemaStatus{Expected: expected}

	applied, dirty, verr := AppliedVersion(databaseURL)
	if verr != nil {
		if errors.Is(verr, migrate.ErrNilVersion) {
			// No journal yet — schema is the unadopted db-push state. Warn, don't fatal:
			// refusing here would lock out the live system before ownership is adopted.
			st.OK = true
			st.Action = "schema_migrations_go not found — run `go run ./cmd/migrate baseline` to adopt migration ownership (no data touched)"
			return st, nil
		}
		return st, fmt.Errorf("read schema journal: %w", verr)
	}

	st.JournalExists = true
	st.Applied = applied
	st.Dirty = dirty

	switch {
	case dirty:
		st.OK = false
		st.Action = fmt.Sprintf(
			"schema journal is DIRTY at v%d — a migration partially applied. Resolve with `go run ./cmd/migrate force %d` (after verifying the partial state).", applied, applied)
	case applied < expected:
		st.OK = false
		st.Action = fmt.Sprintf(
			"schema BEHIND code (applied v%d, expected v%d) — run `go run ./cmd/migrate up` (forward-only, no data loss).", applied, expected)
	case applied > expected:
		// DB ahead of this binary — old code against newer DB. Warn but serve.
		st.OK = true
		st.Action = fmt.Sprintf(
			"schema AHEAD of code (applied v%d, expected v%d) — DB has migrations this binary doesn't ship; deploy the matching build.", applied, expected)
	default:
		st.OK = true
	}
	return st, nil
}
