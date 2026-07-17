// dbq fetches one active user/tenant from the shared DB for parity diagnostics.
// Usage: go run ./scripts/dbq <databaseURL>
package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	db, err := sql.Open("pgx", os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, "open:", err)
		os.Exit(1)
	}
	defer db.Close()
	var id, tenant, role sql.NullString
	err = db.QueryRow(`select id, "tenantId", role from "User" where "isActive" = true limit 1`).
		Scan(&id, &tenant, &role)
	if err != nil {
		fmt.Fprintln(os.Stderr, "query:", err)
		os.Exit(1)
	}
	fmt.Printf("%s\t%s\t%s\n", id.String, tenant.String, role.String)
}
