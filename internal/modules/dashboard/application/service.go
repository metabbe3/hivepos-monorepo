package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/dashboard/domain"
)

// StatsFilter controls the dashboard aggregation window.
type StatsFilter struct {
	BranchID string
	Module   string // LAUNDRY | FNB | SALON
	From     string // YYYY-MM-DD
	To       string // YYYY-MM-DD
}

// Repository is the port for dashboard aggregation queries (hexagonal).
type Repository interface {
	GetStats(ctx context.Context, tenantID string, f StatsFilter) (*domain.Stats, error)
	GetKanban(ctx context.Context, tenantID, branchID, module string) ([]*domain.KanbanEntry, error)
	GetHeatmap(ctx context.Context, tenantID, branchID string) ([]*domain.HeatmapPoint, error)
}

// Service implements the dashboard use cases (read-only).
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) GetStats(ctx context.Context, tenantID string, f StatsFilter) (*domain.Stats, error) {
	if f.From == "" || f.To == "" {
		return nil, fmt.Errorf("from and to dates are required")
	}
	return s.Repo.GetStats(ctx, tenantID, f)
}

func (s *Service) GetKanban(ctx context.Context, tenantID, branchID, module string) ([]*domain.KanbanEntry, error) {
	return s.Repo.GetKanban(ctx, tenantID, branchID, module)
}

func (s *Service) GetHeatmap(ctx context.Context, tenantID, branchID string) ([]*domain.HeatmapPoint, error) {
	return s.Repo.GetHeatmap(ctx, tenantID, branchID)
}
