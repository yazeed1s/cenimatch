package ports

import (
	"cenimatch/internal/domain"
	"context"
)

type MovieRepository interface {
	ListMovies(ctx context.Context, query string, genre string, limit int, offset int) ([]domain.RawMovie, error)
	GetMovieByID(ctx context.Context, id int64) (*domain.RawMovie, error)
	GetMovieCrewByID(ctx context.Context, id int64) (*domain.MovieCrew, error)
	GetRelatedMovies(ctx context.Context, id int64, limit int) ([]domain.RawMovie, error)
}
