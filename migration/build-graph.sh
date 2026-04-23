#!/usr/bin/env bash
set -euo pipefail

GRAPH_NAME="movie_graph"
BATCH_SIZE="${BATCH_SIZE:-5000}"

if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || [ "$BATCH_SIZE" -lt 1 ]; then
  echo "BATCH_SIZE must be a positive integer" >&2
  exit 1
fi

time docker exec -i -u root cenimatch-db psql -U u -d cenimatch-db -v ON_ERROR_STOP=1 <<SQL
BEGIN;

CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "\$user", public;

DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM ag_catalog.ag_graph WHERE name = '${GRAPH_NAME}') THEN
    PERFORM ag_catalog.drop_graph('${GRAPH_NAME}', true);
  END IF;

  PERFORM ag_catalog.create_graph('${GRAPH_NAME}');

  PERFORM ag_catalog.create_vlabel('${GRAPH_NAME}', 'User');
  PERFORM ag_catalog.create_vlabel('${GRAPH_NAME}', 'Movie');
  PERFORM ag_catalog.create_vlabel('${GRAPH_NAME}', 'Genre');
  PERFORM ag_catalog.create_vlabel('${GRAPH_NAME}', 'Person');

  PERFORM ag_catalog.create_elabel('${GRAPH_NAME}', 'WATCHED');
  PERFORM ag_catalog.create_elabel('${GRAPH_NAME}', 'RATED');
  PERFORM ag_catalog.create_elabel('${GRAPH_NAME}', 'IN_GENRE');
  PERFORM ag_catalog.create_elabel('${GRAPH_NAME}', 'ACTED_IN');
  PERFORM ag_catalog.create_elabel('${GRAPH_NAME}', 'DIRECTED');
END
\$\$;

-- Users
DO \$\$
DECLARE
  bs integer := ${BATCH_SIZE}::integer;
  total_rows integer;
  offset_rows integer := 0;
  params agtype;
