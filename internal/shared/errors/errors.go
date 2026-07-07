package errors

import (
	"fmt"
	"net/http"
)

// AppError mirrors the TypeScript AppError hierarchy. Each has a message + HTTP status.
type AppError struct {
	Message string
	Status  int
	Code    string
	Cause   error
}

func (e *AppError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("[%s] %s", e.Code, e.Message)
	}
	return e.Message
}

func (e *AppError) Unwrap() error { return e.Cause }

// Constructors mirroring the TS error classes.

func ValidationError(msg string) *AppError {
	return &AppError{Message: msg, Status: http.StatusBadRequest, Code: "VALIDATION_ERROR"}
}

func NotFoundError(msg string) *AppError {
	return &AppError{Message: msg, Status: http.StatusNotFound, Code: "NOT_FOUND"}
}

func ForbiddenError(msg string) *AppError {
	return &AppError{Message: msg, Status: http.StatusForbidden, Code: "FORBIDDEN"}
}

func UnauthorizedError(msg string) *AppError {
	return &AppError{Message: msg, Status: http.StatusUnauthorized, Code: "UNAUTHORIZED"}
}

func ConflictError(msg string) *AppError {
	return &AppError{Message: msg, Status: http.StatusConflict, Code: "CONFLICT"}
}

func InternalError(msg string, cause error) *AppError {
	return &AppError{Message: msg, Status: http.StatusInternalServerError, Code: "INTERNAL_ERROR", Cause: cause}
}
