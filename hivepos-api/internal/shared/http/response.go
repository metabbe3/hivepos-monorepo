package http

import (
	"encoding/json"
	"net/http"
	"reflect"

	"github.com/hivepos/api/internal/shared/apperror"
)

// APIResponse is the success envelope mirroring the TS apiSuccess shape.
type APIResponse struct {
	Success bool `json:"success"`
	Data    any  `json:"data,omitempty"`
	Meta    any  `json:"meta,omitempty"`
}

// Success sends a 200 with the standard envelope.
func Success(w http.ResponseWriter, data any, meta ...any) {
	resp := APIResponse{Success: true, Data: data}
	if len(meta) > 0 && meta[0] != nil {
		resp.Meta = meta[0]
	}
	writeSuccess(w, http.StatusOK, resp)
}

// Created sends a 201.
func Created(w http.ResponseWriter, data any) {
	writeSuccess(w, http.StatusCreated, APIResponse{Success: true, Data: data})
}

// NoContent completes a delete/destroy. Despite the name it returns 200 with the
// standard envelope, NOT HTTP 204 — the web's apiFetch rejects empty 204 bodies
// (res.json() yields null → "Request failed with status 204"), and the legacy TS
// API returns {success:true} on deletes. A bare 204 would break every delete button.
func NoContent(w http.ResponseWriter) {
	writeSuccess(w, http.StatusOK, APIResponse{Success: true, Data: nil})
}

// codeForStatus maps an HTTP status to the canonical pos-saas error code.
// Every simple error write goes through here so the wire envelope always
// carries a stable code for client branching.
func codeForStatus(status int) apperror.Code {
	switch status {
	case http.StatusBadRequest, http.StatusUnprocessableEntity:
		return apperror.Validation
	case http.StatusUnauthorized:
		return apperror.Unauthenticated
	case http.StatusForbidden:
		return apperror.Forbidden
	case http.StatusNotFound:
		return apperror.NotFound
	case http.StatusConflict:
		return apperror.Conflict
	case http.StatusTooManyRequests:
		return apperror.RateLimited
	default:
		return apperror.Internal
	}
}

// Error sends an error response with the standard envelope + a code derived
// from the status. Delegates to apperror.Write so prod redaction is unified.
func Error(w http.ResponseWriter, status int, message string) {
	apperror.Write(w, &apperror.Error{Message: message, Status: status, Code: codeForStatus(status)})
}

// ValidationError sends a 400 (VALIDATION_ERROR).
func ValidationError(w http.ResponseWriter, message string) {
	Error(w, http.StatusBadRequest, message)
}

// NotFoundError sends a 404 (NOT_FOUND).
func NotFoundError(w http.ResponseWriter, message string) {
	Error(w, http.StatusNotFound, message)
}

// ForbiddenError sends a 403 (FORBIDDEN).
func ForbiddenError(w http.ResponseWriter, message string) {
	Error(w, http.StatusForbidden, message)
}

// UnauthorizedError sends a 401 (UNAUTHENTICATED).
func UnauthorizedError(w http.ResponseWriter, message string) {
	Error(w, http.StatusUnauthorized, message)
}

func writeSuccess(w http.ResponseWriter, status int, v APIResponse) {
	v.Data = emptySliceIfNil(v.Data)            // top-level nil slice → []
	nilSlicesToEmpty(reflect.ValueOf(v.Data))   // nested nil slice fields → [] (TS emits [], not null)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// nilSlicesToEmpty walks a struct/map/slice tree and replaces nil slice fields
// with zero-length slices so they serialize as `[]` (matching TS), not `null`.
func nilSlicesToEmpty(v reflect.Value) {
	switch v.Kind() {
	case reflect.Ptr:
		if v.IsNil() {
			return
		}
		nilSlicesToEmpty(v.Elem())
	case reflect.Struct:
		for i := 0; i < v.NumField(); i++ {
			f := v.Field(i)
			if !f.CanInterface() {
				continue
			}
			if f.Kind() == reflect.Slice {
				if f.IsNil() && f.CanSet() {
					f.Set(reflect.MakeSlice(f.Type(), 0, 0))
				}
			} else {
				nilSlicesToEmpty(f)
			}
		}
	case reflect.Slice:
		for i := 0; i < v.Len(); i++ {
			nilSlicesToEmpty(v.Index(i))
		}
	}
}

// emptySliceIfNil returns a zero-length non-nil slice when data is a nil slice,
// so empty lists serialize as `[]` instead of `null` (matching TS apiSuccess).
// A typed-nil slice held in an interface is not itself nil, so json would
// otherwise emit `null`.
func emptySliceIfNil(data any) any {
	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Slice && v.IsNil() {
		return reflect.MakeSlice(v.Type(), 0, 0).Interface()
	}
	return data
}
