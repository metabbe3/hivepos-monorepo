package http

import (
	"encoding/json"
	"net/http"
)

// APIResponse is the standard envelope mirroring the TypeScript apiSuccess/apiCreated.
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
}

type APIError struct {
	Code    string `json:"code,omitempty"`
	Message string `json:"message"`
}

// Success sends a 200 with the standard envelope.
func Success(w http.ResponseWriter, data interface{}, meta ...interface{}) {
	resp := APIResponse{Success: true, Data: data}
	if len(meta) > 0 && meta[0] != nil {
		resp.Meta = meta[0]
	}
	writeJSON(w, http.StatusOK, resp)
}

// Created sends a 201.
func Created(w http.ResponseWriter, data interface{}) {
	writeJSON(w, http.StatusCreated, APIResponse{Success: true, Data: data})
}

// NoContent sends a 204.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// Error sends an error response with the standard envelope.
func Error(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, APIResponse{
		Success: false,
		Error:   &APIError{Message: message},
	})
}

// ValidationError sends a 400.
func ValidationError(w http.ResponseWriter, message string) {
	Error(w, http.StatusBadRequest, message)
}

// NotFoundError sends a 404.
func NotFoundError(w http.ResponseWriter, message string) {
	Error(w, http.StatusNotFound, message)
}

// ForbiddenError sends a 403.
func ForbiddenError(w http.ResponseWriter, message string) {
	Error(w, http.StatusForbidden, message)
}

// UnauthorizedError sends a 401.
func UnauthorizedError(w http.ResponseWriter, message string) {
	Error(w, http.StatusUnauthorized, message)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
