package application

import (
	"context"
	"crypto/rand"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/billing/domain"
)

// CheckoutInput is the body for POST /api/billing/checkout.
type CheckoutInput struct {
	PlanID    string  `json:"planId"`
	PromoCode *string `json:"promoCode,omitempty"`
}

// WebhookInput is the (subset of the) Midtrans webhook body we act on.
type WebhookInput struct {
	OrderID          string `json:"order_id"`
	TransactionStatus string `json:"transaction_status"`
	SignatureKey     string `json:"signature_key"`
}

// PromoValidateInput is the body for POST /api/billing/promo/validate.
type PromoValidateInput struct {
	Code   string `json:"code"`
	PlanID string `json:"planId"`
}

// CheckoutResult is returned by Service.Checkout.
type CheckoutResult struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirectUrl"`
}

// PromoValidateResult is returned by Service.ValidatePromo.
type PromoValidateResult struct {
	Valid         bool                 `json:"valid"`
	Reason        string               `json:"reason,omitempty"`
	DiscountType  domain.DiscountType  `json:"discountType,omitempty"`
	DiscountValue float64              `json:"discountValue,omitempty"`
	PromoCodeID   string               `json:"promoCodeId,omitempty"`
}

// Repository is the port for billing persistence (hexagonal architecture).
type Repository interface {
	GetSubscriptionByTenant(ctx context.Context, tenantID string) (*domain.Subscription, error)
	GetPlanByID(ctx context.Context, planID string) (*domain.Plan, error)
	CreatePayment(ctx context.Context, p *domain.SaaSPayment) error
	GetPaymentByOrderID(ctx context.Context, orderID string) (*domain.SaaSPayment, error)
	UpdatePaymentStatus(ctx context.Context, id string, status domain.SaaSPaymentStatus) error
	ActivateSubscription(ctx context.Context, tenantID string, periodEnd time.Time) error
	GetPromoByCode(ctx context.Context, code string) (*domain.PromoCode, error)
}

// Service implements the billing use cases.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

// GetStatus returns the tenant's current subscription (or a none-status shell).
func (s *Service) GetStatus(ctx context.Context, tenantID string) (*domain.Subscription, error) {
	sub, err := s.Repo.GetSubscriptionByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("fetching subscription: %w", err)
	}
	if sub == nil {
		return &domain.Subscription{TenantID: tenantID, Status: domain.StatusNone}, nil
	}
	return sub, nil
}

// Checkout creates a pending SaaSPayment and returns a (stubbed) Midtrans Snap token.
func (s *Service) Checkout(ctx context.Context, input CheckoutInput, tenantID string) (*CheckoutResult, error) {
	plan, err := s.Repo.GetPlanByID(ctx, input.PlanID)
	if err != nil {
		return nil, fmt.Errorf("fetching plan: %w", err)
	}
	if plan == nil {
		return nil, fmt.Errorf("plan not found")
	}

	// ponytail: low — stub Midtrans Snap API; integrate github.com/midtrans/midtrans-go when keys available.
	// Generate a pseudo-random token (crypto/rand for unpredictability).
	uuid, err := randomUUID()
	if err != nil {
		return nil, fmt.Errorf("generating token: %w", err)
	}
	token := "mock-snap-token-" + uuid
	redirectURL := "https://app.sandbox.midtrans.com/snap/v2/redirection/" + uuid
	providerOrderID := "snap-" + uuid

	payment := &domain.SaaSPayment{
		TenantID:        tenantID,
		Amount:          plan.Price,
		Status:          domain.PaymentPending,
		Provider:        "MIDTRANS",
		ProviderOrderID: providerOrderID,
	}
	if err := s.Repo.CreatePayment(ctx, payment); err != nil {
		return nil, fmt.Errorf("creating payment: %w", err)
	}

	return &CheckoutResult{Token: token, RedirectURL: redirectURL}, nil
}

// HandleWebhook processes a Midtrans notification.
func (s *Service) HandleWebhook(ctx context.Context, input WebhookInput) error {
	// ponytail: low — stub signature verification (only checks non-empty). Verify HMAC SHA512
	// with server key against order_id+status+gross_amount when Midtrans keys are configured.
	if input.SignatureKey == "" {
		return fmt.Errorf("missing signature_key")
	}

	payment, err := s.Repo.GetPaymentByOrderID(ctx, input.OrderID)
	if err != nil {
		return fmt.Errorf("fetching payment: %w", err)
	}
	if payment == nil {
		return fmt.Errorf("payment not found for order_id %s", input.OrderID)
	}

	// Only SUCCESS / SETTLEMENT advance the subscription.
	if input.TransactionStatus != "capture" && input.TransactionStatus != "settlement" && input.TransactionStatus != "success" {
		return nil
	}

	if err := s.Repo.UpdatePaymentStatus(ctx, payment.ID, domain.PaymentPaid); err != nil {
		return fmt.Errorf("updating payment status: %w", err)
	}

	// Extend the subscription by one monthly period from now.
	periodEnd := time.Now().AddDate(0, 1, 0)
	if err := s.Repo.ActivateSubscription(ctx, payment.TenantID, periodEnd); err != nil {
		return fmt.Errorf("activating subscription: %w", err)
	}

	return nil
}

// ValidatePromo checks a promo code for validity against the current usage / expiry.
func (s *Service) ValidatePromo(ctx context.Context, input PromoValidateInput) (*PromoValidateResult, error) {
	promo, err := s.Repo.GetPromoByCode(ctx, input.Code)
	if err != nil {
		return nil, fmt.Errorf("fetching promo: %w", err)
	}
	if promo == nil || !promo.Active {
		return &PromoValidateResult{Valid: false, Reason: "not found"}, nil
	}
	if promo.ValidUntil != nil && time.Now().After(*promo.ValidUntil) {
		return &PromoValidateResult{Valid: false, Reason: "expired"}, nil
	}
	if promo.MaxRedemptions > 0 && promo.UsedCount >= promo.MaxRedemptions {
		return &PromoValidateResult{Valid: false, Reason: "usage exceeded"}, nil
	}
	return &PromoValidateResult{
		Valid:         true,
		DiscountType:  promo.DiscountType,
		DiscountValue: promo.DiscountValue,
		PromoCodeID:   promo.ID,
	}, nil
}

// randomUUID returns a v4-style UUID string using crypto/rand.
func randomUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	// RFC 4122 v4 / variant bits.
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}
