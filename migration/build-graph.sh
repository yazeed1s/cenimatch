#!/usr/bin/env bash
set -euo pipefail

GRAPH_NAME="movie_graph"
BATCH_SIZE="${BATCH_SIZE:-5000}"
DOCKER_PSQL=(docker exec -i -u root cenimatch-db psql -U u -d cenimatch-db -v ON_ERROR_STOP=1)

usage() {
  echo "Usage: $0 [--rebuild]"
  exit 1
}

REBUILD=false
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=true ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $arg"; usage ;;
  esac
done

if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || [ "$BATCH_SIZE" -lt 1 ]; then
  echo "BATCH_SIZE must be a positive integer" >&2
  exit 1
fi

echo "Preparing graph '$GRAPH_NAME' (rebuild=$REBUILD)..."

if [ "$REBUILD" = true ]; then
  "${DOCKER_PSQL[@]}" <<'SQL'
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ag_graph WHERE name = 'movie_graph') THEN
    PERFORM drop_graph('movie_graph', true);
  END IF;
END$$;
SQL
fi

SQL_TEMPLATE=$(cat <<'SQL'
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

DO $AGE$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ag_graph WHERE name = 'movie_graph') THEN
    PERFORM create_graph('movie_graph');
  END IF;
END$AGE$;

