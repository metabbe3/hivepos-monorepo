package domain

import "time"

// SubscriptionStatus mirrors the lifecycle of a tenant subscription.
type SubscriptionStatus string

const (
	StatusTrial    SubscriptionStatus = "TRIAL"
	StatusActive   SubscriptionStatus = "ACTIVE"
	StatusPastDue  SubscriptionStatus = "PAST_DUE"
	StatusCanceled SubscriptionStatus = "CANCELED"
	// StatusNone is returned when the tenant has no subscription row yet.
	StatusNone SubscriptionStatus = "NONE"
)

// SaaSPaymentStatus mirrors the lifecycle of a SaaS payment.
type SaaSPaymentStatus string

const (
	PaymentPending  SaaSPaymentStatus = "PENDING"
	PaymentPaid     SaaSPaymentStatus = "PAID"
	PaymentFailed   SaaSPaymentStatus = "FAILED"
	PaymentRefunded SaaSPaymentStatus = "REFUNDED"
)

// PlanInterval mirrors the billing cadence of a plan.
type PlanInterval string

const (
	IntervalMonthly PlanInterval = "MONTHLY"
	IntervalYearly  PlanInterval = "YEARLY"
)

// DiscountType mirrors the kind of discount a promo applies.
type DiscountType string

const (
	DiscountPercentage DiscountType = "PERCENTAGE"
	DiscountFixed      DiscountType = "FIXED"
)

// Plan is a billable plan (price + cadence + feature list).
type Plan struct {
	ID       string       `json:"id"`
	Name     string       `json:"name"`
	Price    float64      `json:"price"`
	Interval PlanInterval `json:"interval"`
	Features []string     `json:"features,omitempty"`
}

// BillingStatus mirrors TS /api/billing/status.
type BillingStatus struct {
	Tenant       BillingTenant    `json:"tenant"`
	Subscription BillingSub       `json:"subscription"`
	Outlets      []*BillingOutlet `json:"outlets"`
	ActiveCount  int              `json:"activeCount"`
	LockedCount  int              `json:"lockedCount"`
	ExpiringSoon []interface{}    `json:"expiringSoon"`
	TrialEndsAt  *string          `json:"trialEndsAt"`
	Pricing      BillingPricing   `json:"pricing"`
	Limits       BillingLimits    `json:"limits"`
	Payments     []interface{}    `json:"payments"`
	// Current usage vs the plan limits (n / max).
	OutletsUsed     int `json:"outletsUsed"`
	UsersUsed       int `json:"usersUsed"`
	OrdersUsedMonth int `json:"ordersUsedMonth"`
	// Real per-outlet monthly prices from the Plan table (data-driven, not hardcoded).
	GrowthPrice float64 `json:"growthPrice"`
	ProPrice    float64 `json:"proPrice"`
}

type BillingTenant struct {
	Name          string   `json:"name"`
	Slug          string   `json:"slug"`
	OwnerEmail    string   `json:"ownerEmail"`
	ActiveModules []string `json:"activeModules"`
}

type BillingSub struct {
	Status           string  `json:"status"`
	PlanName         string  `json:"planName"`
	CurrentPeriodEnd *string `json:"currentPeriodEnd"`
}

type BillingOutlet struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	CoverageEnd   *string `json:"coverageEnd"`
	IsFreeTier    bool    `json:"isFreeTier"`
	Status        string  `json:"status"`
	ExpiresInDays *int    `json:"expiresInDays"`
}

type BillingPricing struct {
	OriginalUnitPrice float64 `json:"originalUnitPrice"`
	UnitPrice         float64 `json:"unitPrice"`
}

type BillingLimits struct {
	IsPaid     bool   `json:"isPaid"`
	MaxOrders  int    `json:"maxOrders"`
	MaxOutlets int    `json:"maxOutlets"`
	MaxUsers   int    `json:"maxUsers"`
	PlanName   string `json:"planName"`
}

// Subscription is a tenant's subscription to a plan.
type Subscription struct {
	ID                 string             `json:"id"`
	TenantID           string             `json:"tenantId"`
	PlanID             string             `json:"planId"`
	Status             SubscriptionStatus `json:"status"`
	PlanName           string             `json:"planName,omitempty"`
	Amount             float64            `json:"amount,omitempty"`
	TrialStart         *time.Time         `json:"trialStart,omitempty"`
	TrialEnd           *time.Time         `json:"trialEnd,omitempty"`
	CurrentPeriodStart *time.Time         `json:"currentPeriodStart,omitempty"`
	CurrentPeriodEnd   *time.Time         `json:"currentPeriodEnd,omitempty"`
}

// SaaSPayment is a single payment attempt against the SaaS billing provider.
type SaaSPayment struct {
	ID              string            `json:"id"`
	SubscriptionID  string            `json:"subscriptionId,omitempty"`
	TenantID        string            `json:"tenantId"`
	Amount          float64           `json:"amount"`
	OutletCount     int               `json:"outletCount"`
	UnitPrice       float64           `json:"unitPrice"`
	MonthsPurchased int               `json:"monthsPurchased"`
	Status          SaaSPaymentStatus `json:"status"`
	Provider        string            `json:"provider"`
	ProviderOrderID string            `json:"providerOrderId,omitempty"`
	PromoCodeID     *string           `json:"promoCodeId,omitempty"`
	CreatedAt       time.Time         `json:"createdAt"`
}

// PromoCode is a discount code redeemable against a plan.
type PromoCode struct {
	ID             string     `json:"id"`
	Code           string     `json:"code"`
	Type           string     `json:"type"` // FREE_MONTH | DISCOUNT_PERCENT | DISCOUNT_FIXED
	Value          float64    `json:"value"`
	MaxRedemptions int        `json:"maxRedemptions"`
	UsedCount      int        `json:"usedCount"`
	ValidUntil     *time.Time `json:"validUntil,omitempty"`
	Active         bool       `json:"active"`
}

// PromoRedemption records a single use of a promo code.
type PromoRedemption struct {
	ID          string    `json:"id"`
	PromoCodeID string    `json:"promoCodeId"`
	TenantID    string    `json:"tenantId"`
	CreatedAt   time.Time `json:"createdAt"`
}
