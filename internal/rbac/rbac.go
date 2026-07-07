package rbac

// RBAC constants mirroring lib/permissions/definitions.ts.
// Resources + actions are strings in the form "resource:action".

type Resource string
type Action string

const (
	// Actions
	Read    Action = "read"
	Create  Action = "create"
	Edit    Action = "edit"
	Delete  Action = "delete"
	Export  Action = "export"
	Discount Action = "discount"
)

// Resources matching the TS RESOURCES array.
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
	Attendance      Resource = "attendance"
)

// HasPermission checks if the given permissions list grants a specific resource:action.
// Super-admin bypass + wildcard "*" are handled by the middleware layer.
func HasPermission(perms []string, resource Resource, action Action) bool {
	target := string(resource) + ":" + string(action)
	for _, p := range perms {
		if p == "*" || p == target {
			return true
		}
	}
	return false
}
