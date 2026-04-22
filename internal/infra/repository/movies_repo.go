package repository

import (
	"cenimatch/internal/domain"
	"cenimatch/internal/ports"
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type MovieRepo struct {
	db ports.DBManager
}

func NewMovieRepo(db ports.DBManager) *MovieRepo {
	return &MovieRepo{db: db}
}

func (m *MovieRepo) ListMovies(
	ctx context.Context,
	query string,
	genre string,
	limit int,
	offset int,
) ([]domain.RawMovie, error) {
	if limit <= 0 {
		limit = 30
	}

	query = strings.TrimSpace(strings.ToLower(query))

	baseSelect := `
		SELECT
			m.tmdb_id,
			m.imdb_id,
			m.title,
			m.original_title,
			to_char(m.release_date, 'YYYY-MM-DD') AS release_date,
			m.release_year,
			m.runtime_min,
			m.original_lang,
			m.overview,
			m.popularity,
			m.vote_avg,
			m.vote_count,
			m.budget,
			m.revenue,
			m.mpaa_rating,
			m.poster_path,
			m.enriched,
			coalesce(g.names, '{}'::text[]) AS genres,
			coalesce(t.tags, '{}'::text[]) AS mood_tags,
			d.director_name,
			coalesce(c.cast_names, '{}'::text[]) AS cast_names
		FROM movies m
		LEFT JOIN LATERAL (
			SELECT array_agg(g.name ORDER BY g.name) AS names
			FROM movie_genres mg
			JOIN genres g ON g.id = mg.genre_id
			WHERE mg.movie_id = m.tmdb_id
		) g ON TRUE
		LEFT JOIN LATERAL (
			SELECT array_agg(mt.tag_value ORDER BY mt.tag_value) AS tags
			FROM movie_tags mt
			WHERE mt.movie_id = m.tmdb_id AND mt.tag_key = 'mood'
		) t ON TRUE
		LEFT JOIN LATERAL (
			SELECT p.primary_name AS director_name
			FROM movie_crew mc
			JOIN persons p ON p.imdb_id = mc.person_id
			WHERE mc.movie_id = m.tmdb_id AND mc.role = 'director'
			ORDER BY mc.ordering NULLS LAST
			LIMIT 1
		) d ON TRUE
		LEFT JOIN LATERAL (
			SELECT array_agg(name ORDER BY ord) AS cast_names
			FROM (
				SELECT p.primary_name AS name, mc.ordering AS ord
				FROM movie_crew mc
				JOIN persons p ON p.imdb_id = mc.person_id
				WHERE mc.movie_id = m.tmdb_id AND mc.role = 'actor'
				ORDER BY mc.ordering NULLS LAST
				LIMIT 8
			) cast_members
		) c ON TRUE
		JOIN base_movies b ON b.tmdb_id = m.tmdb_id`

	var sql string
	var args []interface{}
	argCount := 1

	genreFilter := ""
	if genre != "" {
		genreFilter = fmt.Sprintf(` AND EXISTS (SELECT 1 FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id WHERE mg.movie_id = m.tmdb_id AND lower(g.name) = $%d)`, argCount)
		args = append(args, strings.ToLower(genre))
		argCount++
	}

	if query == "" {
		sql = fmt.Sprintf(`
		WITH base_movies AS (
			SELECT m.tmdb_id
			FROM movies m
			WHERE
				m.poster_path IS NOT NULL AND
				lower(m.poster_path) <> 'none' AND
				coalesce(m.vote_count, 0) >= 20
				%s
			ORDER BY m.tmdb_id DESC
			LIMIT $%d OFFSET $%d
		)`, genreFilter, argCount, argCount+1)
		args = append(args, limit, offset)
	} else {
		sql = fmt.Sprintf(`
		WITH base_movies AS (
			SELECT m.tmdb_id
			FROM movies m
			WHERE
				(lower(m.title) LIKE '%%' || $%d || '%%' OR
				lower(m.original_title) LIKE '%%' || $%d || '%%')
				%s
			ORDER BY coalesce(m.popularity, 0) DESC, coalesce(m.vote_count, 0) DESC
			LIMIT $%d OFFSET $%d
		)`, argCount, argCount, genreFilter, argCount+1, argCount+2)
		args = append(args, query, limit, offset)
	}

	sql = sql + baseSelect + `
	ORDER BY coalesce(m.popularity, 0) DESC, coalesce(m.vote_count, 0) DESC`

	rows, err := m.db.Query(ctx, sql, args...)
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
			&movie.Genres,
			&movie.MoodTags,
			&movie.DirectorName,
			&movie.CastNames,
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

func (m *MovieRepo) GetMovieByID(ctx context.Context, id int64) (*domain.RawMovie, error) {
	sql := `
		SELECT
			m.tmdb_id,
			m.imdb_id,
			m.title,
			m.original_title,
			to_char(m.release_date, 'YYYY-MM-DD') AS release_date,
			m.release_year,
			m.runtime_min,
			m.original_lang,
			m.overview,
			m.popularity,
			m.vote_avg,
			m.vote_count,
			m.budget,
			m.revenue,
			m.mpaa_rating,
			m.poster_path,
			m.enriched,
			coalesce(g.names, '{}'::text[]) AS genres,
			coalesce(t.tags, '{}'::text[]) AS mood_tags
		FROM movies m
		LEFT JOIN LATERAL (
			SELECT array_agg(g.name ORDER BY g.name) AS names
			FROM movie_genres mg
			JOIN genres g ON g.id = mg.genre_id
			WHERE mg.movie_id = m.tmdb_id
		) g ON TRUE
		LEFT JOIN LATERAL (
			SELECT array_agg(mt.tag_value ORDER BY mt.tag_value) AS tags
			FROM movie_tags mt
			WHERE mt.movie_id = m.tmdb_id AND mt.tag_key = 'mood'
		) t ON TRUE
		WHERE m.tmdb_id = $1`

	var movie domain.RawMovie
	if err := m.db.QueryRow(ctx, sql, id).Scan(
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
		&movie.Genres,
		&movie.MoodTags,
	); err != nil {
		return nil, err
	}

	return &movie, nil
}

func (m *MovieRepo) GetMovieCrewByID(ctx context.Context, id int64) (*domain.MovieCrew, error) {
	var exists bool
	if err := m.db.QueryRow(
		ctx,
		`SELECT EXISTS(SELECT 1 FROM movies WHERE tmdb_id = $1)`,
		id,
	).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, pgx.ErrNoRows
	}

	sql := `
		SELECT
			p.primary_name,
			mc.role::text,
			nullif(mc.character, ''),
			mc.ordering
		FROM movie_crew mc
		JOIN persons p ON p.imdb_id = mc.person_id
		WHERE mc.movie_id = $1
		ORDER BY
			CASE mc.role
				WHEN 'director' THEN 0
				WHEN 'writer' THEN 1
				WHEN 'producer' THEN 2
				ELSE 3
			END,
			mc.ordering NULLS LAST,
			p.primary_name`

	rows, err := m.db.Query(ctx, sql, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	crew := &domain.MovieCrew{Members: make([]domain.MovieCrewMember, 0, 16)}
	for rows.Next() {
		var member domain.MovieCrewMember
		if err := rows.Scan(
			&member.Name,
			&member.Role,
			&member.Job,
			&member.Ordering,
		); err != nil {
			return nil, err
		}
		if member.Role == "actor" && member.Job != nil {
			member.Character = member.Job
		}
		crew.Members = append(crew.Members, member)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return crew, nil
}

func (m *MovieRepo) GetRelatedMovies(
	ctx context.Context,
	id int64,
	limit int,
) ([]domain.RawMovie, error) {
	if limit <= 0 {
		limit = 8
	}

	sql := `
		WITH target AS (
			SELECT array_agg(mg.genre_id) AS genre_ids
			FROM movie_genres mg
			WHERE mg.movie_id = $1
		)
		SELECT
			m.tmdb_id,
			m.imdb_id,
			m.title,
			m.original_title,
			to_char(m.release_date, 'YYYY-MM-DD') AS release_date,
			m.release_year,
			m.runtime_min,
			m.original_lang,
			m.overview,
			m.popularity,
			m.vote_avg,
			m.vote_count,
			m.budget,
			m.revenue,
			m.mpaa_rating,
			m.poster_path,
			m.enriched,
			coalesce(g.names, '{}'::text[]) AS genres,
			coalesce(t.tags, '{}'::text[]) AS mood_tags,
			d.director_name,
			coalesce(c.cast_names, '{}'::text[]) AS cast_names
		FROM movies m
		LEFT JOIN LATERAL (
			SELECT array_agg(g.name ORDER BY g.name) AS names
			FROM movie_genres mg
			JOIN genres g ON g.id = mg.genre_id
			WHERE mg.movie_id = m.tmdb_id
		) g ON TRUE
		LEFT JOIN LATERAL (
			SELECT array_agg(mt.tag_value ORDER BY mt.tag_value) AS tags
			FROM movie_tags mt
			WHERE mt.movie_id = m.tmdb_id AND mt.tag_key = 'mood'
		) t ON TRUE
		LEFT JOIN LATERAL (
			SELECT p.primary_name AS director_name
			FROM movie_crew mc
			JOIN persons p ON p.imdb_id = mc.person_id
			WHERE mc.movie_id = m.tmdb_id AND mc.role = 'director'
			ORDER BY mc.ordering NULLS LAST
			LIMIT 1
		) d ON TRUE
		LEFT JOIN LATERAL (
			SELECT array_agg(name ORDER BY ord) AS cast_names
			FROM (
				SELECT p.primary_name AS name, mc.ordering AS ord
				FROM movie_crew mc
				JOIN persons p ON p.imdb_id = mc.person_id
				WHERE mc.movie_id = m.tmdb_id AND mc.role = 'actor'
				ORDER BY mc.ordering NULLS LAST
				LIMIT 8
			) cast_members
		) c ON TRUE
		LEFT JOIN LATERAL (
			SELECT count(*) AS shared_genres
			FROM movie_genres mg
			JOIN target t ON TRUE
			WHERE mg.movie_id = m.tmdb_id AND mg.genre_id = ANY(coalesce(t.genre_ids, '{}'::int[]))
		) rel ON TRUE
		WHERE m.tmdb_id <> $1
		ORDER BY rel.shared_genres DESC, coalesce(m.popularity, 0) DESC
		LIMIT $2`

	rows, err := m.db.Query(ctx, sql, id, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var movies []domain.RawMovie
	for rows.Next() {
		var movie domain.RawMovie
		if err := rows.Scan(
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
			&movie.Genres,
			&movie.MoodTags,
			&movie.DirectorName,
			&movie.CastNames,
		); err != nil {
			return nil, err
		}
		movies = append(movies, movie)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return movies, nil
}
