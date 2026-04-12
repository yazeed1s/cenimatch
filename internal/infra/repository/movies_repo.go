package repository

import (
	"cenimatch/internal/domain"
	"cenimatch/internal/ports"
	"context"
)

type MovieRepo struct {
	db ports.DBManager
}

func NewMovieRepo(db ports.DBManager) *MovieRepo {
	return &MovieRepo{db: db}
}

// TODO: this should be paging
func (m *MovieRepo) ListMovies(ctx context.Context) ([]domain.RawMovie, error) {
	sql := `
		SELECT 
			tmdb_id, imdb_id, title, original_title, release_date, 
			release_year, runtime_min, original_lang, overview, 
			popularity, vote_avg, vote_count, budget, revenue, 
			mpaa_rating, poster_path, enriched
		FROM movies 
		LIMIT 10`

	rows, err := m.db.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var movies []domain.RawMovie
	for rows.Next() {
		var movie domain.RawMovie
		err := rows.Scan(
			&movie.TMDBID,
			&movie.IMDBID,
			&movie.Title,
			&movie.OriginalTitle,
			&movie.ReleaseDate,
			&movie.ReleaseYear,
			&movie.RuntimeMin,
			&movie.OriginalLang,
			&movie.Overview,
			&movie.Popularity,
			&movie.VoteAvg,
			&movie.VoteCount,
			&movie.Budget,
			&movie.Revenue,
			&movie.MPAARating,
			&movie.PosterPath,
			&movie.Enriched,
		)
		if err != nil {
			return nil, err
		}
		movies = append(movies, movie)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return movies, nil
}
