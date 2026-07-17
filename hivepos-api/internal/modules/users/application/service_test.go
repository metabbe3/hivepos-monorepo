package application_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/hivepos/api/internal/modules/users/application"
	"github.com/hivepos/api/internal/modules/users/domain"
)

type fakeRepo struct {
	users      map[string]*domain.User
	roles      map[string]*domain.Role
	createErr  error
	lastCreate *domain.User
	lastFilter application.ListFilter
	listTotal  int64
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{users: map[string]*domain.User{}, roles: map[string]*domain.Role{}}
}

func (f *fakeRepo) CreateUser(_ context.Context, u *domain.User) error {
	if f.createErr != nil {
		return f.createErr
	}
	u.ID = "user-new"
	f.users[u.ID] = u
	f.lastCreate = u
	return nil
}
func (f *fakeRepo) FindUserByID(_ context.Context, id, _ string) (*domain.User, error) {
	return f.users[id], nil
}
func (f *fakeRepo) ListUsers(_ context.Context, _ string, fl application.ListFilter) ([]*domain.User, int64, error) {
	f.lastFilter = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) ListUserItems(_ context.Context, _ string, fl application.ListFilter) ([]*application.UserListItem, int64, error) {
	f.lastFilter = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) UpdateUser(_ context.Context, _, _ string, _ application.UpdateUserInput) error {
	return nil
}
func (f *fakeRepo) DeleteUser(_ context.Context, _, _ string) error    { return nil }
func (f *fakeRepo) SetPIN(_ context.Context, _, _, _ string) error     { return nil }
func (f *fakeRepo) ResetUserPassword(_ context.Context, _, _, _ string) error { return nil }
func (f *fakeRepo) GetRoleName(_ context.Context, _, _ string) (string, error) { return "", nil }
func (f *fakeRepo) CreateRole(_ context.Context, _ *domain.Role) error { return nil }
func (f *fakeRepo) FindRoleByID(_ context.Context, _, _ string) (*domain.Role, error) {
	return nil, nil
}
func (f *fakeRepo) ListRoles(_ context.Context, _ string, fl application.ListFilter) ([]*domain.Role, int64, error) {
	f.lastFilter = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) ListRoleItems(_ context.Context, _ string, fl application.ListFilter) ([]*application.RoleListItem, int64, error) {
	f.lastFilter = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) UpdateRole(_ context.Context, _, _ string, _ application.UpdateRoleInput) error {
	return nil
}
func (f *fakeRepo) DeleteRole(_ context.Context, _, _ string) error { return nil }

func strPtr(s string) *string { return &s }

func TestCreateUser_HashesPasswordAndPIN(t *testing.T) {
	r := newFakeRepo()
	s := application.NewService(r)
	pw := "secret"
	pin := "1234"
	u, err := s.CreateUser(context.Background(), application.CreateUserInput{
		Name: "A", Role: "STAFF", BranchID: "b1", Password: &pw, PIN: &pin,
	}, "t1")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if u.PasswordHash == nil || *u.PasswordHash == pw {
		t.Fatal("password must be hashed")
	}
	if u.PinHash == nil || *u.PinHash == pin {
		t.Fatal("PIN must be hashed")
	}
	if u.TenantID != "t1" || u.BranchID != "b1" || !u.IsActive {
		t.Fatalf("defaults/stamps wrong: %+v", u)
	}
}

func TestCreateUser_PinTooShort(t *testing.T) {
	s := application.NewService(newFakeRepo())
	pin := "12"
	_, err := s.CreateUser(context.Background(), application.CreateUserInput{
		Name: "A", Role: "STAFF", BranchID: "b1", PIN: &pin,
	}, "t1")
	if err == nil || !strings.Contains(err.Error(), "pin") {
		t.Fatalf("short PIN must error with pin message, got %v", err)
	}
}

func TestCreateUser_RepoError(t *testing.T) {
	r := newFakeRepo()
	r.createErr = errBoom
	_, err := application.NewService(r).CreateUser(context.Background(), application.CreateUserInput{Name: "A", Role: "STAFF", BranchID: "b1"}, "t1")
	if err == nil {
		t.Fatal("want error")
	}
}

func TestGetUser_NotFound(t *testing.T) {
	if _, err := application.NewService(newFakeRepo()).GetUser(context.Background(), "missing", "t1"); err == nil {
		t.Fatal("missing user must error")
	}
}

func TestSetPIN_TooShort(t *testing.T) {
	s := application.NewService(newFakeRepo())
	if err := s.SetPIN(context.Background(), "u1", "t1", application.SetPINInput{PIN: "1"}); err == nil {
		t.Fatal("short PIN must error")
	}
}

var errBoom = errors.New("boom")
