package application_test

import (
	"context"
	"testing"
	"time"

	"github.com/hivepos/api/internal/modules/billing/application"
	"github.com/hivepos/api/internal/modules/billing/domain"
)

type fakeRepo struct {
	sub       *domain.Subscription
	subErr    error
	plan      *domain.Plan
	payment   *domain.SaaSPayment
	promo     *domain.PromoCode
	promoErr  error
	created     *domain.SaaSPayment
	settledOrder string
}

func (f *fakeRepo) GetSubscriptionByTenant(_ context.Context, _ string) (*domain.Subscription, error) {
	return f.sub, f.subErr
}
func (f *fakeRepo) GetOutlets(_ context.Context, _ string) ([]*domain.BillingOutlet, error) {
	return nil, nil
}
func (f *fakeRepo) GetTenantInfo(_ context.Context, _ string) (*domain.BillingTenant, error) {
	return nil, nil
}
func (f *fakeRepo) GetPlanByID(_ context.Context, _ string) (*domain.Plan, error) { return f.plan, nil }
func (f *fakeRepo) GetPlanByTier(_ context.Context, _ string) (*domain.Plan, error) { return f.plan, nil }
func (f *fakeRepo) CreatePayment(_ context.Context, p *domain.SaaSPayment) error {
	p.ID = "pay-new"
	f.created = p
	return nil
}
func (f *fakeRepo) GetPaymentByOrderID(_ context.Context, _ string) (*domain.SaaSPayment, error) {
	return f.payment, nil
}
func (f *fakeRepo) GetPromoByCode(_ context.Context, _ string) (*domain.PromoCode, error) {
	return f.promo, f.promoErr
}
func (f *fakeRepo) SettlePayment(_ context.Context, orderID string) error {
	f.settledOrder = orderID
	return nil
}

func TestGetStatus_NoSubscription(t *testing.T) {
	r := &fakeRepo{}
	got, err := application.NewService(r, "", "").GetStatus(context.Background(), "t1")
	if err != nil || got.Status != domain.StatusNone {
		t.Fatalf("nil sub must yield StatusNone: %v / %+v", err, got)
	}
}

func TestGetStatus_Found(t *testing.T) {
	r := &fakeRepo{sub: &domain.Subscription{TenantID: "t1", Status: domain.StatusActive}}
	got, _ := application.NewService(r, "", "").GetStatus(context.Background(), "t1")
	if got.Status != domain.StatusActive {
		t.Fatalf("expected active, got %+v", got)
	}
}

func TestCheckout_PlanNotFound(t *testing.T) {
	r := &fakeRepo{}
	if _, err := application.NewService(r, "", "").Checkout(context.Background(), application.CheckoutInput{PlanID: "p1", Months: 1, BranchIDs: []string{"b1"}}, "t1"); err == nil {
		t.Fatal("missing plan must error")
	}
}

func TestCheckout_HappyCreatesPendingPayment(t *testing.T) {
	r := &fakeRepo{plan: &domain.Plan{ID: "p1", Price: 100000}}
	res, err := application.NewService(r, "", "").Checkout(context.Background(), application.CheckoutInput{PlanID: "p1", Months: 1, BranchIDs: []string{"b1"}}, "t1")
	if err != nil || res.SnapToken == "" || r.created == nil || r.created.Status != domain.PaymentPending {
		t.Fatalf("checkout: %v / %+v / %+v", err, res, r.created)
	}
}

func TestWebhook_MissingSignature(t *testing.T) {
	if err := application.NewService(&fakeRepo{}, "", "").HandleWebhook(context.Background(), application.WebhookInput{}); err == nil {
		t.Fatal("missing signature must error")
	}
}

func TestWebhook_PaymentNotFound(t *testing.T) {
	r := &fakeRepo{}
	if err := application.NewService(r, "", "").HandleWebhook(context.Background(), application.WebhookInput{SignatureKey: "x", OrderID: "o1"}); err == nil {
		t.Fatal("missing payment must error")
	}
}

func TestWebhook_NonSuccessIsNoop(t *testing.T) {
	r := &fakeRepo{payment: &domain.SaaSPayment{ID: "pay1", TenantID: "t1"}}
	if err := application.NewService(r, "", "").HandleWebhook(context.Background(), application.WebhookInput{SignatureKey: "x", OrderID: "o1", TransactionStatus: "deny"}); err != nil {
		t.Fatal(err)
	}
	if r.settledOrder != "" {
		t.Fatal("non-success webhook must not settle")
	}
}

func TestWebhook_SuccessActivates(t *testing.T) {
	r := &fakeRepo{payment: &domain.SaaSPayment{ID: "pay1", TenantID: "t1"}}
	if err := application.NewService(r, "", "").HandleWebhook(context.Background(), application.WebhookInput{SignatureKey: "x", OrderID: "o1", TransactionStatus: "settlement"}); err != nil {
		t.Fatal(err)
	}
	if r.settledOrder != "o1" {
		t.Fatalf("success must settle payment 'o1': settledOrder=%q", r.settledOrder)
	}
}

func TestValidatePromo_NotFound(t *testing.T) {
	r := &fakeRepo{}
	res, _ := application.NewService(r, "", "").ValidatePromo(context.Background(), application.PromoValidateInput{Code: "X"})
	if res.Valid || res.Reason != "not found" {
		t.Fatalf("nil promo must be invalid/not-found: %+v", res)
	}
}

func TestValidatePromo_Inactive(t *testing.T) {
	r := &fakeRepo{promo: &domain.PromoCode{ID: "pr1", Active: false}}
	res, _ := application.NewService(r, "", "").ValidatePromo(context.Background(), application.PromoValidateInput{Code: "X"})
	if res.Valid {
		t.Fatal("inactive promo must be invalid")
	}
}

func TestValidatePromo_Expired(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	r := &fakeRepo{promo: &domain.PromoCode{ID: "pr1", Active: true, ValidUntil: &past}}
	res, _ := application.NewService(r, "", "").ValidatePromo(context.Background(), application.PromoValidateInput{Code: "X"})
	if res.Valid || res.Reason != "expired" {
		t.Fatalf("expired promo: %+v", res)
	}
}

func TestValidatePromo_UsageExceeded(t *testing.T) {
	r := &fakeRepo{promo: &domain.PromoCode{ID: "pr1", Active: true, MaxRedemptions: 5, UsedCount: 5}}
	res, _ := application.NewService(r, "", "").ValidatePromo(context.Background(), application.PromoValidateInput{Code: "X"})
	if res.Valid || res.Reason != "usage exceeded" {
		t.Fatalf("exceeded promo: %+v", res)
	}
}

func TestValidatePromo_Valid(t *testing.T) {
	r := &fakeRepo{promo: &domain.PromoCode{ID: "pr1", Active: true, Type: "DISCOUNT_PERCENT", Value: 10}}
	res, _ := application.NewService(r, "", "").ValidatePromo(context.Background(), application.PromoValidateInput{Code: "X"})
	if !res.Valid || res.PromoCodeID != "pr1" {
		t.Fatalf("valid promo: %+v", res)
	}
}
