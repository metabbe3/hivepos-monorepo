package domain

import "time"

// SubscriptionStatus mirrors the lifecycle of a tenant subscription.
type SubscriptionStatus string

const (
	StatusTrial   SubscriptionStatus = "TRIAL"
	StatusActive  SubscriptionStatus = "ACTIVE"
	StatusPastDue SubscriptionStatus = "PAST_DUE"
	StatusCanceled SubscriptionStatus = "CANCELED"
	// StatusNone is returned when the tenant has no subscription row yet.
	StatusNone    SubscriptionStatus = "NONE"
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

// Subscription is a tenant's subscription to a plan.
type Subscription struct {
	ID                  string             `json:"id"`
	TenantID            string             `json:"tenantId"`
	PlanID             string             `json:"planId"`
	Status              SubscriptionStatus `json:"status"`
	PlanName            string             `json:"planName,omitempty"`
	Amount              float64            `json:"amount,omitempty"`
	TrialStart          *time.Time         `json:"trialStart,omitempty"`
	TrialEnd            *time.Time         `json:"trialEnd,omitempty"`
	CurrentPeriodStart  *time.Time         `json:"currentPeriodStart,omitempty"`
	CurrentPeriodEnd    *time.Time         `json:"currentPeriodEnd,omitempty"`
}

// SaaSPayment is a single payment attempt against the SaaS billing provider.
type SaaSPayment struct {
	ID              string            `json:"id"`
	SubscriptionID  string            `json:"subscriptionId,omitempty"`
	TenantID        string            `json:"tenantId"`
	Amount          float64           `json:"amount"`
	Status          SaaSPaymentStatus `json:"status"`
	Provider        string            `json:"provider"`
	ProviderOrderID string            `json:"providerOrderId,omitempty"`
	CreatedAt       time.Time         `json:"createdAt"`
}

// PromoCode is a discount code redeemable against a plan.
type PromoCode struct {
	ID              string       `json:"id"`
	Code            string       `json:"code"`
	DiscountType    DiscountType `json:"discountType"`
	DiscountValue   float64      `json:"discountValue"`
	MaxRedemptions  int          `json:"maxRedemptions"`
	UsedCount       int          `json:"usedCount"`
	ValidUntil      *time.Time   `json:"validUntil,omitempty"`
	Active          bool         `json:"active"`
}

// PromoRedemption records a single use of a promo code.
type PromoRedemption struct {
	ID          string    `json:"id"`
	PromoCodeID string    `json:"promoCodeId"`
	TenantID    string    `json:"tenantId"`
	CreatedAt   time.Time `json:"createdAt"`
}
