// mintjwe prints an Auth.js v5 JWE token (what the TS app issues/expects).
// Usage: go run ./scripts/mintjwe <secret> <userId> <tenantId> [role] [branchId]
package main

import (
	"fmt"
	"os"

	"github.com/hivepos/api/internal/auth"
)

func main() {
	if len(os.Args) < 4 {
		fmt.Fprintln(os.Stderr, "usage: mintjwe <secret> <userId> <tenantId> [role] [branchId]")
		os.Exit(2)
	}
	secret := os.Args[1]
	userID := os.Args[2]
	tenantID := os.Args[3]
	role := "SUPER_ADMIN"
	if len(os.Args) > 4 {
		role = os.Args[4]
	}
	branchID := ""
	if len(os.Args) > 5 {
		branchID = os.Args[5]
	}
	tok, err := auth.EncodeNextAuth(&auth.Claims{
		UserID:      userID,
		Role:        role,
		TenantID:    tenantID,
		BranchID:    branchID,
		Permissions: []string{"*"},
	}, secret, 8*60*60)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Print(tok)
}
