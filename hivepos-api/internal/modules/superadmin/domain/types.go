package domain

import (
	"encoding/json"
	"time"
)

// --- Platform entities (cross-tenant) ---

type Tenant struct {
	ID                    string             `json:"id"`
	Name                  string             `json:"name"`
	Slug                  string             `json:"slug"`
	OwnerEmail            string             `json:"ownerEmail"`
	OwnerName             *string            `json:"ownerName"`
	OwnerPhone            *string            `json:"ownerPhone"`
	LogoURL               *string            `json:"logoUrl"`
	CustomDomain          *string            `json:"customDomain"`
	ActiveModules         []string           `json:"activeModules"`
	Settings              json.RawMessage    `json:"settings,omitempty"`
	IsActive              bool               `json:"isActive"`
	ApprovedAt            *time.Time         `json:"approvedAt,omitempty"`
	OnboardingCompletedAt *time.Time         `json:"onboardingCompletedAt,omitempty"`
	IsDemo                bool               `json:"isDemo"`
	DemoExpiresAt         *time.Time         `json:"demoExpiresAt,omitempty"`
	TrialEndsAt           *time.Time         `json:"trialEndsAt,omitempty"`
	TrialTier             *string            `json:"trialTier,omitempty"`
	WebsiteEnabled        bool               `json:"websiteEnabled"`
	WebsitePublishedAt    *time.Time         `json:"websitePublishedAt,omitempty"`
	ReferralCode          *string            `json:"referralCode,omitempty"`
	CreatedAt             time.Time          `json:"createdAt"`
	UpdatedAt             time.Time          `json:"updatedAt"`
}

// TenantListItem wraps a Tenant with the list-page-only aggregates the FE reads:
// _count.branches (outlet count) + subscription.status. Kept separate from Tenant
// so GetTenant (detail) stays a flat SELECT — these are stitched from sub-queries.
type TenantListItem struct {
	*Tenant
	Subscription *TenantSubStatus `json:"subscription,omitempty"`
	Count        *TenantCounts    `json:"_count,omitempty"`
}

type TenantSubStatus struct {
	Status string `json:"status"`
}

type TenantCounts struct {
	Branches int `json:"branches"`
}

type User struct {
	ID              string     `json:"id"`
	Email           string     `json:"email"`
	Name            string     `json:"name"`
	Phone           *string    `json:"phone"`
	Role            string     `json:"role"`
	RoleID          *string    `json:"roleId"`
	TenantID        string     `json:"tenantId"`
	BranchID        *string    `json:"branchId"`
	IsActive        bool       `json:"isActive"`
	// Denormalized for the cross-tenant users list (LEFT JOIN Tenant/Branch).
	TenantName string `json:"tenantName,omitempty"`
	BranchName string `json:"branchName,omitempty"`
	EmailVerified   *time.Time `json:"emailVerified,omitempty"`
	LastLoginAt     *time.Time `json:"lastLoginAt,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type Subscription struct {
	ID                 string     `json:"id"`
	TenantID           string     `json:"tenantId"`
	PlanID             string     `json:"planId"`
	Status             string     `json:"status"` // TRIAL | ACTIVE | PAST_DUE | CANCELED | EXPIRED
	CurrentPeriodStart *time.Time `json:"currentPeriodStart,omitempty"`
	CurrentPeriodEnd   *time.Time `json:"currentPeriodEnd,omitempty"`
	PaidOutletCount    int        `json:"paidOutletCount"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
}

