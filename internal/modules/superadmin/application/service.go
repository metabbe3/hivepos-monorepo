package application

import (
	"context"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/superadmin/domain"
)

// ListFilter is the shared pagination/search filter for all list endpoints.
type ListFilter struct {
	Search string
	Status string
	Sort   string
	Order  string
	Page   int
	Limit  int
}

// TenantInput is the PATCH /tenants/:id body.
type TenantInput struct {
	Name          *string  `json:"name"`
	OwnerName     *string  `json:"ownerName"`
	OwnerPhone    *string  `json:"ownerPhone"`
	OwnerEmail    *string  `json:"ownerEmail"`
	LogoURL       *string  `json:"logoUrl"`
	IsActive      *bool    `json:"isActive"`
}

// SubscriptionInput is the PATCH /tenants/:id/subscription body.
type SubscriptionInput struct {
	PlanID             string  `json:"planId"`
	Status             *string `json:"status"`
	CurrentPeriodEnd   *time.Time `json:"currentPeriodEnd"`
	PaidOutletCount    *int    `json:"paidOutletCount"`
}

// PlanInput covers POST/PATCH /plans.
type PlanInput struct {
	Name         *string  `json:"name"`
	Description  *string  `json:"description"`
	MaxOutlets   *int     `json:"maxOutlets"`
	MaxUsers     *int     `json:"maxUsers"`
	MaxOrders    *int     `json:"maxOrders"`
	PriceMonthly *float64 `json:"priceMonthly"`
	PriceYearly  *float64 `json:"priceYearly"`
	IsActive     *bool    `json:"isActive"`
	Tier         *string  `json:"tier"`
}

// PromoCodeInput covers POST/PATCH /promo-codes.
type PromoCodeInput struct {
	Code           *string  `json:"code"`
	Description    *string  `json:"description"`
	Type           *string  `json:"type"`
	Value          *float64 `json:"value"`
	MaxRedemptions *int     `json:"maxRedemptions"`
	ValidFrom      *time.Time `json:"validFrom"`
	ValidUntil     *time.Time `json:"validUntil"`
	IsActive       *bool    `json:"isActive"`
	ApplicablePlan *string  `json:"applicablePlan"`
}

// FeatureFlagInput covers POST/PATCH /feature-flags.
type FeatureFlagInput struct {
	Key         *string `json:"key"`
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Enabled     *bool   `json:"enabled"`
	Category    *string `json:"category"`
}

// TenantFlagInput covers POST /feature-flags/:id/tenants.
type TenantFlagInput struct {
	TenantID string `json:"tenantId"`
	Enabled  bool   `json:"enabled"`
	Reason   string `json:"reason"`
}

// BlogPostInput covers POST/PATCH /blog.
type BlogPostInput struct {
	Slug        *string `json:"slug"`
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Keywords    *string `json:"keywords"`
	Content     *string `json:"content"`
	CoverImage  *string `json:"coverImage"`
	Published   *bool   `json:"published"`
}

// CommentInput is POST /tickets/:id/comments.
type CommentInput struct {
	Body string `json:"body"`
}

// TicketStatusInput is PATCH /tickets/:id/status.
type TicketStatusInput struct {
	Status string `json:"status"`
}

// TicketPriorityInput is PATCH /tickets/:id/priority.
type TicketPriorityInput struct {
	Priority string `json:"priority"`
}

// PasswordInput is POST /me/password.
type PasswordInput struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// ImpersonateInput is POST /impersonate.
type ImpersonateInput struct {
	TenantID string `json:"tenantId"`
	UserID   string `json:"userId"`
}

