package validate_test

import (
	"testing"

	"github.com/hivepos/api/internal/shared/apperror"
	"github.com/hivepos/api/internal/shared/validate"
)

func TestCleanReturnsNil(t *testing.T) {
	var v validate.V
	v.Required("name", "ok")
	v.Min("age", 5, 1)
	if err := v.Err(); err != nil {
		t.Fatalf("clean validator returned %v", err)
	}
}

func TestRequiredEmptyAndWhitespace(t *testing.T) {
	var v validate.V
	v.Required("name", "")
	v.Required("email", "   ")
	err := v.Err()
	if err == nil {
		t.Fatal("want validation error")
	}
	ae := apperror.As(err)
	if ae == nil || len(ae.Details) != 2 {
		t.Fatalf("want 2 details, got %+v", ae)
	}
}

func TestMinAndMinLen(t *testing.T) {
	var v validate.V
	v.Min("qty", 0, 1)
	v.MinLen("pin", "12", 4)
	err := v.Err()
	if err == nil {
		t.Fatal("want validation error")
	}
	ae := apperror.As(err)
	fields := []string{ae.Details[0].Field, ae.Details[1].Field}
	if fields[0] != "qty" || fields[1] != "pin" {
		t.Fatalf("field order wrong: %v", fields)
	}
}

func TestOneOf(t *testing.T) {
	var v validate.V
	v.OneOf("role", "guest", "admin", "staff")
	if err := v.Err(); err == nil {
		t.Fatal("guest not allowed should error")
	}

	var v2 validate.V
	v2.OneOf("role", "admin", "admin", "staff")
	if err := v2.Err(); err != nil {
		t.Fatalf("allowed value should not error: %v", err)
	}
}

func TestMultipleAccumulate(t *testing.T) {
	var v validate.V
	v.Required("a", "")
	v.Required("b", "")
	v.Min("c", -1, 0)
	ae := apperror.As(v.Err())
	if len(ae.Details) != 3 {
		t.Fatalf("want 3 accumulated details, got %d", len(ae.Details))
	}
}
