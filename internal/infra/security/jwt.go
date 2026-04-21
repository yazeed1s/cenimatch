package security

import (
	"cenimatch/internal/ports"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type JWTGen struct {
	secret     []byte
	issuer     string
	expiration time.Duration
}

var _ ports.JWTGenerator = (*JWTGen)(nil)

func NewJWTGen(secret string, issuer string, expiration time.Duration) *JWTGen {
	return &JWTGen{
		secret:     []byte(secret),
		issuer:     issuer,
		expiration: expiration,
	}
}

func (j *JWTGen) GenerateAccessToken(uid uuid.UUID, username string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":      uid.String(),
		"username": username,
		"iss":      j.issuer,
		"iat":      now.Unix(),
		"exp":      now.Add(j.expiration).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(j.secret)
}

func (j *JWTGen) ValidateAccessToken(tokenStr string) (*ports.JWTClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return j.secret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	sub, err := claims.GetSubject()
	if err != nil {
		return nil, fmt.Errorf("missing sub claim: %w", err)
	}

	uid, err := uuid.Parse(sub)
	if err != nil {
		return nil, fmt.Errorf("invalid user id in token: %w", err)
	}

	username, _ := claims["username"].(string)
	exp, _ := claims.GetExpirationTime()

	return &ports.JWTClaims{
		UserID:   uid,
		Username: username,
		Exp:      exp.Unix(),
	}, nil
}
