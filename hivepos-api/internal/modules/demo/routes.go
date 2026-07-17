package demo

import (
	"encoding/json"
	"net/http"

	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module serves the public demo-entrypoint: returns credentials for the shared
// seeded demo account so the web client's /demo flow can auto-signin.
//
// ponytail: returns a single shared seeded demo account (owner@demo.com /
// demo1234 from pos-saas prisma/seed.ts) instead of provisioning a fresh
// per-visitor isDemo=true sandbox with 24h TTL like the legacy route did.
// Ceiling: all demo visitors share one account/data. Upgrade path: provision a
// new tenant + sandbox seed + expiry cleanup when multi-visitor isolation is
// needed. Depends on the seed having run (owner@demo.com must exist).
type Module struct{}

func NewModule() *Module { return &Module{} }

// POST /api/demo/start  {email?}  (email ignored — lead-capture only, matches legacy)
func (m *Module) Start(w http.ResponseWriter, req *http.Request) {
	// Body optional — ignore decode errors (email is not verified or used for auth).
	var body struct {
		Email string `json:"email"`
	}
	_ = json.NewDecoder(req.Body).Decode(&body)

	apphttp.Success(w, map[string]string{
		"email":    "owner@demo.com",
		"password": "demo1234",
	})
}
