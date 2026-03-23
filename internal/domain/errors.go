package domain

type ErrorCode string

const (
	CodeInternalError         ErrorCode = "INTERNAL_ERROR"
	CodeInvalidRequest        ErrorCode = "INVALID_REQUEST"
	CodeUnauthorized          ErrorCode = "UNAUTHORIZED"
	CodeNotFound              ErrorCode = "NOT_FOUND"
	CodeForbidden             ErrorCode = "FORBIDDEN"
	CodeUserNotFound          ErrorCode = "USER_NOT_FOUND"
	CodeEmailAlreadyExists    ErrorCode = "EMAIL_ALREADY_EXISTS"
	CodeUsernameAlreadyExists ErrorCode = "USERNAME_ALREADY_EXISTS"
	CodeInvalidCredentials    ErrorCode = "INVALID_CREDENTIALS"
	CodeRefreshTokenInvalid   ErrorCode = "REFRESH_TOKEN_INVALID"
)
