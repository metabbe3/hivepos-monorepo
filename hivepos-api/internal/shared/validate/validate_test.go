package validate_test

import (
	"regexp"
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

func TestMaxLen(t *testing.T) {
	var v validate.V
	v.MaxLen("name", "ok", 120)        // under → clean
	v.MaxLen("name", "too long", 2)    // over → error
	ae := apperror.As(v.Err())
	if ae == nil || len(ae.Details) != 1 || ae.Details[0].Field != "name" {
		t.Fatalf("want 1 name detail, got %+v", ae)
	}
}

func TestMatch(t *testing.T) {
	rx := regexp.MustCompile(`^[0-9+\-\s]{6,}$`)

	var ok validate.V
	ok.Match("phone", "0812 3456 7890", rx) // valid → clean
	ok.Match("phone", "", rx)               // empty → skipped (nullable)
	if err := ok.Err(); err != nil {
		t.Fatalf("valid/empty phone should not error: %v", err)
	}

	var bad validate.V
	bad.Match("phone", "abc", rx) // invalid → error
	ae := apperror.As(bad.Err())
	if ae == nil || len(ae.Details) != 1 || ae.Details[0].Field != "phone" {
		t.Fatalf("want 1 phone detail, got %+v", ae)
	}
}
