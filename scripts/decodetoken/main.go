// decodetoken decrypts an Auth.js JWE token for diagnostics.
// Usage: go run ./scripts/decodetoken <secret> <token>
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/hivepos/api/internal/auth"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "usage: decodetoken <secret> <token>")
		os.Exit(2)
	}
	c, err := auth.DecodeNextAuth(os.Args[2], os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, "decode:", err)
		os.Exit(1)
	}
	b, _ := json.MarshalIndent(c, "", "  ")
	fmt.Println(string(b))
}
