// Package validate is a tiny field-validator that accumulates FieldErrors and
// turns them into a single apperror.Validation. Replaces the scattered
// `if x == ""` checks across domain services.
package validate

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/hivepos/api/internal/shared/apperror"
)

// V accumulates field-level validation issues.
type V struct{ errs []apperror.FieldError }

// Required records an error if value is empty (after trimming).
func (v *V) Required(field, value string) {
	if strings.TrimSpace(value) == "" {
		v.add(field, field+" is required")
	}
}

// RequiredPtr records an error if the pointer is nil.
func (v *V) RequiredPtr(field string, p any) {
	if p == nil {
		v.add(field, field+" is required")
	}
}

// Min records an error if value is below min.
func (v *V) Min(field string, value, min int) {
	if value < min {
		v.add(field, fmt.Sprintf("%s must be at least %d", field, min))
	}
}

// MinLen records an error if len(s) is below min.
func (v *V) MinLen(field, s string, min int) {
	if len(s) < min {
		v.add(field, fmt.Sprintf("%s must be at least %d characters", field, min))
	}
}

// OneOf records an error if value is not one of allowed.
func (v *V) OneOf(field, value string, allowed ...string) {
	for _, a := range allowed {
		if value == a {
			return
		}
	}
	v.add(field, fmt.Sprintf("%s must be one of %s", field, strings.Join(allowed, ", ")))
}

// MaxLen records an error if len(s) exceeds max.
func (v *V) MaxLen(field, s string, max int) {
	if len(s) > max {
		v.add(field, fmt.Sprintf("%s must be at most %d characters", field, max))
	}
}

// Match records an error if a non-empty value does not match rx.
func (v *V) Match(field, value string, rx *regexp.Regexp) {
	if value == "" {
		return
	}
	if !rx.MatchString(value) {
		v.add(field, field+" has an invalid format")
	}
}

func (v *V) add(field, msg string) {
	v.errs = append(v.errs, apperror.FieldError{Field: field, Message: msg})
}

// Err returns an apperror.Validation if any errors accumulated, else nil.
func (v *V) Err() error {
	if len(v.errs) == 0 {
		return nil
	}
	return apperror.NewValidation("Validation failed", v.errs...)
}
