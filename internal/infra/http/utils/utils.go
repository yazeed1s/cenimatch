package utils

import (
	"cenimatch/internal/domain"
	"encoding/json"
	"net/http"
)

// response helpers. we wrap everything in a {success, data, error}
// envelope to keep the api consistent.
type Response struct {
	Success bool           `json:"success"`
	Data    interface{}    `json:"data,omitempty"`
	Error   *ErrorResponse `json:"error,omitempty"`
}

type ErrorResponse struct {
	Code string `json:"code"`
}

func JSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	json.NewEncoder(w).Encode(Response{
		Success: statusCode < 400,
		Data:    data,
	})
}

func Error(w http.ResponseWriter, statusCode int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	json.NewEncoder(w).Encode(Response{
		Success: false,
		Error:   &ErrorResponse{Code: code},
	})
}

func Success(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusOK, data)
}

func BadRequest(w http.ResponseWriter, message string) {
	Error(w, http.StatusBadRequest, message)
}

func Unauthorized(w http.ResponseWriter, message string) {
	Error(w, http.StatusUnauthorized, message)
}

func NotFound(w http.ResponseWriter, message string) {
	Error(w, http.StatusNotFound, message)
}

func InternalServerError(w http.ResponseWriter, message string) {
	Error(w, http.StatusInternalServerError, message)
}

func StatusForCode(code domain.ErrorCode) int {
	switch code {
	case domain.CodeInvalidRequest:
		return http.StatusBadRequest
	case domain.CodeUnauthorized, domain.CodeInvalidCredentials, domain.CodeRefreshTokenInvalid:
		return http.StatusUnauthorized
	case domain.CodeForbidden:
		return http.StatusForbidden
	case domain.CodeUserNotFound:
		return http.StatusNotFound
	case domain.CodeEmailAlreadyExists, domain.CodeUsernameAlreadyExists:
		return http.StatusConflict
	default:
		return http.StatusInternalServerError
	}
}
