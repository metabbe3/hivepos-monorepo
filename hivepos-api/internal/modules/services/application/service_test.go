package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/hivepos/api/internal/modules/services/application"
	"github.com/hivepos/api/internal/modules/services/domain"
)

type fakeRepo struct {
	services     map[string]*domain.Service
	groups       map[string]*domain.ServiceGroup
	createErr    error
	findErr      error
	listTotal    int64
	listErr      error
	lastFilter   application.ListFilter
	lastCreate   *domain.Service
	lastGroupCrt *domain.ServiceGroup
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{services: map[string]*domain.Service{}, groups: map[string]*domain.ServiceGroup{}}
}

func (f *fakeRepo) Create(_ context.Context, s *domain.Service) error {
	if f.createErr != nil {
		return f.createErr
	}
	s.ID = "svc-new"
	f.services[s.ID] = s
	f.lastCreate = s
	return nil
}
func (f *fakeRepo) FindByID(_ context.Context, id, _ string) (*domain.Service, error) {
	if f.findErr != nil {
		return nil, f.findErr
	}
	return f.services[id], nil
}
func (f *fakeRepo) List(_ context.Context, _ string, fl application.ListFilter) ([]*domain.Service, int64, error) {
	f.lastFilter = fl
	return nil, f.listTotal, f.listErr
}
func (f *fakeRepo) ListItems(_ context.Context, _ string, fl application.ListFilter) ([]*application.ServiceListItem, int64, error) {
	f.lastFilter = fl
	return nil, f.listTotal, f.listErr
}
func (f *fakeRepo) Update(_ context.Context, _ *domain.Service) error  { return nil }
func (f *fakeRepo) Delete(_ context.Context, _, _ string) error         { return nil }
func (f *fakeRepo) CountUsage(_ context.Context, _, _ string) (int, error) { return 0, nil }
func (f *fakeRepo) CreateGroup(_ context.Context, g *domain.ServiceGroup) error {
	g.ID = "grp-new"
	f.groups[g.ID] = g
	f.lastGroupCrt = g
	return nil
}
func (f *fakeRepo) FindGroupByID(_ context.Context, id, _ string) (*domain.ServiceGroup, error) {
	return f.groups[id], nil
}
func (f *fakeRepo) ListGroups(_ context.Context, _ string, fl application.ListFilter) ([]*domain.ServiceGroup, int64, error) {
	f.lastFilter = fl
	return nil, f.listTotal, f.listErr
}
func (f *fakeRepo) UpdateGroup(_ context.Context, _ *domain.ServiceGroup) error { return nil }
func (f *fakeRepo) DeleteGroup(_ context.Context, _, _ string) error            { return nil }

func TestCreate_AppliesDefaults(t *testing.T) {
	s := application.NewService(newFakeRepo())
	got, err := s.Create(context.Background(), application.CreateServiceInput{Name: "Wash"}, "t1", "b1")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.PricingType != domain.PerKg || got.CommissionType != domain.CommissionNone || got.Module != "LAUNDRY" || !got.IsActive {
		t.Fatalf("defaults not applied: %+v", got)
	}
	if got.BranchID != "b1" {
		t.Fatalf("branch not stamped: %s", got.BranchID)
	}
}

func TestCreate_KeepsExplicitValues(t *testing.T) {
	s := application.NewService(newFakeRepo())
	got, _ := s.Create(context.Background(), application.CreateServiceInput{
		Name: "X", PricingType: domain.PerItem, Module: "DRYCLEAN",
	}, "t1", "b1")
	if got.PricingType != domain.PerItem || got.Module != "DRYCLEAN" {
		t.Fatalf("explicit values not kept: %+v", got)
	}
}

func TestCreate_RepoError(t *testing.T) {
	r := newFakeRepo()
	r.createErr = errors.New("db")
	_, err := application.NewService(r).Create(context.Background(), application.CreateServiceInput{Name: "X"}, "t1", "b1")
	if err == nil {
		t.Fatal("want error")
	}
}

func TestGet_FoundAndNotFound(t *testing.T) {
	r := newFakeRepo()
	r.services["s1"] = &domain.Service{ID: "s1"}
	s := application.NewService(r)
	if got, err := s.Get(context.Background(), "s1", "t1"); err != nil || got == nil {
		t.Fatalf("Get found: %v/%+v", err, got)
	}
	if _, err := s.Get(context.Background(), "missing", "t1"); err == nil {
		t.Fatal("Get missing must error")
	}
}

func TestList_ClampsTo100(t *testing.T) {
	r := newFakeRepo()
	s := application.NewService(r)
	if _, _, err := s.List(context.Background(), "t1", application.ListFilter{Page: 0, Limit: 999}); err != nil {
		t.Fatal(err)
	}
	// services clamp caps at 100 (not reset to default).
	if r.lastFilter.Page != 1 || r.lastFilter.Limit != 100 {
		t.Fatalf("clamp = (%d,%d), want (1,100)", r.lastFilter.Page, r.lastFilter.Limit)
	}
}

func TestCreateGroup_Defaults(t *testing.T) {
	r := newFakeRepo()
	s := application.NewService(r)
	g, err := s.CreateGroup(context.Background(), application.CreateGroupInput{Name: "Speed"}, "t1", "b1")
	if err != nil || g.Module != "LAUNDRY" || g.SortOrder != 0 || g.BranchID != "b1" {
		t.Fatalf("group defaults wrong: %v / %+v", err, g)
	}
}

func TestGetGroup_NotFound(t *testing.T) {
	if _, err := application.NewService(newFakeRepo()).GetGroup(context.Background(), "g1", "t1"); err == nil {
		t.Fatal("missing group must error")
	}
}
