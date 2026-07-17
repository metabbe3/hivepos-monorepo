package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/hivepos/api/internal/modules/auth/application"
	"github.com/hivepos/api/internal/modules/auth/domain"
)

type fakeRepo struct {
	user    *domain.User
	userCtx *domain.UserContext
	bumpRet int
	bumpErr error
}

func (f *fakeRepo) FindUserByEmail(_ context.Context, _ string) (*domain.User, error) {
	return f.user, nil
}
func (f *fakeRepo) FindUserByID(_ context.Context, _ string) (*domain.User, error) {
	return f.user, nil
}
func (f *fakeRepo) CreateTenantWithOwner(_ context.Context, _ domain.RegisterInput, _ string) (string, string, string, error) {
	return "t1", "u1", "b1", nil
}
func (f *fakeRepo) BumpSessionVersion(_ context.Context, _ string) (int, error) {
	return f.bumpRet, f.bumpErr
}
func (f *fakeRepo) GetSessionVersion(_ context.Context, _ string) (int, error) {
	return f.bumpRet, f.bumpErr
}
func (f *fakeRepo) LoadUserContext(_ context.Context, _ string) (*domain.UserContext, error) {
	return f.userCtx, nil
}
func (f *fakeRepo) FindSuperAdminByEmail(_ context.Context, _ string) (*domain.UserContext, error) {
	return nil, nil
}
func (f *fakeRepo) FindUserByGoogleID(_ context.Context, _ string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeRepo) SetUserGoogleID(_ context.Context, _, _, _ string) error { return nil }
func (f *fakeRepo) ClearUserGoogleID(_ context.Context, _ string) error { return nil }
func (f *fakeRepo) LoadSuperAdminContext(_ context.Context, _ string) (*domain.UserContext, error) {
	return nil, nil
}

func TestLogin_UserNotFound(t *testing.T) {
	r := &fakeRepo{} // user == nil
	if _, err := application.NewService(r).Login(context.Background(), domain.LoginInput{Email: "x"}); !errors.Is(err, application.ErrInvalidCredentials) {
		t.Fatalf("missing user must be ErrInvalidCredentials, got %v", err)
	}
}

func TestLogin_ContextNil(t *testing.T) {
	r := &fakeRepo{user: &domain.User{ID: "u1"}} // userCtx == nil
	if _, err := application.NewService(r).Login(context.Background(), domain.LoginInput{Email: "x"}); !errors.Is(err, application.ErrInvalidCredentials) {
		t.Fatalf("nil context must be ErrInvalidCredentials, got %v", err)
	}
}

func TestLogin_Happy(t *testing.T) {
	r := &fakeRepo{user: &domain.User{ID: "u1"}, userCtx: &domain.UserContext{User: domain.User{ID: "u1"}}}
	uc, err := application.NewService(r).Login(context.Background(), domain.LoginInput{Email: "x"})
	if err != nil || uc.ID != "u1" {
		t.Fatalf("Login happy: %v / %+v", err, uc)
	}
}

func TestRegister_Delegates(t *testing.T) {
	tid, uid, bid, err := application.NewService(&fakeRepo{}).Register(context.Background(), domain.RegisterInput{}, "hash")
	if err != nil || tid != "t1" || uid != "u1" || bid != "b1" {
		t.Fatalf("Register: %v / %s %s %s", err, tid, uid, bid)
	}
}

func TestBumpSessionVersion_Delegates(t *testing.T) {
	r := &fakeRepo{bumpRet: 5}
	got, err := application.NewService(r).BumpSessionVersion(context.Background(), "u1")
	if err != nil || got != 5 {
		t.Fatalf("Bump: %d / %v", got, err)
	}
}
