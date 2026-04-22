package security

import (
	"cenimatch/internal/ports"

	"golang.org/x/crypto/bcrypt"
)

type BcryptHasher struct {
	cost int
}

var _ ports.Hasher = (*BcryptHasher)(nil)

func NewBcryptHasher(cost int) *BcryptHasher {
	if cost < bcrypt.MinCost || cost > bcrypt.MaxCost {
		cost = bcrypt.DefaultCost
	}
	return &BcryptHasher{cost: cost}
}

func (h *BcryptHasher) Hash(pass string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(pass), h.cost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func (h *BcryptHasher) Compare(pass, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pass))
}
