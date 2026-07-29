// Command genopenapi constructs the real chi router (via router.BuildRouter) with
// STUB deps — no live Postgres, no Midtrans — and enumerates every registered
// route. This is the unblocking primitive for generating the OpenAPI spec from
// Go instead of hand-writing contracts/openapi.yaml.
//
// Why: today the spec is hand-maintained and the Go backend has no binding to it,
// so a field/enum rename drifts silently and surfaces as a runtime FE bug. Once
// routes + DTOs are reflected, a CI semantic-diff vs the committed spec makes
// drift a hard failure.
//
// This first cut prints "METHOD path" per route, proving the route table is
// enumerable offline. Next (follow-up): reflect handler DTOs → components.schemas,
// emit paths, diff against contracts/openapi.yaml.
package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/router"
)

func main() {
	// Stub deps — BuildRouter does NO DB I/O at construction (module constructors
	// only store the *sql.DB; handlers are closures that query at request time; the
	// one boot side-effect, SeedFeatureFlags, stays in cmd/server).
	r := router.BuildRouter(router.Deps{
		JWTSecret: "genopenapi-stub",
	})

	var n int
	err := chi.Walk(r, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		fmt.Printf("%-7s %s\n", method, route)
		n++
		return nil
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "genopenapi: walk failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "genopenapi: %d routes enumerated\n", n)
}
