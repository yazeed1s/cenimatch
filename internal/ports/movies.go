package ports

import (
	"cenimatch/internal/domain"
	"context"
)

type MovieRepository interface {
	ListMovies(ctx context.Context) ([]domain.RawMovie, error)
}