type SaaSPayment struct {
	ID              string     `json:"id"`
	TenantID        string     `json:"tenantId"`
	TenantName      string     `json:"tenantName"`
	Amount          float64    `json:"amount"`
	OutletCount     int        `json:"outletCount"`
	UnitPrice       float64    `json:"unitPrice"`
	MonthsPurchased int        `json:"monthsPurchased"`
	Kind            string     `json:"kind"` // RENEWAL | TOPUP | INITIAL
	Status          string     `json:"status"` // PENDING | PAID | FAILED | REFUNDED
	MidtransOrderID *string    `json:"midtransOrderId,omitempty"`
	CoverageStart   *time.Time `json:"coverageStart,omitempty"`
	CoverageEnd     *time.Time `json:"coverageEnd,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	PaidAt          *time.Time `json:"paidAt,omitempty"`
}

type Plan struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description *string         `json:"description"`
	MaxOutlets  int             `json:"maxOutlets"`
	MaxUsers    int             `json:"maxUsers"`
	MaxOrders   int             `json:"maxOrders"`
	PriceMonthly float64        `json:"priceMonthly"`
	PriceYearly  float64        `json:"priceYearly"`
	Modules     []string        `json:"modules"`
	Features    json.RawMessage `json:"features,omitempty"`
	IsActive    bool            `json:"isActive"`
	Tier        *string         `json:"tier,omitempty"` // FREE | GROWTH | PRO
	// Denormalized for the plans list (COUNT of active subscriptions per plan).
	SubscriptionCount int `json:"subscriptionCount"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

type FeatureFlag struct {
	ID          string    `json:"id"`
	Key         string    `json:"key"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Enabled     bool      `json:"enabled"`
	Category    string    `json:"category"`
	// Denormalized for the feature-flags list (COUNT of tenant overrides).
	OverrideCount int       `json:"overrideCount"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type TenantFeatureFlag struct {
	ID       string    `json:"id"`
	FlagID   string    `json:"flagId"`
	TenantID string    `json:"tenantId"`
	Enabled  bool      `json:"enabled"`
	Reason   *string   `json:"reason,omitempty"`
	Tenant     string    `json:"tenantName,omitempty"` // denormalized for list views
	TenantSlug string    `json:"tenantSlug,omitempty"` // denormalized for list views
	FlagKey    string    `json:"flagKey,omitempty"`    // denormalized for list views
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type BlogPost struct {
	ID          string     `json:"id"`
	Slug        string     `json:"slug"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Keywords    *string    `json:"keywords"`
	Content     string     `json:"content"`
	CoverImage  *string    `json:"coverImage"`
	Published   bool       `json:"published"`
	PublishedAt *time.Time `json:"publishedAt,omitempty"`
	AuthorID    string     `json:"authorId"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type AuditLog struct {
	ID         string          `json:"id"`
	Action     string          `json:"action"`
	TargetType string          `json:"targetType"`
	TargetID   string          `json:"targetId"`
	TenantID   *string         `json:"tenantId,omitempty"`
	ActorID    string          `json:"actorId"`
	ActorEmail string          `json:"actorEmail"`
	Reason     *string         `json:"reason,omitempty"`
	Diff       json.RawMessage `json:"diff,omitempty"`
	IPAddress  *string         `json:"ipAddress,omitempty"`
	CreatedAt  time.Time       `json:"createdAt"`
}

type ErrorLog struct {
	ID         string     `json:"id"`
	RequestID  string     `json:"requestId"`
	Method     string     `json:"method"`
	URL        string     `json:"url"`
	HTTPStatus int        `json:"httpStatus"`
	Code       string     `json:"code"`
	Message    string     `json:"message"`
	Stack      *string    `json:"stack,omitempty"`
	TenantID   *string    `json:"tenantId,omitempty"`
	UserID     *string    `json:"userId,omitempty"`
	IPAddress  *string    `json:"ipAddress,omitempty"`
	Resolved   bool       `json:"resolved"`
	CreatedAt  time.Time  `json:"createdAt"`
}

type SupportTicket struct {
	ID             string     `json:"id"`
	Subject        string     `json:"subject"`
	Description    string     `json:"description"`
	Category       string     `json:"category"`   // BILLING | TECHNICAL | ACCOUNT | OTHER
	Priority       string     `json:"priority"`   // LOW | NORMAL | HIGH | URGENT
	Status         string     `json:"status"`     // OPEN | IN_PROGRESS | RESOLVED | CLOSED
	TenantID       *string    `json:"tenantId,omitempty"`
	// Denormalized for the tickets list/detail (LEFT JOIN Tenant + comment count).
	TenantName  string `json:"tenantName,omitempty"`
	CommentCount int   `json:"commentCount"`
	SubmitterName  string     `json:"submitterName"`
	SubmitterEmail string     `json:"submitterEmail"`
	SubmitterPhone *string    `json:"submitterPhone,omitempty"`
	CsatRating     *int       `json:"csatRating,omitempty"`
	CsatComment    *string    `json:"csatComment,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	ResolvedAt     *time.Time `json:"resolvedAt,omitempty"`
}

type TicketComment struct {
	ID         string    `json:"id"`
	TicketID   string    `json:"ticketId"`
	AuthorName string    `json:"authorName"`
	AuthorEmail string   `json:"authorEmail"`
	AuthorRole string    `json:"authorRole"` // TENANT_USER | SUPER_ADMIN | SUPPORT
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Referral struct {
	ID           string     `json:"id"`
	ReferrerID   string     `json:"referrerId"`
	ReferredID   string     `json:"referredId"`
	Status       string     `json:"status"` // PENDING | REWARDED | REJECTED | EXPIRED
	RewardMonths int        `json:"rewardMonths"`
	Reason       *string    `json:"reason,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	RewardedAt   *time.Time `json:"rewardedAt,omitempty"`
	// Denormalized for list views
	ReferrerName string  `json:"referrerName,omitempty"`
	ReferredName string  `json:"referredName,omitempty"`
	ReferrerSlug string  `json:"referrerSlug,omitempty"`
	ReferredSlug string  `json:"referredSlug,omitempty"`
	ReferrerCode *string `json:"referrerCode,omitempty"`
}

type PromoCode struct {
	ID               string     `json:"id"`
	Code             string     `json:"code"`
	Description      *string    `json:"description"`
	Type             string     `json:"type"` // FREE_MONTH | DISCOUNT_PERCENT | DISCOUNT_FIXED
	Value            float64    `json:"value"`
	MaxRedemptions   *int       `json:"maxRedemptions,omitempty"`
	RedemptionCount  int        `json:"redemptionCount"`
	ValidFrom        *time.Time `json:"validFrom,omitempty"`
	ValidUntil       *time.Time `json:"validUntil,omitempty"`
	IsActive         bool       `json:"isActive"`
	ApplicablePlan   *string    `json:"applicablePlan,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
}

// --- Aggregates / DTOs ---

type PlatformStats struct {
	TotalTenants    int64   `json:"totalTenants"`
	ActiveTenants   int64   `json:"activeTenants"`
	PendingTenants  int64   `json:"pendingTenants"`
	TotalUsers      int64   `json:"totalUsers"`
	ActiveUsers     int64   `json:"activeUsers"`
	MRR             float64 `json:"mrr"`
	TrialTenants    int64   `json:"trialTenants"`
	NewThisMonth    int64   `json:"newThisMonth"`
}

type BillingOverview struct {
	MRR              float64 `json:"mrr"`
	TotalRevenue     float64 `json:"totalRevenue"`
	PendingPayments  int64   `json:"pendingPayments"`
	RefundedTotal    float64 `json:"refundedTotal"`
	PaidThisMonth    float64 `json:"paidThisMonth"`
	LifetimeGross    float64 `json:"lifetimeGross"`
	PaidTenantCount  int64   `json:"paidTenantCount"`
	ActivePaidOutlets int64  `json:"activePaidOutlets"`
	FailedCount30d   int64   `json:"failedCount30d"`
}

// OpsCounts are the operational health counters the super-admin overview tiles
// read alongside PlatformStats + BillingOverview (open/urgent tickets, unresolved
// errors, suspended tenants, past-due/canceled subs, total orders).
type OpsCounts struct {
	OpenTickets      int64 `json:"openTickets"`
	UrgentTickets    int64 `json:"urgentTickets"`
	UnresolvedErrors int64 `json:"unresolvedErrors"`
	SuspendedTenants int64 `json:"suspendedTenants"`
	PastDueSubs      int64 `json:"pastDueSubs"`
	CanceledSubs     int64 `json:"canceledSubs"`
	TotalOrders      int64 `json:"totalOrders"`
}

type ImpersonationSession struct {
	Token        string `json:"token"`
	TenantID     string `json:"tenantId"`
	TenantName   string `json:"tenantName"`
	UserID       string `json:"userId"`
	UserEmail    string `json:"userEmail"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

// --- Pickup insights (cross-tenant pickup-request analytics) ---

type PickupInsights struct {
	TotalAll          int64                 `json:"totalAll"`
	TotalRejected     int64                 `json:"totalRejected"`
	RejectionRate     float64               `json:"rejectionRate"`
	TopReasons        []PickupInsightReason `json:"topReasons"`
	TopTenantsByRate  []PickupInsightTenant `json:"topTenantsByRate"`
	TopBranchesByRate []PickupInsightBranch `json:"topBranchesByRate"`
}

type PickupInsightReason struct {
	Reason  string  `json:"reason"`
	Count   int64   `json:"count"`
	Pct     float64 `json:"pct"`
}

type PickupInsightTenant struct {
	TenantID   string  `json:"tenantId"`
	TenantName string  `json:"tenantName"`
	Rejected   int64   `json:"rejected"`
	Total      int64   `json:"total"`
	Rate       float64 `json:"rate"`
}

type PickupInsightBranch struct {
	TenantID   string  `json:"tenantId"`
	TenantName string  `json:"tenantName"`
	BranchName string  `json:"branchName"`
	Rejected   int64   `json:"rejected"`
	Total      int64   `json:"total"`
	Rate       float64 `json:"rate"`
}