// Repository defines the persistence contract for the super-admin module.
// One interface is used; the infrastructure implements all methods against PostgreSQL.
type Repository interface {
	// Stats
	GetPlatformStats(ctx context.Context) (*domain.PlatformStats, error)
	GetBillingOverview(ctx context.Context) (*domain.BillingOverview, error)

	// Tenants
	ListTenants(ctx context.Context, filter ListFilter) ([]*domain.Tenant, int64, error)
	GetTenant(ctx context.Context, id string) (*domain.Tenant, error)
	UpdateTenant(ctx context.Context, id string, input TenantInput) (*domain.Tenant, error)
	ApproveTenant(ctx context.Context, id string) (*domain.Tenant, error)
	SuspendTenant(ctx context.Context, id string, suspend bool) (*domain.Tenant, error)
	GetTenantBilling(ctx context.Context, id string) (interface{}, error)
	UpdateTenantSubscription(ctx context.Context, id string, input SubscriptionInput) (*domain.Subscription, error)

	// Users
	ListUsers(ctx context.Context, filter ListFilter) ([]*domain.User, int64, error)
	SuspendUser(ctx context.Context, id string, suspend bool) (*domain.User, error)
	ResetUserPassword(ctx context.Context, id string) (string, error)

	// Billing / Payments
	ListPayments(ctx context.Context, filter ListFilter) ([]*domain.SaaSPayment, int64, error)
	RefundPayment(ctx context.Context, id string) (*domain.SaaSPayment, error)

	// Plans
	ListPlans(ctx context.Context) ([]*domain.Plan, error)
	CreatePlan(ctx context.Context, input PlanInput) (*domain.Plan, error)
	UpdatePlan(ctx context.Context, id string, input PlanInput) (*domain.Plan, error)
	DeletePlan(ctx context.Context, id string) error

	// Promo codes
	ListPromoCodes(ctx context.Context, filter ListFilter) ([]*domain.PromoCode, int64, error)
	CreatePromoCode(ctx context.Context, input PromoCodeInput) (*domain.PromoCode, error)
	UpdatePromoCode(ctx context.Context, id string, input PromoCodeInput) (*domain.PromoCode, error)
	DeletePromoCode(ctx context.Context, id string) error

	// Feature flags
	ListFeatureFlags(ctx context.Context) ([]*domain.FeatureFlag, error)
	CreateFeatureFlag(ctx context.Context, input FeatureFlagInput) (*domain.FeatureFlag, error)
	UpdateFeatureFlag(ctx context.Context, id string, input FeatureFlagInput) (*domain.FeatureFlag, error)
	DeleteFeatureFlag(ctx context.Context, id string) error
	ListTenantFlags(ctx context.Context, flagID string) ([]*domain.TenantFeatureFlag, error)
	UpsertTenantFlag(ctx context.Context, flagID string, input TenantFlagInput) (*domain.TenantFeatureFlag, error)
	DeleteTenantFlag(ctx context.Context, flagID, tenantID string) error

	// Referrals
	ListReferrals(ctx context.Context, filter ListFilter) ([]*domain.Referral, int64, error)
	UpdateReferral(ctx context.Context, id, status, reason string) (*domain.Referral, error)

	// Tickets
	ListTickets(ctx context.Context, filter ListFilter) ([]*domain.SupportTicket, int64, error)
	GetTicket(ctx context.Context, id string) (*domain.SupportTicket, error)
	AddTicketComment(ctx context.Context, ticketID, body, authorID, authorEmail string) (*domain.TicketComment, error)
	UpdateTicketStatus(ctx context.Context, id, status string) (*domain.SupportTicket, error)
	UpdateTicketPriority(ctx context.Context, id, priority string) (*domain.SupportTicket, error)

	// Error logs
	ListErrorLogs(ctx context.Context, filter ListFilter) ([]*domain.ErrorLog, int64, error)
	ResolveErrorLog(ctx context.Context, id string, resolved bool) error

	// Blog
	ListBlogPosts(ctx context.Context, filter ListFilter) ([]*domain.BlogPost, int64, error)
	GetBlogPost(ctx context.Context, id string) (*domain.BlogPost, error)
	CreateBlogPost(ctx context.Context, input BlogPostInput, authorID string) (*domain.BlogPost, error)
	UpdateBlogPost(ctx context.Context, id string, input BlogPostInput) (*domain.BlogPost, error)
	DeleteBlogPost(ctx context.Context, id string) error

	// Audit log
	ListAuditLogs(ctx context.Context, filter ListFilter) ([]*domain.AuditLog, int64, error)

	// Super-admin self
	UpdateSuperAdminPassword(ctx context.Context, id, currentPassword, newPassword string) error
	RevokeSuperAdminSessions(ctx context.Context, id string) error

	// Impersonation
	CreateImpersonation(ctx context.Context, input ImpersonInput) (string, error)
}

// ImpersonInput is the internal impersonation payload used by the service.
type ImpersonInput struct {
	TenantID string
	UserID   string
	ActorID  string
}

// Service is the super-admin use-case layer.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func normalizePage(filter *ListFilter) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 20
	}
}

// Stats
func (s *Service) GetStats(ctx context.Context) (*domain.PlatformStats, error) {
	return s.Repo.GetPlatformStats(ctx)
}
func (s *Service) GetBillingOverview(ctx context.Context) (*domain.BillingOverview, error) {
	return s.Repo.GetBillingOverview(ctx)
}

