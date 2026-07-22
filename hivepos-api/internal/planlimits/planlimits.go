package planlimits

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"
)

// ponytail: in-memory TTL cache for plan limits. Plans change rarely (only on checkout/upgrade),
// but Resolve runs on every order/user/outlet create + billing status. 5m TTL avoids hammering the
// Subscription/Plan join. Invalidate() clears it on subscription changes (upgrade path can call it).
// Upgrade path: Redis if multi-instance.
const limitsTTL = 5 * time.Minute

type cachedLimits struct {
	limits *Limits
	at     time.Time
}

var limitsCache sync.Map // tenantID → cachedLimits

// Invalidate drops the cached limits for a tenant (call after a subscription/plan change).
func Invalidate(tenantID string) { limitsCache.Delete(tenantID) }


// Kind identifies which plan limit to check.
type Kind int

const (
	Outlets Kind = iota
	Users
	Orders
)

func (k Kind) String() string {
	switch k {
	case Outlets:
		return "Outlet"
	case Users:
		return "User"
	case Orders:
		return "Monthly order"
	}
	return "Resource"
}

// Unlimited sentinel (mirrors legacy UNLIMITED). Plan values >= this skip the check.
const Unlimited = 999999

// Limits is a tenant's resolved plan limits (from the Plan row).
type Limits struct {
	MaxOutlets int
	MaxUsers   int
	MaxOrders  int
	IsPaid     bool
	PlanName   string
}

// Result is a single limit check outcome.
type Result struct {
	Kind     Kind
	Allowed  bool
	Current  int
	Max      int
	PlanName string
}

// Resolve loads the tenant's plan limits (cached 5m): Subscription.planId → Plan, falling back
// to the FREE plan when there is no (active) subscription. IsPaid = tier != FREE.
func Resolve(ctx context.Context, db *sql.DB, tenantID string) (*Limits, error) {
	if v, ok := limitsCache.Load(tenantID); ok {
		c := v.(cachedLimits)
		if time.Since(c.at) < limitsTTL {
			return c.limits, nil
		}
	}
	l, err := resolveFromDB(ctx, db, tenantID)
	if err != nil {
		return nil, err
	}
	limitsCache.Store(tenantID, cachedLimits{limits: l, at: time.Now()})
	return l, nil
}

func resolveFromDB(ctx context.Context, db *sql.DB, tenantID string) (*Limits, error) {
	l := &Limits{}
	var tier, status string
	var periodEnd sql.NullTime
	// Subscription → Plan.
	err := db.QueryRowContext(ctx, `
		SELECT p."maxOutlets", p."maxUsers", p."maxOrders", p.name, p.tier::text, s.status, s."currentPeriodEnd"
		FROM "Subscription" s JOIN "Plan" p ON p.id = s."planId"
		WHERE s."tenantId" = $1`, tenantID,
	).Scan(&l.MaxOutlets, &l.MaxUsers, &l.MaxOrders, &l.PlanName, &tier, &status, &periodEnd)
	if err == sql.ErrNoRows {
		// Fallback: FREE plan.
		err = db.QueryRowContext(ctx, `
			SELECT "maxOutlets", "maxUsers", "maxOrders", name, tier::text
			FROM "Plan" WHERE tier = 'FREE' LIMIT 1`).
			Scan(&l.MaxOutlets, &l.MaxUsers, &l.MaxOrders, &l.PlanName, &tier)
	}
	if err != nil {
		return nil, fmt.Errorf("planlimits resolve: %w", err)
	}
	// Lazy trial expiry: an expired TRIAL downgrades to FREE limits until the
	// tenant upgrades. The row's status stays TRIAL (no cron); limits drop here.
	if status == "TRIAL" && periodEnd.Valid && periodEnd.Time.Before(time.Now()) {
		if ferr := db.QueryRowContext(ctx, `
			SELECT "maxOutlets", "maxUsers", "maxOrders", name, tier::text
			FROM "Plan" WHERE tier = 'FREE' LIMIT 1`).
			Scan(&l.MaxOutlets, &l.MaxUsers, &l.MaxOrders, &l.PlanName, &tier); ferr != nil {
			return nil, fmt.Errorf("planlimits trial-expiry fallback: %w", ferr)
		}
	}
	l.IsPaid = tier != "FREE"
	return l, nil
}

// Check resolves the plan + current usage for one Kind and decides if a new
// branch/user/order may be created. Allowed = current < max OR max is unlimited.
func Check(ctx context.Context, db *sql.DB, tenantID string, kind Kind) (*Result, error) {
	l, err := Resolve(ctx, db, tenantID)
	if err != nil {
		return nil, err
	}
	max := 0
	switch kind {
	case Outlets:
		max = l.MaxOutlets
	case Users:
		max = l.MaxUsers
	case Orders:
		max = l.MaxOrders
	}

	current, err := count(ctx, db, tenantID, kind)
	if err != nil {
		return nil, err
	}
	return &Result{
		Kind:     kind,
		Max:      max,
		Current:  current,
		Allowed:  max >= Unlimited || current < max,
		PlanName: l.PlanName,
	}, nil
}

// Usage returns current counts for all three kinds (for billing status display).
type Usage struct {
	OutletsUsed     int
	UsersUsed       int
	OrdersUsedMonth int
}

func UsageCounts(ctx context.Context, db *sql.DB, tenantID string) (Usage, error) {
	var u Usage
	var err error
	if u.OutletsUsed, err = count(ctx, db, tenantID, Outlets); err != nil {
		return u, err
	}
	if u.UsersUsed, err = count(ctx, db, tenantID, Users); err != nil {
		return u, err
	}
	u.OrdersUsedMonth, err = count(ctx, db, tenantID, Orders)
	return u, err
}

func count(ctx context.Context, db *sql.DB, tenantID string, kind Kind) (int, error) {
	var query string
	switch kind {
	case Outlets:
		query = `SELECT COUNT(*) FROM "Branch" WHERE "tenantId" = $1 AND COALESCE("isActive", true)`
	case Users:
		query = `SELECT COUNT(*) FROM "User" WHERE "tenantId" = $1 AND COALESCE("isActive", true)`
	case Orders:
		// date_trunc on DB-side NOW() (passing a Go time.Time param errors under pgx).
		query = `
			SELECT COUNT(*) FROM "Order" o
			JOIN "Branch" b ON b.id = o."branchId"
			WHERE b."tenantId" = $1 AND o."createdAt" >= date_trunc('month', NOW())`
	}
	var c int
	if err := db.QueryRowContext(ctx, query, tenantID).Scan(&c); err != nil {
		return 0, fmt.Errorf("planlimits count: %w", err)
	}
	return c, nil
}
