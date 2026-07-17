// dbcount finds a user context that exposes the branch-scoped data endpoints.
// Usage: go run ./scripts/dbcount <databaseURL>
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
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer db.Close()

	// An OWNER whose tenant has expenses in ACTIVE branches (so ALL-outlets returns them).
	var uid, tid, bid sql.NullString
	err = db.QueryRow(`
		SELECT u.id, u."tenantId", u."branchId"
		FROM "User" u
		WHERE u."isActive" AND u.role='OWNER'
		  AND EXISTS (SELECT 1 FROM "Expense" e
		              JOIN "Branch" b ON b.id = e."branchId"
		              WHERE e."tenantId" = u."tenantId" AND b."isActive" = true)
		LIMIT 1`).Scan(&uid, &tid, &bid)
	if err != nil || !uid.Valid {
		fmt.Println("(no OWNER found whose tenant has expenses in active branches)")
		// Fallback: any OWNER in a tenant that has ANY expense at all.
		_ = db.QueryRow(`SELECT u.id,u."tenantId",u."branchId" FROM "User" u WHERE u."isActive" AND u.role='OWNER' AND u."tenantId" IN (SELECT DISTINCT "tenantId" FROM "Expense") LIMIT 1`).Scan(&uid, &tid, &bid)
	}
	fmt.Printf("EXPENSE-CONTEXT-USER\t%s\t%s\t%s\n", uid.String, tid.String, bid.String)

	for _, t := range []string{`"Expense"`, `"StockItem"`, `"ExpenseCategory"`, `"PickupRequest"`, `"ServiceGroup"`, `"AttendanceEvent"`} {
		var n int64
		_ = db.QueryRow(fmt.Sprintf(`SELECT COUNT(*) FROM %s`, t)).Scan(&n)
		fmt.Printf("%-20s %d\n", t, n)
	}
}