// Tenants
func (s *Service) ListTenants(ctx context.Context, filter ListFilter) ([]*domain.Tenant, int64, error) {
	normalizePage(&filter)
	return s.Repo.ListTenants(ctx, filter)
}
func (s *Service) GetTenant(ctx context.Context, id string) (*domain.Tenant, error) {
	t, err := s.Repo.GetTenant(ctx, id)
	if err != nil || t == nil {
		return nil, fmt.Errorf("tenant not found")
	}
	return t, nil
}
func (s *Service) UpdateTenant(ctx context.Context, id string, input TenantInput) (*domain.Tenant, error) {
	return s.Repo.UpdateTenant(ctx, id, input)
}
func (s *Service) ApproveTenant(ctx context.Context, id string) (*domain.Tenant, error) {
	return s.Repo.ApproveTenant(ctx, id)
}
func (s *Service) SuspendTenant(ctx context.Context, id string) (*domain.Tenant, error) {
	return s.Repo.SuspendTenant(ctx, id, true)
}
func (s *Service) ReactivateTenant(ctx context.Context, id string) (*domain.Tenant, error) {
	return s.Repo.SuspendTenant(ctx, id, false)
}
func (s *Service) GetTenantBilling(ctx context.Context, id string) (interface{}, error) {
	return s.Repo.GetTenantBilling(ctx, id)
}
func (s *Service) UpdateTenantSubscription(ctx context.Context, id string, input SubscriptionInput) (*domain.Subscription, error) {
	return s.Repo.UpdateTenantSubscription(ctx, id, input)
}

// Users
func (s *Service) ListUsers(ctx context.Context, filter ListFilter) ([]*domain.User, int64, error) {
	normalizePage(&filter)
	return s.Repo.ListUsers(ctx, filter)
}
func (s *Service) SuspendUser(ctx context.Context, id string) (*domain.User, error) {
	return s.Repo.SuspendUser(ctx, id, true)
}
func (s *Service) ReactivateUser(ctx context.Context, id string) (*domain.User, error) {
	return s.Repo.SuspendUser(ctx, id, false)
}
func (s *Service) ResetUserPassword(ctx context.Context, id string) (string, error) {
	return s.Repo.ResetUserPassword(ctx, id)
}

// Payments
func (s *Service) ListPayments(ctx context.Context, filter ListFilter) ([]*domain.SaaSPayment, int64, error) {
	normalizePage(&filter)
	return s.Repo.ListPayments(ctx, filter)
}
func (s *Service) RefundPayment(ctx context.Context, id string) (*domain.SaaSPayment, error) {
	return s.Repo.RefundPayment(ctx, id)
}

// Plans
func (s *Service) ListPlans(ctx context.Context) ([]*domain.Plan, error) {
	return s.Repo.ListPlans(ctx)
}
func (s *Service) CreatePlan(ctx context.Context, input PlanInput) (*domain.Plan, error) {
	return s.Repo.CreatePlan(ctx, input)
}
func (s *Service) UpdatePlan(ctx context.Context, id string, input PlanInput) (*domain.Plan, error) {
	return s.Repo.UpdatePlan(ctx, id, input)
}
func (s *Service) DeletePlan(ctx context.Context, id string) error {
	return s.Repo.DeletePlan(ctx, id)
}

// Promo codes
func (s *Service) ListPromoCodes(ctx context.Context, filter ListFilter) ([]*domain.PromoCode, int64, error) {
	normalizePage(&filter)
	return s.Repo.ListPromoCodes(ctx, filter)
}
func (s *Service) CreatePromoCode(ctx context.Context, input PromoCodeInput) (*domain.PromoCode, error) {
	return s.Repo.CreatePromoCode(ctx, input)
}
func (s *Service) UpdatePromoCode(ctx context.Context, id string, input PromoCodeInput) (*domain.PromoCode, error) {
	return s.Repo.UpdatePromoCode(ctx, id, input)
}
func (s *Service) DeletePromoCode(ctx context.Context, id string) error {
	return s.Repo.DeletePromoCode(ctx, id)
}

