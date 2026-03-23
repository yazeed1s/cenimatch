package ports

import (
	"time"

	"github.com/google/uuid"
)

type Hasher interface {
	Hash(pass string) (string, error)
	Compare(pass, hash string) error
}

type JWTGenerator interface {
	GenerateAccessToken(uid uuid.UUID, username string) (string, error)
	ValidateAccessToken(token string) (*JWTClaims, error)
}

type RefreshTokenGenerator interface {
	GenerateRefreshToken() (string, error)
	ParseRefreshToken(token string) (*RefreshTokenInfo, error)
	Expiration() time.Duration
}

type JWTClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	Exp      int64     `json:"exp"`
}

type RefreshTokenInfo struct {
	TokenID uuid.UUID `json:"token_id"`
	Secret  string    `json:"secret"`
}