BEGIN
  SELECT count(*) INTO total_rows FROM public.users WHERE id IS NOT NULL;

  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
      INTO params
    FROM (
      SELECT
        id::text AS user_id,
        username,
        email
      FROM public.users
      WHERE id IS NOT NULL
      ORDER BY id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM *
    FROM ag_catalog.cypher(
      '${GRAPH_NAME}'::name,
      \$cypher\$
        UNWIND \$rows AS row
        CREATE (:User {
          user_id: row.user_id,
          username: row.username,
          email: row.email
        })
        RETURN count(*)
      \$cypher\$,
      params
    ) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END
\$\$;

-- Movies
DO \$\$
DECLARE
  bs integer := ${BATCH_SIZE}::integer;
  total_rows integer;
  offset_rows integer := 0;
  params agtype;
BEGIN
  SELECT count(*) INTO total_rows FROM public.movies WHERE tmdb_id IS NOT NULL;

  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
      INTO params
    FROM (
      SELECT
        tmdb_id AS movie_id,
        title,
        release_year,
        vote_avg,
        imdb_rating,
        original_lang,
        runtime_min
      FROM public.movies
      WHERE tmdb_id IS NOT NULL
      ORDER BY tmdb_id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM *
    FROM ag_catalog.cypher(
      '${GRAPH_NAME}'::name,
      \$cypher\$
        UNWIND \$rows AS row
        CREATE (:Movie {
          movie_id: row.movie_id,
          title: row.title,
          release_year: row.release_year,
          vote_avg: row.vote_avg,
          imdb_rating: row.imdb_rating,
          original_lang: row.original_lang,
          runtime_min: row.runtime_min
        })
        RETURN count(*)
      \$cypher\$,
      params
    ) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END
\$\$;

-- Genres
DO \$\$
DECLARE
  bs integer := ${BATCH_SIZE}::integer;
  total_rows integer;
  offset_rows integer := 0;
  params agtype;
BEGIN
  SELECT count(*) INTO total_rows FROM public.genres WHERE id IS NOT NULL;

  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
      INTO params
    FROM (
      SELECT id AS genre_id, name
      FROM public.genres
      WHERE id IS NOT NULL
      ORDER BY id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM *
    FROM ag_catalog.cypher(
      '${GRAPH_NAME}'::name,
      \$cypher\$
        UNWIND \$rows AS row
        CREATE (:Genre {
          genre_id: row.genre_id,
          name: row.name
        })
        RETURN count(*)
      \$cypher\$,
      params
    ) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END
\$\$;

-- Persons
DO \$\$
DECLARE
  bs integer := ${BATCH_SIZE}::integer;
  total_rows integer;
  offset_rows integer := 0;
  params agtype;
BEGIN
  SELECT count(*) INTO total_rows FROM public.persons WHERE imdb_id IS NOT NULL;

  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
      INTO params
    FROM (
      SELECT
        imdb_id AS person_id,
        primary_name AS name
      FROM public.persons
      WHERE imdb_id IS NOT NULL
      ORDER BY imdb_id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM *
    FROM ag_catalog.cypher(
      '${GRAPH_NAME}'::name,
      \$cypher\$
        UNWIND \$rows AS row
        CREATE (:Person {
          person_id: row.person_id,
          name: row.name
        })
        RETURN count(*)
      \$cypher\$,
      params
    ) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END
\$\$;

-- Movie -> Genre
DO \$\$
DECLARE
  bs integer := ${BATCH_SIZE}::integer;
  total_rows integer;
  offset_rows integer := 0;
  params agtype;
BEGIN
  SELECT count(*) INTO total_rows FROM public.movie_genres;

  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
      INTO params
    FROM (
      SELECT movie_id, genre_id
      FROM public.movie_genres
      ORDER BY movie_id, genre_id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM *
    FROM ag_catalog.cypher(
      '${GRAPH_NAME}'::name,
      \$cypher\$
        UNWIND \$rows AS row
        MATCH (m:Movie {movie_id: row.movie_id})
        MATCH (g:Genre {genre_id: row.genre_id})
        CREATE (m)-[:IN_GENRE]->(g)
        RETURN count(*)
      \$cypher\$,
      params
    ) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END
\$\$;

-- User -> Movie (WATCHED), one edge per (user,movie)
DO \$\$
DECLARE
  bs integer := ${BATCH_SIZE}::integer;
  total_rows integer;
  offset_rows integer := 0;
  params agtype;
BEGIN
  SELECT count(*)
    INTO total_rows
  FROM (
    SELECT user_id, movie_id
    FROM public.watch_history
    GROUP BY user_id, movie_id
  ) w;

  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
      INTO params
    FROM (
      SELECT
        user_id::text AS user_id,
        movie_id,
        to_char(max(watched_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS watched_at,
        bool_or(completed) AS completed
      FROM public.watch_history
      GROUP BY user_id, movie_id
      ORDER BY user_id, movie_id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM *
    FROM ag_catalog.cypher(
      '${GRAPH_NAME}'::name,
      \$cypher\$
        UNWIND \$rows AS row
        MATCH (u:User {user_id: row.user_id})
        MATCH (m:Movie {movie_id: row.movie_id})
        CREATE (u)-[:WATCHED {
          watched_at: row.watched_at,
          completed: row.completed
        }]->(m)
        RETURN count(*)
      \$cypher\$,
      params
    ) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END
\$\$;

-- User -> Movie (RATED)
DO \$\$
DECLARE
  bs integer := ${BATCH_SIZE}::integer;
  total_rows integer;
  offset_rows integer := 0;
  params agtype;
BEGIN
  SELECT count(*) INTO total_rows FROM public.user_feedback;

  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
      INTO params
    FROM (
      SELECT
        user_id::text AS user_id,
        movie_id,
        rating,
        coalesce(not_interested, false) AS not_interested,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
      FROM public.user_feedback
      ORDER BY user_id, movie_id
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM *
    FROM ag_catalog.cypher(
      '${GRAPH_NAME}'::name,
      \$cypher\$
        UNWIND \$rows AS row
        MATCH (u:User {user_id: row.user_id})
        MATCH (m:Movie {movie_id: row.movie_id})
        CREATE (u)-[:RATED {
          rating: row.rating,
          not_interested: row.not_interested,
          created_at: row.created_at
        }]->(m)
        RETURN count(*)
      \$cypher\$,
      params
    ) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END
\$\$;

-- Person -> Movie (ACTED_IN)
DO \$\$
DECLARE
  bs integer := ${BATCH_SIZE}::integer;
  total_rows integer;
  offset_rows integer := 0;
  params agtype;
BEGIN
  SELECT count(*)
    INTO total_rows
  FROM public.movie_crew
  WHERE role = 'actor';

  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
      INTO params
    FROM (
      SELECT
        person_id,
        movie_id,
        character,
        ordering
      FROM public.movie_crew
      WHERE role = 'actor'
      ORDER BY person_id, movie_id, ordering NULLS LAST
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM *
    FROM ag_catalog.cypher(
      '${GRAPH_NAME}'::name,
      \$cypher\$
        UNWIND \$rows AS row
        MATCH (p:Person {person_id: row.person_id})
        MATCH (m:Movie {movie_id: row.movie_id})
        CREATE (p)-[:ACTED_IN {character: row.character, ordering: row.ordering}]->(m)
        RETURN count(*)
      \$cypher\$,
      params
    ) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END
\$\$;

-- Person -> Movie (DIRECTED)
DO \$\$
DECLARE
  bs integer := ${BATCH_SIZE}::integer;
  total_rows integer;
  offset_rows integer := 0;
  params agtype;
BEGIN
  SELECT count(*)
    INTO total_rows
  FROM public.movie_crew
  WHERE role = 'director';

  WHILE offset_rows < total_rows LOOP
    SELECT json_build_object('rows', COALESCE(json_agg(row_to_json(t)), '[]'::json))::text::agtype
      INTO params
    FROM (
      SELECT
        person_id,
        movie_id,
        ordering
      FROM public.movie_crew
      WHERE role = 'director'
      ORDER BY person_id, movie_id, ordering NULLS LAST
      LIMIT bs OFFSET offset_rows
    ) t;

    PERFORM *
    FROM ag_catalog.cypher(
      '${GRAPH_NAME}'::name,
      \$cypher\$
        UNWIND \$rows AS row
        MATCH (p:Person {person_id: row.person_id})
        MATCH (m:Movie {movie_id: row.movie_id})
        CREATE (p)-[:DIRECTED {ordering: row.ordering}]->(m)
        RETURN count(*)
      \$cypher\$,
      params
    ) AS (v agtype);

    offset_rows := offset_rows + bs;
  END LOOP;
END
\$\$;

SELECT *
FROM ag_catalog.cypher(
  '${GRAPH_NAME}'::name,
  \$cypher\$ CREATE INDEX ON :User(user_id) \$cypher\$,
  NULL::agtype
) AS (v agtype);

SELECT *
FROM ag_catalog.cypher(
  '${GRAPH_NAME}'::name,
  \$cypher\$ CREATE INDEX ON :Movie(movie_id) \$cypher\$,
  NULL::agtype
) AS (v agtype);

SELECT *
FROM ag_catalog.cypher(
  '${GRAPH_NAME}'::name,
  \$cypher\$ CREATE INDEX ON :Genre(genre_id) \$cypher\$,
  NULL::agtype
) AS (v agtype);

SELECT *
FROM ag_catalog.cypher(
  '${GRAPH_NAME}'::name,
  \$cypher\$ CREATE INDEX ON :Person(person_id) \$cypher\$,
  NULL::agtype
) AS (v agtype);

COMMIT;
SQL
