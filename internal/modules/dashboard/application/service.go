package application

import (
	"context"
	"time"

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
	GetKanban(ctx context.Context, tenantID, branchID, module string) ([]map[string]interface{}, error)
	GetHeatmap(ctx context.Context, tenantID, branchID string) (map[string]interface{}, error)
}

// Service implements the dashboard use cases (read-only).
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) GetStats(ctx context.Context, tenantID string, f StatsFilter) (*domain.Stats, error) {
	// Default the aggregation window to the last 30 days (WIB-agnostic). The TS
	// backend applied a 30-day default; the Go port's hard requirement broke
	// callers (e.g. the dashboard card) that omit from/to entirely.
	if f.From == "" || f.To == "" {
		now := time.Now()
		if f.To == "" {
			f.To = now.Format("2006-01-02")
		}
		if f.From == "" {
			f.From = now.AddDate(0, 0, -30).Format("2006-01-02")
		}
	}
	return s.Repo.GetStats(ctx, tenantID, f)
}

func (s *Service) GetKanban(ctx context.Context, tenantID, branchID, module string) ([]map[string]interface{}, error) {
	return s.Repo.GetKanban(ctx, tenantID, branchID, module)
}

func (s *Service) GetHeatmap(ctx context.Context, tenantID, branchID string) (map[string]interface{}, error) {
	return s.Repo.GetHeatmap(ctx, tenantID, branchID)
}
