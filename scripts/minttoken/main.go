// minttoken prints a Go HS256 JWT for parity diagnostics.
// Usage: go run ./scripts/minttoken <secret> [tenantID]
package main

import (
	"fmt"
	"os"
	"time"

	"github.com/hivepos/api/internal/auth"
)

func main() {
	secret := "dev-secret-change-in-production"
	if len(os.Args) > 1 {
		secret = os.Args[1]
	}
	tenant := "t1"
	if len(os.Args) > 2 {
		tenant = os.Args[2]
	}
	m := auth.NewJWTManager(secret)
	tok, err := m.Generate(&auth.Claims{
		UserID:      "u-parity",
		Role:        "SUPER_ADMIN",
		TenantID:    tenant,
		BranchID:    "b1",
		Permissions: []string{"*"},
	}, 8*time.Hour)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Print(tok)
}
