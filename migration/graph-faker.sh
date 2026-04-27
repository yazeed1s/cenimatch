#!/usr/bin/env bash
set -euo pipefail

DOCKER_PSQL="docker exec -i -u root cenimatch-db psql -U u -d cenimatch-db -v ON_ERROR_STOP=1"

EXECUTE=false
TRUNCATE=false
SYNC_GRAPH=true

usage() {
  local code="${1:-1}"
  echo "Usage: $0 [--execute] [--truncate-user-data] [--no-sync-graph]"
  echo "  --execute              run against DB (default prints SQL)"
  echo "  --truncate-user-data   clears users/watch_history/user_feedback first"
  echo "  --no-sync-graph        skip Apache AGE incremental sync after execute"
  exit "$code"
}

while [[ $# -gt 0 ]]; do
  arg="$1"
  case "$arg" in
    --execute)
      EXECUTE=true
      shift
      ;;
    --truncate-user-data)
      TRUNCATE=true
      shift
      ;;
    --no-sync-graph)
      SYNC_GRAPH=false
      shift
      ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown arg: $arg"; usage ;;
  esac
done

SQL_BODY=$(cat <<SQL
BEGIN;
$(if [ "$TRUNCATE" = true ]; then echo "TRUNCATE watch_history, user_feedback, users CASCADE;"; fi)

CREATE TEMP TABLE faker_new_users (
  user_id UUID,
  username TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE faker_watched (
  user_id UUID,
  movie_id INT,
  watched_at TIMESTAMPTZ,
  completed BOOLEAN
) ON COMMIT DROP;

CREATE TEMP TABLE faker_rated (
  user_id UUID,
  movie_id INT,
  rating FLOAT,
  not_interested BOOLEAN,
  created_at TIMESTAMPTZ
) ON COMMIT DROP;

WITH clusters AS (
  VALUES
    ('action_sci', ARRAY['Action','Science Fiction']::text[]),
    ('drama_romance', ARRAY['Drama','Romance']::text[]),
    ('comedy_family', ARRAY['Comedy','Family']::text[]),
    ('mixed', ARRAY['Action','Drama','Comedy','Adventure']::text[])
),
new_users AS (
  INSERT INTO users (username, email, password_hash, is_active, last_login)
  SELECT format('user_%s_%02s', c.column1, i) AS username,
         format('user_%s_%02s@example.com', c.column1, i) AS email,
         'fakehash' AS password_hash,
         true,
         now() - (i || ' days')::interval
  FROM clusters c
  CROSS JOIN generate_series(1, 8) AS i
  RETURNING id, username, split_part(username, '_', 2) AS cluster
)
INSERT INTO faker_new_users (user_id, username)
SELECT id, username
FROM new_users;

WITH clusters AS (
  VALUES
    ('action_sci', ARRAY['Action','Science Fiction']::text[]),
    ('drama_romance', ARRAY['Drama','Romance']::text[]),
    ('comedy_family', ARRAY['Comedy','Family']::text[]),
    ('mixed', ARRAY['Action','Drama','Comedy','Adventure']::text[])
),
new_users AS (
  SELECT user_id AS id, username, split_part(username, '_', 2) AS cluster
  FROM faker_new_users
),
cluster_movies AS (
  SELECT c.column1 AS cluster,
         array_agg(DISTINCT m.tmdb_id) AS movie_ids
  FROM clusters c
  JOIN genres g ON lower(g.name) = ANY(SELECT lower(x) FROM unnest(c.column2) AS x)
  JOIN movie_genres mg ON mg.genre_id = g.id
  JOIN movies m ON m.tmdb_id = mg.movie_id
  GROUP BY c.column1
),
watched AS (
  INSERT INTO watch_history (user_id, movie_id, watched_at, completed)
  SELECT nu.id,
         pick.movie_id,
         now() - (random() * 90 || ' days')::interval,
         random() < 0.65
  FROM new_users nu
  JOIN cluster_movies cm ON cm.cluster = nu.cluster
  JOIN LATERAL (
    SELECT movie_id
    FROM unnest(cm.movie_ids) AS movie_id
    ORDER BY random()
    LIMIT 15
  ) pick ON true
  RETURNING user_id, movie_id, watched_at, completed
)
INSERT INTO faker_watched (user_id, movie_id, watched_at, completed)
SELECT user_id, movie_id, watched_at, completed
FROM watched;

WITH rated AS (
  INSERT INTO user_feedback (user_id, movie_id, rating, not_interested, created_at)
  SELECT w.user_id,
         w.movie_id,
         CASE split_part(u.username, '_', 2)
           WHEN 'action_sci' THEN 3.5 + random() * 1.5
           WHEN 'drama_romance' THEN 3.4 + random() * 1.6
           WHEN 'comedy_family' THEN 3.0 + random() * 1.8
           ELSE 2.5 + random() * 2.0
         END,
         random() < 0.05,
         now() - (random() * 60 || ' days')::interval
  FROM faker_watched w
  JOIN users u ON u.id = w.user_id
  WHERE random() < 0.7
  ON CONFLICT (user_id, movie_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        not_interested = EXCLUDED.not_interested,
        created_at = EXCLUDED.created_at
  RETURNING user_id, movie_id, rating, not_interested, created_at
)
INSERT INTO faker_rated (user_id, movie_id, rating, not_interested, created_at)
SELECT user_id, movie_id, rating, not_interested, created_at
FROM rated;

$(if [ "$SYNC_GRAPH" = true ]; then cat <<'EOSQL'
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

DO $$
DECLARE
  params agtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'movie_graph') THEN
    RAISE NOTICE 'movie_graph was not found, skipping graph sync';
    RETURN;
  END IF;

  SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
  FROM (
    SELECT user_id::text AS user_id, username
    FROM faker_new_users
  ) t;

  PERFORM *
  FROM ag_catalog.cypher(
    'movie_graph'::name,
    $cypher$
      UNWIND $rows AS row
      MERGE (u:User {user_id: row.user_id})
      SET u.username = row.username
      RETURN count(*)
    $cypher$,
    params
  ) AS (v agtype);

  SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
  FROM (
    SELECT
      user_id::text AS user_id,
      movie_id,
      to_char(watched_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS watched_at,
      completed
    FROM faker_watched
  ) t;

  PERFORM *
  FROM ag_catalog.cypher(
    'movie_graph'::name,
    $cypher$
      UNWIND $rows AS row
      MATCH (u:User {user_id: row.user_id})
      MATCH (m:Movie {movie_id: row.movie_id})
      MERGE (u)-[w:WATCHED]->(m)
      SET w.watched_at = row.watched_at, w.completed = row.completed
      RETURN count(*)
    $cypher$,
    params
  ) AS (v agtype);

  SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
  FROM (
    SELECT
      user_id::text AS user_id,
      movie_id,
      rating,
      coalesce(not_interested, false) AS not_interested,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM faker_rated
  ) t;

  PERFORM *
  FROM ag_catalog.cypher(
    'movie_graph'::name,
    $cypher$
      UNWIND $rows AS row
      MATCH (u:User {user_id: row.user_id})
      MATCH (m:Movie {movie_id: row.movie_id})
      MERGE (u)-[r:RATED]->(m)
      SET r.rating = row.rating,
          r.not_interested = row.not_interested,
          r.created_at = row.created_at
      RETURN count(*)
    $cypher$,
    params
  ) AS (v agtype);
END
$$;
EOSQL
fi)

SELECT
  (SELECT count(*) FROM faker_new_users) AS users_created,
  (SELECT count(*) FROM faker_watched) AS watches_created,
  (SELECT count(*) FROM faker_rated) AS ratings_created;
COMMIT;
SQL
)

if [ "$EXECUTE" = true ]; then
  echo "Executing fake data load..."
  echo "$SQL_BODY" | $DOCKER_PSQL
else
  echo "$SQL_BODY"
fi