DO $AGE$
BEGIN
  BEGIN PERFORM create_vlabel('movie_graph','User');   EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN PERFORM create_vlabel('movie_graph','Movie');  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN PERFORM create_vlabel('movie_graph','Genre');  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN PERFORM create_vlabel('movie_graph','Person'); EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN PERFORM create_elabel('movie_graph','WATCHED');  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN PERFORM create_elabel('movie_graph','RATED');    EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN PERFORM create_elabel('movie_graph','IN_GENRE'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN PERFORM create_elabel('movie_graph','ACTED_IN'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN PERFORM create_elabel('movie_graph','DIRECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END;
END$AGE$;

DO $AGE$
DECLARE
  bs integer := GREATEST(1, __BATCH_SIZE__::integer);
  total_rows integer;
  offset_rows integer;
  params agtype;
BEGIN
  SELECT count(*) INTO total_rows FROM users WHERE id IS NOT NULL;
  offset_rows := 0;
  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
    FROM (
      SELECT id, username, email, created_at, is_active
      FROM users
      WHERE id IS NOT NULL
      ORDER BY id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM * FROM ag_catalog.cypher('movie_graph', $$
      UNWIND $rows AS row
      MERGE (u:User {user_id: row.id})
      SET u.username = row.username,
          u.email = row.email,
          u.created_at = row.created_at,
          u.is_active = row.is_active
      RETURN count(*)
    $$, params) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;

  SELECT count(*) INTO total_rows FROM movies WHERE tmdb_id IS NOT NULL;
  offset_rows := 0;
  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
    FROM (
      SELECT tmdb_id, title, release_year, vote_avg
      FROM movies
      WHERE tmdb_id IS NOT NULL
      ORDER BY tmdb_id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM * FROM ag_catalog.cypher('movie_graph', $$
      UNWIND $rows AS row
      MERGE (m:Movie {movie_id: row.tmdb_id})
      SET m.title = row.title,
          m.release_year = row.release_year,
          m.vote_avg = row.vote_avg
      RETURN count(*)
    $$, params) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;

  SELECT count(*) INTO total_rows FROM genres WHERE id IS NOT NULL;
  offset_rows := 0;
  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
    FROM (
      SELECT id, name
      FROM genres
      WHERE id IS NOT NULL
      ORDER BY id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM * FROM ag_catalog.cypher('movie_graph', $$
      UNWIND $rows AS row
      MERGE (g:Genre {genre_id: row.id})
      SET g.name = row.name
      RETURN count(*)
    $$, params) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;

  SELECT count(*) INTO total_rows FROM persons WHERE imdb_id IS NOT NULL;
  offset_rows := 0;
  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
    FROM (
      SELECT imdb_id, full_name
      FROM persons
      WHERE imdb_id IS NOT NULL
      ORDER BY imdb_id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM * FROM ag_catalog.cypher('movie_graph', $$
      UNWIND $rows AS row
      MERGE (p:Person {person_id: row.imdb_id})
      SET p.full_name = row.full_name
      RETURN count(*)
    $$, params) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;

  SELECT count(*) INTO total_rows FROM watch_history WHERE user_id IS NOT NULL AND movie_id IS NOT NULL;
  offset_rows := 0;
  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
    FROM (
      SELECT user_id, movie_id, watched_at, progress, source
      FROM watch_history
      WHERE user_id IS NOT NULL AND movie_id IS NOT NULL
      ORDER BY user_id, movie_id, watched_at
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM * FROM ag_catalog.cypher('movie_graph', $$
      UNWIND $rows AS row
      MATCH (u:User {user_id: row.user_id})
      MATCH (m:Movie {movie_id: row.movie_id})
      MERGE (u)-[r:WATCHED {watched_at: row.watched_at}]->(m)
      SET r.progress = row.progress,
          r.source = row.source
      RETURN count(*)
    $$, params) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;

  SELECT count(*) INTO total_rows FROM user_feedback WHERE user_id IS NOT NULL AND movie_id IS NOT NULL;
  offset_rows := 0;
  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
    FROM (
      SELECT user_id, movie_id, rating, review_text, rated_at
      FROM user_feedback
      WHERE user_id IS NOT NULL AND movie_id IS NOT NULL
      ORDER BY user_id, movie_id, rated_at
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM * FROM ag_catalog.cypher('movie_graph', $$
      UNWIND $rows AS row
      MATCH (u:User {user_id: row.user_id})
      MATCH (m:Movie {movie_id: row.movie_id})
      MERGE (u)-[r:RATED]->(m)
      SET r.rating = row.rating,
          r.review_text = row.review_text,
          r.rated_at = row.rated_at
      RETURN count(*)
    $$, params) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;

  SELECT count(*) INTO total_rows FROM movie_genres WHERE movie_id IS NOT NULL AND genre_id IS NOT NULL;
  offset_rows := 0;
  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
    FROM (
      SELECT movie_id, genre_id
      FROM movie_genres
      WHERE movie_id IS NOT NULL AND genre_id IS NOT NULL
      ORDER BY movie_id, genre_id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM * FROM ag_catalog.cypher('movie_graph', $$
      UNWIND $rows AS row
      MATCH (m:Movie {movie_id: row.movie_id})
      MATCH (g:Genre {genre_id: row.genre_id})
      MERGE (m)-[:IN_GENRE]->(g)
      RETURN count(*)
    $$, params) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;

  SELECT count(*) INTO total_rows FROM movie_crew WHERE movie_id IS NOT NULL AND person_id IS NOT NULL AND role IN ('actor','director');
  offset_rows := 0;
  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
    INTO params
    FROM (
      SELECT movie_id, person_id, role, character, ordering
      FROM movie_crew
      WHERE movie_id IS NOT NULL AND person_id IS NOT NULL AND role IN ('actor','director')
      ORDER BY movie_id, person_id, role, ordering
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM * FROM ag_catalog.cypher('movie_graph', $$
      UNWIND $rows AS row
      MATCH (m:Movie {movie_id: row.movie_id})
      MATCH (p:Person {person_id: row.person_id})
      FOREACH (_ IN CASE WHEN row.role = 'actor' THEN [1] ELSE [] END |
        MERGE (p)-[r:ACTED_IN]->(m)
        SET r.character = row.character,
            r.ordering = row.ordering
      )
      FOREACH (_ IN CASE WHEN row.role = 'director' THEN [1] ELSE [] END |
        MERGE (p)-[r:DIRECTED]->(m)
        SET r.ordering = row.ordering
      )
      RETURN count(*)
    $$, params) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END$AGE$;

SELECT 'User'   AS label, count(*) AS total FROM ag_catalog.cypher('movie_graph', $$ MATCH (n:User)   RETURN n $$) AS (n agtype)
UNION ALL
SELECT 'Movie'  AS label, count(*) AS total FROM ag_catalog.cypher('movie_graph', $$ MATCH (n:Movie)  RETURN n $$) AS (n agtype)
UNION ALL
SELECT 'Genre'  AS label, count(*) AS total FROM ag_catalog.cypher('movie_graph', $$ MATCH (n:Genre)  RETURN n $$) AS (n agtype)
UNION ALL
SELECT 'Person' AS label, count(*) AS total FROM ag_catalog.cypher('movie_graph', $$ MATCH (n:Person) RETURN n $$) AS (n agtype)
UNION ALL
SELECT 'WATCHED'  AS label, count(*) AS total FROM ag_catalog.cypher('movie_graph', $$ MATCH ()-[r:WATCHED]->()  RETURN r $$) AS (r agtype)
UNION ALL
SELECT 'RATED'    AS label, count(*) AS total FROM ag_catalog.cypher('movie_graph', $$ MATCH ()-[r:RATED]->()    RETURN r $$) AS (r agtype)
UNION ALL
SELECT 'IN_GENRE' AS label, count(*) AS total FROM ag_catalog.cypher('movie_graph', $$ MATCH ()-[r:IN_GENRE]->() RETURN r $$) AS (r agtype)
UNION ALL
SELECT 'ACTED_IN' AS label, count(*) AS total FROM ag_catalog.cypher('movie_graph', $$ MATCH ()-[r:ACTED_IN]->() RETURN r $$) AS (r agtype)
UNION ALL
SELECT 'DIRECTED' AS label, count(*) AS total FROM ag_catalog.cypher('movie_graph', $$ MATCH ()-[r:DIRECTED]->() RETURN r $$) AS (r agtype)
ORDER BY label;
SQL
)

printf '%s\n' "$SQL_TEMPLATE" | sed "s/__BATCH_SIZE__/$BATCH_SIZE/g" | "${DOCKER_PSQL[@]}"

echo "Graph build completed."