// Feature flags
func (s *Service) ListFeatureFlags(ctx context.Context) ([]*domain.FeatureFlag, error) {
	return s.Repo.ListFeatureFlags(ctx)
}
func (s *Service) CreateFeatureFlag(ctx context.Context, input FeatureFlagInput) (*domain.FeatureFlag, error) {
	return s.Repo.CreateFeatureFlag(ctx, input)
}
func (s *Service) UpdateFeatureFlag(ctx context.Context, id string, input FeatureFlagInput) (*domain.FeatureFlag, error) {
	return s.Repo.UpdateFeatureFlag(ctx, id, input)
}
func (s *Service) DeleteFeatureFlag(ctx context.Context, id string) error {
	return s.Repo.DeleteFeatureFlag(ctx, id)
}
func (s *Service) ListTenantFlags(ctx context.Context, flagID string) ([]*domain.TenantFeatureFlag, error) {
	return s.Repo.ListTenantFlags(ctx, flagID)
}
func (s *Service) UpsertTenantFlag(ctx context.Context, flagID string, input TenantFlagInput) (*domain.TenantFeatureFlag, error) {
	return s.Repo.UpsertTenantFlag(ctx, flagID, input)
}
func (s *Service) DeleteTenantFlag(ctx context.Context, flagID, tenantID string) error {
	return s.Repo.DeleteTenantFlag(ctx, flagID, tenantID)
}

// Referrals
func (s *Service) ListReferrals(ctx context.Context, filter ListFilter) ([]*domain.Referral, int64, error) {
	normalizePage(&filter)
	return s.Repo.ListReferrals(ctx, filter)
}
func (s *Service) UpdateReferral(ctx context.Context, id, status, reason string) (*domain.Referral, error) {
	return s.Repo.UpdateReferral(ctx, id, status, reason)
}

// Tickets
func (s *Service) ListTickets(ctx context.Context, filter ListFilter) ([]*domain.SupportTicket, int64, error) {
	normalizePage(&filter)
	return s.Repo.ListTickets(ctx, filter)
}
func (s *Service) GetTicket(ctx context.Context, id string) (*domain.SupportTicket, error) {
	t, err := s.Repo.GetTicket(ctx, id)
	if err != nil || t == nil {
		return nil, fmt.Errorf("ticket not found")
	}
	return t, nil
}
func (s *Service) AddTicketComment(ctx context.Context, ticketID, body, authorID, authorEmail string) (*domain.TicketComment, error) {
	if body == "" {
		return nil, fmt.Errorf("comment body is required")
	}
	return s.Repo.AddTicketComment(ctx, ticketID, body, authorID, authorEmail)
}
func (s *Service) UpdateTicketStatus(ctx context.Context, id, status string) (*domain.SupportTicket, error) {
	return s.Repo.UpdateTicketStatus(ctx, id, status)
}
func (s *Service) UpdateTicketPriority(ctx context.Context, id, priority string) (*domain.SupportTicket, error) {
	return s.Repo.UpdateTicketPriority(ctx, id, priority)
}

// Error logs
func (s *Service) ListErrorLogs(ctx context.Context, filter ListFilter) ([]*domain.ErrorLog, int64, error) {
	normalizePage(&filter)
	return s.Repo.ListErrorLogs(ctx, filter)
}
func (s *Service) ResolveErrorLog(ctx context.Context, id string) error {
	return s.Repo.ResolveErrorLog(ctx, id, true)
}

// Blog
func (s *Service) ListBlogPosts(ctx context.Context, filter ListFilter) ([]*domain.BlogPost, int64, error) {
	normalizePage(&filter)
	return s.Repo.ListBlogPosts(ctx, filter)
}
func (s *Service) GetBlogPost(ctx context.Context, id string) (*domain.BlogPost, error) {
	b, err := s.Repo.GetBlogPost(ctx, id)
	if err != nil || b == nil {
		return nil, fmt.Errorf("blog post not found")
	}
	return b, nil
}
func (s *Service) CreateBlogPost(ctx context.Context, input BlogPostInput, authorID string) (*domain.BlogPost, error) {
	return s.Repo.CreateBlogPost(ctx, input, authorID)
}
func (s *Service) UpdateBlogPost(ctx context.Context, id string, input BlogPostInput) (*domain.BlogPost, error) {
	return s.Repo.UpdateBlogPost(ctx, id, input)
}
func (s *Service) DeleteBlogPost(ctx context.Context, id string) error {
	return s.Repo.DeleteBlogPost(ctx, id)
}

// Audit log
func (s *Service) ListAuditLogs(ctx context.Context, filter ListFilter) ([]*domain.AuditLog, int64, error) {
	normalizePage(&filter)
	return s.Repo.ListAuditLogs(ctx, filter)
}

// Self (super-admin)
func (s *Service) UpdatePassword(ctx context.Context, id, currentPassword, newPassword string) error {
	return s.Repo.UpdateSuperAdminPassword(ctx, id, currentPassword, newPassword)
}
func (s *Service) RevokeSessions(ctx context.Context, id string) error {
	return s.Repo.RevokeSuperAdminSessions(ctx, id)
}
