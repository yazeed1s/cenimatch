package ports

import (
	"cenimatch/internal/domain"
	"context"

	"github.com/google/uuid"
)

type MovieRepository interface {
	ListMovies(ctx context.Context, query string, genre string, limit int, offset int) ([]domain.RawMovie, error)
	GetTopRatedMoviesAllTime(ctx context.Context, limit int) ([]domain.RawMovie, error)
	GetTrendingMoviesThisWeek(ctx context.Context, limit int) ([]domain.RawMovie, error)
	GetMovieByID(ctx context.Context, id int64) (*domain.RawMovie, error)
	GetMovieCrewByID(ctx context.Context, id int64) (*domain.MovieCrew, error)
	GetRelatedMovies(ctx context.Context, id int64, limit int) ([]domain.RawMovie, error)
	GetGraphRelatedMoviesData(ctx context.Context, id int64) (*domain.GraphRelatedMovies, error)
	GetUserGraphRecommendations(ctx context.Context, userID uuid.UUID) ([]domain.RawMovie, error)
}
