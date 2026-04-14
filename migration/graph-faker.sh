#!/usr/bin/env bash
set -euo pipefail

DOCKER_PSQL="docker exec -i -u root cenimatch-db psql -U u -d cenimatch-db -v ON_ERROR_STOP=1"

EXECUTE=false
TRUNCATE=false

usage() {
  echo "Usage: $0 [--execute] [--truncate-user-data]"
  echo "  --execute              run against DB (default prints SQL)"
  echo "  --truncate-user-data   clears users/watch_history/user_feedback first"
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --execute) EXECUTE=true ;;
    --truncate-user-data) TRUNCATE=true ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $arg"; usage ;;
  esac
done

SQL_BODY=$(cat <<SQL
BEGIN;
${TRUNCATE:+TRUNCATE watch_history, user_feedback, users CASCADE;}

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
  RETURNING id, user_id, movie_id
),
rated AS (
  INSERT INTO user_feedback (user_id, movie_id, rating, not_interested, created_at)
  SELECT w.user_id,
         w.movie_id,
         CASE nu.cluster
           WHEN 'action_sci' THEN 3.5 + random() * 1.5
           WHEN 'drama_romance' THEN 3.4 + random() * 1.6
           WHEN 'comedy_family' THEN 3.0 + random() * 1.8
           ELSE 2.5 + random() * 2.0
         END,
         random() < 0.05,
         now() - (random() * 60 || ' days')::interval
  FROM watched w
  JOIN new_users nu ON nu.id = w.user_id
  WHERE random() < 0.7
  ON CONFLICT (user_id, movie_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        not_interested = EXCLUDED.not_interested,
        created_at = EXCLUDED.created_at
)
SELECT
  (SELECT count(*) FROM new_users) AS users_created,
  (SELECT count(*) FROM watched) AS watches_created,
  (SELECT count(*) FROM rated) AS ratings_created;
COMMIT;
SQL
)

if [ "$EXECUTE" = true ]; then
  echo "Executing fake data load..."
  echo "$SQL_BODY" | $DOCKER_PSQL
else
  echo "$SQL_BODY"
fi
