#!/usr/bin/env bash

# Inserts TMDB CSV data into the postgres schema defined in migration/schema-01.sql.
# - Loads DATABASE_URL from .env if present.
# - Uses a temp staging table to keep the import idempotent.

docker exec -i -u root cenimatch-db psql -U u -d cenimatch-db -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

-- Temp staging mirrors CSV columns as text to allow flexible casting.
CREATE TEMP TABLE staging_tmdb (
  id TEXT,
  title TEXT,
  vote_average TEXT,
  vote_count TEXT,
  status TEXT,
  release_date TEXT,
  revenue TEXT,
  runtime TEXT,
  adult TEXT,
  backdrop_path TEXT,
  budget TEXT,
  homepage TEXT,
  imdb_id TEXT,
  original_language TEXT,
  original_title TEXT,
  overview TEXT,
  popularity TEXT,
  poster_path TEXT,
  tagline TEXT,
  genres TEXT,
  production_companies TEXT,
  production_countries TEXT,
  spoken_languages TEXT,
  keywords TEXT
) ON COMMIT DROP;

\copy staging_tmdb FROM '/data/raw/tmdb-movies/TMDB_movie_dataset_v11.csv' CSV HEADER;

-- Movies
INSERT INTO movies (
  tmdb_id,
  imdb_id,
  title,
  original_title,
  release_date,
  release_year,
  runtime_min,
  original_lang,
  overview,
  popularity,
  vote_avg,
  vote_count,
  budget,
  revenue,
  mpaa_rating,
  poster_path,
  enriched
)
SELECT
  id::INT,
  NULLIF(imdb_id, ''),
  title,
  NULLIF(original_title, ''),
  rd,
  CASE WHEN rd IS NULL THEN NULL ELSE EXTRACT(YEAR FROM rd)::INT END,
  NULLIF(runtime, '')::INT,
  NULLIF(original_language, ''),
  NULLIF(overview, ''),
  NULLIF(popularity, '')::FLOAT,
  NULLIF(vote_average, '')::FLOAT,
  NULLIF(vote_count, '')::INT,
  NULLIF(budget, '')::BIGINT,
  NULLIF(revenue, '')::BIGINT,
  NULL,
  NULLIF(poster_path, ''),
  FALSE
FROM (
  SELECT *, NULLIF(release_date, '')::DATE AS rd FROM staging_tmdb
) s
ON CONFLICT (tmdb_id) DO NOTHING;

-- Genres
WITH g AS (
  SELECT DISTINCT TRIM(g) AS name
  FROM staging_tmdb s
  CROSS JOIN LATERAL unnest(string_to_array(s.genres, ',')) AS g
  WHERE s.genres IS NOT NULL AND s.genres <> ''
)
INSERT INTO genres (name)
SELECT name FROM g
ON CONFLICT (name) DO NOTHING;

-- Movie -> Genre mapping
INSERT INTO movie_genres (movie_id, genre_id)
SELECT DISTINCT
  s.id::INT,
  g.id
FROM staging_tmdb s
CROSS JOIN LATERAL unnest(string_to_array(s.genres, ',')) AS gname
JOIN genres g ON g.name = TRIM(gname)
WHERE s.genres IS NOT NULL AND s.genres <> ''
ON CONFLICT DO NOTHING;

COMMIT;
SQL
