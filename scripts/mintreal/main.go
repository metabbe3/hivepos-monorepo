// mintreal mints a JWE token carrying a user's REAL DB-derived permissions
// (User → Role.permissions), so Go's RequireResource checks the same perms TS does.
// Usage: go run ./scripts/mintreal <databaseURL> <secret> <userId>
package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"

	"github.com/hivepos/api/internal/auth"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	if len(os.Args) < 4 {
		fmt.Fprintln(os.Stderr, "usage: mintreal <databaseURL> <secret> <userId>")
		os.Exit(2)
	}
	dbURL, secret, userID := os.Args[1], os.Args[2], os.Args[3]

	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open:", err)
		os.Exit(1)
	}
	defer db.Close()
	var tenantID, role, branchID, permsJSON sql.NullString
	err = db.QueryRow(
		`SELECT u."tenantId", u.role, u."branchId", COALESCE(array_to_json(r.permissions), '[]')
		 FROM "User" u LEFT JOIN "Role" r ON r.id = u."roleId" WHERE u.id = $1`, userID,
	).Scan(&tenantID, &role, &branchID, &permsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, "query:", err)
		os.Exit(1)
	}
	var perms []string
	_ = json.Unmarshal([]byte(permsJSON.String), &perms)

	tok, err := auth.EncodeNextAuth(&auth.Claims{
		UserID:      userID,
		Role:        role.String,
		TenantID:    tenantID.String,
		BranchID:    branchID.String,
		Permissions: perms,
	}, secret, 8*60*60)
	if err != nil {
		fmt.Fprintln(os.Stderr, "mint:", err)
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "user=%s role=%s tenant=%s branch=%s perms=%v\n", userID, role.String, tenantID.String, branchID.String, perms)
	fmt.Print(tok)
}
