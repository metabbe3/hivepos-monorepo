package application

import (
	"context"
	"crypto/rand"
	"fmt"
	"math"
	"time"

	"github.com/hivepos/api/internal/midtrans"
	"github.com/hivepos/api/internal/modules/billing/domain"
)

// CheckoutInput is the body for POST /api/billing/checkout. The dashboard sends planTier
// (GROWTH/PRO) + branchIds + months + promoCode; planId is accepted for back-compat.
type CheckoutInput struct {
	PlanTier  string   `json:"planTier"`
	BranchIDs []string `json:"branchIds"`
	Months    int      `json:"months"`
	PlanID    string   `json:"planId,omitempty"`
	PromoCode *string  `json:"promoCode,omitempty"`
}

// WebhookInput is the (subset of the) Midtrans webhook body we act on.
type WebhookInput struct {
	OrderID           string `json:"order_id"`
	TransactionStatus string `json:"transaction_status"`
	SignatureKey      string `json:"signature_key"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
}

// PromoValidateInput is the body for POST /api/billing/promo/validate.
type PromoValidateInput struct {
	Code   string `json:"code"`
	PlanID string `json:"planId"`
}

// CheckoutResult is returned by Service.Checkout. Shape mirrors the FE contract
// (status + snapToken + redirectUrl + message) so handleCheckout opens Snap.
type CheckoutResult struct {
	Status      string `json:"status"`
	SnapToken   string `json:"snapToken"`
	RedirectURL string `json:"redirectUrl"`
	Message     string `json:"message,omitempty"`
}

// PromoValidateResult is returned by Service.ValidatePromo.
type PromoValidateResult struct {
	Valid       bool    `json:"valid"`
	Reason      string  `json:"reason,omitempty"`
	Type        string  `json:"type,omitempty"`  // FREE_MONTH | DISCOUNT_PERCENT | DISCOUNT_FIXED
	Value       float64 `json:"value,omitempty"`
	PromoCodeID string  `json:"promoCodeId,omitempty"`
}

// Repository is the port for billing persistence (hexagonal architecture).
type Repository interface {
	GetSubscriptionByTenant(ctx context.Context, tenantID string) (*domain.Subscription, error)
	GetPlanByID(ctx context.Context, planID string) (*domain.Plan, error)
	GetPlanByTier(ctx context.Context, tier string) (*domain.Plan, error)
	CreatePayment(ctx context.Context, p *domain.SaaSPayment) error
	GetPaymentByOrderID(ctx context.Context, orderID string) (*domain.SaaSPayment, error)
	GetOutlets(ctx context.Context, tenantID string) ([]*domain.BillingOutlet, error)
	GetTenantInfo(ctx context.Context, tenantID string) (*domain.BillingTenant, error)
	UpdatePaymentStatus(ctx context.Context, id string, status domain.SaaSPaymentStatus) error
	ActivateSubscription(ctx context.Context, tenantID string, periodEnd time.Time) error
	GetPromoByCode(ctx context.Context, code string) (*domain.PromoCode, error)
	RedeemPromo(ctx context.Context, promoCodeID, tenantID string) error
}

// Service implements the billing use cases.
type Service struct {
	Repo          Repository
	MidtransKey   string // server key; empty → checkout falls back to a mock token
	MidtransEnv   string // sandbox | production
}

func NewService(repo Repository, midtransServerKey, midtransEnv string) *Service {
	return &Service{Repo: repo, MidtransKey: midtransServerKey, MidtransEnv: midtransEnv}
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
	// Dashboard sends planTier; resolve to the Plan (planId accepted for back-compat).
	var plan *domain.Plan
	var err error
	if input.PlanID != "" {
		plan, err = s.Repo.GetPlanByID(ctx, input.PlanID)
	} else {
		plan, err = s.Repo.GetPlanByTier(ctx, input.PlanTier)
	}
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
	providerOrderID := "snap-" + uuid

	// Amount = outlets × price × months. Require at least 1 of each.
	months := input.Months
	if months < 1 {
		return nil, fmt.Errorf("months must be at least 1")
	}
	if months > 36 {
		return nil, fmt.Errorf("months exceeds maximum (36)")
	}
	outlets := len(input.BranchIDs)
	if outlets < 1 {
		return nil, fmt.Errorf("at least 1 outlet is required")
	}
	gross := plan.Price * float64(outlets) * float64(months)
	amount := gross
	// Apply promo code (TS calculateBill: FREE_MONTH / DISCOUNT_PERCENT / DISCOUNT_FIXED).
	var promoCodeID *string
	if input.PromoCode != nil && *input.PromoCode != "" {
		promo, perr := s.Repo.GetPromoByCode(ctx, *input.PromoCode)
		if perr != nil {
			return nil, fmt.Errorf("validating promo: %w", perr)
		}
		if promo == nil {
			return nil, fmt.Errorf("promo code invalid or expired")
		}
		if promo.MaxRedemptions > 0 && promo.UsedCount >= promo.MaxRedemptions {
			return nil, fmt.Errorf("promo code usage limit reached")
		}
		switch promo.Type {
		case "FREE_MONTH":
			charged := months - int(promo.Value)
			if charged < 0 {
				charged = 0
			}
			amount = plan.Price * float64(outlets) * float64(charged)
		case "DISCOUNT_PERCENT":
			amount = gross - math.Round(gross*promo.Value/100)
		case "DISCOUNT_FIXED":
			disc := promo.Value
			if disc > gross {
				disc = gross
			}
			amount = gross - disc
		}
		if amount < 0 {
			amount = 0
		}
		promoCodeID = &promo.ID
	}

	payment := &domain.SaaSPayment{
		TenantID:        tenantID,
		Amount:          amount,
		OutletCount:     outlets,
		UnitPrice:       plan.Price,
		MonthsPurchased: months,
		Status:          domain.PaymentPending,
		Provider:        "MIDTRANS",
		ProviderOrderID: providerOrderID,
		PromoCodeID:     promoCodeID,
	}
	if err := s.Repo.CreatePayment(ctx, payment); err != nil {
		return nil, fmt.Errorf("creating payment: %w", err)
	}

	// Mint a real Snap token when the server key is configured; otherwise fall back to a
	// mock token so dev without keys still returns a shape the FE can open.
	var token, redirectURL string
	if s.MidtransKey != "" {
		var tname, email string
		if tenant, _ := s.Repo.GetTenantInfo(ctx, tenantID); tenant != nil {
			tname, email = tenant.Name, tenant.OwnerEmail
		}
		res, merr := midtrans.CreateTransaction(ctx, s.MidtransKey, s.MidtransEnv, midtrans.TransactionRequest{
			OrderID:     providerOrderID,
			GrossAmount: amount,
			TenantName:  tname,
			OwnerEmail:  email,
			Item: midtrans.ItemDetail{
				ID:       "subscription",
				Name:     fmt.Sprintf("hivePOS Subscription (%d outlet, %d bln)", outlets, months),
				Price:    amount,
				Quantity: 1,
			},
			CustomField1: fmt.Sprintf("outlets:%d", outlets),
			CustomField2: fmt.Sprintf("months:%d", months),
		})
		if merr != nil {
			return nil, fmt.Errorf("midtrans: %w", merr)
		}
		token, redirectURL = res.Token, res.RedirectURL
	} else {
		token = "mock-snap-token-" + uuid
		redirectURL = "https://app.sandbox.midtrans.com/snap/v2/redirection/" + uuid
	}

	return &CheckoutResult{Status: "PENDING", SnapToken: token, RedirectURL: redirectURL}, nil
}

// HandleWebhook processes a Midtrans notification.
func (s *Service) HandleWebhook(ctx context.Context, input WebhookInput) error {
	// Verify HMAC-SHA512 signature (order_id + status_code + gross_amount + server_key).
	// In dev without a server key, fall back to requiring a non-empty signature so the
	// endpoint isn't wide open.
	if s.MidtransKey != "" {
		if !midtrans.VerifySignature(s.MidtransKey, input.OrderID, input.StatusCode, input.GrossAmount, input.SignatureKey) {
			return fmt.Errorf("invalid signature")
		}
	} else if input.SignatureKey == "" {
		return fmt.Errorf("missing signature_key")
	}

	payment, err := s.Repo.GetPaymentByOrderID(ctx, input.OrderID)
	if err != nil {
		return fmt.Errorf("fetching payment: %w", err)
	}
	if payment == nil {
		return fmt.Errorf("payment not found for order_id %s", input.OrderID)
	}

	// Idempotency: Midtrans retries webhooks. If this payment is already PAID,
	// a duplicate notification must not extend the subscription again.
	if payment.Status == domain.PaymentPaid {
		return nil
	}

	// Only SUCCESS / SETTLEMENT advance the subscription.
	if input.TransactionStatus != "capture" && input.TransactionStatus != "settlement" && input.TransactionStatus != "success" {
		return nil
	}

	if err := s.Repo.UpdatePaymentStatus(ctx, payment.ID, domain.PaymentPaid); err != nil {
		return fmt.Errorf("updating payment status: %w", err)
	}

	// Extend the subscription by the purchased number of months (legacy Go hardcoded 1,
	// so a multi-month payment only granted 1 month of access).
	months := payment.MonthsPurchased
	if months < 1 {
		months = 1
	}
	periodEnd := time.Now().AddDate(0, months, 0)
	if err := s.Repo.ActivateSubscription(ctx, payment.TenantID, periodEnd); err != nil {
		return fmt.Errorf("activating subscription: %w", err)
	}

	// Redeem the promo (increment count + audit) — runs once per PAID transition.
	if payment.PromoCodeID != nil {
		_ = s.Repo.RedeemPromo(ctx, *payment.PromoCodeID, payment.TenantID)
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
		Valid:       true,
		Type:        promo.Type,
		Value:       promo.Value,
		PromoCodeID: promo.ID,
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
