// Package apperror is the single source of error responses. It mirrors the
// pos-saas (TS) AppError catalog so Go error envelopes carry the same stable
// code + field-level details clients already branch on.
package apperror

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
)

// Code mirrors pos-saas ErrorCode (modules/shared/errors/error-code.ts).
type Code string

const (
	Validation               Code = "VALIDATION_ERROR"
	InvalidInput             Code = "INVALID_INPUT"
	Unauthenticated          Code = "UNAUTHENTICATED"
	Forbidden                Code = "FORBIDDEN"
	InsufficientPermission   Code = "INSUFFICIENT_PERMISSION"
	NotFound                 Code = "NOT_FOUND"
	Conflict                 Code = "CONFLICT"
	PreconditionFailed       Code = "PRECONDITION_FAILED"
	BusinessRule             Code = "BUSINESS_RULE_VIOLATION"
	InvalidStatusTransition  Code = "INVALID_STATUS_TRANSITION"
	InsufficientBalance      Code = "INSUFFICIENT_BALANCE"
	AmountExceedsBalance     Code = "AMOUNT_EXCEEDS_BALANCE"
	OutletLocked             Code = "OUTLET_LOCKED"
	SubscriptionLimitReached Code = "SUBSCRIPTION_LIMIT_REACHED"
	RateLimited              Code = "RATE_LIMITED"
	Internal                 Code = "INTERNAL_ERROR"
	Database                 Code = "DATABASE_ERROR"
	ExternalService          Code = "EXTERNAL_SERVICE_ERROR"
)

// FieldError mirrors pos-saas FieldError: a single field-level issue.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error carries a stable Code + HTTP status + optional field details + an
// underlying cause. The cause is logged by the caller; it is never serialized.
type Error struct {
	Message string
	Status  int
	Code    Code
	Details []FieldError
	Cause   error
}

func (e *Error) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *Error) Unwrap() error { return e.Cause }

// As unwraps err to *Error; nil if err is not (or does not wrap) one.
func As(err error) *Error {
	var ae *Error
	if errors.As(err, &ae) {
		return ae
	}
	return nil
}

// ── Constructors mirroring pos-saas AppError subclasses ─────────────────

func NewValidation(msg string, details ...FieldError) *Error {
	return &Error{Message: msg, Status: http.StatusBadRequest, Code: Validation, Details: details}
}

func NewInvalidInput(msg string) *Error {
	return &Error{Message: msg, Status: http.StatusBadRequest, Code: InvalidInput}
}

func NewUnauthenticated(msg string) *Error {
	if msg == "" {
		msg = "Authentication required"
	}
	return &Error{Message: msg, Status: http.StatusUnauthorized, Code: Unauthenticated}
}

func NewForbidden(msg string) *Error {
	if msg == "" {
		msg = "You do not have permission to perform this action"
	}
	return &Error{Message: msg, Status: http.StatusForbidden, Code: Forbidden}
}

func NewInsufficientPermission(resource, action string) *Error {
	return &Error{
		Message: fmt.Sprintf("Missing permission: %s:%s", resource, action),
		Status:  http.StatusForbidden,
		Code:    InsufficientPermission,
	}
}

// NewNotFound mirrors TS NotFoundError(resource, id?).
func NewNotFound(resource, id string) *Error {
	if id != "" {
		return &Error{Message: fmt.Sprintf("%s not found (id: %s)", resource, id), Status: http.StatusNotFound, Code: NotFound}
	}
	return &Error{Message: fmt.Sprintf("%s not found", resource), Status: http.StatusNotFound, Code: NotFound}
}

func NewConflict(msg string) *Error {
	return &Error{Message: msg, Status: http.StatusConflict, Code: Conflict}
}

func NewBusinessRule(msg string) *Error {
	return &Error{Message: msg, Status: http.StatusBadRequest, Code: BusinessRule}
}

func NewInternal(msg string, cause error) *Error {
	if msg == "" {
		msg = "Internal server error"
	}
	return &Error{Message: msg, Status: http.StatusInternalServerError, Code: Internal, Cause: cause}
}

func NewDatabase(msg string, cause error) *Error {
	return &Error{Message: msg, Status: http.StatusInternalServerError, Code: Database, Cause: cause}
}

// production is set once at startup (main) to gate message redaction for 5xx.
var production bool

// SetProduction toggles prod mode: in prod, 5xx messages are redacted to a
// generic string so internals never reach clients.
func SetProduction(b bool) { production = b }

// envelope mirrors the TS ErrorEnvelope: { success:false, error:{code,message,details?} }.
type envelope struct {
	Success bool      `json:"success"`
	Error   bodyError `json:"error"`
}

type bodyError struct {
	Code    string       `json:"code"`
	Message string       `json:"message"`
	Details []FieldError `json:"details,omitempty"`
}

// Write serializes err to the standard envelope. *Error values emit their code
// and status; unknown errors become INTERNAL_ERROR. In production, 5xx messages
// are redacted. The cause is never serialized.
func Write(w http.ResponseWriter, err error) {
	ae := As(err)
	if ae == nil {
		ae = NewInternal("", err)
	}
	// Server-side 5xx logging: prod redacts the message for clients (below), but the
	// real cause must reach the server log so failures are diagnosable — the request
	// INFO line only carries status, and ErrorLogger stores the redacted header. Best-effort.
	if ae.Status >= 500 {
		args := []any{"status", ae.Status, "code", ae.Code, "message", ae.Message}
		if rid := w.Header().Get("X-Request-Id"); rid != "" {
			args = append(args, "requestId", rid)
		}
		if ae.Cause != nil {
			args = append(args, "cause", ae.Cause.Error())
		}
		slog.Error("server error", args...)
	}
	msg := ae.Message
	if production && ae.Status >= 500 {
		msg = "Internal server error"
	}
	w.Header().Set("Content-Type", "application/json")
	// Expose error code + message in headers so the ErrorLogger middleware can capture them
	// without buffering the response body.
	w.Header().Set("X-Error-Code", string(ae.Code))
	if msg != "" {
		w.Header().Set("X-Error-Message", msg)
	}
	w.WriteHeader(ae.Status)
	_ = json.NewEncoder(w).Encode(envelope{
		Success: false,
		Error:   bodyError{Code: string(ae.Code), Message: msg, Details: ae.Details},
	})
}

// DecodeJSON decodes r.Body into dst. On failure it writes a VALIDATION_ERROR
// envelope and returns false; callers return immediately. Lives here (not in
// shared/http) to keep the error path in one place and avoid an import cycle.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		Write(w, NewValidation("Invalid JSON body"))
		return false
	}
	return true
}
