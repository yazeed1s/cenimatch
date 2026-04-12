#!/usr/bin/env bash
set -euo pipefail

# Loads TMDB movies plus IMDb ratings and crew into Postgres inside the Docker DB container.
# Data files are expected inside the container under /data/raw/.

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

CREATE TEMP TABLE staging_ratings (
  tconst TEXT,
  average_rating TEXT,
  num_votes TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE staging_crew (
  tconst TEXT,
  directors TEXT,
  writers TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE staging_names (
  nconst TEXT,
  primary_name TEXT,
  birth_year TEXT,
  death_year TEXT,
  primary_profession TEXT,
  known_for_titles TEXT
) ON COMMIT DROP;

\copy staging_tmdb FROM '/data/raw/tmdb-movies/TMDB_movie_dataset_v11.csv' CSV HEADER;
\copy staging_ratings FROM '/data/raw/imdb-title-ratings/title.ratings.tsv' WITH (FORMAT csv, DELIMITER E'\t', NULL '\N', HEADER true, QUOTE E'\b');
\copy staging_crew FROM '/data/raw/imdb-title-crew/title.crew.tsv' WITH (FORMAT csv, DELIMITER E'\t', NULL '\N', HEADER true, QUOTE E'\b');
\copy staging_names FROM '/data/raw/imdb-name-basics/name.basics.tsv' WITH (FORMAT csv, DELIMITER E'\t', NULL '\N', HEADER true, QUOTE E'\b');

-- Movies
INSERT INTO movies (
  tmdb_id,
  imdb_id,
  imdb_rating,
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
  NULL,
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
  SELECT
    s.*,
    NULLIF(release_date, '')::DATE AS rd,
    sr.average_rating::FLOAT AS rating
  FROM staging_tmdb s
  JOIN staging_ratings sr
    ON s.imdb_id = sr.tconst
   AND sr.average_rating IS NOT NULL
   AND sr.average_rating <> '\N'
  WHERE s.imdb_id IS NOT NULL AND s.imdb_id <> ''
) s
WHERE rating IS NOT NULL
ON CONFLICT (tmdb_id) DO NOTHING;

-- At this point, only movies with a valid IMDb rating were inserted.

-- Persons (only those referenced by crew)
WITH needed AS (
  SELECT DISTINCT person_id
  FROM (
    SELECT unnest(string_to_array(NULLIF(directors, '\N'), ',')) AS person_id FROM staging_crew
    UNION
    SELECT unnest(string_to_array(NULLIF(writers, '\N'), ',')) AS person_id FROM staging_crew
  ) u
  WHERE person_id IS NOT NULL AND person_id <> ''
)
INSERT INTO persons (imdb_id, primary_name, birth_year, death_year, primary_profession, known_for_titles)
SELECT
  n.nconst,
  n.primary_name,
  NULLIF(n.birth_year, '\N')::INT,
  NULLIF(n.death_year, '\N')::INT,
  NULLIF(n.primary_profession, '\N'),
  NULLIF(n.known_for_titles, '\N')
FROM staging_names n
JOIN needed ON needed.person_id = n.nconst
ON CONFLICT (imdb_id) DO NOTHING;

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
JOIN movies m ON m.tmdb_id = s.id::INT  -- only map for movies we kept
WHERE s.genres IS NOT NULL AND s.genres <> ''
ON CONFLICT DO NOTHING;

-- Movie crew: directors
INSERT INTO movie_crew (movie_id, person_id, role, ordering)
SELECT DISTINCT
  m.tmdb_id,
  dir.person_id,
  'director'::crew_role,
  dir.ord::INT
FROM staging_crew c
JOIN movies m ON m.imdb_id = c.tconst
CROSS JOIN LATERAL unnest(string_to_array(NULLIF(c.directors, '\N'), ',')) WITH ORDINALITY AS dir(person_id, ord)
JOIN persons p ON p.imdb_id = dir.person_id
WHERE c.directors IS NOT NULL AND c.directors <> '\N'
ON CONFLICT DO NOTHING;

-- Movie crew: writers
INSERT INTO movie_crew (movie_id, person_id, role, ordering)
SELECT DISTINCT
  m.tmdb_id,
  w.person_id,
  'writer'::crew_role,
  w.ord::INT
FROM staging_crew c
JOIN movies m ON m.imdb_id = c.tconst
CROSS JOIN LATERAL unnest(string_to_array(NULLIF(c.writers, '\N'), ',')) WITH ORDINALITY AS w(person_id, ord)
JOIN persons p ON p.imdb_id = w.person_id
WHERE c.writers IS NOT NULL AND c.writers <> '\N'
ON CONFLICT DO NOTHING;

COMMIT;
SQL
