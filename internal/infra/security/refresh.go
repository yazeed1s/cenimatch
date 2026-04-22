package security

import (
	"cenimatch/internal/ports"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type RefreshGen struct {
	expiration time.Duration
}

var _ ports.RefreshTokenGenerator = (*RefreshGen)(nil)

func NewRefreshGen(expiration time.Duration) *RefreshGen {
	return &RefreshGen{expiration: expiration}
}

// generates a refresh token string in the format "tokenID:secret".
// the caller stores the sha256(secret) in the db, not the raw secret.
func (g *RefreshGen) GenerateRefreshToken() (string, error) {
	tokenID := uuid.New()

	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	secretHex := hex.EncodeToString(secret)
	return tokenID.String() + ":" + secretHex, nil
}

// parses "tokenID:secret" back into its components.
func (g *RefreshGen) ParseRefreshToken(token string) (*ports.RefreshTokenInfo, error) {
	// split on the first colon
	for i := 0; i < len(token); i++ {
		if token[i] == ':' {
			idStr := token[:i]
			secret := token[i+1:]

			tid, err := uuid.Parse(idStr)
			if err != nil {
				return nil, fmt.Errorf("invalid token id: %w", err)
			}

			return &ports.RefreshTokenInfo{
				TokenID: tid,
				Secret:  secret,
			}, nil
		}
	}
	return nil, fmt.Errorf("malformed refresh token")
}

func (g *RefreshGen) Expiration() time.Duration {
	return g.expiration
}

// hashes the secret portion for storage. the db stores this hash,
// not the raw secret.
func HashSecret(secret string) string {
	h := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(h[:])
}
