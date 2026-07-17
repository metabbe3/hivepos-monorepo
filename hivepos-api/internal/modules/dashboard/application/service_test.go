package application_test

import (
	"context"
	"testing"

	"github.com/hivepos/api/internal/modules/dashboard/application"
	"github.com/hivepos/api/internal/modules/dashboard/domain"
)

type fakeRepo struct {
	stats    *domain.Stats
	statsErr error
	kanban   []map[string]interface{}
	heatmap  map[string]interface{}
}

func (f *fakeRepo) GetStats(_ context.Context, _ string, _ application.StatsFilter) (*domain.Stats, error) {
	return f.stats, f.statsErr
}
func (f *fakeRepo) GetKanban(_ context.Context, _, _, _ string) ([]map[string]interface{}, error) {
	return f.kanban, nil
}
func (f *fakeRepo) GetHeatmap(_ context.Context, _, _ string) (map[string]interface{}, error) {
	return f.heatmap, nil
}

func TestGetStats_DelegatesAndErrors(t *testing.T) {
	r := &fakeRepo{stats: &domain.Stats{TodayOrders: 9}}
	got, err := application.NewService(r).GetStats(context.Background(), "t1", application.StatsFilter{})
	if err != nil || got.TodayOrders != 9 {
		t.Fatalf("GetStats delegate: %v / %+v", err, got)
	}

	r2 := &fakeRepo{statsErr: errStr("db")}
	if _, err := application.NewService(r2).GetStats(context.Background(), "t1", application.StatsFilter{}); err == nil {
		t.Fatal("repo error must surface")
	}
}

func TestGetKanban_Delegates(t *testing.T) {
	r := &fakeRepo{kanban: []map[string]interface{}{{"id": "k1"}}}
	got, err := application.NewService(r).GetKanban(context.Background(), "t1", "b1", "LAUNDRY")
	if err != nil || len(got) != 1 {
		t.Fatalf("GetKanban: %v / %d", err, len(got))
	}
}

func TestGetHeatmap_Delegates(t *testing.T) {
	r := &fakeRepo{heatmap: map[string]interface{}{"customerVisits": []interface{}{}}}
	got, err := application.NewService(r).GetHeatmap(context.Background(), "t1", "b1")
	if err != nil || got["customerVisits"] == nil {
		t.Fatalf("GetHeatmap: %v / %+v", err, got)
	}
}

type errStr string

func (e errStr) Error() string { return string(e) }
