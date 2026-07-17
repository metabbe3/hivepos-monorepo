// Package rbac holds the permission catalog, mirroring pos-saas
// lib/permissions/definitions.ts so Go enforces the same resource:action strings.
// Re-added (it was cut as dead in the ponytail pass) because the HTTP layer now
// consumes it via middleware.RequireResource.
package rbac

import "net/http"

type Resource string
type Action string

// Resources — must match RESOURCES in pos-saas lib/permissions/definitions.ts.
const (
	Dashboard      Resource = "dashboard"
	Orders         Resource = "orders"
	Customers      Resource = "customers"
	Services       Resource = "services"
	Inventory      Resource = "inventory"
	Expenses       Resource = "expenses"
	Deposits       Resource = "deposits"
	Reports        Resource = "reports"
	Branches       Resource = "branches"
	Users          Resource = "users"
	Roles          Resource = "roles"
	Billing        Resource = "billing"
	PickupRequests Resource = "pickupRequests"
	Attendance     Resource = "attendance"
)

// Actions — must match ACTIONS in pos-saas.
const (
	Read     Action = "read"
	Create   Action = "create"
	Edit     Action = "edit"
	Delete   Action = "delete"
	Export   Action = "export"
	Discount Action = "discount"
)

// ActionForMethod maps an HTTP method to the default RBAC action. Endpoint-
// specific actions (export, discount) need a per-route override; the CRUD default
// covers list/get/create/edit/delete.
func ActionForMethod(method string) Action {
	switch method {
	case http.MethodGet, http.MethodHead:
		return Read
	case http.MethodPost:
		return Create
	case http.MethodPatch, http.MethodPut:
		return Edit
	case http.MethodDelete:
		return Delete
	default:
		return Read
	}
}
