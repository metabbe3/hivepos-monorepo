package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/branches/domain"
)

// CreateInput is the DTO for creating a branch. Branches are tenant-scoped via
// the session, so TenantID is injected from the request context, not the body.
type CreateInput struct {
	Name             string  `json:"name"`
	Address          *string `json:"address"`
	Phone            *string `json:"phone"`
	InvoiceFooter    *string `json:"invoiceFooter"`
	IsActive         *bool   `json:"isActive"`
	Latitude         *float64 `json:"latitude"`
	Longitude        *float64 `json:"longitude"`
	WhatsappLink     *string `json:"whatsappLink"`
	GoogleMapsLink   *string `json:"googleMapsLink"`
	PrinterHost      *string `json:"printerHost"`
	PrinterPort      *int    `json:"printerPort"`
	PrinterName      *string `json:"printerName"`
	PrinterEnabled   *bool   `json:"printerEnabled"`
	PrinterPaperSize *string `json:"printerPaperSize"`
	CoverageEnd      *string `json:"coverageEnd"`
	IsFreeTier       *bool   `json:"isFreeTier"`
	Slug             *string `json:"slug"`
}

// ListFilter holds the query params for listing branches.
type ListFilter struct {
	Search string
	Active string
	Page   int
	Limit  int
}

// Repository is the persistence port for branches.
type Repository interface {
	Create(ctx context.Context, b *domain.Branch) error
	FindByID(ctx context.Context, id, tenantID string) (*domain.Branch, error)
	List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Branch, int64, error)
	Update(ctx context.Context, b *domain.Branch) error
	Delete(ctx context.Context, id, tenantID string) error
}

// Service implements the branch use cases.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) Create(ctx context.Context, input CreateInput, tenantID string) (*domain.Branch, error) {
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	printerPort := 9100
	if input.PrinterPort != nil {
		printerPort = *input.PrinterPort
	}
	printerPaperSize := "58mm"
	if input.PrinterPaperSize != nil {
		printerPaperSize = *input.PrinterPaperSize
	}
	b := &domain.Branch{
		Name:             input.Name,
		Address:          input.Address,
		Phone:            input.Phone,
		InvoiceFooter:    input.InvoiceFooter,
		IsActive:         isActive,
		TenantID:         tenantID,
		Latitude:         input.Latitude,
		Longitude:        input.Longitude,
		WhatsappLink:     input.WhatsappLink,
		GoogleMapsLink:   input.GoogleMapsLink,
		PrinterHost:      input.PrinterHost,
		PrinterPort:      printerPort,
		PrinterName:      input.PrinterName,
		PrinterEnabled:   input.PrinterEnabled != nil && *input.PrinterEnabled,
		PrinterPaperSize: printerPaperSize,
		IsFreeTier:       input.IsFreeTier != nil && *input.IsFreeTier,
		Slug:             input.Slug,
		WorkDays:         []int32{1, 2, 3, 4, 5, 6},
	}
	// CoverageEnd is set via the PATCH path on a fetched entity; create keeps
	// it null (default). The field on input is accepted for forward-compat.
	if err := s.Repo.Create(ctx, b); err != nil {
		return nil, fmt.Errorf("creating branch: %w", err)
	}
	return b, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*domain.Branch, error) {
	b, err := s.Repo.FindByID(ctx, id, tenantID)
	if err != nil || b == nil {
		return nil, fmt.Errorf("branch not found")
	}
	return b, nil
}

func (s *Service) List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Branch, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		filter.Limit = 100
	}
	return s.Repo.List(ctx, tenantID, filter)
}

func (s *Service) Update(ctx context.Context, b *domain.Branch) error {
	return s.Repo.Update(ctx, b)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) error {
	return s.Repo.Delete(ctx, id, tenantID)
}
